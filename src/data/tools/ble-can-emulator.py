#!/usr/bin/env python3
"""
BLE 車載機（DrivingCanData）エミュレータ

開発機（Linux）を BLE ペリフェラルとして動作させ、`infra.ble.device` が期待する
車載機になりすまして 12 バイトの CAN パケットを notify する検証用ツール。

仕様根拠:
  proposal #14 (synced) — ツール位置づけ / 広告名・UUID / 12 バイト符号化 /
                          Linux 開発機のみ / アプリ本体は変更しない / 新規依存ゼロ
  proposal #15 (synced) — 2 フェーズ分割と Phase 1 完了ゲート /
                          事前入力シミュレーション型のみ採用 /
                          Phase 1 疎通は cruise.canConnected を使用
  proposal #10 / #12 / #13 (synced) — 入力に使うモックセンサログの正準形

アプリから見て本物の車載機と区別がつかないことが本ツールの要件のため、
アプリ本体（src/data/src/app/**）には一切手を入れない。

依存:
  python3 標準ライブラリ + python3-dbus + PyGObject(GLib) + BlueZ 5.72 の D-Bus API のみ。
  新規 pip / apt パッケージは追加しない（proposal #14 / #15）。

使い方:
  # Phase 1（BLE 接続確立の疎通確認）
  python3 tools/ble-can-emulator.py --source mock/sensor-log.cruise.canConnected.txt.gz

  # Phase 2（シナリオを流す）
  python3 tools/ble-can-emulator.py \\
      --source mock/sensor-log.hard_brake.canConnected.txt.gz --rate-ms 100 --loop

実機側の前提:
  settings.selectedSensorMode は canDataOnly または combination にしておくこと。
  smartphoneOnly では infra.ble.device の接続自体がスキップされる（proposal #15）。
"""

import argparse
import gzip
import json
import sys

import dbus
import dbus.mainloop.glib
import dbus.service
from gi.repository import GLib

# ---------------------------------------------------------------------------
# 定数（すべて proposal #14 / #15 由来）
# ---------------------------------------------------------------------------

#: 広告 LocalName。ble.ts は result.device.name の完全一致で識別するため、
#: この名前でなければアプリに検出されない（proposal #14 §2）
LOCAL_NAME = 'DrivingCanData'

#: Primary Service UUID（0x2310 の 128bit 展開）
SERVICE_UUID = '00002310-0000-1000-8000-00805f9b34fb'

#: Notify Characteristic UUID（0x2311 の 128bit 展開）。プロパティは notify のみ
CHARACTERISTIC_UUID = '00002311-0000-1000-8000-00805f9b34fb'

#: notify するペイロードの固定長 [byte]
PAYLOAD_LEN = 12

#: 送信周期の既定値と可変範囲 [ms]（proposal #14 §4 / #15 §4。暫定値）
DEFAULT_RATE_MS = 100
MIN_RATE_MS = 10
MAX_RATE_MS = 1000

#: 送信フレームを stdout に出す間隔 [件]（proposal #60 §2 / 裁定 instruction）。
#: 既定は 100 件ごと、--verbose 指定時は 10 件ごと（rate-ms=100 で毎秒 4 行）。
SEND_LOG_INTERVAL = 100
VERBOSE_SEND_LOG_INTERVAL = 10

# BlueZ D-Bus の定型名
BLUEZ_SERVICE = 'org.bluez'
DBUS_OM_IFACE = 'org.freedesktop.DBus.ObjectManager'
DBUS_PROP_IFACE = 'org.freedesktop.DBus.Properties'
GATT_MANAGER_IFACE = 'org.bluez.GattManager1'
GATT_SERVICE_IFACE = 'org.bluez.GattService1'
GATT_CHRC_IFACE = 'org.bluez.GattCharacteristic1'
LE_ADVERTISING_MANAGER_IFACE = 'org.bluez.LEAdvertisingManager1'
LE_ADVERTISEMENT_IFACE = 'org.bluez.LEAdvertisement1'
ADAPTER_IFACE = 'org.bluez.Adapter1'

# 本アプリケーションが D-Bus 上に公開するオブジェクトパス
APP_PATH = '/com/maysun/drivingscore/canemu'
SERVICE_PATH = APP_PATH + '/service0'
CHRC_PATH = SERVICE_PATH + '/char0'
ADV_PATH = APP_PATH + '/advertisement0'


# ---------------------------------------------------------------------------
# 12 バイト符号化（proposal #14 §2 — sensor.service のデコードの逆変換）
# ---------------------------------------------------------------------------

def _round_half_up(value):
    """
    仕様の round() は「.5 を上へ」を意図している。Python 組込み round() は
    偶数丸め（banker's rounding）なので、モックログ側（JS の Math.round）と
    食い違わないよう自前で half-up する。

    符号化後の値はオフセット加算により必ず非負になるため floor(x + 0.5) で足りる。
    """
    return int(value + 0.5)


def _clamp(value, lo, hi):
    """各フィールドを u8 / u16 の表現域にクランプする（proposal #14 §2）"""
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def encode_can_data(can):
    """
    canData（物理量）を 12 バイトの CAN パケットに符号化する。

    アプリ側デコード（middleware.sensor.service）の逆変換であること:
        [0]    u8     vehicleSpeed        ×1
        [1]    u8     longAcc             ×0.01 - 1.28
        [2]    u8     latAcc              ×0.01 - 1.28
        [3]    u8     frontDistance       ×0.5
        [4]    u8     lateralDistance     ×0.5 - 64
        [5..6] u16 BE steeringAngle       ×0.1 - 1080
        [7]    u8     accelPedalPosition  ×1
        [8]    u8     brakePressure       ×1
        [9]    u8     brakeSwitch         そのまま
        [10]   u8     shiftIndication     そのまま
        [11]   u8     turnSignal          そのまま
    """
    def u8(raw):
        return _clamp(_round_half_up(raw), 0, 0xFF)

    steering_raw = _clamp(_round_half_up((can.get('steeringAngle', 0.0) + 1080) / 0.1), 0, 0xFFFF)

    payload = bytearray(PAYLOAD_LEN)
    payload[0] = u8(can.get('vehicleSpeed', 0.0))
    payload[1] = u8((can.get('longAcc', 0.0) + 1.28) / 0.01)
    payload[2] = u8((can.get('latAcc', 0.0) + 1.28) / 0.01)
    payload[3] = u8(can.get('frontDistance', 0.0) / 0.5)
    payload[4] = u8((can.get('lateralDistance', 0.0) + 64) / 0.5)
    # offset 5-6 は u16 ビッグエンディアン（アプリ側は getUint16(5, false)）
    payload[5] = (steering_raw >> 8) & 0xFF
    payload[6] = steering_raw & 0xFF
    payload[7] = u8(can.get('accelPedalPosition', 0.0))
    payload[8] = u8(can.get('brakePressure', 0.0))
    payload[9] = u8(can.get('brakeSwitch', 0))
    payload[10] = u8(can.get('shiftIndication', 0))
    payload[11] = u8(can.get('turnSignal', 0))
    return bytes(payload)


# ---------------------------------------------------------------------------
# 送信フレームの可読表示（proposal #60）
# ---------------------------------------------------------------------------

# 列挙値のラベル（proposal #60 §5 — 設計書 docs/運転診断アプリ_詳細設計書_20250228.xlsx 由来）。
# 定義に無い値は "(?)" を表示するだけで、エラーにも警告にもせず送出は継続する
# （エミュレータは入力を忠実に送る役割であり、値域検査は行わない。fact #55 の
#  --inject-invalid で不正値を意図的に送る用途と両立させるため）。
BRAKE_SWITCH_LABELS = {0: 'OFF', 1: 'ON'}
SHIFT_LABELS = {1: 'P', 2: 'R', 3: 'N', 4: 'D', 6: 'L', 7: 'B'}
TURN_SIGNAL_LABELS = {0: 'OFF', 1: 'L', 2: 'R', 3: 'HAZ'}


def _enum_label(raw, labels):
    """列挙値を "生値(ラベル)" 形式にする。未定義値は "生値(?)"（proposal #60 §5）"""
    return '%d(%s)' % (raw, labels.get(raw, '?'))


def decode_can_frame(payload):
    """
    12 バイトを物理量へ復号する（encode_can_data の逆変換 / infra.ble.device）。

    表示は符号化前の canData ではなく **実際に送出するバイト列** を復号して出す
    （proposal #60 §1）。クランプ・量子化の結果がそのまま見えるようにするため。
    """
    steering_raw = (payload[5] << 8) | payload[6]
    return {
        'vehicleSpeed': payload[0],
        'longAcc': payload[1] * 0.01 - 1.28,
        'latAcc': payload[2] * 0.01 - 1.28,
        'frontDistance': payload[3] * 0.5,
        'lateralDistance': payload[4] * 0.5 - 64,
        'steeringAngle': steering_raw * 0.1 - 1080,
        'accelPedalPosition': payload[7],
        'brakePressure': payload[8],
        'brakeSwitch': payload[9],
        'shiftIndication': payload[10],
        'turnSignal': payload[11],
    }


def format_send_lines(sent_count, payload):
    """
    1 フレーム分の出力 4 行を返す（proposal #60 §1）。

    1 行目は現行書式のまま（既存証跡・回帰との突き合わせを壊さないため）。
    2〜4 行目は先頭 3 スペースインデント、区切り " | " のデコード行。
    単位は infra.ble.device.candata.units（proposal #60 §4）。
    """
    head = '[send] #%06d %s' % (sent_count, payload.hex(' '))
    if len(payload) != PAYLOAD_LEN:
        # --inject-invalid（fact #55）で長さ違反を送る場合はデコードできない。
        # 送出そのものは継続させ、hex 行だけを出す。
        return [head, '   (%d バイトのためデコードしません)' % len(payload)]

    d = decode_can_frame(payload)
    return [
        head,
        '   speed %4d km/h | longAcc %+.2f G | latAcc %+.2f G'
        % (d['vehicleSpeed'], d['longAcc'], d['latAcc']),
        '   front %5.1f m   | lateral %+.1f m | steer %+.1f deg'
        % (d['frontDistance'], d['lateralDistance'], d['steeringAngle']),
        '   accel %4d %%    | brake %4d bar | bSw %s shift %s turn %s'
        % (d['accelPedalPosition'], d['brakePressure'],
           _enum_label(d['brakeSwitch'], BRAKE_SWITCH_LABELS),
           _enum_label(d['shiftIndication'], SHIFT_LABELS),
           _enum_label(d['turnSignal'], TURN_SIGNAL_LABELS)),
    ]


# ---------------------------------------------------------------------------
# 入力（proposal #15 §2 — 事前入力シミュレーション型）
# ---------------------------------------------------------------------------

# 10ms 刻みのモックレコードを 100ms の 1 フレームへ集約する単位（proposal #25 / #26）。
# --rate-ms とは連動しない。#25 / #26 は集約数を 10 固定として決定している。
AGGREGATE_RECORDS = 10

# 集約時に区間平均を取るフィールド（proposal #25 の 5 つ + #26 の steeringAngle）
_MEAN_FIELDS = (
    'vehicleSpeed', 'longAcc', 'latAcc', 'frontDistance', 'lateralDistance',
    'steeringAngle',
)

# 集約時に区間先頭の値を採るフィールド
#   brakeSwitch / shiftIndication / turnSignal は列挙値のため（proposal #25）
#   accelPedalPosition / brakePressure は proposal #13 §4 の 3 状態規則が
#   離散値のみを取るため、平均すると規則に存在しない中間値が出る（proposal #26）
_FIRST_FIELDS = (
    'accelPedalPosition', 'brakePressure',
    'brakeSwitch', 'shiftIndication', 'turnSignal',
)


def aggregate_can_records(cans, group=AGGREGATE_RECORDS):
    """
    10ms 刻みの canData を group 件ずつ集約し、100ms 相当の canData を返す
    （proposal #25 / #26）。

    実車載機は 100ms 間隔で canData を送出し、設計書は vehicleSpeed / longAcc /
    latAcc / frontDistance / lateralDistance に「※平均値」と付記している。
    モックは 10ms 刻みなので、10 件を 1 フレームへ畳んで実車と同じ時間軸にする。

    末尾が group で割り切れない場合、残り全部で平均を取る（切り捨てない / #26）。
    """
    out = []
    for start in range(0, len(cans), group):
        window = cans[start:start + group]
        head = window[0]
        merged = dict(head)
        n = len(window)
        for key in _MEAN_FIELDS:
            merged[key] = sum(c.get(key, 0.0) for c in window) / n
        for key in _FIRST_FIELDS:
            merged[key] = head.get(key, 0)
        out.append(merged)
    return out


def load_can_frames(path, raw=False):
    """
    sensor-log.<scenario>.canConnected.txt.gz を読み、sensor.canData を
    12 バイトに符号化したリストを返す。

    既定では 10 レコードを 1 フレームへ集約する（proposal #25 / #26）。
    raw=True のときは 1 レコード = 1 フレームとして集約せずに符号化する。

    canData を持たない生成物（smartphoneOnly）は入力として拒否する（proposal #15 §2）。
    """
    try:
        with gzip.open(path, 'rt', encoding='utf-8') as fp:
            lines = [ln for ln in fp if ln.strip()]
    except FileNotFoundError:
        raise SystemExit('[ERROR] 入力ファイルが見つかりません: %s' % path)
    except OSError as exc:
        raise SystemExit('[ERROR] 入力ファイルを gzip として読めません: %s (%s)' % (path, exc))

    if not lines:
        raise SystemExit('[ERROR] 入力ファイルが空です: %s' % path)

    cans = []
    for lineno, line in enumerate(lines, start=1):
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise SystemExit('[ERROR] %s の %d 行目が JSON として読めません: %s' % (path, lineno, exc))

        can = record.get('sensor', {}).get('canData')
        if can is None:
            raise SystemExit(
                '[ERROR] canData を含まないセンサログは入力にできません: %s (%d 行目)\n'
                '        smartphoneOnly の生成物は canData キー自体を持ちません。\n'
                '        sensor-log.<scenario>.canConnected.txt.gz を指定してください。'
                % (path, lineno)
            )
        cans.append(can)

    if not raw:
        cans = aggregate_can_records(cans)

    # 平均後に #22 の量子化を適用してから符号化する（encode_can_data が floor(x+0.5) で丸める）
    return [encode_can_data(can) for can in cans]


# ---------------------------------------------------------------------------
# GATT サーバ（BlueZ D-Bus API）
# ---------------------------------------------------------------------------

class Application(dbus.service.Object):
    """GattManager1 に登録する GATT アプリケーション（ObjectManager のルート）"""

    def __init__(self, bus):
        self.path = APP_PATH
        self.services = []
        dbus.service.Object.__init__(self, bus, self.path)

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def add_service(self, service):
        self.services.append(service)

    @dbus.service.method(DBUS_OM_IFACE, out_signature='a{oa{sa{sv}}}')
    def GetManagedObjects(self):
        response = {}
        for service in self.services:
            response[service.get_path()] = service.get_properties()
            for chrc in service.characteristics:
                response[chrc.get_path()] = chrc.get_properties()
        return response


class CanService(dbus.service.Object):
    """Primary Service 00002310-...（proposal #14 §2）"""

    def __init__(self, bus):
        self.path = SERVICE_PATH
        self.bus = bus
        self.characteristics = []
        dbus.service.Object.__init__(self, bus, self.path)

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def add_characteristic(self, chrc):
        self.characteristics.append(chrc)

    def get_properties(self):
        return {
            GATT_SERVICE_IFACE: {
                'UUID': SERVICE_UUID,
                'Primary': dbus.Boolean(True),
                'Characteristics': dbus.Array(
                    [c.get_path() for c in self.characteristics], signature='o'
                ),
            }
        }


class CanCharacteristic(dbus.service.Object):
    """
    Notify Characteristic 00002311-...（プロパティは notify のみ / proposal #14 §2）

    アプリ側は startNotifications で購読し、value.buffer をそのまま
    middleware.sensor.service のデコードへ渡す。
    """

    def __init__(self, bus, service, frames, rate_ms, loop_forever, verbose):
        self.path = CHRC_PATH
        self.bus = bus
        self.service = service
        self.frames = frames
        self.rate_ms = rate_ms
        self.loop_forever = loop_forever
        self.verbose = verbose

        self.notifying = False
        self.index = 0
        self.sent_count = 0
        self.timer_id = None
        self.value = dbus.Array([dbus.Byte(0)] * PAYLOAD_LEN, signature='y')

        dbus.service.Object.__init__(self, bus, self.path)

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def get_properties(self):
        return {
            GATT_CHRC_IFACE: {
                'Service': self.service.get_path(),
                'UUID': CHARACTERISTIC_UUID,
                'Flags': dbus.Array(['notify'], signature='s'),
                'Value': self.value,
            }
        }

    # -- D-Bus プロパティ ---------------------------------------------------

    @dbus.service.method(DBUS_PROP_IFACE, in_signature='s', out_signature='a{sv}')
    def GetAll(self, interface):
        if interface != GATT_CHRC_IFACE:
            raise dbus.exceptions.DBusException(
                'org.bluez.Error.InvalidArguments', 'Unknown interface: %s' % interface
            )
        return self.get_properties()[GATT_CHRC_IFACE]

    @dbus.service.signal(DBUS_PROP_IFACE, signature='sa{sv}as')
    def PropertiesChanged(self, interface, changed, invalidated):
        """notify の実体。BlueZ がこのシグナルを見て ATT Notification を送出する"""

    # -- notify 制御 --------------------------------------------------------

    @dbus.service.method(GATT_CHRC_IFACE)
    def StartNotify(self):
        if self.notifying:
            return
        self.notifying = True
        print('[notify] 購読開始（アプリが startNotifications を呼びました）')
        self.timer_id = GLib.timeout_add(self.rate_ms, self._on_tick)

    @dbus.service.method(GATT_CHRC_IFACE)
    def StopNotify(self):
        if not self.notifying:
            return
        self.notifying = False
        if self.timer_id is not None:
            GLib.source_remove(self.timer_id)
            self.timer_id = None
        print('[notify] 購読停止（送信済み %d 件）' % self.sent_count)

    def _on_tick(self):
        """rate_ms ごとに 1 レコード送出する。戻り値 False でタイマ終了"""
        if not self.notifying:
            return False

        if self.index >= len(self.frames):
            if not self.loop_forever:
                print('[notify] 入力を末尾まで送出しました（%d 件）。--loop で繰り返せます。'
                      % self.sent_count)
                self.notifying = False
                self.timer_id = None
                return False
            self.index = 0
            print('[notify] 末尾に到達したため先頭へ戻ります（--loop）')

        payload = self.frames[self.index]
        self.index += 1
        self.sent_count += 1

        self.value = dbus.Array([dbus.Byte(b) for b in payload], signature='y')
        self.PropertiesChanged(GATT_CHRC_IFACE, {'Value': self.value}, [])

        # 出力頻度（proposal #60 §2 + 裁定 implementation_instruction）。
        #   既定       : 1 件目と 100 件ごと
        #   --verbose  : 10 件ごと（1 件目は出す）
        # --verbose を毎フレームにすると rate-ms=100 で毎秒 40 行になり読めないため、
        # 裁定で「秒間 40 → 4（10 回に 1 回）」へ落とすよう指示された。
        interval = VERBOSE_SEND_LOG_INTERVAL if self.verbose else SEND_LOG_INTERVAL
        if self.sent_count == 1 or self.sent_count % interval == 0:
            for line in format_send_lines(self.sent_count, payload):
                print(line)

        return True


# ---------------------------------------------------------------------------
# LE 広告
# ---------------------------------------------------------------------------

class Advertisement(dbus.service.Object):
    """
    LocalName=DrivingCanData の LE 広告（proposal #14 §2）

    アプリは requestLEScan({services: []}) でスキャンし、result.device.name の
    完全一致でのみ識別するため、LocalName が一致しなければ検出されない。
    """

    def __init__(self, bus):
        self.path = ADV_PATH
        self.bus = bus
        dbus.service.Object.__init__(self, bus, self.path)

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def get_properties(self):
        return {
            LE_ADVERTISEMENT_IFACE: {
                'Type': 'peripheral',
                'ServiceUUIDs': dbus.Array([SERVICE_UUID], signature='s'),
                'LocalName': dbus.String(LOCAL_NAME),
                'Includes': dbus.Array([], signature='s'),
            }
        }

    @dbus.service.method(DBUS_PROP_IFACE, in_signature='s', out_signature='a{sv}')
    def GetAll(self, interface):
        if interface != LE_ADVERTISEMENT_IFACE:
            raise dbus.exceptions.DBusException(
                'org.bluez.Error.InvalidArguments', 'Unknown interface: %s' % interface
            )
        return self.get_properties()[LE_ADVERTISEMENT_IFACE]

    @dbus.service.method(LE_ADVERTISEMENT_IFACE)
    def Release(self):
        print('[adv] BlueZ から広告が解放されました')


# ---------------------------------------------------------------------------
# アダプタ準備
# ---------------------------------------------------------------------------

def find_adapter_path(bus, adapter_name):
    """org.bluez.Adapter1 を持つオブジェクトパスを探す"""
    manager = dbus.Interface(bus.get_object(BLUEZ_SERVICE, '/'), DBUS_OM_IFACE)
    for path, ifaces in manager.GetManagedObjects().items():
        if ADAPTER_IFACE not in ifaces:
            continue
        if path.endswith('/' + adapter_name):
            return path
    return None


def power_on_adapter(bus, adapter_path):
    """アダプタの Powered を true にする（既に true なら何もしない）"""
    props = dbus.Interface(bus.get_object(BLUEZ_SERVICE, adapter_path), DBUS_PROP_IFACE)
    if not bool(props.Get(ADAPTER_IFACE, 'Powered')):
        print('[adapter] Powered=false のため電源を入れます')
        props.Set(ADAPTER_IFACE, 'Powered', dbus.Boolean(True))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog='ble-can-emulator.py',
        description='BLE 車載機（DrivingCanData）エミュレータ / proposal #14, #15',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            '例:\n'
            '  # Phase 1（接続確立の疎通確認 / proposal #15 §3）\n'
            '  python3 tools/ble-can-emulator.py \\\n'
            '      --source mock/sensor-log.cruise.canConnected.txt.gz\n'
            '\n'
            '  # Phase 2（急ブレーキシナリオを繰り返し送出）\n'
            '  python3 tools/ble-can-emulator.py \\\n'
            '      --source mock/sensor-log.hard_brake.canConnected.txt.gz --loop\n'
        ),
    )
    parser.add_argument(
        '--source', required=True, metavar='PATH',
        help='入力にする sensor-log.<scenario>.canConnected.txt.gz'
             '（canData を持たない smartphoneOnly は拒否）',
    )
    parser.add_argument(
        '--rate-ms', type=int, default=DEFAULT_RATE_MS, metavar='N',
        help='notify 送信周期 [ms]。既定 %d、範囲 %d〜%d（暫定値 / proposal #14 §4）'
             % (DEFAULT_RATE_MS, MIN_RATE_MS, MAX_RATE_MS),
    )
    parser.add_argument(
        '--loop', action='store_true',
        help='入力の末尾に達したら先頭へ戻って送出を続ける',
    )
    parser.add_argument(
        '--raw', action='store_true',
        help='集約せず 1 レコード = 1 notify で送出する（proposal #25）。'
             'モックは 10ms 刻みなので再生が 1/10 速度になるが、'
             '送出値がモックの canData と 1 対 1 対応するためバイト単位の突き合わせに使える',
    )
    # 以下 2 つは BLE 契約・送出データに影響しない実行上の補助オプション
    parser.add_argument(
        '--adapter', default='hci0', metavar='NAME',
        help='使用する Bluetooth アダプタ名（既定: hci0）',
    )
    parser.add_argument(
        '--verbose', action='store_true',
        help='送出フレームの表示を %d 件ごとに増やす（既定は %d 件ごと / proposal #60）'
             % (VERBOSE_SEND_LOG_INTERVAL, SEND_LOG_INTERVAL),
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # `| tee log.txt` のようにパイプへ流すと既定でブロックバッファリングになり、
    # 進捗が実時間で見えなくなる。監視しながら使うツールなので行バッファに固定する。
    sys.stdout.reconfigure(line_buffering=True)

    if not (MIN_RATE_MS <= args.rate_ms <= MAX_RATE_MS):
        raise SystemExit(
            '[ERROR] --rate-ms は %d〜%d の範囲で指定してください（指定値: %d）'
            % (MIN_RATE_MS, MAX_RATE_MS, args.rate_ms)
        )

    frames = load_can_frames(args.source, raw=args.raw)
    print('[source] %s' % args.source)
    if args.raw:
        print('[source] --raw: 集約せず %d レコードを 12 バイトに符号化しました（先頭: %s）'
              % (len(frames), frames[0].hex(' ')))
        print('[source] 再生はモック時間の 1/10 速度になります'
              '（%d 件 × %dms = 実時間 %.1f 分）'
              % (len(frames), args.rate_ms, len(frames) * args.rate_ms / 60000.0))
    else:
        print('[source] %d レコードを %d 件ずつ集約し %d フレームに符号化しました（先頭: %s）'
              % (len(frames) * AGGREGATE_RECORDS, AGGREGATE_RECORDS, len(frames),
                 frames[0].hex(' ')))
        print('[source] 実時間 %.1f 秒で送出します（%d 件 × %dms）'
              % (len(frames) * args.rate_ms / 1000.0, len(frames), args.rate_ms))

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()

    adapter_path = find_adapter_path(bus, args.adapter)
    if adapter_path is None:
        raise SystemExit(
            '[ERROR] Bluetooth アダプタ %s が見つかりません。'
            'hciconfig で状態を確認してください。' % args.adapter
        )
    power_on_adapter(bus, adapter_path)
    print('[adapter] %s' % adapter_path)

    app = Application(bus)
    service = CanService(bus)
    chrc = CanCharacteristic(
        bus, service, frames, args.rate_ms, args.loop, args.verbose
    )
    service.add_characteristic(chrc)
    app.add_service(service)

    advertisement = Advertisement(bus)

    gatt_manager = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE, adapter_path), GATT_MANAGER_IFACE
    )
    adv_manager = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE, adapter_path), LE_ADVERTISING_MANAGER_IFACE
    )

    mainloop = GLib.MainLoop()

    def on_register_error(kind):
        def handler(error):
            print('[ERROR] %s の登録に失敗しました: %s' % (kind, error))
            mainloop.quit()
        return handler

    gatt_manager.RegisterApplication(
        app.get_path(), {},
        reply_handler=lambda: print('[gatt] service %s / characteristic %s を公開しました'
                                    % (SERVICE_UUID, CHARACTERISTIC_UUID)),
        error_handler=on_register_error('GATT アプリケーション'),
    )
    adv_manager.RegisterAdvertisement(
        advertisement.get_path(), {},
        reply_handler=lambda: print('[adv] LocalName=%s で広告を開始しました' % LOCAL_NAME),
        error_handler=on_register_error('LE 広告'),
    )

    print('[ready] 実機アプリで診断を開始してください。')
    print('[ready] settings.selectedSensorMode は canDataOnly / combination のいずれかにすること。')
    print('[ready] 停止は Ctrl-C。')

    try:
        mainloop.run()
    except KeyboardInterrupt:
        print('\n[stop] 停止します')
    finally:
        chrc.StopNotify()
        try:
            adv_manager.UnregisterAdvertisement(advertisement.get_path())
            gatt_manager.UnregisterApplication(app.get_path())
        except dbus.exceptions.DBusException:
            pass

    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
モックセンサログの geolocation を実機へ流し込む GPS フィーダ

`ble-can-emulator.py` は canData のみを BLE notify で送るため、実機の
`sensor.service.ts` にある全モード共通の GPS ゲート

    if (self.lastGeolocation === null) { return; }   // sensor.service.ts:426

を屋内では越えられず、BLE が正常に届いていてもスコアが 1 件も算出されない。
本ツールは adb の location test provider を使い、同じモックファイルの
geolocation を 1 Hz で投入してこのゲートだけを開ける。

仕様根拠:
  proposal #74 (synced) — 供給手段は adb テストプロバイダ / 投入値はモックの
                          geolocation を軌跡追従 / 周期 1 Hz（100 レコードごと
                          = 60 点）/ 終了時 remove-test-provider 必須 /
                          依存は python3 標準ライブラリ + adb のみ /
                          エミュレータ・アプリ・スコアロジックは変更しない
  proposal #75 (synced) — 投入値は latitude / longitude / accuracy のみ
                          （cmd location は altitude/heading/speed 非対応）/
                          プロバイダは gps のみで fused は登録しない /
                          実行前に MOCK_LOCATION allow、終了時に remove して
                          appops を default へ戻す / lat・lng 欠落は非ゼロ終了
  proposal #62 (synced) — score2 受入は実機 BLE 100ms（repeat=0）経路

score1 / score2 は canData のみから算出され geolocation を参照しないため、
GPS の供給元が実 GNSS かテストプロバイダかは値に影響しない（proposal #74）。
地図表示・ヒヤリ地点座標・車両マーカーの向きの検証は本ツールの対象外
（heading はプラットフォームが投入を受け付けない / proposal #75）。

使い方:
  # 別ターミナルで BLE エミュレータを起動しておき、接続後に本ツールを走らせる
  python3 tools/mock-gps-feeder.py \\
      --source mock/sensor-log.steer_stable.canConnected.txt.gz

  # 登録・投入せず、何を流すかだけ確認する
  python3 tools/mock-gps-feeder.py --source ... --dry-run

終了時（Ctrl-C / 正常終了 / 例外のいずれでも）テストプロバイダを削除し、
appops を default へ戻して原状復帰する。テストプロバイダは実行時のみの登録で、
GNSS ハードウェアにも位置情報設定にも影響しない。
"""

import argparse
import gzip
import json
import signal
import subprocess
import sys
import time

#: 1 点あたりのモックレコード数。モックは 10ms 刻みなので 100 件 = 1 秒
#: （proposal #74「1 秒ごと（10ms 刻み 6000 レコードの 100 件ごと = 60 点）」）
RECORDS_PER_FIX = 100

#: 投入周期 [秒]。実 GNSS の更新周期に合わせる（proposal #74）
FIX_INTERVAL_SEC = 1.0

#: 投入先プロバイダ。gps に入れた mock は fused にも伝播するため、
#: fused を二重に上書きしない（proposal #75 提案 2）
PROVIDER = 'gps'

#: mock location を実行する shell のパッケージ名（proposal #75 提案 3）
SHELL_PACKAGE = 'com.android.shell'

#: geolocation から投入する値。cmd location が受け付けるのはこの 3 つだけで、
#: altitude / heading / speed は非対応（proposal #75 提案 1）
REQUIRED_KEYS = ['latitude', 'longitude']
OPTIONAL_KEY = 'accuracy'


def adb(args, check=True):
    """adb コマンドを 1 つ実行して CompletedProcess を返す"""
    proc = subprocess.run(
        ['adb'] + args,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    if check and proc.returncode != 0:
        raise SystemExit(
            '[ERROR] adb %s に失敗しました (exit=%d)\n%s'
            % (' '.join(args), proc.returncode, proc.stdout.strip())
        )
    return proc


def check_device():
    """adb に実機が 1 台だけつながっていることを確認する"""
    proc = adb(['devices'])
    devices = [
        line.split('\t')[0]
        for line in proc.stdout.splitlines()[1:]
        if line.strip() and line.endswith('\tdevice')
    ]
    if not devices:
        raise SystemExit('[ERROR] adb に実機が接続されていません。')
    if len(devices) > 1:
        raise SystemExit(
            '[ERROR] 実機が複数接続されています: %s\n'
            '        ANDROID_SERIAL を指定して 1 台に絞ってください。'
            % ', '.join(devices)
        )
    return devices[0]


def load_fixes(path):
    """
    モックセンサログから 1 Hz 分の geolocation を取り出す

    10ms 刻みのレコードを RECORDS_PER_FIX 件ごとに 1 点へ間引く。
    latitude / longitude が欠けている点があれば、黙って間引かずに
    その場で非ゼロ終了する（proposal #75 提案 1）。
    """
    try:
        with gzip.open(path, 'rt', encoding='utf-8') as fp:
            lines = fp.read().splitlines()
    except FileNotFoundError:
        raise SystemExit('[ERROR] 入力ファイルが見つかりません: %s' % path)
    except OSError as exc:
        raise SystemExit(
            '[ERROR] 入力ファイルを gzip として読めません: %s (%s)' % (path, exc)
        )

    fixes = []
    for lineno, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        if (lineno - 1) % RECORDS_PER_FIX != 0:
            continue
        index = len(fixes)
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise SystemExit(
                '[ERROR] index=%d (%s の %d 行目) が JSON として読めません: %s'
                % (index, path, lineno, exc)
            )
        geo = record.get('sensor', {}).get('geolocation')
        if geo is None:
            raise SystemExit(
                '[ERROR] index=%d (%s の %d 行目): geolocation がありません'
                % (index, path, lineno)
            )
        missing = [key for key in REQUIRED_KEYS if geo.get(key) is None]
        if missing:
            raise SystemExit(
                '[ERROR] index=%d (%s の %d 行目): geolocation に %s がありません'
                % (index, path, lineno, ' / '.join(missing))
            )
        fixes.append(geo)

    if not fixes:
        raise SystemExit('[ERROR] 入力から geolocation を 1 点も取り出せません: %s' % path)
    return fixes


def location_args(geo):
    """
    set-test-provider-location に渡す引数を組み立てる

    cmd location が受け付けるのは --location と --accuracy のみ。
    altitude / heading / speed は渡さない（proposal #75 提案 1）。
    """
    args = ['--location', '%s,%s' % (geo['latitude'], geo['longitude'])]
    accuracy = geo.get(OPTIONAL_KEY)
    if accuracy is not None:
        args += ['--accuracy', str(accuracy)]
    return args


def allow_mock_location():
    """shell に MOCK_LOCATION を許可する（proposal #75 提案 3）"""
    adb(['shell', 'appops', 'set', SHELL_PACKAGE, 'android:mock_location', 'allow'])
    print('[appops] %s に MOCK_LOCATION を許可しました' % SHELL_PACKAGE)


def reset_mock_location():
    """MOCK_LOCATION の許可を既定へ戻す（proposal #75 提案 3）"""
    proc = adb(['shell', 'appops', 'set', SHELL_PACKAGE,
                'android:mock_location', 'default'], check=False)
    if proc.returncode == 0:
        print('[appops] %s の MOCK_LOCATION を default に戻しました' % SHELL_PACKAGE)
    else:
        print('[appops] default への復帰に失敗しました: %s' % proc.stdout.strip())


def add_provider():
    """テストプロバイダを登録して有効化する"""
    # 前回の登録が残っていることがあるので、先に消してから足す。
    # 未登録での remove はエラーになるため check=False で無視する。
    adb(['shell', 'cmd', 'location', 'providers',
         'remove-test-provider', PROVIDER], check=False)
    adb(['shell', 'cmd', 'location', 'providers',
         'add-test-provider', PROVIDER])
    adb(['shell', 'cmd', 'location', 'providers',
         'set-test-provider-enabled', PROVIDER, 'true'])
    print('[provider] %s をテストプロバイダとして登録・有効化しました' % PROVIDER)


def remove_provider():
    """テストプロバイダを削除して原状復帰する（proposal #74 / #75 で必須）"""
    proc = adb(['shell', 'cmd', 'location', 'providers',
                'remove-test-provider', PROVIDER], check=False)
    if proc.returncode == 0:
        print('[provider] %s のテストプロバイダを削除しました' % PROVIDER)
    else:
        print('[provider] 削除に失敗しました（すでに未登録の可能性）: %s'
              % proc.stdout.strip())


def feed(fixes):
    """1 Hz で geolocation を投入する"""
    total = len(fixes)
    for index, geo in enumerate(fixes):
        adb(['shell', 'cmd', 'location', 'providers',
             'set-test-provider-location', PROVIDER] + location_args(geo),
            check=False)
        print('[fix] #%03d/%03d lat=%s lon=%s acc=%s'
              % (index + 1, total, geo['latitude'], geo['longitude'],
                 geo.get(OPTIONAL_KEY)))
        if index + 1 < total:
            time.sleep(FIX_INTERVAL_SEC)
    print('[fix] 入力の geolocation を最後まで投入しました（%d 点 / %d 秒）。'
          % (total, total))


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description='モックセンサログの geolocation を実機へ 1 Hz で投入する'
                    '（proposal #74 / #75）',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            '例:\n'
            '  python3 tools/mock-gps-feeder.py \\\n'
            '      --source mock/sensor-log.steer_stable.canConnected.txt.gz\n'
        ),
    )
    parser.add_argument(
        '--source', required=True, metavar='PATH',
        help='入力にする sensor-log.<scenario>.canConnected.txt.gz'
             '（ble-can-emulator.py と同じファイルを指定する）',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='テストプロバイダを登録せず、投入予定の点だけ表示して終了する',
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    fixes = load_fixes(args.source)
    print('[source] %s' % args.source)
    print('[source] %d 点の geolocation を %.0f 秒かけて %s へ投入します'
          '（%d レコードごとに 1 点）'
          % (len(fixes), len(fixes) * FIX_INTERVAL_SEC, PROVIDER, RECORDS_PER_FIX))
    print('[source] 先頭: lat=%s lon=%s / 末尾: lat=%s lon=%s'
          % (fixes[0]['latitude'], fixes[0]['longitude'],
             fixes[-1]['latitude'], fixes[-1]['longitude']))

    if args.dry_run:
        for index, geo in enumerate(fixes):
            print('  #%03d %s' % (index + 1, ' '.join(location_args(geo))))
        print('[dry-run] テストプロバイダは登録していません。')
        return 0

    serial = check_device()
    print('[device] %s' % serial)

    # Ctrl-C / SIGTERM のいずれでも finally を通して必ず原状復帰させる
    def on_term(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, on_term)

    allow_mock_location()
    try:
        add_provider()
        print('[ready] 実機アプリで診断を開始してください。停止は Ctrl-C。')
        feed(fixes)
    except KeyboardInterrupt:
        print('\n[stop] 中断されました。')
    finally:
        # 順序は proposal #75: 先に remove-test-provider、続けて appops default
        remove_provider()
        reset_mock_location()
    return 0


if __name__ == '__main__':
    sys.exit(main())

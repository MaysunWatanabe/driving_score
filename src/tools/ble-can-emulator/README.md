# DrivingCanData BLE ペリフェラル・エミュレータ

Linux ホストを、車載機 `DrivingCanData` の代わりの **BLE ペリフェラル**にして、
driving-score アプリ（Android 実機）を実機なしで BLE 接続テストするためのツール。

- Service `0x2310` / Notify Characteristic `0x2311` / ローカル名 `DrivingCanData`
- 12 バイトの合成 CAN フレームを 100ms 周期で Notify（`can-decode.ts` の `decodeCanFrame` と対応）
- 実装: [bumble](https://github.com/google/bumble)（Python BT スタック）を HCI ソケット経由で使用

## 前提
- BlueZ 5.x / LE アドバタイズ対応アダプタ（`bluetoothctl show` の `SupportedInstances` > 0）
- Python venv + bumble（下記セットアップ）

## セットアップ
```bash
cd src/tools/ble-can-emulator
python3 -m venv venv
venv/bin/pip install -r requirements.txt   # or: venv/bin/pip install bumble
```

## 実行（要 sudo）
bumble が HCI アダプタを占有するため、BlueZ を止めてから root で実行する。

### かんたん起動: `run.sh`（推奨）
BlueZ 停止(off) → publish → 終了時に BlueZ 復帰、までを 1 コマンドで行う。

```bash
sudo src/tools/ble-can-emulator/run.sh 0    # 末尾は hci index (省略時 0)
# → [emulator] advertising as "DrivingCanData" ... で待受中
# Ctrl-C で停止すると BlueZ を自動復帰する
```

### 手動起動
```bash
# 1) BlueZ からアダプタを解放
sudo systemctl stop bluetooth

# 2) ペリフェラル起動（hci0 の場合は末尾 0）
sudo src/tools/ble-can-emulator/venv/bin/python \
     src/tools/ble-can-emulator/driving_can_peripheral.py 0

# 終了後に BlueZ を戻す
# sudo systemctl start bluetooth
```

## アプリ側の操作（Android 実機）
1. 設定画面で「利用センサー」を **端末センサーのみ以外**（車載BLE / 併用）にする
   （`smartphoneOnly` では BLE を起動しない）
2. 運転診断画面へ進み「診断開始」→ アプリが `DrivingCanData` をスキャン・接続
3. edit 画面（ブラウザ）や診断中のログで CAN 各項目が変化することを確認

## トラブルシュート
- `Operation not permitted` → root で実行しているか、`sudo systemctl stop bluetooth` 済みか確認
- 実機が見つからない → アプリの sensor mode が `smartphoneOnly` になっていないか、
  アダプタが LE アドバタイズ対応か（`bluetoothctl show`）を確認
- 別の BLE を使いたくなったら `sudo systemctl start bluetooth` で BlueZ を復帰

## BlueZ 復帰 (`restore-bluez.sh`)

`run.sh` は正常終了時 (`Ctrl-C` / SIGTERM) には trap で `bluetooth.service` の
unmask + start を自動実行するが、**SIGKILL・ターミナル強制終了・クラッシュ**では
trap が飛んで `bluetooth.service` が **masked のまま inactive** で残る。
`mask` は永続なので、そのまま reboot しても BlueZ は起動しない。

この状態に陥ったら以下でリカバリする:

```bash
sudo src/tools/ble-can-emulator/restore-bluez.sh
```

スクリプトは:
1. 残っている `driving_can_peripheral` プロセスに SIGTERM
2. `systemctl unmask bluetooth.service`
3. `systemctl start bluetooth.service`
4. `systemctl start obex.service`
5. 最終状態を表示 (`bluetooth.service` active / hci0 UP RUNNING 等)

## フレーム仕様（12 バイト固定・big-endian の舵角）
| offset | field | 変換式 |
|---|---|---|
| 0 | vehicleSpeed | b |
| 1 | longAcc | b*0.01 - 1.28 |
| 2 | latAcc | b*0.01 - 1.28 |
| 3 | frontDistance | b*0.5 |
| 4 | lateralDistance | b*0.5 - 64 |
| 5-6 | steeringAngle (uint16 BE) | v*0.1 - 1080 |
| 7 | accelPedalPosition | b |
| 8 | brakePressure | b |
| 9 | brakeSwitch | b |
| 10 | shiftIndication | b |
| 11 | turnSignal | b |

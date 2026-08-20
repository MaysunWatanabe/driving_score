# モックセンサログ（正準 6 ファイル）

実車・実車載機なしで運転診断を検証するための合成センサログ。
乱数を使わない**決定的生成**で、再生成しても同一バイト列になる。

## 仕様根拠

| proposal | status | 内容 |
|---|---|---|
| #10 | synced | 正準レコードスキーマ / 5 シナリオ / 生成スクリプト / DemoData 件数閾値 0 |
| #12 | synced | scenario × sensorMode 対応 / 出力ファイル名 / mixed・hard_brake・sharp_curve の決定的プロファイル / 端末取付姿勢 / canData 量子化 |
| #13 | synced | T0 = 2026-07-01T10:00:00.000+09:00 固定 / 初期 heading 0.0 / accel_decel の 20s 周期 / accelPedal・brakePressure・brakeSwitch の longAcc ±0.02G 閾値による状態別規則 |
| #22 | synced | 設計書の物理値域を仕様へ昇格し、#12 §7 の量子化と #13 §4 の状態別規則を物理値域内へ改訂 |
| #14, #15 | synced | BLE エミュレータの入力として使う場合の制約 |

仕様の正本は ProjectSmith。記述が Smith の応答と食い違った場合は Smith が正しい。

---

## ファイル一覧

| ファイル | sensorMode | 用途 |
|---|---|---|
| `sensor-log.cruise.canConnected.txt.gz` | canConnected | 減点が出ない基準。全項目 0 固定で目視検算しやすい |
| `sensor-log.accel_decel.canConnected.txt.gz` | canConnected | 加速度系 |
| `sensor-log.hard_brake.canConnected.txt.gz` | canConnected | 急減速・ヒヤリ地点 |
| `sensor-log.sharp_curve.canConnected.txt.gz` | canConnected | 横 G・操舵 |
| `sensor-log.mixed.canConnected.txt.gz` | canConnected | 通し確認（上記を内包） |
| `sensor-log.cruise.smartphoneOnly.txt.gz` | smartphoneOnly | canData キーを持たない |

いずれも **6000 レコード / 60 秒 / 10ms 刻み**。

---

## レコード構造

gzip された JSON Lines。1 行が `JSON.stringify({ date, sensor })`。
`date` は `YYYY-MM-DD HH:mm:ss.SSS`。基準時刻 T0 = `2026-07-01 10:00:00.000`（proposal #13）。

```json
{
  "date": "2026-07-01 10:00:00.000",
  "sensor": {
    "timestamp": 1782867600000,
    "videoTime": 0,
    "geolocation": {
      "latitude": 35.681236, "longitude": 139.767125,
      "accuracy": 5, "altitude": 5, "altitudeAccuracy": 3,
      "heading": 0, "speed": 11.111111111111111, "repeat": 0
    },
    "acceleration": {
      "accelerationIncludingGravity": { "x": 0, "y": 0, "z": 9.80665 },
      "rotationRate": { "beta": 0, "gamma": 0, "alpha": 0 },
      "interval": 10, "repeat": 0
    },
    "gyroscope":    { "beta": 0, "gamma": 0, "alpha": 0, "repeat": 0 },
    "magnetometer": { "x": 0, "y": 30.2, "z": -34.7, "repeat": 0 },
    "canData": {
      "vehicleSpeed": 40, "longAcc": 0, "latAcc": 0,
      "frontDistance": 50, "lateralDistance": 0, "steeringAngle": 0,
      "accelPedalPosition": 40, "brakePressure": 0, "brakeSwitch": 0,
      "shiftIndication": 4, "turnSignal": 0, "repeat": 0
    }
  }
}
```

補足（proposal #10）:

- `smartphoneOnly` は **`canData` キー自体を持たない**（空オブジェクトではなく省略）
- `canConnected` は全 `canData` フィールドを明示する
- `repeat` は合成時すべて **0 固定**
- `speed` は m/s（40 km/h → 11.111… m/s）、`vehicleSpeed` は km/h

DemoData 側の必須フィールドは `videoTime / geolocation / acceleration / gyroscope / magnetometer`。
欠落行はスキップされる。

---

## シナリオ別の値の振れ幅（実測）

| | vehicleSpeed [km/h] | longAcc [G] | latAcc [G] | steeringAngle [deg] | accelPedal [%] | brakePressure [bar] | accelIncGravity.x | accelIncGravity.y | gyroscope.alpha |
|---|---|---|---|---|---|---|---|---|---|
| cruise | 40 固定 | 0 | 0 | 0 | 40 | 0 | 0 | 0 | 0 |
| accel_decel | 0 〜 60 | -0.212 〜 +0.212 | 0 | 0 | 0 〜 100 | 0 〜 126 | 0 | -2.083 〜 +2.083 | 0 |
| hard_brake | 10 〜 60 | -0.472 〜 +0.350 | 0 | 0 | 0 〜 100 | 0 〜 126 | 0 | -4.630 〜 +3.472 | 0 |
| sharp_curve | 40 固定 | 0 | -0.300 〜 +0.300 | -180 〜 +180 | 40 | 0 | -2.942 〜 +2.942 | 0 | 0 〜 38.632 |
| mixed | 0 〜 60 | -0.472 〜 +0.350 | -0.300 〜 +0.300 | -180 〜 +180 | 0 〜 100 | 0 〜 126 | -2.942 〜 +2.942 | -4.630 〜 +3.472 | 0 〜 38.632 |

すべて proposal #22 が確定した物理値域内に収まっている（`accelPedalPosition` 0〜100 %、
`brakePressure` 0〜126 bar、`steeringAngle` ±1080 deg、`frontDistance` 0〜127 m）。

`geolocation.speed` は `vehicleSpeed` に対応（cruise 11.111 m/s 固定、accel_decel / hard_brake / mixed は 0 〜 16.667 m/s）。

値を自分で確認する:

```bash
cd src/data/mock
zcat sensor-log.hard_brake.canConnected.txt.gz | head -1 | python3 -m json.tool
zcat sensor-log.hard_brake.canConnected.txt.gz | wc -l          # 6000
```

---

## 再生成

```bash
cd src/data
node tools/gen-mock-sensorlog.mjs --canonical    # 正準 6 ファイルを一括生成
```

決定的生成なので、再生成しても既存ファイルとバイト単位で一致する。
差分が出た場合は生成器か仕様が変わっている。

---

## 使い方

### A. ブラウザで再生してスコアロジックを確認する

`ui.edit.page`（`/edit`）から取り込んで運転診断を実行する。
BLE スタックは通らない。手順はリポジトリルートの `README.md`「ブラウザでデモ再生する」を参照。

canConnected / smartphoneOnly のどちらも取り込める。

### B. BLE エミュレータの入力にする

開発 PC を BLE ペリフェラル化し、`canData` を 12 バイトに符号化して実機へ notify する。

```bash
cd src/data
python3 tools/ble-can-emulator.py \
    --source mock/sensor-log.cruise.canConnected.txt.gz --loop
```

**`canConnected` の 5 本のみ入力にできる。** `sensor-log.cruise.smartphoneOnly.txt.gz` は
`canData` を持たないため指定するとエラーで停止する（終了コード 1）。

詳細は `src/data/tools/ble-can-emulator.README.txt` を参照。

---

## 検証済みの事項

- 符号化の正しさ: 5 シナリオ 30,000 レコードすべてについて、アプリ側のデコード式で
  逆変換した結果が元の `canData` と完全一致（誤差 0）
- 2026-08-19 の実機検証で、`cruise.canConnected` を BLE 経由で実機に届けられることを確認
  （notify 1066 件 / 平均間隔 100.4ms / 取りこぼし 0.39%）
- 同日、ブラウザで 4 シナリオ（cruise / accel_decel / hard_brake / sharp_curve）を
  `/edit` から取り込み、運転診断が正常終了することを確認

## 値域の是正について（proposal #22）

2026-08-20 まで、`accel_decel` / `hard_brake` / `mixed` の 3 ファイルは
`brakePressure` 最大 200、`accelPedalPosition` 最大 120 という**物理的にあり得ない値**を
含んでいた。原因は proposal #12 §7 が量子化範囲を BLE デコード式から逆算した
バイト値域 `[0,255]` として定め、設計書の物理値域（% 0〜100 / bar 0〜126）を
参照していなかったこと。

proposal #22 で設計書の物理値域を仕様へ昇格し、生成器と正準 6 ファイルを是正した。
状態判定の閾値（longAcc ±0.02G）と 3 状態という構造は #13 のまま変更していない。
値を上限へ丸めただけである。

  加速状態  accelPedalPosition 120 → 100
  減速状態  brakePressure      200 → 126

バイト列が変わったのは上記 3 ファイルのみ。`cruise`（両モード）と `sharp_curve` は
元から値域内だったため不変。

## 既知の未解決事項

- **4 シナリオすべてで総合スコアが 100.00 のまま変化しない。**
  `hard_brake` / `sharp_curve` / `accel_decel` ではログに `[ヒヤリ] 発生!` が出るため、
  値はスコアロジックまで届いている。モックデータ側は上表のとおり仕様どおり振れており、
  データの問題ではない。
  スコア算出の仕様は先方から後日指示される予定のため、それを待って判断する。
  この時点でモックデータの閾値設計を推測で変更してはならない。

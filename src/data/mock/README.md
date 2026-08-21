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
| #32 | synced | canConnected の 5 本を「出車 → 走行 → 駐車」の 1 トリップ構成に変更 |
| #14, #15 | synced | BLE エミュレータの入力として使う場合の制約 |

仕様の正本は ProjectSmith。記述が Smith の応答と食い違った場合は Smith が正しい。

---

## ファイル一覧

| ファイル | sensorMode | 走行区間の特徴 |
|---|---|---|
| `sensor-log.cruise.canConnected.txt.gz` | canConnected | 40 km/h 定速・直進 |
| `sensor-log.accel_decel.canConnected.txt.gz` | canConnected | 加減速の反復 |
| `sensor-log.hard_brake.canConnected.txt.gz` | canConnected | 急減速 3 回・ヒヤリ地点 |
| `sensor-log.sharp_curve.canConnected.txt.gz` | canConnected | 横 G・操舵 |
| `sensor-log.mixed.canConnected.txt.gz` | canConnected | 通し確認（上記を内包） |
| `sensor-log.cruise.smartphoneOnly.txt.gz` | smartphoneOnly | canData キーを持たない。**トリップ構成の対象外** |

いずれも **6000 レコード / 60 秒 / 10ms 刻み**。

---

## トリップ構成（proposal #32）

canConnected の 5 本は **1 トリップとして完結**する。P で始まり P で終わる。

```
 P →|← D ─────────────────────────────────────→|← R ──→|← P
    出車  発進   走行（シナリオ固有）    減速  停止  後退   駐車完了
    0.05D 0.10D  ────── 0.72D ──────  0.81D 0.85D 0.95D   D
                                        ↑            ↑
                                   評価窓の起点    D→R    R→P
```

| 区間 | 比率 | 時刻(D=60s) | shift | 内容 |
|---|---|---|---|---|
| 出車 | 〜0.05D | 0〜3s | 1→4 | P で停止、中間で P→D |
| 発進 | 〜0.10D | 3〜6s | 4 | 0→40 km/h、`longAcc +0.21G` |
| **走行** | 〜0.72D | 6〜43.2s | 4 | **各シナリオの特徴的走行（37.2 秒）** |
| 減速 | 〜0.81D | 43.2〜48.6s | 4 | 40→0 km/h、`longAcc -0.21G` |
| 停止 | 〜0.85D | 48.6〜51s | 4 | 停止保持 |
| 後退 | 〜0.95D | 51〜57s | **2** | 8 km/h まで加速→定速→減速 |
| 駐車完了 | 〜D | 57〜60s | **1** | P で停止保持 |

### なぜトリップ構成にしたか

スコアロジックの `score1`（アクセル/ブレーキ操作の丁寧さ）・`scoreA`（歩行機能）・
`scoreB`（認知機能）は、**駐車行動 D(4)→R(2)→P(1) を検知したときにのみ算出**される。

従来は proposal #12 §7 で `shiftIndication = 4` 固定だったため駐車行動が永久に発火せず、
これらが「未算出」(-1) のままだった。総合スコアは -1 を除いた平均なので、
結果として実機で **100 点固定**に見えていた。

### 評価窓

駐車評価の窓は **D→R の 8 秒前**から始まる（`searchIndex(canDataList, i, 8000)`）。
上表では減速区間と停止区間だけが窓に入り、**シナリオ固有の走行は窓の外**になる。

この配置により `score1` は駐車の巧拙だけを測り、シナリオ間の差は
`score2`（中高速走行のエントロピー）とヒヤリ検知に現れる（#32）。

### 出車について

スコアロジックに **P→D を検知する処理は無い**。出車はスコアに寄与しないが、
トリップとして正しい形であり実機ログとの形式的整合も取れるため入れている。

### `--loop` は使わない

1 トリップで完結する構成のため、途中から繰り返すと P→D→…→P の整合が崩れる。
エミュレータのオプションとしては残っているが、正準シナリオでの使用は非推奨（#32）。

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

トリップ全体（出車・駐車を含む）での実測値。

| | vehicleSpeed [km/h] | longAcc [G] | latAcc [G] | steeringAngle [deg] | accelPedal の出現値 [%] | brakePressure の出現値 [bar] | shift |
|---|---|---|---|---|---|---|---|
| cruise | 0 〜 40 | -0.210 〜 +0.210 | 0 | 0 | 0 / 15 / 40 / 100 | 0 / 60 / 126 | 1, 2, 4 |
| accel_decel | 0 〜 60 | -0.210 〜 +0.210 | 0 | 0 | 0 / 15 / 40 / 100 | 0 / 60 / 126 | 1, 2, 4 |
| hard_brake | 0 〜 60 | -0.470 〜 +0.350 | 0 | 0 | 0 / 15 / 40 / 100 | 0 / 60 / 126 | 1, 2, 4 |
| sharp_curve | 0 〜 40 | -0.210 〜 +0.210 | -0.300 〜 +0.300 | -180 〜 +180 | 0 / 15 / 40 / 100 | 0 / 60 / 126 | 1, 2, 4 |
| mixed | 0 〜 60 | -0.470 〜 +0.210 | -0.300 〜 +0.300 | -180 〜 +180 | 0 / 15 / 40 / 100 | 0 / 60 / 126 | 1, 2, 4 |

`accelPedal` の 15 と `brakePressure` の 60 は後退区間の値。`100` は発進区間。
`shift` に 1(P) と 2(R) が現れるのがトリップ構成の証拠。

すべて proposal #22 が確定した物理値域内に収まっている（`accelPedalPosition` 0〜100 %、
`brakePressure` 0〜126 bar、`steeringAngle` ±1080 deg、`frontDistance` 0〜127 m）。

### 後退区間の longAcc の符号

`scoreLogicFunction.txt:298-299` のコメントに「後退の加速が負の値、減速が正の値」とある。
前進時と符号の意味が逆になるため、後退区間では proposal #13 の 3 状態規則
（`longAcc > +0.02G` なら加速）を適用せず、ペダル・ブレーキ値を直接指定している（#32）。

### スコアへの反映（2026-08-21 実測）

実物の `scoreLogicFunction.txt` に集約後のデータを流し、`score-logic.ts:244-278` と
同じ集計（-1 を除いた平均）を行った結果。

| シナリオ | 総合 | score1 | score2 | 歩行機能 | 認知機能 | ヒヤリ |
|---|---|---|---|---|---|---|
| cruise | 85.13 | 59.66 | 100.00 | 35.57 | 22.01 | 4 |
| accel_decel | 62.82 | 59.66 | 100.00 | 35.57 | 22.01 | 7 |
| hard_brake | 62.81 | 59.65 | 100.00 | 35.57 | 22.00 | 13 |
| sharp_curve | 62.81 | 59.66 | 100.00 | 35.57 | 22.01 | 4 |
| mixed | 62.81 | 59.66 | 100.00 | 35.57 | 22.01 | 8 |

`score1` がほぼ同値なのは駐車プロファイルが全シナリオ共通なため（評価窓の設計どおり）。
シナリオ間の差はヒヤリ件数に出る。

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

## 既知の制約

- **駐車の巧拙を測るデータにはなっていない。** 全シナリオが同一の駐車プロファイルを
  使うため `score1` はほぼ同値になる。駐車評価そのものを検証したい場合は
  専用のモックを別途作る必要がある。
- **`cruise.smartphoneOnly` はスコアが出ない。** canData を持たずトリップ構成の
  対象外であることに加え、`scoreLogicFunction.txt` 冒頭が
  `canDataList.length === 0` で即 return するため。
- スコア算出の仕様は先方から後日指示される予定。評価窓や `shiftIndication` の
  扱いが変われば本トリップ構成は作り直しになる可能性がある。

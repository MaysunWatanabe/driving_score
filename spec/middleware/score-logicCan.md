# middleware.score.logicCan — 車載 CAN 対応本番スコアロジック

## 概要
`assets/data/scoreLogicFunction.txt`（およびリポジトリ直下 `src/scoreLogicFunction.js` の写し）に配布される、車載 CAN データを使う本番用スコアロジック。約 885 行。CAN の `shiftIndication` / `vehicleSpeed` / `steeringAngle` / `turnSignal` / `longAcc` / `latAcc` を主入力に、3 種の判定を行って総合＋4 指標 + 能力指標を算出する。

## 真実源
- `src/data/src/assets/data/scoreLogicFunction.txt`
- 開発参照コピー: `src/scoreLogicFunction.js`
- 実行フレーム: [[middleware.score.logic]]

## 判定 1: 駐車行動 (parkingAction)
- `shiftIndication` の遷移 D→R→P を検出し駐車シーケンスと判定。
- **s1**: D 中の最大減速度
- **s2**: D 中の最大速度
- **s3**: R 中の最大加速度
- それぞれ正規分布 `normDist(x, mean=0, sd)` で係数化した後、
  - `score1 = 0.57*S1 + 0.25*S2 + 0.18*S3`
  - `scoreA = 0.6*S1 + 0.4*S3`
  - `scoreB = 0.42*S1 + 0.34*S2 + 0.24*S3`

## 判定 2: 中高速直進 (midHighSpeedDrive)
- 条件: `vehicleSpeed >= 40 km/h` かつ `turnSignal === 0` かつ `|steeringAngle| <= 15°` が **10 秒継続**。
- 過去 3 点の 2 次テイラー展開で予測した `steeringAngle` と実測値の差の 90 パーセンタイル `α` を求める。
- 9 セル分割で Shannon エントロピー `Hp`（底=9）を計算し、`score2 = (1 - Hp) * 100`。

## 判定 3: ヒヤリ (hiyari)
- `longAcc` と `latAcc` の Jerk（前サンプルとの差分）を 1 次 IIR ローパス（`T=0.05s, F=2Hz`）に通す。
- `|Jerk_LPF| > 0.4 G/s` で発火。1 秒間の再発火を抑止。
- 発火時は `hiyari=true`、`score` の該当項目に減点、`intersection` に近傍交差点名を付ける。

## 総合と能力指標
- `overAll` = 有効スコアの平均（`score1..4` のうち `-1` でないものの平均）。
- `scoreA` = 歩行機能（駐車 s1・s3 中心）、`scoreB` = 注意機能（駐車 s1・s2・s3）、`scoreC` = 視野（実装内で midHighSpeedDrive の Hp を派生に使う変種あり）。

## メッセージ選定 (`getMessage`)
- `scoreLogicJson.messages` から `key/area/score.inclusive_min/exclusive_max` の範囲一致で選定。
- `custom` フィールドが定義されていれば、`custom` 値も完全一致で絞り込み（例: parkingAction の s1/s2/s3 別メッセージ）。
- 該当 message の `text` に `%COUNT`（同 id 出現回数）と `%INTERSECTION`（交差点名）を後段で置換。

## 補助関数
- `searchIndex(list, startIndex, msec)`: `list[startIndex].timestamp - msec` を境に、`repeat===0` のみを対象として一致 index を返す。使い回しサンプル (`repeat >= 1`) はスキップ。
- `normDist(x, mean, sd)`: 標準正規分布密度 × スケーリング（0–1 の範囲）。

## 業務ルール
- **`repeat==0` のサンプルのみ「新規かつ有効」**。1 以上は再送・流用として `searchIndex` などで無視。
- 駐車行動評価は D→R→P 遷移の 1 サイクル完了時に確定し、Score に反映される。以降のシーケンス検出まで score1 は変わらない。
- 判定 2 の連続時間 10 秒はハードコード。閾値は `spec/unknowns.md` に運用ルール確認事項として記載。

## 関連ノード
- 実行フレーム: [[middleware.score.logic]]
- CAN 入力: [[infra.ble.device]] → [[middleware.sensor.service]]
- 対応データ: [[infra.assets.scoreLogicJson]]
- 代替: [[middleware.score.logicSimple]]

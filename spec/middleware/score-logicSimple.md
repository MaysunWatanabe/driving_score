# middleware.score.logicSimple — スマホセンサー版簡易スコアロジック

## 概要
`assets/data/scoreLogicFunction_simple.txt` に配布される、スマホの加速度・ジャイロだけで判定する減点方式の簡易スコアロジック。`localData.negativeScore=100` を初期値に、しきい値を超える挙動が発生すると項目別/総合スコアを減点する。

## 真実源
- `src/data/src/assets/data/scoreLogicFunction_simple.txt`
- 実行フレーム: [[middleware.score.logic]]

## 主要定数
```
NEGATIVE_SCORE          = 8       // 各項目の 1 回あたりの減点
NEGATIVE_OVER_ALL_SCORE = 10      // 総合スコアの 1 回あたりの減点
NEGATIVE_INTERVAL       = 10000   // 同種の再発火抑止 (ms)
RECOVER_TIME            = 20000   // negative がなければ overAll を 100 に戻す (ms)
```

## しきい値
- **アクセル操作 (score1)**: 加速度 `z <= -1.8` で発火
- **ハンドル操作 (score4)**: ジャイロ `|gamma| >= 35` で発火
- ブレーキ (score2) / 速度 (score3) の判定は現状 **コメントアウト**（＝発火しない）

## ロジックの流れ
1. `localData.negativeScore` が未定義なら 100 で初期化。同様に各項目の `lastNegativeAt` を保持する `Map` を初期化。
2. 直近サンプルを対象に各しきい値を評価。発火時は `currentTimestamp - lastNegativeAt < NEGATIVE_INTERVAL` なら抑止。
3. 発火時は `score{i} -= NEGATIVE_SCORE`（下限 0）、`overAll -= NEGATIVE_OVER_ALL_SCORE`。10 秒以内に **2 種以上** の negative が同時に発生していれば `hiyari=true` を返し、`overAll` に追加減点。
4. 直近 `RECOVER_TIME (20 秒)` 以内に negative がなければ `overAll` を 100 に戻す（項目スコアは戻さない）。

## 能力指標 (scoreA/B/C)
- 実装は 1% の確率で `Math.random()*100` を返すダミー。医学的意味は持たない（`spec/unknowns.md` の能力指標項目を参照）。

## 業務ルール
- Simple ロジックは Storage の `driving-score-logic` を [[middleware.score.logic]] が動的評価するため、切替は Storage 上のテキスト差し替えで行う。
- 想定センサーモードは `smartphoneOnly`。CAN 未接続でも動作する。

## 関連ノード
- 実行フレーム: [[middleware.score.logic]]
- 対応データ: [[infra.assets.scoreLogicJson]]（settings/messages を参照）
- 代替: [[middleware.score.logicCan]]

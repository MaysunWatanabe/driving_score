<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:33:02 JST -->

# middleware.score.logicSimple — スマホセンサー版簡易スコアロジック（未配線プロトタイプ）

> **記録方針**: 本ノードは 2026-09-01 時点の**実装実態**の記録である。対象ソース（`scoreLogicFunction_simple.txt`）はコード変更禁止であり、本仕様は「配線する／しない」の意思決定を含まない。

## 概要
`scoreLogicFunction_simple.txt`（394 行）は、スマホの加速度・ジャイロだけで判定する減点方式の簡易スコアロジック。`localData.negativeScore=100` を初期値に、しきい値を超える挙動が発生すると項目別/総合スコアを減点する。

**位置づけ（実装実態）**
- 本ファイルは**未配線の先行プロトタイプ**であり、[[middleware.score.logicCan]] との**補完関係にはない**。
- 版ヘッダ `1736899200000`（2025-01-15）を持つ、**1 世代前の本番ロジック**がアセットとして残置されているもの。
- 2026-09-01 時点で**どこからも参照されていない**（`src/data/src` / `www` bundle / `git log -S` いずれも参照なし）。
- センサーモードによる**ロジック切替の配線は未実装**であり、本記録の対象外。

## 真実源
- `src/data/src/assets/data/scoreLogicFunction_simple.txt`
- 実行フレーム（参照されていれば評価する側）: [[middleware.score.logic]]

## 参照状況（実装実態）
- `opening.page.ts:254` は**常に** `assets/data/scoreLogicFunction.txt` を GET する。
- `score-logic.ts` は `this.scoreLogicFunction` 1 本のみを保持し、`selectedSensorMode` による差替は**未実装**。
- したがって UC11「センサーモード切替」から本ロジックへ到達する経路は現状存在しない。
- 「Storage の `driving-score-logic` テキストを差し替えて Simple に切替える」という運用は**実装されていない**（過去記述の訂正）。

## 主要定数
```
NEGATIVE_SCORE          = 8       // 各項目の 1 回あたりの減点
NEGATIVE_OVER_ALL_SCORE = 10      // 総合スコアの 1 回あたりの減点
NEGATIVE_INTERVAL       = 10000   // 同種の再発火抑止 (ms)
RECOVER_TIME            = 20000   // negative がなければ overAll を 100 に戻す (ms)
```

## しきい値
- **アクセル操作 (score1)**: `accelMinZ <= -1.8` を満たす**走行中**サンプルで発火し減点する。
  - CAN 版 (`score1` = `parkingAction` のシフト遷移評価) とは**評価モデルが異なる**。同一指標名だが値の意味は互換ではない。
- **ハンドル操作 (score4)**: ジャイロ `|gamma| >= 35` で発火。
- ブレーキ (score2) / 速度 (score3) の判定は現状 **コメントアウト**（＝発火しない）。

## ロジックの流れ
1. `localData.negativeScore` が未定義なら 100 で初期化。同様に各項目の `lastNegativeAt` を保持する `Map` を初期化。
2. 直近サンプルを対象に各しきい値を評価。発火時は `currentTimestamp - lastNegativeAt < NEGATIVE_INTERVAL` なら抑止。
3. 発火時は `score{i} -= NEGATIVE_SCORE`（下限 0）、`overAll -= NEGATIVE_OVER_ALL_SCORE`。10 秒以内に **2 種以上** の negative が同時に発生していれば `hiyari=true` を返し、`overAll` に追加減点。
   - CAN 版はヒヤリでスコア値を変更しない（`result.hiyari=true` とメッセージのみ）点で挙動が異なる。
4. 直近 `RECOVER_TIME (20 秒)` 以内に negative がなければ `overAll` を 100 に戻す（項目スコアは戻さない）。

## 能力指標 (scoreA/B/C)
- L364-370 で **1% の確率で `Math.random()*100`** を返すダミー実装。それ以外は設定しない。
- 医学的・運転能力上の意味を持たない（`spec/unknowns.md` の能力指標項目を参照）。

## 業務ルール（実装実態）
- 想定センサーモードは `smartphoneOnly` であり、CAN 未接続でも算出可能な指標のみを扱う設計であった。
- ただし現行フローでは `smartphoneOnly` でも CAN 版ロジックが評価され、`lastCanData` のゼロ埋め（`sensor.service.ts:463-466`）により全指標が発火せず、`scoreList` が空となり全項目 100 の未算出となる（[[middleware.score.logic]] / [[middleware.score.logicCan]] 参照）。本ファイルはその代替として稼働していない。

## 関連ノード
- 実行フレーム: [[middleware.score.logic]]
- 対応データ: [[infra.assets.scoreLogicJson]]（settings/messages を参照。`label3/label4/labelC` が空なのは CAN 版が当該スコアを設定しないことに対応）
- 現行本番ロジック: [[middleware.score.logicCan]]
- センサー入力: [[middleware.sensor.service]]

```json
{
  "required_changes": [
    {"node": "middleware.score.logicSimple", "entrypoint": "spec/middleware/score-logicSimple.md", "description": "未配線プロトタイプである旨・版ヘッダ1736899200000（1世代前本番ロジック）・2026-09-01時点で未参照を明記する"},
    {"node": "middleware.score.logicSimple", "entrypoint": "spec/middleware/score-logicSimple.md", "description": "『Storage のテキスト差し替えで切替』という記述を削除し、opening.page.ts:254 が常に scoreLogicFunction.txt を GET する実装実態に訂正する"},
    {"node": "middleware.score.logicSimple", "entrypoint": "spec/middleware/score-logicSimple.md", "description": "score1 が accelMinZ<=-1.8 の走行中減点であり CAN 版 score1（parkingAction）と評価モデルが異なる旨を追記する"},
    {"node": "middleware.score.logicSimple", "entrypoint": "spec/middleware/score-logicSimple.md", "description": "能力指標 A/B/C が L364-370 の 1% 確率 Math.random()*100 ダミーである旨を行番号付きで明記する"},
    {"node": "middleware.score.logicSimple", "entrypoint": "spec/middleware/score-logicSimple.md", "description": "CAN 版との補完関係ではないこと、切替配線は本記録の対象外であることを位置づけ節に明記する"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "should", "reason": "UC11 センサーモード切替の UI からは Simple ロジックへ到達できないため、設定画面の切替表現が実態と乖離していないか確認が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "本ロジックは未参照のためテスト対象外であり、smartphoneOnly の期待値は CAN 版経由の全項目100（未算出）となる点を試験観点に反映すべき"},
    {"domain": "DB-agent", "severity": "could", "reason": "Storage の driving-score-logic による差替が未実装であるため、当該キーの用途記述の見直しが必要になる可能性がある"}
  ],
  "requirements_context": "middleware.score.logicSimple は scoreLogicFunction_simple.txt（394行）の仕様ノードである。既存要件として、localData.negativeScore=100 を初期値とする減点方式で、NEGATIVE_SCORE=8 / NEGATIVE_OVER_ALL_SCORE=10 / NEGATIVE_INTERVAL=10000ms / RECOVER_TIME=20000ms の定数を持ち、score1 は加速度 accelMinZ<=-1.8、score4 はジャイロ |gamma|>=35 で発火し、score2/score3 の判定はコメントアウトで発火しない。同種の再発火は NEGATIVE_INTERVAL で抑止され、10秒以内に2種以上の negative が同時発生すると hiyari=true を返し overAll に追加減点、直近20秒以内に negative がなければ overAll のみ 100 に復帰する（項目スコアは復帰しない）。能力指標 scoreA/B/C は L364-370 で 1% の確率で Math.random()*100 を返すダミーで医学的意味を持たない。今回の承認済みファクトにより次の点を追加・訂正する：(1) 本ファイルは未配線の先行プロトタイプであり CAN 版との補完関係ではない、(2) 版ヘッダ 1736899200000（2025-01-15）を持つ1世代前の本番ロジックがアセットとして残置されたものである、(3) score1 の accelMinZ<=-1.8 走行中減点は CAN 版 score1（parkingAction のシフト遷移評価）と評価モデルが異なる、(4) 2026-09-01 時点で src/data/src・www bundle・git log -S いずれからも未参照であり、opening.page.ts:254 は常に scoreLogicFunction.txt を GET し score-logic.ts は scoreLogicFunction 1本のみを保持するため selectedSensorMode による差替は未実装、(5) 従来記述の『Storage の driving-score-logic テキスト差し替えで切替』は実装されておらず訂正対象、(6) 切替配線の実装は未実装のまま本記録の対象外。対象ソースはコード変更禁止であり、spec の記述は必ず『実装実態』と明示し、切替を実装する／しないの判断や未算出100の是非は書かない。関連として smartphoneOnly では sensor.service.ts:463-466 の lastCanData ゼロ埋めにより CAN 版の全指標が発火せず scoreList 空＝全項目100の未算出となるため、本ファイルはその代替として稼働していない。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "scoreLogicFunction_simple.txt は未配線の先行プロトタイプである",
      "statement": "scoreLogicFunction_simple.txt はアプリ実行経路から呼び出されない未配線の先行プロトタイプである",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "_simple は CAN 版との補完関係にない",
      "statement": "scoreLogicFunction_simple.txt は scoreLogicFunction.txt（CAN 版）と機能を補完する関係にはない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "_simple は版ヘッダ 1736899200000 の1世代前本番ロジックである",
      "statement": "scoreLogicFunction_simple.txt は版ヘッダ 1736899200000（2025-01-15）を持つ1世代前の本番ロジックがアセットとして残置されたものである",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "_simple は 2026-09-01 時点で未参照である",
      "statement": "2026-09-01 時点で scoreLogicFunction_simple.txt は src/data/src・www bundle・git log -S のいずれからも参照されていない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "センサーモードによるロジック切替配線は未実装である",
      "statement": "selectedSensorMode に応じてスコアロジックを差し替える配線は未実装であり、本ノードの記録対象外である",
      "status": "candidate"
    },
    {
      "type": "api_contract",
      "title": "ロジック取得は常に scoreLogicFunction.txt を GET する",
      "statement": "opening.page.ts:254 は常に assets/data/scoreLogicFunction.txt を GET し、score-logic.ts は scoreLogicFunction 1本のみを保持する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "_simple の score1 は accelMinZ<=-1.8 の走行中減点である",
      "statement": "scoreLogicFunction_simple.txt の score1 は走行中サンプルの accelMinZ<=-1.8 を条件に減点する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "_simple の score1 は CAN 版 score1 と評価モデルが異なる",
      "statement": "scoreLogicFunction_simple.txt の score1 と CAN 版の score1（parkingAction のシフト遷移評価）は評価モデルが異なり値の意味は互換でない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "_simple の能力指標は 1% 確率の乱数ダミーである",
      "statement": "scoreLogicFunction_simple.txt の L364-370 は 1% の確率で scoreA/B/C に Math.random()*100 を返すダミー実装である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "対象ソースはコード変更禁止である",
      "statement": "scoreLogicFunction_simple.txt はコード変更禁止であり、本作業では spec のみを更新する",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "_simple を将来配線するのか、アセットから削除するのかは未確定。判断には Middleware（切替設計）と PO の意思決定が必要で、決まらないとセンサーモード切替 UC11 の実現方式が確定しない。",
    "smartphoneOnly 時に全項目100（未算出）となる現状を許容するかは未確定。Middleware/QA/UI の合意が必要で、決まらないとスコア表示の期待値定義ができない。",
    "_simple の hiyari が overAll を追加減点する一方 CAN 版はスコアを変更しない差異について、どちらが正しい設計意図かは未確定。ロジック設計者の確認が必要。"
  ],
  "rationale_notes": [
    "既存仕様の『Storage の driving-score-logic を動的評価して切替』という記述は実装実態と矛盾するため訂正した。ただし『切替を実装すべき』という判断は仕様に書かず、未実装である事実の記録に留めている。",
    "score1 の名称が CAN 版と共通であるため、同名でも評価対象が異なる点を明示しておかないと将来の比較・移行で誤解が生じる。",
    "能力指標のダミー実装は行番号付きで残し、医学的意味を持たない旨を明示することで、UI 側の表示可否判断の根拠を残す。",
    "smartphoneOnly の未算出100は sensor.service.ts のゼロ埋めに起因するため、本ノードでは因果の参照のみを行い、是非の判断は書かない。"
  ]
}
```
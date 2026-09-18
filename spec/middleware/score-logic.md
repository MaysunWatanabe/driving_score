<!-- 作成: 2026-09-10 17:32:54 JST | 更新: 2026-09-18 18:28:16 JST -->

# middleware.score.logic — 運転診断ロジック実行ランナー

## 概要
`ScoreLogic` は Ionic Storage に保存された **JavaScript 文字列** を `new Function()` で動的に関数化し、`setInterval` (既定 300ms) で実行する運転診断ランナー。センサ配列を蓄積・古いサンプルを削除し、実行結果を [[db.score.model]] の Score へ変換して走行内平均を再計算する。

**実装実態**: 保持するロジック関数スロットは `this.scoreLogicFunction` の **1 本のみ**で、センサモードによる複数ロジックの差替は行われない（後述「ロジック関数の供給経路（実装実態）」参照）。

## 真実源
- `src/data/src/app/data/score-logic.ts`
- `src/data/src/app/pages/opening/opening.page.ts`（ロジック文字列の初期投入元・254 行）
- `src/data/src/assets/data/scoreLogicFunction.txt`（実行される JS 本体）
- `src/data/src/assets/data/scoreLogicFunction_simple.txt`（未配線の残置アセット・版ヘッダ参照用）

## 状態
```
geolocationList / accelerationList / gyroscopeList / magnetometerList / canDataList: Array
scoreLogicFunction: Function       // ロジック関数スロットは1本のみ（実装実態）
scoreLogicLocalData: {}            // ロジック関数間で共有する任意 state
isStart / isPause: boolean
sensorTimer: setInterval id
scoreLogicResultList: Array        // ロジックの生 result（JSON）
scoreList: Array<Score>
startTimestamp: number = -1
lastTimestamp: number = -1
scoreOverAll / score1..4: number = 100   // 走行内平均（初期値 100）
```

## ロジック関数の供給経路（実装実態）
- `opening.page.ts:254` は起動時に **常に** `assets/data/scoreLogicFunction.txt` を GET し、取得した JS 文字列を `environment.scoreLogicKey` として Ionic Storage に保存する。取得先アセットは設定値によって分岐しない。
- `score-logic.ts` はその 1 本を `this.scoreLogicFunction` に格納するのみで、複数ロジックを保持・切り替えるスロットを持たない。
- したがって **`selectedSensorMode` によるロジック関数の差替は未実装**である。`selectedSensorMode` は後述のとおり `scoreLogicJson.settings` に注入されるだけで、どの JS が読み込まれるかには影響しない。
- `assets/data/scoreLogicFunction_simple.txt` は `src/data/src` 内・`www` バンドル・`git log -S` のいずれからも参照が見つからず、実行経路に接続されていない残置アセットである（[[middleware.score.logicSimple]]）。
- **実装実態**: `scoreLogicFunction_simple.txt` は簡易版・補完版として並置されたものではなく、版ヘッダ `1736899200000`（2025-01-15）を持つ **1 世代前の本番ロジック** である。切替が配線されないままアセットとして残置されている。

## `init()`
1. `storage.create()` を await。
2. `storage.get(environment.scoreLogicKey)` で JS 文字列（= `scoreLogicFunction.txt` の内容）を取り出し、`new Function(currentTimestamp, lastTimestamp, geolocationList, accelerationList, gyroscopeList, magnetometerList, canDataList, scoreLogicJson, scoreLogicResultList, localData, log, drawGraph, <body>)` へ変換して `scoreLogicFunction` に保存。
3. `scoreLogicLocalData = {}` にリセット。

## `start(interval, func, drawGraphFunc=null)`
1. `init()` を await。
2. `isStart=true, isPause=false, startTimestamp = Date.now()`、平均スコアを 100 に初期化。
3. `storage.get(environment.scoreLogicJsonKey)` を parse し、`scoreLogicJson.settings.selectedSensorMode` に Storage の `settingSelectedSensorMode` を注入する。**実装実態として、この注入はロジック関数の選択には使われない**（ロジック本体側の参照に委ねられる）。
4. **即座に空の Score を func に渡す**（`setTimeout(0)` で `new Score(null, Date.now())`）。この Score は各スコアフィールドが初期値 100 のまま `scoreList` に積まれる。
5. `setInterval(interval)` で `clearOldData()` → `execScoreLogic(scoreLogicJson, func, drawGraphFunc)` をループ実行。

## `execScoreLogic(scoreLogicJson, func, drawGraphFunc?)`
- `isStart && !isPause` のときのみ実行。
- `currentTimestamp = Date.now()` を計算し、`scoreLogicFunction(currentTimestamp, lastTimestamp, …lists, scoreLogicJson, scoreLogicResultList, scoreLogicLocalData, this.logService, drawGraphCallback)` を呼ぶ。
- 戻り値 `result` を `new Score(result, currentTimestamp)` に変換。
- `lastTimestamp = currentTimestamp` を保存。
- `score.initialize` なら `scoreLogicResultList.push(result)`、`scoreList.push(score)`、`calculator()`、そして `func(score, null)` で呼び出し元に通知。
- 例外時は `logService.error()` と `func(null, error.stack.replace(…))` を通知。stack の `http://localhost` の含まれる箇所を `scoreLogic` に置換して見やすく。

## `calculator()`
- `scoreList` を全走査し、`overAll / score1..4` の平均を再計算。`initialize=false` はスキップ。`-1` の値もスキップ。
- **実装実態**: `start()` が `setTimeout(0)` で積む `new Score(null)`（各スコア初期値 100）は `-1` ではないため平均対象に含まれる。結果として実測式は

  ```
  平均 = (評価窓の合計 + 100) / (評価窓数 + 1)
  ```

  となり、走行開始直後の 100 が常に 1 件混ざる。
- 平均へ混ざるこの初回 100 の出所は `assets/data/scoreLogicFunction.txt` の **105–107 行**である。
- 0 件のスコアフィールドはそのまま前回値を保持（既定 100）。
- 本ノードではロジック本体・集約処理・初期値のいずれも変更しない（実装実態の記録に留める）。

## `pushSensorData(sensorData)`
- `isStart=false` なら return。
- センサ情報を [[middleware.log.service]] の `sensor()` へ流す（`accelerationIncludingGravity.lowPass/rotate`、`gyroscope.rotate` は削除してからログ）。
- `sensorData.calibration` が true（キャリブレーション完了）のときのみ、`geolocation/acceleration/gyroscope/magnetometer/canData` を `timestamp` 付きで各リストに push。

## `clearOldData()` / `spliceList()`
- 現在時刻から `environment.sensorStockTime = 60000ms` より古いサンプルを 5 つのリストからまとめて先頭削除。

## `stop()`
- `clearInterval(sensorTimer)`、`isStart=false, isPause=false`。停止時にスコアをログに出力（`over_all/score1..4`）。

## `pause(status)`
- `isStart=true` のときのみ `isPause=status` を反映。

## `clearAll()`
- `stop()` 相当に加えて `scoreList / scoreLogicResultList / 全センサリスト` をクリア。`startTimestamp=lastTimestamp=-1`。

## `static testScoreLogic(logService, scoreLogicJsonText, scoreLogic): true | string`
- 固定のダミーセンサー（けいゆう病院前交差点付近）で 1 回だけ関数を実行して構文/実行時エラーの有無を確認する。
- 成功時 `true`、失敗時はスタックトレース文字列を返す（http://localhost… は `scoreLogic` に置換）。
- [[ui.settings.page]] と [[ui.edit.page]] が保存前検証に使う。

## 業務ルール
- ロジック関数のシグネチャ:
  ```
  function(
    currentTimestamp, lastTimestamp,
    geolocationList, accelerationList, gyroscopeList, magnetometerList, canDataList,
    scoreLogicJson, scoreLogicResultList, localData,
    log, drawGraph
  ) { … return result; }
  ```
- 出力 `result` のスキーマは [[db.score.model]] の `Score` コンストラクタが受け取る `data`:
  ```
  {
    hiyari: boolean,
    intersection: string,
    drivingScore: {
      score: { overAll, score1..4 },
      messages: [ {id, key, type, message}, ... ]
    },
    capabilityScore: { score: {...}, messages: {...} }
  }
  ```
- ロジック資産は 2 ファイル存在する（[[middleware.score.logicSimple]] / [[middleware.score.logicCan]]）が、**実装実態として実行経路に接続されているのは `scoreLogicFunction.txt`（CAN 版）のみ**であり、`selectedSensorMode` による JS 文字列の差替は行われていない。`_simple` は 1 世代前の本番ロジックの残置であり、現行版との補完関係は持たない。

## 実装実態として記録する既知の不整合（修正は行わない）
以下はいずれも **実装実態の記録のみ**であり、本ノードではコードを 1 行も変更しない。修正の可否は打ち合わせ後に判断する。

- **`score.ts:70-72` の `scoreA` 三重代入**: [[db.score.model]] の `Score` 構築時、`scoreA` に相当する代入が 3 度重なっており、`scoreB` / `scoreC` に入るべき値が上書きされる実装バグがある。ランナー側（`execScoreLogic` → `new Score(...)`）はこの値をそのまま受け取るため、能力指標側の値は本ノード経由でも同じ不整合を引き継ぐ。
- **ラベルと注記の食い違い**: `scoreLogic.json` の `settings.label.labelB` は「注意機能」だが、ロジック側コメントは「認知機能」と記述されている（[[infra.assets.scoreLogicJson]]）。表示文言と実装意図が一致していない状態を記録に留める。
- **ロジック未算出時の 100**: `calculator()` の節に記したとおり、評価窓が 0 件でも各スコアは 100 を保持し、初期 Score の 100 が平均に 1 件混ざる。この挙動を是とするかは未確定であり、本ノードでは判断しない。

## 関連ノード
- 依存: [[db.score.model]]、[[middleware.log.service]]、[[infra.assets.scoreLogicJson]]
- 関連ロジック資産: [[middleware.score.logicCan]]（実行経路）、[[middleware.score.logicSimple]]（未配線・1 世代前）
- 呼び出し元: [[ui.driving.page]]、[[ui.edit.page]]、[[ui.settings.page]]（`testScoreLogic`）、[[ui.opening.page]]（ロジック文字列の初期投入）

```json
{
  "required_changes": [
    {"node": "middleware.score.logic", "entrypoint": "spec/middleware/score-logic.md", "description": "_simple が版ヘッダ1736899200000(2025-01-15)の1世代前本番ロジックである実装実態、初回100の出所(scoreLogicFunction.txt:105-107)の明示、score.ts:70-72 の scoreA 三重代入バグと labelB『注意機能』/コメント『認知機能』食い違いを『記録のみ・修正は打ち合わせ後』として追記"}
  ],
  "suggested_impacts": [
    {"domain": "DB-agent", "severity": "should", "reason": "score.ts:70-72 の scoreA 三重代入により scoreB/scoreC が上書きされる実装バグは db.score.model 側の仕様本文にも実装実態として記録が必要"},
    {"domain": "UI-agent", "severity": "could", "reason": "能力指標ラベル(labelB=注意機能)と実装コメント(認知機能)の食い違い、および走行直後の平均へ初回100が混ざる挙動は表示側の解釈に影響する"}
  ],
  "requirements_context": "middleware.score.logic は Ionic Storage 上の JS 文字列を new Function() 化し既定300ms周期で評価する運転診断ランナー。UC06(運転診断の実行)/UC10(スコアロジック・辞書の更新)/UC12(編集とデモ再生)が対象。承認済み design_decision 2 件に従い、本更新は実装実態の spec 反映のみでコード変更は一切禁止（scoreLogicFunction.txt / scoreLogicFunction_simple.txt / scoreLogic.json / score-logic.ts / sensor.service.ts / opening.page.ts を含め 1 行も変更しない）。反映内容: (1) opening.page.ts:254 が常に assets/data/scoreLogicFunction.txt を GET し、score-logic.ts は this.scoreLogicFunction 1 本のみを保持するため selectedSensorMode による差替は未実装、scoreLogicFunction_simple.txt は src/data/src・www バンドル・git log -S いずれからも未参照。(2) _simple は簡易版ではなく版ヘッダ 1736899200000（2025-01-15）の 1 世代前本番ロジックであり、切替未配線のまま残置されたアセットで CAN 版と補完関係にない。(3) calculator() は initialize=false と -1 を除外して平均するが、start() が setTimeout(0) で積む new Score(null)（各スコア初期値100）は -1 でないため平均対象となり、実測式は (評価窓合計+100)/(窓数+1)。0 件フィールドは前回値（既定100）を保持し、初回100の出所は scoreLogicFunction.txt:105-107。(4) score.ts:70-72 の scoreA 三重代入は実装バグとして記録するが修正は打ち合わせ後、labelB『注意機能』とロジック側コメント『認知機能』の食い違いも記録のみ。文面は必ず『実装実態』と明示し、切替を実装する/しないの方針、未算出100の是非、proposal #62 の受入可否は記述しない。既存記述（関数シグネチャ、result スキーマ、testScoreLogic、センサ蓄積 pushSensorData/clearOldData、stop/pause/clearAll、真実源、関連ノード）は維持する。なお 2026 年度改修（レーダーチャート6項目5段階、前回=履歴平均など）に伴う 6 項目の採点データ形式は未確定で、既存のスコアロジック凍結は解除されていない。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "_simple は1世代前の本番ロジックである", "statement": "scoreLogicFunction_simple.txt は版ヘッダ 1736899200000（2025-01-15）を持つ1世代前の本番ロジックであり、簡易版や補完版ではない", "status": "candidate"},
    {"type": "data_semantics", "title": "_simple は切替未配線のまま残置されている", "statement": "scoreLogicFunction_simple.txt は切替が配線されないままアセットとして残置されており、実行経路に接続されていない", "status": "candidate"},
    {"type": "data_semantics", "title": "初回100の出所は scoreLogicFunction.txt:105-107", "statement": "走行内平均に混ざる初回100の出所は assets/data/scoreLogicFunction.txt の105-107行である", "status": "candidate"},
    {"type": "business_rule", "title": "score.ts:70-72 の scoreA 三重代入は実装バグである", "statement": "src/data/src/app/data/score.ts:70-72 は scoreA に相当する代入を3度重ねており、scoreB/scoreC に入るべき値が上書きされる", "status": "candidate"},
    {"type": "constraint", "title": "scoreA 三重代入の修正は打ち合わせ後に判断する", "statement": "score.ts:70-72 の scoreA 三重代入は実装実態として記録するのみで、修正は打ち合わせ後まで行わない", "status": "candidate"},
    {"type": "data_semantics", "title": "labelB とロジック側コメントの文言が食い違う", "statement": "scoreLogic.json の settings.label.labelB は『注意機能』だがロジック側コメントは『認知機能』と記述されており、記録のみで修正しない", "status": "candidate"},
    {"type": "constraint", "title": "本更新はコードを1行も変更しない", "statement": "本更新は spec のみを対象とし、scoreLogicFunction.txt / scoreLogicFunction_simple.txt / scoreLogic.json / score-logic.ts / sensor.service.ts / opening.page.ts を1行も変更しない", "status": "candidate"},
    {"type": "business_rule", "title": "走行内平均の実測式", "statement": "走行内平均は (評価窓の合計 + 100) / (評価窓数 + 1) となり、開始直後の初期スコア100が常に1件混ざる", "status": "candidate"},
    {"type": "business_rule", "title": "selectedSensorMode によるロジック差替は未実装", "statement": "selectedSensorMode は scoreLogicJson.settings に注入されるのみで、読み込まれる JS 文字列の選択には使われない", "status": "candidate"}
  ],
  "open_questions": [
    "selectedSensorMode によるロジック差替を実装すべきか（設計意図）は未確定。方針が決まらないと score-logicSimple / logicCan の役割定義と設定画面の意味づけが確定しない。Middleware と UI の合意が必要。",
    "ロジック未算出時に100が平均へ混ざる挙動を是とするかは未確定。Middleware / QA / UI の合意が必要で、決まらないと走行直後の平均値の受入基準が定まらない。",
    "score.ts:70-72 の scoreA 三重代入を修正する範囲と時期が未確定。DB(Score モデル)側の責務であり、修正すると既存保存済み能力指標値との整合が問われる。",
    "2026 年度改修のレーダーチャート6項目（筋力・柔軟性・空間把握・危険予測・視力・視野、1〜5 段階）に対し、現行ランナーが返す overAll/score1..4 および capabilityScore をどう対応づけるかが未確定。6 項目の採点データ形式が先方検討中でスコアロジック凍結も解除されていないため、本ノードでは判断しない。",
    "scoreLogicFunction_simple.txt を残置し続けるかはアセット管理（Infra）側の判断が必要。"
  ],
  "rationale_notes": [
    "承認済み design_decision に従い、本更新は『実装実態』の記録に限定し、切替実装の可否・未算出100の是非・proposal #62 の受入可否には一切言及していない。",
    "score.ts の scoreA 三重代入と labelB/コメント食い違いは他ドメイン（DB / Infra）の一次責務だが、ランナー経由で値がそのまま伝播するため本ノードにも『既知の不整合』節として参照を残した。",
    "_simple の版ヘッダ情報は『簡易版ロジック』という誤解を招く従来記述を正すために明記した。旧記述はロジック名の字面に引かれた推測であり、実装実態と一致しない。",
    "start() の初期 Score 投入は呼び出し元へ即時に描画用データを渡すための挙動であり、その副作用として平均に1件加算される点を calculator() 節に併記した。",
    "ロジック関数の供給経路は score-logic.ts 単体では読み取れないため、opening.page.ts を真実源に含め独立した節として維持した。"
  ]
}
```
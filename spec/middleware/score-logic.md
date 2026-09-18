<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:32:54 JST -->

# middleware.score.logic — 運転診断ロジック実行ランナー

## 概要
`ScoreLogic` は Ionic Storage に保存された **JavaScript 文字列** を `new Function()` で動的に関数化し、`setInterval` (既定 300ms) で実行する運転診断ランナー。センサ配列を蓄積・古いサンプルを削除し、実行結果を [[db.score.model]] の Score へ変換して走行内平均を再計算する。

**実装実態**: 保持するロジック関数スロットは `this.scoreLogicFunction` の **1 本のみ**で、センサモードによる複数ロジックの差替は行われない（後述「ロジック関数の供給経路（実装実態）」参照）。

## 真実源
- `src/data/src/app/data/score-logic.ts`
- `src/data/src/app/pages/opening/opening.page.ts`（ロジック文字列の初期投入元・254 行）
- `src/data/src/assets/data/scoreLogicFunction.txt`（実行される JS 本体）

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
- 平均へ混ざるこの初回 100 の出所は `assets/data/scoreLogicFunction.txt` の 105–107 行である。
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
- ロジック資産は 2 ファイル存在する（[[middleware.score.logicSimple]] / [[middleware.score.logicCan]]）が、**実装実態として実行経路に接続されているのは `scoreLogicFunction.txt`（CAN 版）のみ**であり、`selectedSensorMode` による JS 文字列の差替は行われていない。

## 関連ノード
- 依存: [[db.score.model]]、[[middleware.log.service]]、[[infra.assets.scoreLogicJson]]
- 呼び出し元: [[ui.driving.page]]、[[ui.edit.page]]、[[ui.settings.page]]（`testScoreLogic`）、[[ui.opening.page]]（ロジック文字列の初期投入）

```json
{
  "required_changes": [
    {"node": "middleware.score.logic", "entrypoint": "spec/middleware/score-logic.md", "description": "ロジック関数スロットが1本のみでselectedSensorModeによる差替が未実装である実装実態と、calculator()の実測平均式 (評価窓合計+100)/(窓数+1) を追記"}
  ],
  "suggested_impacts": [
    {"domain": "DB-agent", "severity": "could", "reason": "new Score(null) の各スコア初期値100がScoreモデル側の初期化仕様に依存するため参照整合の確認が望ましい"},
    {"domain": "UI-agent", "severity": "could", "reason": "走行開始直後に表示される平均値へ初回100が1件混ざる実装実態を表示仕様側でも認識しておく必要がある"}
  ],
  "requirements_context": "middleware.score.logic は Ionic Storage に保存された JS 文字列を new Function() 化し、既定300ms周期で評価する運転診断ランナー。UC06(運転診断の実行)/UC10(スコアロジック・辞書の更新)/UC12(編集とデモ再生)が対象。今回の要件は承認済みファクトの実装実態を仕様本文へ反映することのみで、コード変更は一切禁止（spec のみ更新）。反映内容は(1)opening.page.ts:254 が常に assets/data/scoreLogicFunction.txt を GET し、score-logic.ts は this.scoreLogicFunction 1 本のみを保持するため selectedSensorMode によるロジック差替は未実装、scoreLogicFunction_simple.txt は src/data/src・www バンドル・git log -S いずれからも未参照である旨、(2)calculator() は start() が setTimeout(0) で積む new Score(null)（各スコア初期値100、-1 ではないため平均対象）により実測式が (評価窓合計+100)/(窓数+1) となり、0件フィールドは前回値（既定100）を保持する旨、初回100の出所は scoreLogicFunction.txt:105-107 である旨。ロジック本体・集約処理・初期値は変更しない。文面は必ず『実装実態』と明示し、切替を実装する/しないの方針、未算出100の是非、関連 proposal の受入可否は記述しない。既存記述（シグネチャ、result スキーマ、testScoreLogic、センサ蓄積・clearOldData、stop/pause/clearAll 等）は維持する。",
  "fact_candidates": [
    {"type": "business_rule", "title": "ロジック文字列は常に scoreLogicFunction.txt から取得される", "statement": "opening.page.ts:254 は起動時に常に assets/data/scoreLogicFunction.txt を GET し、取得した JS 文字列を Storage の scoreLogicKey に保存する", "status": "candidate"},
    {"type": "constraint", "title": "ロジック関数スロットは1本のみ", "statement": "score-logic.ts はロジック関数を this.scoreLogicFunction の1スロットのみで保持し、複数ロジックを同時に保持しない", "status": "candidate"},
    {"type": "business_rule", "title": "selectedSensorMode によるロジック差替は未実装", "statement": "selectedSensorMode は scoreLogicJson.settings に注入されるのみで、読み込まれる JS 文字列の選択には使われない", "status": "candidate"},
    {"type": "data_semantics", "title": "scoreLogicFunction_simple.txt は未参照アセット", "statement": "assets/data/scoreLogicFunction_simple.txt は src/data/src・www バンドル・git log -S のいずれからも参照されていない", "status": "candidate"},
    {"type": "business_rule", "title": "start() は初期スコアを scoreList に積む", "statement": "start() は setTimeout(0) で new Score(null, Date.now()) を生成し、各スコアフィールドが初期値100のまま scoreList に積まれる", "status": "candidate"},
    {"type": "business_rule", "title": "calculator() は -1 以外を平均する", "statement": "calculator() は initialize=false のスコアと値 -1 のフィールドを除外して overAll/score1..4 の平均を算出する", "status": "candidate"},
    {"type": "business_rule", "title": "走行内平均の実測式には初回100が1件含まれる", "statement": "走行内平均は (評価窓の合計 + 100) / (評価窓数 + 1) となり、開始直後の初期スコア100が常に1件混ざる", "status": "candidate"},
    {"type": "data_semantics", "title": "初回100の出所", "statement": "平均に混ざる初回100の出所は assets/data/scoreLogicFunction.txt の105-107行である", "status": "candidate"},
    {"type": "business_rule", "title": "0件フィールドは前回値を保持する", "statement": "評価対象が0件のスコアフィールドは前回値（既定100）を保持する", "status": "candidate"},
    {"type": "constraint", "title": "本更新はコード変更を伴わない", "statement": "ロジック本体・集約処理・スコア初期値は変更せず、仕様本文の実装実態記録のみを更新する", "status": "candidate"}
  ],
  "open_questions": [
    "selectedSensorMode によるロジック差替を実装すべきか（設計意図）は未確定であり、本ノードでは判断しない。方針が決まらないと score-logicSimple/logicCan の役割定義と設定画面の意味づけが確定しない。",
    "未算出時に100が平均へ混ざる挙動を是とするかは未確定であり、判断には Middleware/QA/UI の合意が必要。決まらないと走行直後の平均値の受入基準が定まらない。",
    "scoreLogicFunction_simple.txt を残置し続けるかの扱いは Infra/アセット管理側の判断が必要。"
  ],
  "rationale_notes": [
    "承認済みファクトに従い、本更新は『実装実態』の明示に限定し、切替実装の可否・未算出100の是非・関連 proposal の受入可否には言及していない。",
    "start() の初期 Score 投入は呼び出し元へ即時に描画用データを渡すための挙動であり、その副作用として平均計算に1件加算される点を calculator() 節に併記した。",
    "ロジック関数の供給経路は score-logic.ts 単体では読み取れないため、opening.page.ts を真実源に追加し独立した節として明示した。"
  ]
}
```
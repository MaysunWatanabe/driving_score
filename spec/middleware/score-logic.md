# middleware.score.logic — 運転診断ロジック実行ランナー

## 概要
`ScoreLogic` は Ionic Storage に保存された **JavaScript 文字列** を `new Function()` で動的に関数化し、`setInterval` (既定 300ms) で実行する運転診断ランナー。センサ配列を蓄積・古いサンプルを削除し、実行結果を [[db.score.model]] の Score へ変換して走行内平均を再計算する。

## 真実源
- `src/data/src/app/data/score-logic.ts`

## 状態
```
geolocationList / accelerationList / gyroscopeList / magnetometerList / canDataList: Array
scoreLogicFunction: Function
scoreLogicLocalData: {}            // ロジック関数間で共有する任意 state
isStart / isPause: boolean
sensorTimer: setInterval id
scoreLogicResultList: Array        // ロジックの生 result（JSON）
scoreList: Array<Score>
startTimestamp: number = -1
lastTimestamp: number = -1
scoreOverAll / score1..4: number = 100   // 走行内平均（初期値 100）
```

## `init()`
1. `storage.create()` を await。
2. `storage.get(environment.scoreLogicKey)` で JS 文字列を取り出し、`new Function(currentTimestamp, lastTimestamp, geolocationList, accelerationList, gyroscopeList, magnetometerList, canDataList, scoreLogicJson, scoreLogicResultList, localData, log, drawGraph, <body>)` へ変換して `scoreLogicFunction` に保存。
3. `scoreLogicLocalData = {}` にリセット。

## `start(interval, func, drawGraphFunc=null)`
1. `init()` を await。
2. `isStart=true, isPause=false, startTimestamp = Date.now()`、平均スコアを 100 に初期化。
3. `storage.get(environment.scoreLogicJsonKey)` を parse し、`scoreLogicJson.settings.selectedSensorMode` に Storage の `settingSelectedSensorMode` を注入。
4. **即座に空の Score を func に渡す**（`setTimeout(0)` で `new Score(null, Date.now())`）。
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
- 0 件のスコアフィールドはそのまま前回値を保持（既定 100）。

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
- ロジック本体は 2 系統: [[middleware.score.logicSimple]] と [[middleware.score.logicCan]]。設定 `selectedSensorMode` で切り替える運用（実装では JS 文字列そのものを差し替える）。

## 関連ノード
- 依存: [[db.score.model]]、[[middleware.log.service]]、[[infra.assets.scoreLogicJson]]
- 呼び出し元: [[ui.driving.page]]、[[ui.edit.page]]、[[ui.settings.page]]（`testScoreLogic`）

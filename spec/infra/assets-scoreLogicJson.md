# infra.assets.scoreLogicJson — スコアメッセージ辞書 & 交差点マスタ JSON

## 概要
運転診断結果に対するアドバイス文言・スコア切替閾値・アプリ挙動設定・交差点マスタを 1 つに束ねた JSON。バージョン管理を持ち、[[ui.opening.page]] の起動時 `saveDefaultScoreLogicJson()` が `version` を比較して新しい場合のみ Ionic Storage の `score-logic-json` に上書きする。

## 真実源
- `src/data/src/assets/data/scoreLogic.json`

## スキーマ
```
{
  "version": 0.33,
  "settings": {
    "order_of_message": 0,               // 0: positive→negative, 1: negative→positive
    "label": {
      "label1": "アクセル/ブレーキ操作の丁寧さ",
      "label2": "ハンドル操作の安定性",
      "label3": "",
      "label4": "",
      "labelA": "歩行機能",
      "labelB": "注意機能",
      "labelC": ""
    },
    "score_logic_interval_ms": 300,
    "capability_score_target_days": 30,
    "score_show_star": {
      "area1": true,   // 総合スコアを星表示（false は 101-score の順位表示）
      "area2": true,   // 個別スコア(score1..4)
      "area3": true    // 能力指標(scoreA/B/C)
    }
  },
  "intersection": [
    { "lat": 35.46025745017747, "lon": 139.63377896689911, "name": "けいゆう病院前" },
    { "lat": 35.45776663871314, "lon": 139.6292854209744,  "name": "美術館北" },
    { "lat": 35.457197986054815,"lon": 139.62824315430478, "name": "いちょう通り西" },
    { "lat": 35.45859958746394, "lon": 139.62689607379784, "name": "みなとみらい四丁目" },
    { "lat": 35.462708141169635,"lon": 139.6265617618472,  "name": "とちのき通り西" }
  ],
  "messages": [
    {
      "id": 100,
      "key": "over_all" | "score1" | "score2" | "score3" | "score4" | "capabilityA/B/C",
      "type": "positive" | "negative",
      "area": "all" | ...,
      "score": { "inclusive_min": 0, "exclusive_max": 40 },
      "message": "…% INTERSECTION、% COUNT 回…",
      "custom": string (省略可)
    },
    ...
  ]
}
```

## メッセージ選定
- スコアが `inclusive_min <= score < exclusive_max` の範囲にあるものが候補。
- `custom` 指定がある場合、`getMessage()` は `custom` 値が一致するもののみを候補にする（[[middleware.score.logicCan]] の判定内で使う）。
- `%COUNT` は同一 `id` の出現回数、`%INTERSECTION` は交差点名で置換（履歴では `%INTERSECTION` は空文字に）。

## 起動時の更新ルール
- 端末側 Storage に既存の JSON があるとき、`oldJson.version` が未定義または `newJson.version >= oldJson.version` なら上書き。
- 上書き対象は `environment.scoreLogicJsonKey`（'score-logic-json'）。
- `parse` 例外があれば無視して既存のまま。

## 業務ルール
- 交差点マスタは横浜みなとみらい周辺 5 交差点のみ（実証実験範囲）。将来拡張の方針は `spec/unknowns.md` を参照。
- ロジック本体（JS）は [[middleware.score.logic]] の Storage キー `driving-score-logic` にあり、辞書と分離することでロジックとメッセージを独立に差し替えられる。

## 関連ノード
- 参照元: [[middleware.login.service]]（`initialize()` で settings をパース）、[[middleware.score.logic]]（動的評価時に scoreLogicJson として渡す）、[[ui.opening.page]]（初期配布）、[[ui.settings.page]]（アップロード・保存）

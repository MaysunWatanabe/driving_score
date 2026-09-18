<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:36:38 JST -->

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

## settings.label の意味（実装実態・承認済みファクト）
- `label1` = 「アクセル/ブレーキ操作の丁寧さ」
- `label2` = 「ハンドル操作の安定性」
- `labelA` = 「歩行機能」
- `labelB` = 「注意機能」
- `label3` / `label4` / `labelC` は**空文字**。これは [[middleware.score.logicCan]]（`scoreLogicFunction.txt`）が `score3` / `score4` / `scoreC` を一切設定しないという実装実態と対応する。設定される指標は `score1` / `score2` / `overAll` / `scoreA` / `scoreB` のみ。
- したがって空ラベルは「未定義の欠落」ではなく、**算出されない指標に対応する意図的な空値**として扱う（表示側は空ラベルの指標を非表示にする責務を持つ）。
- `labelB` の値「注意機能」と、コード内コメントに現れる「認知機能」の表記は食い違っている。これは**記録のみ**とし、JSON もコードも修正しない（承認済み方針）。

> 本節は実装実態の記述であり、指標追加・ラベル補完・表記統一の是非は本ノードでは判断しない。

## メッセージ選定
- スコアが `inclusive_min <= score < exclusive_max` の範囲にあるものが候補。
- `custom` 指定がある場合、`getMessage()` は `custom` 値が一致するもののみを候補にする（[[middleware.score.logicCan]] の判定内で使う）。
- `%COUNT` は同一 `id` の出現回数、`%INTERSECTION` は交差点名で置換（履歴では `%INTERSECTION` は空文字に）。
- `score3` / `score4` / `capabilityC` を `key` に持つメッセージ定義が存在しても、対応スコアが算出されないため実行時に選定されることはない（実装実態）。

## 起動時の更新ルール
- 端末側 Storage に既存の JSON があるとき、`oldJson.version` が未定義または `newJson.version >= oldJson.version` なら上書き。
- 上書き対象は `environment.scoreLogicJsonKey`（'score-logic-json'）。
- `parse` 例外があれば無視して既存のまま。

## 業務ルール
- 交差点マスタは横浜みなとみらい周辺 5 交差点のみ（実証実験範囲）。将来拡張の方針は `spec/unknowns.md` を参照。
- ロジック本体（JS）は [[middleware.score.logic]] の Storage キー `driving-score-logic` にあり、辞書と分離することでロジックとメッセージを独立に差し替えられる。
- 辞書（本 JSON）とロジック（`scoreLogicFunction.txt`）はバージョン整合の保証機構を持たない。`settings.label` の空値とロジックが設定するスコアの対応は運用（配布時の人手確認）で担保される。

## 配布・更新経路
- 初期配布: アプリ同梱アセット `assets/data/scoreLogic.json` → [[ui.opening.page]] が version 比較で Storage へ書き込み。
- 実験時更新（UC10）: [[ui.settings.page]] からのアップロード・保存で Storage を直接上書き。アセット同梱版より低い `version` を配布した場合、次回起動時にアセット版で上書きされ得る点に注意。

## 関連ノード
- 参照元: [[middleware.login.service]]（`initialize()` で settings をパース）、[[middleware.score.logic]]（動的評価時に scoreLogicJson として渡す）、[[middleware.score.logicCan]]（`custom` 一致によるメッセージ絞り込み・スコア設定範囲）、[[ui.opening.page]]（初期配布）、[[ui.settings.page]]（アップロード・保存）

```json
{
  "required_changes": [
    {"node": "infra.assets.scoreLogicJson", "entrypoint": "spec/infra/assets-scoreLogicJson.md", "description": "settings.label の各ラベル意味を明記し、label3/label4/labelC が空であることを CAN 版が score3/score4/scoreC を設定しない実装実態と対応づけて記載する"},
    {"node": "infra.assets.scoreLogicJson", "entrypoint": "spec/infra/assets-scoreLogicJson.md", "description": "labelB『注意機能』とコード内コメント『認知機能』の食い違いを記録のみとし修正しない方針を明記する"},
    {"node": "infra.assets.scoreLogicJson", "entrypoint": "spec/infra/assets-scoreLogicJson.md", "description": "score3/score4/capabilityC を key に持つメッセージは実行時に選定されない旨をメッセージ選定節に追記する"},
    {"node": "infra.assets.scoreLogicJson", "entrypoint": "spec/infra/assets-scoreLogicJson.md", "description": "辞書とロジックのバージョン整合保証機構が無く運用担保である点、および配布・更新経路（アセット同梱 vs 設定画面アップロード）の上書き関係を追記する"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "should", "reason": "空ラベル（label3/label4/labelC）に対応する指標の表示可否は UI 側の表示責務であり、非表示ルールの明記が必要"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "settings.label の空値は scoreLogicFunction.txt が score3/score4/scoreC を設定しない実装実態と対応するため、ロジック側仕様と記述整合が必要"},
    {"domain": "QA-agent", "severity": "could", "reason": "labelB『注意機能』とコメント『認知機能』の表記差異はテスト期待値の混乱要因となるため記録の共有が望ましい"}
  ],
  "requirements_context": "scoreLogic.json はアドバイス文言（messages）、スコア切替閾値、アプリ挙動設定（settings）、交差点マスタ（intersection）を単一 JSON に束ねた配布アセットであり、真実源は src/data/src/assets/data/scoreLogic.json。version を持ち、ui.opening.page の saveDefaultScoreLogicJson() が起動時に Storage(score-logic-json / environment.scoreLogicJsonKey) の既存 version と比較し、既存 version 未定義または新 version >= 旧 version の場合のみ上書きする。parse 例外時は既存を維持。UC07 ではスコアに応じたメッセージ選定（inclusive_min <= score < exclusive_max、custom 一致時は custom 候補のみ、%COUNT は同一 id 出現回数、%INTERSECTION は交差点名／履歴では空文字）に使用され、UC10 では ui.settings.page からのアップロード・保存で更新される。承認済みファクトとして、settings.label は label1=アクセル/ブレーキ操作の丁寧さ、label2=ハンドル操作の安定性、labelA=歩行機能、labelB=注意機能であり、label3/label4/labelC は空である。この空値は CAN 版ロジック（scoreLogicFunction.txt）が score1/score2/overAll/scoreA/scoreB のみを設定し score3/score4/scoreC を設定しない実装実態と対応する意図的な空値であって欠落ではない。labelB の値『注意機能』とコード内コメント『認知機能』の食い違いは記録のみとし、JSON もコードも修正しない。対象ソース（scoreLogic.json 等）は1行も変更せず spec のみ更新する。交差点マスタは横浜みなとみらい周辺5交差点（けいゆう病院前・美術館北・いちょう通り西・みなとみらい四丁目・とちのき通り西）に限定され実証実験範囲を表す。ロジック本体 JS は middleware.score.logic の Storage キー driving-score-logic に別置され、辞書とロジックを独立に差し替え可能とする分離設計だが、両者のバージョン整合を保証する機構は存在せず運用で担保する。settings は middleware.login.service の initialize() でパースされ、score_show_star により総合/個別/能力指標の星表示と 101-score 順位表示が切り替わる。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "scoreLogic.json の真実源はアプリ同梱アセットである",
      "statement": "スコアメッセージ辞書・settings・交差点マスタの真実源は src/data/src/assets/data/scoreLogic.json である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "settings.label1 はアクセル/ブレーキ操作の丁寧さである",
      "statement": "settings.label.label1 の値は「アクセル/ブレーキ操作の丁寧さ」である",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "settings.label2 はハンドル操作の安定性である",
      "statement": "settings.label.label2 の値は「ハンドル操作の安定性」である",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "settings.labelA は歩行機能である",
      "statement": "settings.label.labelA の値は「歩行機能」である",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "settings.labelB は注意機能である",
      "statement": "settings.label.labelB の値は「注意機能」である",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "label3 / label4 / labelC は空文字である",
      "statement": "settings.label の label3 / label4 / labelC は空文字であり、CAN 版ロジックが score3 / score4 / scoreC を設定しないことと対応する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "labelB とコード内コメントの表記差異は修正しない",
      "statement": "settings.label.labelB「注意機能」とコード内コメント「認知機能」の食い違いは記録のみとし、JSON およびコードを修正してはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "本件対応でコードを変更してはならない",
      "statement": "本ノードの仕様更新において scoreLogic.json を含む対象ソースを1行も変更してはならない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "起動時の辞書上書きは version 比較で行われる",
      "statement": "ui.opening.page の saveDefaultScoreLogicJson() は Storage 上の旧 version が未定義または新 version >= 旧 version のときのみ score-logic-json を上書きする",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "JSON パース失敗時は既存値を維持する",
      "statement": "scoreLogic.json のパースに失敗した場合は例外を無視し Storage の既存値を維持する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "辞書の Storage キーは score-logic-json である",
      "statement": "スコア辞書の保存先は environment.scoreLogicJsonKey が示す Ionic Storage キー 'score-logic-json' である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "ロジック本体は辞書と別キーで保存される",
      "statement": "スコアロジック本体（JS）は Storage キー 'driving-score-logic' に保存され、辞書 JSON とは分離して差し替えられる",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "メッセージ候補はスコア範囲で絞り込まれる",
      "statement": "メッセージ候補は inclusive_min <= score < exclusive_max を満たすものとし、custom 指定がある場合は custom 値が一致するものに限定される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "プレースホルダは置換される",
      "statement": "メッセージ中の %COUNT は同一 id の出現回数に、%INTERSECTION は交差点名（履歴表示では空文字）に置換される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "交差点マスタは実証実験範囲の5交差点に限定される",
      "statement": "intersection は横浜みなとみらい周辺の5交差点（けいゆう病院前・美術館北・いちょう通り西・みなとみらい四丁目・とちのき通り西）のみを含む",
      "status": "candidate"
    },
    {
      "type": "assumption",
      "title": "辞書とロジックのバージョン整合は運用担保である",
      "statement": "scoreLogic.json とスコアロジック本体のバージョン整合を検証する機構はアプリ内に存在せず、配布時の人手確認で担保される",
      "status": "assumption"
    }
  ],
  "open_questions": [
    "label3 / label4 / labelC が空のとき、UI は該当指標領域を非表示にするのか空ラベルで表示するのか未確定。ui.result / ui.history 側の表示責務判断が必要で、決まらないとスコア表示のレイアウト仕様と QA 期待値が確定しない。",
    "settings.score_show_star.area2 / area3 は score3/score4/scoreC が算出されない前提でも true のままで良いのか未確定。UI/Middleware の表示責務判断が必要で、未算出指標の星表示有無に影響する。",
    "scoreLogic.json 内に score3 / score4 / capabilityC を key に持つメッセージ定義が実際に残存しているかは未検証。残存していれば恒久デッドデータとなり、辞書メンテナンス方針（削除するか記録のみか）の判断が必要。",
    "ui.settings.page からアップロードした辞書がアセット同梱版より低い version の場合、次回起動時にアセット版へ巻き戻る挙動が UC10（実験時の辞書更新）で許容されるか未確定。運用・QA 判断が必要で、実験中の辞書差し替え手順に影響する。",
    "labelB「注意機能」とコメント「認知機能」のどちらが正なのかは業務側（診断指標定義）の確認が必要。決まらないと外部報告資料・UI 文言・QA 期待値の表記統一ができない。",
    "交差点マスタを実証実験範囲外へ拡張する場合の配布方式（アセット再ビルド / 設定画面アップロード / サーバ配信）が未確定。運用・インフラ判断が必要で、辞書更新のリリース手順に影響する。"
  ],
  "rationale_notes": [
    "本ノードは辞書アセットの構造・配布経路・更新ルールに責務を限定し、スコアの算出可否や未算出時の値（100 など）の是非は middleware 側の論点として扱わない。",
    "label3 / label4 / labelC の空値を『欠落』ではなく『算出されない指標に対応する意図的な空値』と位置づけたのは、承認済みファクトで CAN 版ロジックが score1/score2/overAll/scoreA/scoreB のみを設定すると確認されているため。",
    "labelB とコメントの表記差異は仕様・コードいずれも変更しない方針が承認済みのため、仕様書では『記録のみ』と明示し、読み手が誤って修正しないよう注記を残した。",
    "辞書（JSON）とロジック（JS）を別 Storage キーで分離する設計は、メッセージ文言のみを実験中に差し替え可能にするための意図的な構成。ただし整合検証機構が無いため、運用手順側でのバージョン管理が前提となる。",
    "配布経路をアセット同梱と設定画面アップロードの2系統として明記したのは、version 比較による巻き戻りリスクが UC10 の運用に直接影響するため。",
    "インフラ観点での必要条件は『アプリ同梱アセットとして JSON が配置されること』『Ionic Storage が利用可能であること』の2点に留まり、追加の外部サービスやパーミッションは不要。"
  ]
}
```
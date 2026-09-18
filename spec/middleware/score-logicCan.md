<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:34:27 JST -->

# middleware.score.logicCan — 車載 CAN 対応本番スコアロジック

## 概要
`assets/data/scoreLogicFunction.txt`（開発参照コピー: リポジトリ直下 `src/scoreLogicFunction.js`）として配布される、車載 CAN データを使う**現在アプリ内で実行される唯一のスコアロジック**。約 885 行。CAN の `shiftIndication` / `vehicleSpeed` / `steeringAngle` / `turnSignal` / `longAcc` / `latAcc` を主入力に、**駐車行動**と**中高速直進**の 2 判定でスコアを算出し、加えて**ヒヤリ**を検出する。

> 本ドキュメントは **実装実態の記録** である。設計意図・将来案ではない。以下に記載する誤りの訂正（4 指標算出／ヒヤリ減点／scoreC=Hp 派生）は、実装バグ・未実装を含めて「現状こうである」として読むこと。対象ソースは 1 行も変更しない方針（コード変更禁止）。

## 真実源
- `src/data/src/assets/data/scoreLogicFunction.txt`
- 開発参照コピー: `src/scoreLogicFunction.js`
- 実行フレーム: [[middleware.score.logic]]
- Score モデル: `score.ts`

## 設定されるスコア項目（実装実態）
本ロジックが値を設定するのは以下の 5 項目のみ。

| 項目 | 設定箇所 | 算出元 |
| --- | --- | --- |
| `score1` | L811 | parkingAction（駐車行動）のみ |
| `score2` | L834 | midHighSpeedDrive（中高速直進のハンドル安定性）のみ |
| `scoreA` | L824 | parkingAction（D→R→P）のみ |
| `scoreB` | L828 | parkingAction（D→R→P）のみ |
| `overAll` | L876 | 有効スコアの平均 |

- **`score3` / `score4` / `scoreC` は本ロジックでは一切設定されない（未設定）。**
- したがって「4 指標を算出する」「ヒヤリで減点する」「`scoreC` は midHighSpeedDrive の `Hp` から派生する」という従来記述は**誤り**であり、実装実態に合わせて訂正した。設計意図としても残さない。
- `scoreLogic.json` の `settings.label` において `label3` / `label4` / `labelC` が空であることは、この未設定と対応している（[[infra.assets.scoreLogicJson]]）。
- 実装バグ記録: `score.ts:70-72` で `scoreA` に対する**三重代入**が行われている（`scoreB` / `scoreC` へ代入すべき箇所が `scoreA` になっている）。**記録のみとし、修正は打ち合わせ後**とする。コードは変更しない。
- 名称の食い違い記録: `labelB` は「注意機能」だが、コード内コメントは「認知機能」。記録のみ。

## 判定 1: 駐車行動 (parkingAction) → `score1` / `scoreA` / `scoreB`
`shiftIndication` の**シフト遷移のみ**を根拠に算出する（走行中の加減速などは score1 に寄与しない）。

- 検出シーケンス: **D → R → P**
- 評価窓
  - **D→R 遷移の直前 8 秒**を D 区間の評価窓とする。
  - **R→D（切り返し）**も遷移として検出・評価対象に含める。
  - **P 到達で当該駐車を確定**する。
  - 1 診断中に**駐車が複数回**成立した場合は、各回の結果を**平均**する。
- 特徴量
  - **s1**: D 区間（直前 8 秒）の最大減速度
  - **s2**: D 区間（直前 8 秒）の最大速度
  - **s3**: R 区間の最大加速度
- 係数化: 各特徴量を正規分布 `normDist(x, mean=0, sd)` で 0–1 に写像（`S1` / `S2` / `S3`）。
- 合成
  - `score1 = 0.57*S1 + 0.25*S2 + 0.18*S3`（L811）
  - `scoreA = 0.6*S1 + 0.4*S3`（L824）
  - `scoreB = 0.42*S1 + 0.34*S2 + 0.24*S3`（L828）
- **`scoreA` / `scoreB` も駐車（D→R→P）のみが算出根拠**であり、中高速直進やヒヤリは寄与しない。
- P 到達による確定までは `score1` / `scoreA` / `scoreB` は更新されない（次シーケンス確定まで値は不変）。

## 判定 2: 中高速直進 (midHighSpeedDrive) → `score2`
**ハンドル安定性**のみを評価する。

- 発火ゲート（すべて同時成立が **10 秒継続**）
  - `vehicleSpeed >= 40 km/h`
  - `turnSignal === 0`（ウィンカ非点灯）
  - `|steeringAngle| <= 15°`
- サンプリング
  - ソースコメントには **50ms** と記載されているが、**実装は `repeat === 0` の全件**を用いる（実測周期は 10ms もしくは 100ms）。コメントと実装が食い違っている点は記録のみとし、コメント・コードは変更しない。
- 算出
  - 過去 3 点の 2 次テイラー展開で予測した `steeringAngle` と実測値の差から、その 90 パーセンタイル `alpha` を求める。
  - 9 セル分割の Shannon エントロピー `Hp`（底 = 9）を `calculateEntropy` で計算し、`score2 = (1 - Hp) * 100`（L834）。
  - **`calculateEntropy` は `alpha` を使用していない**ため、`score2` は**舵角ばらつきの振幅に依存しない**（分布形状のみに依存する）。
- 既存ログ所見（記録のみ・コード化しない）
  - 既存の `accel_decel` / `hard_brake` / `mixed` ログは、いずれも **10 秒継続ゲートに僅差で未達**であり `score2` が発火しない。ゲート緩和や条件変更は行わない。

## 判定 3: ヒヤリ (hiyari) → スコアには影響しない
- `longAcc` と `latAcc` の Jerk（前サンプルとの差分）を 1 次 IIR ローパス（`T=0.05s, F=2Hz`）に通す。
- `|Jerk_LPF| > 0.4 G/s` で発火。発火後 1 秒間は再発火を抑止。
- 発火時の処理は **L843-845** で `result.hiyari = true` を立て、**メッセージ（および近傍交差点名 `intersection`）を設定するのみ**。
- **スコア値は一切変更しない（減点しない）。** 「ヒヤリ減点」は誤り。

## 総合 (`overAll`)
- `overAll` = `score1..score4` のうち **`-1` でない項目の平均**（L876）。
- 実装実態として `score3` / `score4` は常に未設定であるため、実質 `score1` / `score2` の有効分のみが平均対象となる。
- フレーム側の挙動: `start()` が `setTimeout(0)` で `new Score(null)`（各スコア初期値 100、`scoreLogicFunction.txt:105-107`）を積むため、**初回 100 が 1 件混ざる**。結果として実測式は `(評価窓合計 + 100) / (窓数 + 1)` となる（詳細は [[middleware.score.logic]]）。
- 全指標が未発火の場合、L871-874 が `null` を返し `scoreList` が空となり、**全項目 100 の「未算出」**として扱われる。

## smartphoneOnly モードでの挙動（実装実態）
- `sensor.service.ts:463-466` で `lastCanData` がゼロ埋めされる（`shiftIndication = 0` 等）。
- そのため **parkingAction / midHighSpeedDrive / hiyari の全指標が発火しない**。
- 結果として L871-874 が `null` を返し、**全項目 100 の未算出**となる。
- `selectedSensorMode` によるロジック差替（`scoreLogicFunction_simple.txt` への切替）は**未実装**であり、`opening.page.ts:254` は常に `assets/data/scoreLogicFunction.txt` を GET する。詳細は [[middleware.score.logic]] / [[middleware.sensor.service]]。

## メッセージ選定 (`getMessage`)
- `scoreLogicJson.messages` から `key` / `area` / `score.inclusive_min` / `score.exclusive_max` の範囲一致で選定。
- `custom` フィールドが定義されていれば `custom` 値も完全一致で絞り込み（例: parkingAction の s1 / s2 / s3 別メッセージ）。
- 該当 message の `text` に `%COUNT`（同 id 出現回数）と `%INTERSECTION`（交差点名）を後段で置換。
- ヒヤリはスコアを動かさないため、ヒヤリ関連の出力は**メッセージと地点情報のみ**。

## 補助関数
- `searchIndex(list, startIndex, msec)`: `list[startIndex].timestamp - msec` を境に、**`repeat === 0` のみ**を対象として一致 index を返す。使い回しサンプル（`repeat >= 1`）はスキップ。
- `normDist(x, mean, sd)`: 標準正規分布密度 × スケーリング（0–1 の範囲）。
- `calculateEntropy(...)`: 9 セル分割の Shannon エントロピー。引数 `alpha` は**未使用**。

## 業務ルール
- **`repeat == 0` のサンプルのみ「新規かつ有効」**。1 以上は再送・流用として `searchIndex` などで無視。
- 駐車行動評価は D→R→P の 1 サイクル完了（P 到達）時に確定する。
- 判定 2 の連続時間 10 秒・速度 40km/h・舵角 15° はハードコード。閾値の妥当性は `spec/unknowns.md` に運用ルール確認事項として記載。
- 本ロジック・関連アセット（`scoreLogicFunction.txt` / `scoreLogicFunction_simple.txt` / `scoreLogic.json` / `score-logic.ts` / `sensor.service.ts` / `opening.page.ts` / `score.ts`）は**コード変更禁止**。仕様側の記録のみで運用する。

## 関連ノード
- 実行フレーム: [[middleware.score.logic]]
- CAN 入力: [[infra.ble.device]] → [[middleware.sensor.service]]
- 対応データ: [[infra.assets.scoreLogicJson]]
- 先行プロトタイプ（未配線・CAN 版と補完関係ではない）: [[middleware.score.logicSimple]]

```json
{
  "required_changes": [
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "設定項目を score1/score2/scoreA/scoreB/overAll の5つに限定し、score3/score4/scoreC 未設定を明記した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "『4指標算出』『ヒヤリ減点』『scoreC=Hp派生』の誤記を削除し設計意図としても残さないよう訂正した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "score1 の算出根拠を D→R 直前8秒・R→D 切り返し・P 確定・複数回平均のシフト遷移のみに限定して記述した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "score2 はハンドル安定性のみで、サンプリングはコメント50msに対し実装 repeat=0 全件、calculateEntropy が alpha 未使用で振幅非依存であることを追記した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "ヒヤリは L843-845 で hiyari=true とメッセージのみ設定しスコア値を変えないことを明記した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "smartphoneOnly の canData ゼロ埋めによる全指標未発火・全項目100の未算出、および初回100混入（105-107）を追記した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "score.ts:70-72 の scoreA 三重代入を実装バグとして記録し、修正は打ち合わせ後・コード変更禁止と明記した"},
    {"node": "middleware.score.logicCan", "entrypoint": "spec/middleware/score-logicCan.md", "description": "既存 accel_decel/hard_brake/mixed ログが10秒ゲートに僅差で未達である所見を記録のみとして追記した"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "should", "reason": "score3/score4/scoreC は本ロジックで未設定のため、指標表示・ラベル空欄（label3/label4/labelC）の扱いを表示側仕様と整合させる必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "ヒヤリはスコアを変えずメッセージと交差点名のみを返すため、ヒヤリ地点確認画面（UC08）は減点表現をしてはならない"},
    {"domain": "UI-agent", "severity": "could", "reason": "smartphoneOnly では全項目100の未算出となるため、未算出と満点の区別表現の検討余地がある（本件では変更しない）"},
    {"domain": "DB-agent", "severity": "could", "reason": "score3/score4/scoreC は常に未設定値のまま保存されるため、永続化スキーマの意味づけ確認余地がある"},
    {"domain": "QA-agent", "severity": "should", "reason": "既存ログでは score2 が10秒ゲート未達で発火しないため、CAN 版検証には10秒以上の直進ログ採取が必要"}
  ],
  "requirements_context": "UC06（運転診断の実行）/UC07（アドバイス表示）/UC08（ヒヤリ地点確認）の実行主体は assets/data/scoreLogicFunction.txt（約885行、CAN 対応本番ロジック）であり、アプリ内で実行される唯一のスコアロジックである。本ロジックが設定するのは score1(L811)/score2(L834)/scoreA(L824)/scoreB(L828)/overAll(L876) のみで、score3/score4/scoreC は未設定である。score1 は parkingAction のシフト遷移（D→R 遷移直前8秒を D 区間、R→D 切り返しも検出、P 到達で確定、複数回成立時は平均）のみを根拠に、s1=D区間最大減速度・s2=D区間最大速度・s3=R区間最大加速度を normDist で係数化し 0.57/0.25/0.18 で合成する。scoreA(0.6*S1+0.4*S3)・scoreB(0.42*S1+0.34*S2+0.24*S3) も駐車 D→R→P のみが根拠である。score2 は vehicleSpeed>=40km/h・turnSignal=0・|steeringAngle|<=15° が10秒継続したときのハンドル安定性で、過去3点の2次テイラー予測との差の90パーセンタイル alpha を求めた上で9セル分割 Shannon エントロピー Hp（底9）から (1-Hp)*100 を算出するが、calculateEntropy は alpha を未使用のため振幅非依存である。サンプリングはコメントに50msとあるが実装は repeat=0 の全件（実測10msまたは100ms）を用いる。既存 accel_decel/hard_brake/mixed ログは10秒ゲートに僅差で未達で score2 は発火しない（記録のみ、コード化しない）。ヒヤリは longAcc/latAcc の Jerk を1次IIRローパス（T=0.05s,F=2Hz）に通し |Jerk_LPF|>0.4G/s で発火（1秒再発火抑止）するが、L843-845 で result.hiyari=true とメッセージ・intersection のみ設定しスコア値は変更しない。overAll は score1..4 のうち -1 でない項目の平均で、フレーム側 start() が setTimeout(0) で new Score(null)（初期値100、105-107）を積むため実測式は (評価窓合計+100)/(窓数+1) となる。全指標未発火時は L871-874 が null を返し scoreList 空となり全項目100の未算出となる。smartphoneOnly では sensor.service.ts:463-466 の lastCanData ゼロ埋め（shiftIndication=0 等）により全指標が発火せず全項目100の未算出となる。selectedSensorMode によるロジック差替は未実装で opening.page.ts:254 は常に CAN 版を GET する。score.ts:70-72 の scoreA 三重代入は実装バグとして記録するが修正は打ち合わせ後とし、labelB「注意機能」とコード内コメント「認知機能」の食い違いも記録のみとする。メッセージ選定 getMessage は scoreLogicJson.messages を key/area/score.inclusive_min/exclusive_max で範囲一致させ、custom があれば完全一致で絞り込み、text の %COUNT/%INTERSECTION を後段置換する。searchIndex は repeat===0 のみを有効サンプルとして扱う。scoreLogicFunction.txt/_simple.txt/scoreLogic.json/score-logic.ts/sensor.service.ts/opening.page.ts/score.ts はコード変更禁止であり、仕様側の記録のみで運用する。",
  "fact_candidates": [
    {"type": "business_rule", "title": "CAN 版ロジックが設定するスコアは5項目のみ", "statement": "scoreLogicFunction.txt は score1(L811)・score2(L834)・scoreA(L824)・scoreB(L828)・overAll(L876) のみを設定する", "status": "approved"},
    {"type": "business_rule", "title": "score3 / score4 / scoreC は未設定", "statement": "scoreLogicFunction.txt は score3・score4・scoreC に値を設定しない", "status": "approved"},
    {"type": "business_rule", "title": "score1 は駐車のシフト遷移のみで算出される", "statement": "score1 は parkingAction のシフト遷移（D→R→P）のみを根拠に算出される", "status": "approved"},
    {"type": "business_rule", "title": "D 区間の評価窓は D→R 遷移の直前8秒である", "statement": "parkingAction は D→R 遷移の直前8秒を D 区間の評価窓とする", "status": "approved"},
    {"type": "state_rule", "title": "R→D の切り返しも遷移として検出される", "statement": "parkingAction は R→D の切り返し遷移を検出対象に含める", "status": "approved"},
    {"type": "state_rule", "title": "駐車評価は P 到達で確定する", "statement": "parkingAction のスコアは shiftIndication が P になった時点で確定する", "status": "approved"},
    {"type": "business_rule", "title": "駐車が複数回成立した場合は平均する", "statement": "1診断中に駐車シーケンスが複数回成立した場合、各回の算出結果を平均して score1 とする", "status": "approved"},
    {"type": "business_rule", "title": "score1 の合成式", "statement": "score1 = 0.57*S1 + 0.25*S2 + 0.18*S3（S1=D区間最大減速度、S2=D区間最大速度、S3=R区間最大加速度を normDist で係数化した値）", "status": "candidate"},
    {"type": "business_rule", "title": "scoreA は駐車のみを根拠とする", "statement": "scoreA = 0.6*S1 + 0.4*S3 で、駐車 D→R→P のみを算出根拠とする", "status": "approved"},
    {"type": "business_rule", "title": "scoreB は駐車のみを根拠とする", "statement": "scoreB = 0.42*S1 + 0.34*S2 + 0.24*S3 で、駐車 D→R→P のみを算出根拠とする", "status": "approved"},
    {"type": "business_rule", "title": "score2 はハンドル安定性のみを評価する", "statement": "score2 は midHighSpeedDrive におけるハンドル安定性のみから算出される", "status": "approved"},
    {"type": "business_rule", "title": "score2 の発火ゲート条件", "statement": "score2 は vehicleSpeed>=40km/h かつ turnSignal===0 かつ |steeringAngle|<=15° が10秒継続したときに算出される", "status": "approved"},
    {"type": "business_rule", "title": "score2 の算出式", "statement": "score2 = (1 - Hp) * 100（Hp は9セル分割・底9の Shannon エントロピー）", "status": "candidate"},
    {"type": "data_semantics", "title": "score2 のサンプリングはコメントと実装が食い違う", "statement": "ソースコメントは50msサンプリングと記載するが、実装は repeat===0 の全件（実測10msまたは100ms）を用いる", "status": "approved"},
    {"type": "business_rule", "title": "calculateEntropy は alpha を未使用で振幅非依存である", "statement": "calculateEntropy は引数 alpha を使用しないため、score2 は舵角ばらつきの振幅に依存しない", "status": "approved"},
    {"type": "qa_expectation", "title": "既存3ログは score2 の10秒ゲートに未達である", "statement": "既存の accel_decel / hard_brake / mixed ログは10秒継続ゲートに僅差で未達であり score2 が発火しない", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリはスコア値を変更しない", "statement": "ヒヤリ発火時は L843-845 で result.hiyari=true とメッセージのみを設定し、いずれのスコア値も変更しない", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ判定は Jerk のローパス後閾値で行う", "statement": "longAcc / latAcc の Jerk を1次IIRローパス（T=0.05s, F=2Hz）に通し |Jerk_LPF|>0.4G/s で発火し、発火後1秒は再発火を抑止する", "status": "candidate"},
    {"type": "business_rule", "title": "overAll は -1 でないスコアの平均である", "statement": "overAll は score1..score4 のうち -1 でない項目の平均として算出される", "status": "approved"},
    {"type": "business_rule", "title": "overAll には初回100が1件混入する", "statement": "start() が setTimeout(0) で new Score(null)（初期値100、scoreLogicFunction.txt:105-107）を積むため、overAll は (評価窓合計+100)/(窓数+1) となる", "status": "approved"},
    {"type": "business_rule", "title": "全指標未発火時は全項目100の未算出となる", "statement": "全指標が未発火の場合 L871-874 が null を返し scoreList が空となり、全項目100の未算出として扱われる", "status": "approved"},
    {"type": "constraint", "title": "smartphoneOnly では CAN 版の全指標が発火しない", "statement": "smartphoneOnly では sensor.service.ts:463-466 の lastCanData ゼロ埋め（shiftIndication=0 等）により CAN 版の全指標が発火せず、全項目100の未算出となる", "status": "approved"},
    {"type": "constraint", "title": "ロジック差替は未実装である", "statement": "opening.page.ts:254 は常に assets/data/scoreLogicFunction.txt を GET し、selectedSensorMode によるロジック差替は実装されていない", "status": "approved"},
    {"type": "constraint", "title": "score.ts:70-72 の scoreA 三重代入は実装バグである", "statement": "score.ts:70-72 で scoreA に三重代入が行われており実装バグであるが、修正は打ち合わせ後とし現時点でコードは変更しない", "status": "approved"},
    {"type": "data_semantics", "title": "labelB の名称とコメントが食い違う", "statement": "labelB は「注意機能」だがコード内コメントは「認知機能」であり、記録のみとする", "status": "approved"},
    {"type": "data_semantics", "title": "repeat==0 のサンプルのみ有効である", "statement": "searchIndex は repeat===0 のサンプルのみを新規かつ有効として扱い、repeat>=1 は再送・流用として無視する", "status": "candidate"},
    {"type": "business_rule", "title": "メッセージは範囲一致と custom 完全一致で選定される", "statement": "getMessage は scoreLogicJson.messages を key/area/score.inclusive_min/exclusive_max の範囲一致で選定し、custom が定義されていれば custom 値の完全一致で絞り込む", "status": "candidate"},
    {"type": "display_rule", "title": "メッセージ文中のプレースホルダは後段で置換される", "statement": "message の text 中の %COUNT（同 id 出現回数）と %INTERSECTION（交差点名）は後段で置換される", "status": "candidate"},
    {"type": "constraint", "title": "対象ソースはコード変更禁止である", "statement": "scoreLogicFunction.txt / scoreLogicFunction_simple.txt / scoreLogic.json / score-logic.ts / sensor.service.ts / opening.page.ts / score.ts は変更せず、仕様側の記録のみを行う", "status": "approved"}
  ],
  "open_questions": [
    "score.ts:70-72 の scoreA 三重代入をいつ・どう修正するかが未確定。現状 scoreB/scoreC 相当の値が失われている可能性があり、能力指標の表示値に影響する。修正可否は打ち合わせ待ちで Middleware/UI 双方の判断が必要。",
    "score2 のサンプリング周期の正がコメントの50msか実装の repoat=0 全件（10ms/100ms）かが未確定。エントロピー Hp の分布と score2 の絶対値に影響するため、ロジック設計元の確認が必要。",
    "既存 accel_decel / hard_brake / mixed ログが10秒ゲートに僅差で未達である点について、ゲート緩和するか検証ログを採り直すかが未確定。QA の検証可否に直結する。",
    "全指標未発火時に全項目100を返す挙動（未算出と満点が区別できない）の是非が未確定。UI 表示仕様と DB 保存値の意味づけに影響する。",
    "score3 / score4 / scoreC を将来算出するか、恒久的に未使用とするかが未確定。scoreLogic.json の label3/label4/labelC 空欄および UI の指標枠に影響する。",
    "labelB「注意機能」とコード内コメント「認知機能」のどちらが正しい指標定義かが未確定。UC07 のアドバイス文面と整合させる判断が必要。",
    "selectedSensorMode によるロジック差替（_simple への切替）を実装するか否かが未確定。smartphoneOnly 時の診断成立性に影響する。"
  ],
  "rationale_notes": [
    "本ドキュメントは設計意図ではなく実装実態の記録として書き下している。誤記（4指標算出・ヒヤリ減点・scoreC=Hp派生）は訂正のうえ設計意図としても残さない方針に従った。",
    "score1 / scoreA / scoreB は駐車、score2 は中高速直進という『発火源が完全に分離した2系統』であることを明示し、指標名から機能連想して混同されないようにした。",
    "ヒヤリは検出イベント（hiyari フラグ＋メッセージ＋交差点名）であってスコア要素ではない、という責務分離を明記した。UC08 は表示責務のみを持つ。",
    "overAll の初回100混入はフレーム側（score-logic）の起動シーケンス由来であり、CAN ロジック自身の欠陥ではない。参照関係が追えるよう両ノードに記載する。",
    "smartphoneOnly の未算出は sensor.service のゼロ埋めが上流原因であるため、原因箇所（sensor.service.ts:463-466）を明示して責任所在を追跡可能にした。",
    "実装バグ（scoreA 三重代入）とコメント齟齬（50ms、認知機能）は、いずれも『記録するが直さない』というスタンスをドキュメント上で明言し、後続作業者が善意で修正しないようにした。"
  ]
}
```
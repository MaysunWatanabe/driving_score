# QA Test Specification — ui

> このドキュメントは qa-maintainer-domain によって生成された正本です。
> Generation: 1 / Domain: ui / Generated: 2026-07-20 01:22:36 UTC

## カバレッジ評価

- **coverage_score**: 8
- **coverage_notes**: existing_qa が空であり、UI ドメインの 8 ノード (ui.opening.page / ui.account.page / ui.driving.page / ui.comment.page / ui.badspot.page / ui.history.page / ui.settings.page / ui.edit.page) すべてに対して QA が 1 本も存在しない。canonical_spec_nodes も空だが spec_documents に node_id が明記されているためそれを対応キーとして扱う。全ノードが未検証状態のため coverage は極めて低い。特に driving-page の診断開始→センサー→スコア表示→保存→終了ダイアログの通しフロー、opening-page の自動ログイン境界 (72h)、account-page の作成/編集/削除の状態遷移、settings/edit の testScoreLogic 検証パスがゼロ件。
- **quality_notes**: 既存 QA がないため API smoke 偏重の問題は現時点では無いが、これから整備する QA は Ionic/Angular 画面である本アプリの性質上『ユーザー操作 → DOM(星/順位/Chart/ダイアログ)反映 → SQLite(score/user)反映 → 再読込/別画面での再確認』を通す業務シナリオ形式で書く必要がある。単なる画面遷移確認や 200 OK 相当の存在確認だけでは不十分。
- **drift_notes**: spec 側にコメント選定アルゴリズムの同点処理に関する未確定記述あり (comment-page.md『同点は先勝ちの可能性あり。ソース確認要』)。この曖昧さは QA で確定させるべきで、priority は should 以下に留める。account-page の onCreateAccount で作成成功時に logout+navigateBack する旨がダイアログ表 (showCreateFinishDialog) と業務ルール記述で一貫しており drift なし。opening と settings/edit の //<UnixTime> 巻き戻し防止ロジックは複数ノードに跨る協調記述だが同一ドメイン内なので本エージェントで扱う。

---

## 検証シナリオ（追加）



### TC-UI-OPENING-001 — 未ログイン状態からのログイン成功と直近スコアコメント表示

- **node_id**: `ui.opening.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1262 の基本フロー。opening-page.md の onLoginClick → login → showLoginDialog(over_all メッセージ %COUNT 置換) が must 動線。

**検証手順**:

1. ユーザー操作: オープニングで『ログイン』押下 → ID/PASSWORD 入力 → OK

1. 期待 DOM 反映: ログイン成功ダイアログ表示。直近スコアがあれば subHeader『運転診断コメント』+ over_all メッセージが %COUNT 置換済・%INTERSECTION 空文字化で表示される

1. 期待 DB / API 状態: loginService.login が hashStr(password) で照合成功、Storage lastLoginUserId が更新される

1. 再読込・別セッションでの再確認: ダイアログ閉じ後にログイン済み状態が維持され、ログアウトボタンが表示される



### TC-UI-OPENING-002 — ログイン失敗時のエラーダイアログ表示と状態非遷移

- **node_id**: `ui.opening.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1262 のエラーパス。showLoginFailedDialog の記述に対応。誤 PASSWORD/存在しない ID で失敗すること、ログイン状態に遷移しないこと。

**検証手順**:

1. ユーザー操作: 誤った PASSWORD または未登録 ID でログイン試行

1. 期待 DOM 反映: 『ログインに失敗しました。』ダイアログが表示され、閉じるとオープニングのまま

1. 期待 DB / API 状態: loginService.login が false、loginUser は未設定のまま、lastLoginUserId は変更されない

1. 再読込・別セッションでの再確認: 再読込後もログイン済みにならない



### TC-UI-OPENING-003 — 72時間以内の自動ログイン成功／72時間超での自動ログイン不成立（境界）

- **node_id**: `ui.opening.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: UC1263 の自動ログイン境界条件。ngOnInit で autoLogin 成功時に showLoginDialog。3日(72h)境界は spec gap（opening-page.md には autoLogin の 72h 判定閾値の記載がなく UC1263 summary のみが根拠）。

**検証手順**:

1. ユーザー操作: 前回ログインから 71h59m 経過状態でアプリ起動 / 72h01m 経過状態でアプリ起動

1. 期待 DOM 反映: 71h59m ではログイン済み+ログインダイアログ表示、72h01m では未ログイン導線(ログイン/作成/設定)表示

1. 期待 DB / API 状態: autoLogin が境界内で true / 境界外で false を返す。Storage の最終ログイン時刻を参照

1. 再読込・別セッションでの再確認: 境界値ちょうど(72h00m00s)の扱いを確認し spec に確定させる



### TC-UI-OPENING-004 — assets scoreLogic のバージョン比較による巻き戻し防止

- **node_id**: `ui.opening.page`
- **priority**: `must`
- **applicable_roles**: driver, operator
- **rationale**: opening-page.md の non-negotiable 業務ルール『古い方に巻き戻さない』。saveDefaultScoreLogic は //<UnixTime>、saveDefaultScoreLogicJson は version で比較。settings/edit で新しく保存したロジックが起動時に assets へ巻き戻らないこと。

**検証手順**:

1. ユーザー操作: /settings or /edit でロジックを更新(先頭に //<新UnixTime>)後にアプリ再起動 → オープニング初期化

1. 期待 DOM 反映: 特に UI 変化はないが後続の診断で新ロジックが使われる

1. 期待 DB / API 状態: Storage scoreLogicKey の先頭 UnixTime が assets の UnixTime より新しい場合は上書きされない。scoreLogicJson は newJson.version >= oldJson.version のときのみ上書き

1. 再読込・別セッションでの再確認: 再起動を繰り返しても Storage のユーザー更新ロジックが保持される



### TC-UI-ACCOUNT-001 — アカウント新規作成成功→自動ログアウト→オープニング復帰

- **node_id**: `ui.account.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1264 の基本フロー。account-page.md onCreateAccount と showCreateFinishDialog(閉じるで logout+navigateBack)。作成後に再ログインが必要になる業務ルールを検証。

**検証手順**:

1. ユーザー操作: /account/create で ID/PASSWORD/性別/生年月/身長/都道府県 を入力し作成

1. 期待 DOM 反映: 『アカウントを作成しました。』ダイアログ→閉じるでオープニングに戻る

1. 期待 DB / API 状態: user テーブルに 1 レコード追加、userPassword は Md5.hashStr で保存、生年月は '年''月' 除去済み整数。loginService.insert が true

1. 再読込・別セッションでの再確認: 作成直後はログアウト状態。新規 ID で改めてログインでき、平文 PASSWORD は DB に存在しない



### TC-UI-ACCOUNT-002 — アカウント作成フォームバリデーション失敗時の作成拒否

- **node_id**: `ui.account.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: account-page.md Reactive Forms。userId は半角英数 pattern、userPassword は英数記号 pattern、height は 100-299 の 3 桁+小数 pattern。NG 時 showCreateFailDialog(作成失敗ダイアログ兼用)。

**検証手順**:

1. ユーザー操作: userId に日本語、height に 099 / 300、PASSWORD に禁止文字を入力して作成試行

1. 期待 DOM 反映: 『アカウントを作成できませんでした。』ダイアログ表示、フォームはそのまま

1. 期待 DB / API 状態: loginService.insert は呼ばれず user レコードは追加されない

1. 再読込・別セッションでの再確認: 不正データが DB に混入していないこと



### TC-UI-ACCOUNT-003 — アカウント編集: パスワード未変更('****')は現行維持・変更時のみ再ハッシュ

- **node_id**: `ui.account.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1265 の非自明な業務ルール。onModifyAccount のパスワード変更判定 (userPassword != '****' && user.userPassword != value のとき Md5 置換)。編集画面初期値は '****' 4 文字固定。

**検証手順**:

1. ユーザー操作(A): /account/modify で PASSWORD 欄を '****' のまま身長のみ変更して更新

1. ユーザー操作(B): PASSWORD 欄を新しい値に書き換えて更新

1. 期待 DOM 反映: 両ケースとも『アカウントを更新しました。』→閉じるで logout+オープニング復帰

1. 期待 DB / API 状態: (A) では user.userPassword ハッシュが変更前と一致し身長のみ更新。(B) では userPassword が新値の Md5 ハッシュに更新される

1. 再読込・別セッションでの再確認: (A) は旧パスワードで再ログイン可、(B) は新パスワードで再ログイン可・旧パスワードで不可



### TC-UI-ACCOUNT-004 — アカウント削除の確認ダイアログと4テーブル連鎖削除

- **node_id**: `ui.account.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1266 + account-page.md onDeleteAccount。showDeleteDialog(キャンセル/削除)→削除で loginService.delete + scoreDbService.delete(3テーブル連鎖)。UC1266 は user/score/score_history/capability_score を挙げる。キャンセル時に削除されないことも検証。

**検証手順**:

1. ユーザー操作(A): アカウント編集画面で削除→確認ダイアログで『キャンセル』

1. ユーザー操作(B): 削除→確認ダイアログで『削除』→完了ダイアログ閉じる

1. 期待 DOM 反映: (A) は画面据え置き、(B) は『アカウントを削除しました。』→閉じるで logout+オープニング復帰

1. 期待 DB / API 状態: (A) は全レコード残存。(B) は user + score + score_history + capability_score の当該 userId レコードがすべて削除、Storage lastLoginUserId も削除

1. 再読込・別セッションでの再確認: (B) 後は削除済み ID で再ログイン不可、履歴/コメントに残骸が出ない



### TC-UI-DRIVING-001 — 運転診断の通しフロー: 開始→スコア更新→終了→SQLite保存→終了ダイアログ

- **node_id**: `ui.driving.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1267 の中核業務フロー。driving-page.md onStart/onStop。センサー→scoreLogic→星/順位表示→insertScore→loginService.scoreId 設定→終了ダイアログ。API smoke ではなくセンサー入力から DB 保存までを通す。

**検証手順**:

1. ユーザー操作: /driving で『診断開始』→デモ/実センサーで走行→『診断終了』

1. 期待 DOM 反映: 開始で status=running・開始マーカー描画・自車位置追従、スコア(総合+4指標)が星または順位(101-score)で更新、終了で status=finish・終了マーカー・fitBounds・終了ダイアログ表示

1. 期待 DB / API 状態: onStop で scoreDbService.insertScore が呼ばれ score レコードが 1 件追加、loginService.scoreId = scoreLogic.startTimestamp、logService.resetLogDir 実行

1. 再読込・別セッションでの再確認: /history に当該走行が追加され、/comment で同一 startTimestamp の結果が参照できる



### TC-UI-DRIVING-002 — センサー異常(sensorData=null)発生時の自動停止

- **node_id**: `ui.driving.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: driving-page.md updateSensor の異常パス『sensorData === null: センサー異常発生 → onStop()』。エラーパスとして必須。

**検証手順**:

1. ユーザー操作: 診断実行中にセンサーが null を返す状況を発生させる

1. 期待 DOM 反映: 自動的に status=finish に遷移し終了処理(終了マーカー/fitBounds/終了ダイアログ)が走る

1. 期待 DB / API 状態: onStop 経由で insertScore が実行され、それまでの走行分が保存される

1. 再読込・別セッションでの再確認: 異常停止した走行も履歴/コメントで参照できる（破損レコードで落ちない）



### TC-UI-DRIVING-003 — ヒヤリマーカータップは診断終了後のみ有効・動画パス付きで/bad-spotへ遷移

- **node_id**: `ui.driving.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: driving-page.md 業務ルール『ヒヤリマーカーのタップは診断終了後のみ有効』および mark リスナ (status===finish のときのみ setSelectMarkerPos + videoRecordedPath を /→@ 置換して navigateForward)。UC1269 の遷移元。

**検証手順**:

1. ユーザー操作(A): 診断実行中(running)にヒヤリマーカーをタップ

1. ユーザー操作(B): 診断終了後(finish)にヒヤリマーカーをタップ

1. 期待 DOM 反映: (A) は遷移しない。(B) は /bad-spot/<@エスケープ済パス> へ遷移

1. 期待 DB / API 状態: (B) で mapService.setSelectMarkerPos(pos) が設定され bad-spot 側で復帰参照できる

1. 再読込・別セッションでの再確認: 動画未録画(videoRecordedPath 空)の場合でも遷移でき、bad-spot で地図のみ辿れる



### TC-UI-DRIVING-004 — 動画録画: 60秒チャンクのファイル追記保存(初回writeFile/2回目以降append)

- **node_id**: `ui.driving.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: driving-page.md saveVideo の非自明ルール『初回は writeFile、2回目以降は append』および業務ルール『1走行=movie.webm 1ファイル追記』。settings.recording=false 時は no-op であることも検証。

**検証手順**:

1. ユーザー操作: recording=enable で 130 秒(=3チャンク)走行して終了

1. 期待 DOM 反映: 終了後 videoRecordedPath に Blob URL が設定され bad-spot で再生可能

1. 期待 DB / API 状態: Documents/driving-score/data.<日時>/movie.webm が 1 ファイルとして存在し、初回 writeFile 後は {append:true} で追記されている

1. 再読込・別セッションでの再確認: recording=disable のときは startVideo が no-op で movie.webm が生成されないこと



### TC-UI-COMMENT-001 — アドバイス表示: 直近1走行の5×2マトリクスから代表メッセージ選定と%置換

- **node_id**: `ui.comment.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1268 の中核。comment-page.md メッセージ選定アルゴリズム(positive=最高スコア/negative=最低スコア)、%COUNT=同id出現数、%INTERSECTION=交差点名、orderOfMessage による表示順。

**検証手順**:

1. ユーザー操作: 診断終了ダイアログ『アドバイス表示』または opening 直近コメント経由で /comment を開く

1. 期待 DOM 反映: over_all/score1..4 それぞれで positive は最高スコア・negative は最低スコアの代表メッセージが表示。%COUNT が数値に、%INTERSECTION が交差点名に置換済み。orderOfMessage=0 で positive→negative、=1 で逆順

1. 期待 DB / API 状態: scoreDbService.selectScore(loginService.scoreId) の結果配列末尾(最新)を参照

1. 再読込・別セッションでの再確認: 同一 scoreId で再表示しても同一の代表メッセージ・順位(101-round)が出る



### TC-UI-COMMENT-002 — 同点スコア時の代表メッセージ選定の確定挙動

- **node_id**: `ui.comment.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: comment-page.md 自身が『同点は先勝ち/後勝ちどちらか、ソース確認要』と未確定を明記。drift の温床になるため QA で挙動を固定し spec に逆フィードバックする。spec 確定前のため must にしない。

**検証手順**:

1. ユーザー操作: 同一 (key,type) 内でスコアが同点のメッセージが複数ある走行結果で /comment を開く

1. 期待 DOM 反映: 選ばれる代表メッセージが決定的(先勝ち or 後勝ち)である

1. 期待 DB / API 状態: 選定ロジックの厳密不等号(</>)が同点をどちら優先で解決するか実装挙動を記録

1. 再読込・別セッションでの再確認: 同一データで毎回同じメッセージが選ばれる(非決定にならない)



### TC-UI-BADSPOT-001 — ヒヤリ地点確認: 動画currentTime追従とマーカー自動選択

- **node_id**: `ui.badspot.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: UC1269 + badspot-page.md loadVideo の 300ms 周期監視(getMarkerVideoTime <= currentTime を満たす最後の pos を採用) と onPointer の hiyar_big.png 強調。

**検証手順**:

1. ユーザー操作: /bad-spot/:path で動画を再生位置移動する

1. 期待 DOM 反映: currentTime に対応するヒヤリマーカーが自動選択され hiyar_big.png で強調、それ以外は hiyari.png。spotTimestamp と spotComment1..4 が対応マーカーの内容に更新、地図が該当マーカー中心 zoom16

1. 期待 DB / API 状態: mapService.getSelectMarkerPos() から driving 側が設定した spotPos を復帰参照

1. 再読込・別セッションでの再確認: 前/次ボタンがリング動作(末尾→先頭、先頭→末尾)し seekVideo で動画位置も同期する



### TC-UI-BADSPOT-002 — 動画未録画(videoPath空)でも地図ナビゲーションのみで辿れる

- **node_id**: `ui.badspot.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: badspot-page.md 業務ルール『動画が録画されていない診断結果でもマーカーは辿れる(videoPath==='' のときは video 空、Map ナビゲーションのみ)』。空状態の境界条件。

**検証手順**:

1. ユーザー操作: recording=disable で記録した走行のヒヤリ地点を bad-spot で開く

1. 期待 DOM 反映: video は空表示、前/次ボタンで地図マーカーのみ切替できる。エラーやクラッシュが起きない

1. 期待 DB / API 状態: videoPath='' でも spotComment/timestamp が正しく表示される

1. 再読込・別セッションでの再確認: 動画あり走行と動画なし走行を切替えても bad-spot が破綻しない



### TC-UI-HISTORY-001 — 履歴表示: 直近30件を古い順表示・30件未満は空ラベル左詰め(境界)

- **node_id**: `ui.history.page`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: UC1270 + history-page.md GRAPH_MAX=30 業務ルール『最新30件を古い順、30件未満は空ラベルで左詰め』。空状態(0件で return)、境界(1件/30件/31件)。

**検証手順**:

1. ユーザー操作: /history をヒストリータブで開く(0件 / 1件 / 30件 / 31件 の各状態)

1. 期待 DOM 反映: 0件は Chart 描画せず return(空画面)。1〜29件は空ラベル左詰め。31件以上は最新30件のみ古い順に表示。scoreShowStarArea1/2 に応じて生スコア or 順位(101-round)で Y軸 reverse 反転

1. 期待 DB / API 状態: scoreDbService.selectAllScore() の結果から最新 GRAPH_MAX 件を選択

1. 再読込・別セッションでの再確認: 新規走行追加後に再表示すると最古の1件が押し出され最新が右端に来る



### TC-UI-HISTORY-002 — 能力指標タブ: capabilityScoreTargetDays内平均とTooltipサブグラフ

- **node_id**: `ui.history.page`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: UC1270 の能力指標タブ。history-page.md initializeCapabilityScoreCanvas/makeCapabilityGraphData(targetDate<=graph[key].date のみ平均に含む、score<=-1 スキップ、サブグラフ 2件以上でメイン下に描画)。

**検証手順**:

1. ユーザー操作: 能力指標タブ(onCapabilityClick)に切替え、A/B/C グラフの点をホバー

1. 期待 DOM 反映: scoreA/B/C(筋力/柔軟性/視野)が capabilityScoreTargetDays(既定30日)以内の平均で表示、rankScoreA/B/C 反映。ホバーで該当日サブグラフ(2件以上時)を下に表示、messages が scoreAMessage 等に反映

1. 期待 DB / API 状態: graphCapabilityScoreList から scoreA/B/C を吸い上げ、score<=-1 の走行は除外される

1. 再読込・別セッションでの再確認: targetDays 範囲外(31日以上前)の走行が平均に含まれないこと、サブグラフ1件時は subGraphDateFullText='' になること



### TC-UI-SETTINGS-001 — 設定切替の即時Storage永続化と再読込後の保持

- **node_id**: `ui.settings.page`
- **priority**: `must`
- **applicable_roles**: operator
- **rationale**: UC1272 + settings-page.md 業務ルール『設定はすべて即座に Storage に反映(再起動を待たない)』。録画/GPSデモ/ログ保存/センサログ保存/センサーモードの各ハンドラ。

**検証手順**:

1. ユーザー操作: recording/gpsDemo/logStorage/sensorLogStorage を enable⇔disable、selectedSensorMode を smartphoneOnly/canDataOnly/combination で切替

1. 期待 DOM 反映: トグル/セレクタが選択状態に即反映

1. 期待 DB / API 状態: Storage settingRecording 等が即時更新。settings.recording 等の boolean/文字列に正しくマップ

1. 再読込・別セッションでの再確認: /settings を開き直しても切替値が保持される。logStorage/sensorLogStorage 切替時は logService.initialize が再実行されバッファがクリアされる



### TC-UI-SETTINGS-002 — ScoreLogic更新: testScoreLogic検証成功時のみStorage反映・失敗時は反映しない

- **node_id**: `ui.settings.page`
- **priority**: `must`
- **applicable_roles**: operator
- **rationale**: UC1271 の non-negotiable。settings-page.md openScoreLogicFile『testScoreLogic 成功時のみ storage.set、失敗時は反映しない』および先頭 //<UnixTime> 差し込み(巻き戻し防止)。エラーパス必須。

**検証手順**:

1. ユーザー操作(A): 正常な scoreLogic ファイルをアップロード。(B): 構文/実行時エラーを含むファイルをアップロード

1. 期待 DOM 反映: (A) は『運転診断スコアロジックを更新しました。』、(B) は『...エラーになるため更新できません。』(message=stack)

1. 期待 DB / API 状態: (A) は Storage scoreLogicKey に保存され先頭に //<UnixTime> が差し込まれる。(B) は Storage が変更されない(旧ロジック保持)

1. 再読込・別セッションでの再確認: (B) 後に診断すると旧ロジックが使われ、(A) 後は新ロジックが使われる。再起動で assets へ巻き戻らない(TC-UI-OPENING-004 と協調)



### TC-UI-SETTINGS-003 — ScoreJson更新: settings/messages 存在検証と不正JSON拒否

- **node_id**: `ui.settings.page`
- **priority**: `must`
- **applicable_roles**: operator
- **rationale**: UC1271 + settings-page.md openScoreJsonFile『JSON.parse 成功かつ settings と messages 存在時のみ保存』。不正JSON/必須キー欠落のエラーパス。

**検証手順**:

1. ユーザー操作(A): 正常な scoreLogic.json をアップロード。(B): 壊れた JSON / settings or messages 欠落 JSON をアップロード

1. 期待 DOM 反映: (A) は『JSONファイルを更新しました。』、(B) は『不正なJSONファイルです。』(message=errorMsg)

1. 期待 DB / API 状態: (A) は Storage scoreLogicJsonKey 更新 + loginService.initialize 再実行、(B) は Storage 変更なし

1. 再読込・別セッションでの再確認: (A) 後は新しいメッセージ辞書が comment/history に反映、(B) 後は旧辞書が保持される



### TC-UI-SETTINGS-004 — ScoreLogic/ScoreJsonの端末書き出し(save)

- **node_id**: `ui.settings.page`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: UC1271 の書き出し系。settings-page.md onScoreJsonFile('save')/onScoreLogicFile('save') で Android は Documents/driving-score へ scoreLogicJson.<日時>.txt、ブラウザは download。

**検証手順**:

1. ユーザー操作: 設定画面で scoreJson/scoreLogic の 'save' を実行

1. 期待 DOM 反映: 『ファイルを保存しました。』ダイアログ(message=保存パス)表示

1. 期待 DB / API 状態: Android は Documents/driving-score/ 配下に <日時> 付きファイル生成、ブラウザは <a id=save> の download 発火

1. 再読込・別セッションでの再確認: 書き出したファイルが再度アップロード可能な内容であること



### TC-UI-EDIT-001 — デモ再生: gzセンサログ+webm動画アップロードと時系列復元再生

- **node_id**: `ui.edit.page`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: UC1273 + edit-page.md openSensorLogFiles(ファイル名昇順ソートで時系列復元、.webm は DemoData.movieFile、gz は Base64 化して pushSensorLogFile)。runScoreLogic でグラフ描画。

**検証手順**:

1. ユーザー操作: /edit で gz センサログ複数 + webm を選択アップロード → 診断実行

1. 期待 DOM 反映: sensorLogLoaded=true、スライダ範囲(min/max VideoTime)が設定され、Chart.js に GPS/加速度/ジャイロ/CAN/4スコア/能力指標/hiyari が GRAPH_SIZE=1200 で描画、resultMessages が unshift 表示

1. 期待 DB / API 状態: DemoData に時系列順(ファイル名昇順)でセンサログが積まれる。DB 書き込みは無し(検証専用)

1. 再読込・別セッションでの再確認: スライダで再生位置を変えるとグラフ/動画/スコアが同期する



### TC-UI-EDIT-002 — エディタ保存: testScoreLogic検証・先頭2行(//UnixTime,//日付)差し込み

- **node_id**: `ui.edit.page`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: UC1273 + edit-page.md onSaveScoreLogic(testScoreLogic 成功時に1行目 //<UnixTime>、2行目 //<日付> を検証/差し込み、Storage 保存 + 非Android は download。失敗時は showFailedScoreLogicDialog(stack))。

**検証手順**:

1. ユーザー操作(A): エディタで正常なロジックを保存。(B): エラーを含むロジックを保存

1. 期待 DOM 反映: (A) は『(保存完了)』ダイアログ、(B) は失敗ダイアログ(message=stack)

1. 期待 DB / API 状態: (A) は Storage scoreLogicKey に保存、1行目 //<Date.now()>・2行目 //<dateFormat(now)> が差し込まれ、Form も patchValue。(B) は Storage 変更なし

1. 再読込・別セッションでの再確認: (A) 保存後にオープニング再起動しても assets へ巻き戻らず(先頭UnixTimeが新しい)新ロジックが保持される



### TC-UI-EDIT-003 — 画面離脱時に診断中のスコアロジックが停止される

- **node_id**: `ui.edit.page`
- **priority**: `nice`
- **applicable_roles**: developer
- **rationale**: edit-page.md ionViewWillLeave『onStopScoreLogic()(診断中なら停止)』。リソースリーク/タイマー残存防止のエラー回避パス。

**検証手順**:

1. ユーザー操作: /edit でデモ診断実行中に別画面へ遷移

1. 期待 DOM 反映: 遷移先で問題なく表示され、edit のタイマー(sensorTimer)が残らない

1. 期待 DB / API 状態: scoreLogicRunning=false、sensorTimer が clearInterval される

1. 再読込・別セッションでの再確認: /edit に戻ったとき前回の診断が動き続けていない



### TC-UI-ROLE-001 — 未ログイン状態でのアクセス制御(診断/編集/削除への到達制約)

- **node_id**: `ui.opening.page`
- **priority**: `should`
- **applicable_roles**: driver, operator, developer
- **rationale**: spec gap: 各 use case は role(driver/operator/developer)前提だが、未ログイン時に /driving・/account/modify・/comment・/history 等へ到達したときの挙動が spec 未記載。opening-page.md 業務ルールは『未ログイン時でも設定画面には遷移可能(Score DB 非アクセス項目のみ)』のみ言及。

**検証手順**:

1. ユーザー操作: 未ログイン状態で運転診断/アカウント編集/過去診断結果の各導線を操作

1. 期待 DOM 反映: ログインが必要な機能ではログイン要求 or 導線非表示となる(実装挙動を確認)。設定は遷移可能だが Score DB 依存項目は制限される

1. 期待 DB / API 状態: loginUser 未設定時に scoreDbService へ userId 未確定のアクセスが発生しないこと

1. 再読込・別セッションでの再確認: 未ログインで到達できてしまう画面がないか横断確認





---

## 既存シナリオへの修正提案


（修正提案なし）


---

## 削除提案


（削除提案なし）


---

## 優先度調整



- `TC-UI-OPENING-001` → **must** : UC1262 のログイン成功は全機能の入口となる基本動線

- `TC-UI-OPENING-004` → **must** : 巻き戻し防止は spec で non-negotiable と明記され複数ノード協調の要

- `TC-UI-OPENING-003` → **should** : 72h 閾値が spec gap のため確定前に must にしない

- `TC-UI-ACCOUNT-003` → **must** : '****' 現行維持 vs 再ハッシュはデータ破壊/ログイン不能に直結する非自明ルール

- `TC-UI-ACCOUNT-004` → **must** : 4テーブル連鎖削除は取り返しがつかず整合性が重要

- `TC-UI-DRIVING-001` → **must** : 運転診断→保存はアプリの中核業務フロー

- `TC-UI-DRIVING-002` → **should** : 異常停止パス。データ保存は伴うが発生頻度は基本フローより低い

- `TC-UI-COMMENT-001` → **must** : 代表メッセージ選定と%置換は UC1268 の中核価値

- `TC-UI-COMMENT-002` → **should** : 同点処理が spec 未確定のため spec 確定まで must にしない

- `TC-UI-HISTORY-001` → **must** : 30件境界と0件空状態は表示破綻に直結

- `TC-UI-SETTINGS-001` → **must** : 設定即時永続化は全機能の前提となる基盤

- `TC-UI-SETTINGS-002` → **must** : testScoreLogic 検証なしでの反映は診断全体を壊すため non-negotiable

- `TC-UI-SETTINGS-003` → **must** : 不正辞書の混入防止は comment/history 全体の表示に影響

- `TC-UI-EDIT-002` → **should** : 開発者向け機能だが巻き戻し防止の 2 行差し込みロジックは検証価値が高い

- `TC-UI-ROLE-001` → **should** : spec gap でありアクセス制御の実装挙動確認と spec 補強が必要



---

## Open Questions



### 自動ログインの有効期限(72時間)の閾値と境界扱いが spec 未記載

- **質問**: opening-page.md には autoLogin の有効期限判定が記載されておらず UC1263 summary の『3日(72時間)以内』のみが根拠。72h ちょうど(境界)を成功とするか失敗とするか、判定に使う基準時刻(最終ログイン時刻の保存場所)を spec に明記してほしい。
- **保留中の判断**: TC-UI-OPENING-003


### コメント代表メッセージ選定の同点解決が未確定

- **質問**: comment-page.md 自身が『厳密不等号(</>)により同点は先勝ちの可能性あり、ソース確認要』と記載。同一 (key,type) 内でスコア同点時に先勝ち/後勝ちどちらを採用するかを確定し spec に固定してほしい(comment と history で挙動が揃っているかも要確認)。
- **保留中の判断**: TC-UI-COMMENT-002


### 未ログイン時の画面別アクセス制御が spec 未記載

- **質問**: 各 use case は role(driver/operator/developer)を前提とするが、未ログイン状態で /driving・/account/modify・/comment・/history・/settings・/edit に到達した場合の挙動(遷移拒否/ログイン要求/導線非表示)が spec に定義されていない。ログイン必須画面と未ログイン許容画面の一覧、及び違反時の UI 挙動を各 ui ノードに追記してほしい。
- **保留中の判断**: TC-UI-ROLE-001, TC-UI-ACCOUNT-003, TC-UI-COMMENT-001




---

## Spec to update（参考）


LLM が修正対象として挙げた仕様書：

- `spec/qa/ui-opening.md`

- `spec/qa/ui-account.md`

- `spec/qa/ui-driving.md`

- `spec/qa/ui-comment.md`

- `spec/qa/ui-badspot.md`

- `spec/qa/ui-history.md`

- `spec/qa/ui-settings.md`

- `spec/qa/ui-edit.md`



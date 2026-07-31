# QA Test Specification — qa

> このドキュメントは qa-maintainer-domain によって生成された正本です。
> Generation: 1 / Domain: qa / Generated: 2026-07-20 01:22:36 UTC

## カバレッジ評価

- **coverage_score**: 0
- **coverage_notes**: canonical_spec_nodes / spec_documents / facts / existing_qa がすべて空であり、QA として検証可能な状態のノードは 0 件。現状 QA カバレッジは 13 件の use_cases に対し 0%。すべてのシナリオが spec gap 状態のため、以下 additions はすべて use_cases からの導出であり、spec 側の裏付けが未確定。特に UC1263 の『3日/72時間』しきい値、UC1265 の '****' パスワード維持ロジック、UC1271 の testScoreLogic 検証仕様は spec 文書化が必須。
- **quality_notes**: 既存 QA が皆無のため API smoke への偏りは発生していないが、この状態で追加する QA は最初から『ユーザー操作 → SQLite/Storage 反映 → 再描画・再ログイン確認』まで通す業務シナリオベースで設計する必要がある。単純な画面遷移確認だけに留めない。
- **drift_notes**: existing_qa / facts / spec_documents がすべて空のため、現時点で照合可能な drift は検出不能。spec 文書と QA の双方を新規に立ち上げる必要があり、drift 監視は次サイクル以降に持ち越し。

---

## 検証シナリオ（追加）



### QA-QA-1262-01 — オープニングから手動ログイン成功と直近 over_all 表示

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1262 から導出される基本フロー。ログイン成否とログイン成功時の over_all メッセージ表示に関する spec 文書が存在しない

**検証手順**:

1. ユーザー操作: オープニング→『ログイン』→正しい ID/PASSWORD 入力→送信

1. 期待 DOM 反映: ログイン後画面に直近スコアの over_all メッセージが表示される

1. 期待 DB / API 状態: 認証成功、セッション/ログイン状態が確立、最終ログイン時刻が更新される

1. 再読込・別セッションでの再確認: 再読込後もログイン状態が維持され over_all が再表示される



### QA-QA-1262-02 — 誤った資格情報でのログイン失敗とエラー表示

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1262 のエラーパス。誤 ID/PASSWORD 時のバリデーション/エラー表示仕様が未記載

**検証手順**:

1. ユーザー操作: 誤った PASSWORD でログイン送信

1. 期待 DOM 反映: 認証失敗メッセージが表示され、オープニング/ログイン画面に留まる

1. 期待 DB / API 状態: セッションは確立されず、最終ログイン時刻は更新されない

1. 再読込・別セッションでの再確認: 再読込後も未ログイン状態のまま



### QA-QA-1263-01 — 72時間以内の自動ログイン成功

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1263 の『3日(72時間)以内』しきい値と自動ログイン挙動を規定する spec が存在しない。境界値の正確な定義が必要

**検証手順**:

1. ユーザー操作: 前回ログインから 72 時間未満の状態でアプリ起動→オープニング初期化

1. 期待 DOM 反映: ログイン操作なしにログイン済み状態の画面が表示される

1. 期待 DB / API 状態: 保存済み資格情報で認証成功し最終ログイン時刻が更新される

1. 再読込・別セッションでの再確認: 再起動後も 72 時間以内なら自動ログインが継続する



### QA-QA-1263-02 — 72時間経過後は自動ログインせずオープニングに留まる（境界条件）

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1263 の境界条件。ちょうど 72 時間経過時の扱い（含む/含まない）が未定義

**検証手順**:

1. ユーザー操作: 前回ログインから 72 時間経過後にアプリ起動

1. 期待 DOM 反映: 自動ログインされず、オープニングのログインボタンが提示される

1. 期待 DB / API 状態: 自動認証は実行されない

1. 再読込・別セッションでの再確認: 72時間ちょうどの境界での挙動が一貫している



### QA-QA-1264-01 — アカウント作成成功と作成後の自動ログアウト

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1264 の登録項目バリデーションと作成後の自動ログアウト挙動を規定する spec が未整備

**検証手順**:

1. ユーザー操作: オープニング→『アカウント作成』→ ID/PASSWORD/性別/生年月/身長/都道府県 を入力→登録

1. 期待 DOM 反映: 登録成功後、自動的にログアウトしてオープニングに戻る

1. 期待 DB / API 状態: user レコードが新規作成され、PASSWORD は MD5 ハッシュで保存される

1. 再読込・別セッションでの再確認: 作成した ID/PASSWORD で改めてログインが成功する



### QA-QA-1264-02 — 必須項目未入力・重複IDでの作成失敗

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1264 のバリデーション/重複エラーパス。必須項目・ID 一意制約の仕様が未記載

**検証手順**:

1. ユーザー操作: 必須項目を空欄、または既存 ID で登録送信

1. 期待 DOM 反映: 各項目のバリデーションエラー/ID 重複エラーが表示される

1. 期待 DB / API 状態: user レコードは作成されない

1. 再読込・別セッションでの再確認: 不正入力での重複作成が発生していないこと



### QA-QA-1265-01 — パスワード欄'****'維持での編集保存（現行維持ロジック）

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1265 の '****' なら現行維持・変更時のみ MD5 保存という重要ロジックの spec 文書が存在せず、誤ってハッシュを二重化するリスクがある

**検証手順**:

1. ユーザー操作: アカウント編集で PASSWORD 欄を '****' のまま他項目のみ変更→保存

1. 期待 DOM 反映: 保存成功メッセージが表示され編集内容が反映される

1. 期待 DB / API 状態: PASSWORD ハッシュは変更前と同一、他項目のみ更新される

1. 再読込・別セッションでの再確認: 変更前の元パスワードで再ログインが成功する



### QA-QA-1265-02 — パスワード変更時の MD5 ハッシュ保存

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1265 のパスワード変更分岐。新パスワードの MD5 保存と旧パスワード無効化の仕様が未記載

**検証手順**:

1. ユーザー操作: PASSWORD 欄に新しい値を入力→保存

1. 期待 DOM 反映: 保存成功メッセージが表示される

1. 期待 DB / API 状態: 新パスワードの MD5 ハッシュで user が更新される

1. 再読込・別セッションでの再確認: 新パスワードでログイン成功、旧パスワードではログイン失敗する



### QA-QA-1266-01 — アカウント削除で関連レコードを一括削除（確認ダイアログ経由）

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1266 の user/score/score_history/capability_score 一括削除と確認ダイアログの仕様が未整備。削除漏れ・カスケード整合性の検証が必要

**検証手順**:

1. ユーザー操作: アカウント編集→削除→確認ダイアログで最終確認→実行

1. 期待 DOM 反映: 削除完了後オープニング/未ログイン状態に戻る

1. 期待 DB / API 状態: 対象ユーザーの user/score/score_history/capability_score レコードがすべて削除される

1. 再読込・別セッションでの再確認: 削除済み ID でのログインが失敗し、過去診断結果も参照できない



### QA-QA-1266-02 — 削除確認ダイアログでのキャンセル（削除されないこと）

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1266 の確認ダイアログのキャンセル分岐。取り消し時の非破壊挙動が未記載

**検証手順**:

1. ユーザー操作: 削除→確認ダイアログでキャンセル

1. 期待 DOM 反映: 編集画面に留まりデータは表示されたまま

1. 期待 DB / API 状態: いかなるレコードも削除されない

1. 再読込・別セッションでの再確認: 対象 ID で引き続きログイン可能



### QA-QA-1267-01 — 運転診断の開始・走行・終了と SQLite への結果保存

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1267 のセンサーサービス/スコアロジック/録画起動と走行終了時の SQLite 保存フローの spec が未整備。中核業務フローのため通し検証が必須

**検証手順**:

1. ユーザー操作: オープニング→『運転診断』→ドライビング画面→『診断開始』→走行→走行終了

1. 期待 DOM 反映: 診断開始でセンサー/録画が起動し、走行終了で結果ダイアログが表示される

1. 期待 DB / API 状態: SQLite の score/score_history 等に当該走行の結果が保存される

1. 再読込・別セッションでの再確認: 過去診断結果/ヒストリーに当該走行が反映されている



### QA-QA-1267-02 — 診断開始の権限・ログイン前提（未ログイン時に実行不可）

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1267 は『ログイン済みドライバー』が前提。未ログイン状態でのアクセス制御仕様が未記載

**検証手順**:

1. ユーザー操作: 未ログイン状態で運転診断へ遷移を試みる

1. 期待 DOM 反映: ログインを促す/オープニングへ戻される

1. 期待 DB / API 状態: 診断が開始されず結果レコードも作成されない

1. 再読込・別セッションでの再確認: 未ログインのまま診断が開始できないこと



### QA-QA-1268-01 — 直近1走行のアドバイス(over_all/score1..4 × positive/negative)表示

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1268 の /comment 表示内容（over_all および score1..4 の positive/negative 代表メッセージ）の spec が未整備

**検証手順**:

1. ユーザー操作: 診断終了ダイアログ『アドバイス表示』またはオープニング直近コメントから /comment を開く

1. 期待 DOM 反映: over_all と score1..4 各々の positive/negative 代表メッセージが表示される

1. 期待 DB / API 状態: 直近 1 走行のスコアデータを参照している

1. 再読込・別セッションでの再確認: 再度 /comment を開いても同一の直近走行アドバイスが表示される



### QA-QA-1268-02 — 走行実績ゼロ件時のアドバイス表示（空状態）

- **node_id**: `None`
- **priority**: `nice`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1268 の空状態。診断履歴がない場合の /comment 表示が未定義（境界条件）

**検証手順**:

1. ユーザー操作: 診断実績が 0 件のユーザーで /comment を開く

1. 期待 DOM 反映: 空状態メッセージが表示されエラーにならない

1. 期待 DB / API 状態: 参照可能なスコアデータが存在しないことを正しく判定

1. 再読込・別セッションでの再確認: 再読込しても空状態表示が維持される



### QA-QA-1269-01 — ヒヤリマーカータップで /bad-spot/:path に遷移し動画・地図表示

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1269 のヒヤリ地点遷移と動画/地図表示の spec が未整備

**検証手順**:

1. ユーザー操作: 診断終了画面地図または /comment 経由でヒヤリマーカーをタップ

1. 期待 DOM 反映: /bad-spot/:path に遷移し、対象ヒヤリ地点の動画と地図が 1 点表示される

1. 期待 DB / API 状態: 選択したヒヤリ地点 path に対応する録画・座標データを参照

1. 再読込・別セッションでの再確認: 同一 path を再度開いても同じヒヤリ地点が表示される



### QA-QA-1270-01 — ヒストリーで直近30回スコア推移と能力指標タブを Chart.js 表示

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1270 の直近 30 回上限、能力指標の過去 N 日平均集計、Chart.js 描画仕様が未整備。件数上限は境界条件として要検証

**検証手順**:

1. ユーザー操作: オープニング→『過去の診断結果』→ヒストリー画面→能力指標タブ切替

1. 期待 DOM 反映: 直近 30 回分のスコア推移チャートと能力指標(過去 N 日平均)チャートが描画される

1. 期待 DB / API 状態: score_history/capability_score から 30 件上限・N 日集計で取得

1. 再読込・別セッションでの再確認: 再描画後も同一データ・同一件数上限で表示される



### QA-QA-1270-02 — 診断回数が30回超・0回時のヒストリー表示（境界条件）

- **node_id**: `None`
- **priority**: `nice`
- **applicable_roles**: driver
- **rationale**: spec gap: UC1270 の件数境界。30 回超で古いものが切り捨てられるか、0 回の空状態が未定義

**検証手順**:

1. ユーザー操作: 診断 31 回以上のユーザー、および 0 回のユーザーでヒストリーを開く

1. 期待 DOM 反映: 31 回以上では直近 30 件のみ表示、0 回では空状態が表示される

1. 期待 DB / API 状態: 31 件目以降が取得対象外、0 件時はクエリ結果空を正しく処理

1. 再読込・別セッションでの再確認: 件数上限・空状態が一貫して再現される



### QA-QA-1271-01 — scoreLogic アップロードと testScoreLogic 検証後の Storage 更新

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: spec gap: UC1271 の testScoreLogic 検証仕様（合否判定基準）と検証通過後にのみ Storage を更新するフローの spec が未整備。運用担当者ロール限定である点も要明記

**検証手順**:

1. ユーザー操作: 設定画面で正当な scoreLogic.txt / scoreLogic.json をアップロード→検証実行

1. 期待 DOM 反映: 検証成功メッセージが表示され更新完了が示される

1. 期待 DB / API 状態: testScoreLogic 通過後に Storage の scoreLogic が新内容で更新される

1. 再読込・別セッションでの再確認: 再読込後も更新後の scoreLogic が有効で、診断に反映される



### QA-QA-1271-02 — testScoreLogic 検証失敗時に Storage を更新しない

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: spec gap: UC1271 のエラーパス。不正な scoreLogic で検証失敗した場合に Storage を書き換えない non-negotiable な挙動が未文書化

**検証手順**:

1. ユーザー操作: 不正な内容の scoreLogic をアップロード→検証実行

1. 期待 DOM 反映: 検証失敗エラーが表示され原因が示される

1. 期待 DB / API 状態: Storage の scoreLogic は更新前のまま維持される

1. 再読込・別セッションでの再確認: 再読込後も従来の scoreLogic が有効



### QA-QA-1271-03 — 現在の scoreLogic 内容のファイル書き出し

- **node_id**: `None`
- **priority**: `nice`
- **applicable_roles**: operator
- **rationale**: spec gap: UC1271 の書き出し機能。エクスポート内容が Storage の現行値と一致することの検証仕様が未記載

**検証手順**:

1. ユーザー操作: 設定画面で現在の scoreLogic をファイルとして書き出す

1. 期待 DOM 反映: ダウンロード/書き出し完了が示される

1. 期待 DB / API 状態: 書き出されたファイル内容が Storage の現行 scoreLogic と一致

1. 再読込・別セッションでの再確認: 書き出し操作で Storage 側が変更されないこと



### QA-QA-1272-01 — センサーモード・各種フラグの切替と Storage 永続化

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: spec gap: UC1272 のセンサーモード(smartphoneOnly/canDataOnly/combination)と各フラグの永続化仕様が未整備

**検証手順**:

1. ユーザー操作: 設定画面でセンサーモードを切替、録画/GPSデモ/ログ保存/センサログ保存フラグを変更

1. 期待 DOM 反映: 選択したモード・フラグが UI 上で選択状態として反映される

1. 期待 DB / API 状態: 各設定値が Storage に永続化される

1. 再読込・別セッションでの再確認: 再起動後も設定値が保持され、次回診断に適用される



### QA-QA-1273-01 — /edit でのデモデータ再生とScoreLogic編集・testScoreLogic試験実行

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: spec gap: UC1273 の gz センサログ/webm 動画アップロードによる DemoData 再生とエディタ試験実行フローの spec が未整備

**検証手順**:

1. ユーザー操作: ブラウザで /edit を開き gz センサログと webm 動画をアップロード→DemoData 再生→ScoreLogic 編集→testScoreLogic 実行

1. 期待 DOM 反映: デモ再生が動作し、試験実行結果(成否)がエディタ上に表示される

1. 期待 DB / API 状態: 試験実行時点では Storage/永続保存は行われない（保存操作まで非破壊）

1. 再読込・別セッションでの再確認: 保存前の試験実行では既存 scoreLogic が変更されていないこと



### QA-QA-1273-02 — 試験成功時の保存でヘッダに //<UnixTime> と //<日付> を差し込む

- **node_id**: `None`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: spec gap: UC1273 の保存時ヘッダ差し込み(先頭に //<UnixTime> と //<日付>)という具体仕様が未文書化。差し込みフォーマット/多重差し込み防止の検証が必要

**検証手順**:

1. ユーザー操作: /edit で testScoreLogic 成功後に保存を実行

1. 期待 DOM 反映: 保存成功が表示される

1. 期待 DB / API 状態: 保存された内容の先頭に //<UnixTime> と //<日付> が 1 組だけ差し込まれる

1. 再読込・別セッションでの再確認: 再度保存しても差し込み行が重複せず、最新のタイムスタンプに更新される





---

## 既存シナリオへの修正提案


（修正提案なし）


---

## 削除提案


（削除提案なし）


---

## 優先度調整



- `QA-QA-1267-01` → **should** : 運転診断は本アプリの中核業務フローだが spec 根拠がない spec gap 状態のため must 断定を避け should とする

- `QA-QA-1271-02` → **should** : 検証失敗時に Storage を保護する非破壊挙動は重要だが spec 未確定のため should

- `QA-QA-1265-01` → **should** : '****' 現行維持ロジックは誤実装リスクが高いが spec 未確定のため should

- `QA-QA-1268-02` → **nice** : 空状態は重要だが spec 未定義かつ縁ケースのため nice

- `QA-QA-1270-02` → **nice** : 件数境界は要検証だが上限仕様が未確定のため nice

- `QA-QA-1271-03` → **nice** : 書き出しは補助機能のため nice



---

## Open Questions



### 自動ログインの 72 時間しきい値の境界定義

- **質問**: UC1263 の『3日(72時間)以内』は 72 時間ちょうどを含むか、また基準時刻は最終ログイン時刻か最終アクティブ時刻か。spec 文書が存在しない。
- **保留中の判断**: QA-QA-1263-01, QA-QA-1263-02


### アカウント編集のパスワード維持ロジック仕様化

- **質問**: UC1265 の '****' 維持と変更時 MD5 保存の分岐条件、および入力値がたまたま '****' の場合の扱いを spec 化する必要がある。
- **保留中の判断**: QA-QA-1265-01, QA-QA-1265-02


### アカウント削除のカスケード対象と整合性

- **質問**: UC1266 で削除する user/score/score_history/capability_score 以外に削除すべき関連データ（録画ファイル等）があるか、トランザクション/部分失敗時の扱いが未定義。
- **保留中の判断**: QA-QA-1266-01


### 運転診断結果の SQLite 保存スキーマとタイミング

- **質問**: UC1267 の走行終了時にどのテーブルへ何を保存するか、走行中断/異常終了時の保存挙動が spec 化されていない。
- **保留中の判断**: QA-QA-1267-01, QA-QA-1267-02


### アドバイス・ヒストリーの集計仕様（件数上限/N日平均/空状態）

- **質問**: UC1270 の直近 30 回上限、能力指標の過去 N 日の N 値、および実績 0 件時の空状態表示が未定義。
- **保留中の判断**: QA-QA-1268-02, QA-QA-1270-01, QA-QA-1270-02


### testScoreLogic の合否判定基準と Storage 更新条件

- **質問**: UC1271/UC1273 における testScoreLogic の合格条件、失敗時の Storage 非更新保証、保存時ヘッダ(//<UnixTime>/日付)差し込みフォーマットが spec 化されていない。
- **保留中の判断**: QA-QA-1271-01, QA-QA-1271-02, QA-QA-1273-01, QA-QA-1273-02


### 運用担当者/開発者ロールのアクセス制御

- **質問**: UC1271/UC1272/UC1273 は運用担当者・開発者向け機能だが、ドライバーロールからのアクセス制限があるか、/edit /設定画面 の到達制御が未定義。
- **保留中の判断**: QA-QA-1271-01, QA-QA-1272-01, QA-QA-1273-01




---

## Spec to update（参考）


LLM が修正対象として挙げた仕様書：

- `spec/qa/auth-and-account.md`

- `spec/qa/driving-diagnosis.md`

- `spec/qa/advice-and-badspot.md`

- `spec/qa/history-and-charts.md`

- `spec/qa/scorelogic-and-settings.md`



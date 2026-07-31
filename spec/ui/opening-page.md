<!-- 作成: 2026-07-20 09:55:53 JST | 更新: 2026-07-20 10:30:14 JST -->

```json
{
  "required_changes": [
    {"node": "ui.opening.page", "entrypoint": "spec/ui/opening-page.md", "description": "未ログイン時アクセス制御方針（ログイン必須画面への導線制御とオープニング誘導）を追記"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "should", "reason": "未ログイン判定(loginUser.userId=='')の提供元・ロール判定(env.config.environment参照)のロジックがUI導線制御の前提となる"},
    {"domain": "DB-agent", "severity": "could", "reason": "userId=''時に0件返却しレコード生成しない前提がUIの未ログイン表示制御と整合している必要がある"}
  ],
  "requirements_context": "オープニング画面は未ログイン（loginUser.userId=''）状態でのアクセス制御方針を持つ。ログイン必須画面（運転診断=/driving、履歴=/history、アカウント編集=/account/modify、アドバイス=/comment）へは未ログイン時に到達させず、導線を非表示にするかログインを要求してオープニングへ誘導する。設定画面（/settings）はScore DBへアクセスしない項目のみ未ログインでも到達可能という既存ルールを維持する。DB層はuserId=''で0件返却しレコードを生成しない前提と整合させる。ロール定義（driverが主、operator/developerは運用区分で権限ゲート最小）はenv.config.environmentを参照する。既存の初期化フロー・自動ログイン・scoreLogic配布・ダイアログ仕様は現行のまま維持する。",
  "fact_candidates": [
    {"type": "permission_rule", "title": "未ログイン時はログイン必須画面へ到達させない", "statement": "loginUser.userId=='' の未ログイン状態では、運転診断(/driving)・履歴(/history)・アカウント編集(/account/modify)・アドバイス(/comment)へ到達させない", "status": "candidate"},
    {"type": "display_rule", "title": "未ログイン時はログイン必須画面への導線を非表示またはログイン要求", "statement": "未ログイン時、ログイン必須画面への導線は非表示にするか、押下時にログインを要求してオープニングへ誘導する", "status": "candidate"},
    {"type": "permission_rule", "title": "設定画面は未ログインでも到達可能", "statement": "設定画面(/settings)はScore DBへアクセスしない設定項目のみ利用する前提で未ログインでも到達可能とする", "status": "candidate"},
    {"type": "permission_rule", "title": "ロール定義はenv.config.environmentを参照", "statement": "ロール（driver主／operator・developerは運用区分で権限ゲート最小）はenv.config.environmentを参照して判定する", "status": "candidate"},
    {"type": "constraint", "title": "既存の初期化・自動ログイン・配布・ダイアログ仕様は維持", "statement": "初期化フロー・自動ログイン・scoreLogic配布・ダイアログ仕様は現行のまま変更しない", "status": "candidate"}
  ],
  "open_questions": [
    "未ログイン時のログイン必須画面制御は『導線非表示』か『押下時ログイン要求』かどちらを既定とするか（UX方針・要確認）",
    "アドバイス画面(/comment)・履歴画面(/history)の正確なルートパスとオープニングからの導線有無（Routing/UI要確認）",
    "operator/developer ロールで未ログイン制御の挙動が driver と異なるか（Middleware/権限設計と要確認）",
    "未ログインで設定画面到達時、Score DB依存項目をどう非表示/無効化するかの具体UI（settings画面側と要確認）"
  ],
  "rationale_notes": [
    "UIは到達可否と導線表示の責務を持ち、ログイン判定やロール判定のロジックはMiddleware側に依存する",
    "DB層のuserId=''で0件返却・レコード非生成の前提により、未ログイン時に空表示となるがUIは事前に導線制御することで不整合表示を防ぐ",
    "設定画面のみ例外的に未ログイン到達可能とする既存ルールを維持することで、初期設定操作を妨げない"
  ]
}
```
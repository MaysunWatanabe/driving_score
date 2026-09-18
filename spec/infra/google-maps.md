<!-- 作成: 2026-08-31 16:23:52 JST | 更新: 2026-09-10 17:35:09 JST -->

```json
{
  "required_changes": [
    {
      "node": "infra.google.maps",
      "entrypoint": "spec/infra/google-maps.md",
      "description": "approved design_decision（開発/実機検証のキー同一共用・供給経路分離・GCP両API有効化・制限は無しまたは緩い・本番分離は別判断）を仕様本文として確定維持し、関連ユースケース UC06/UC08 を明記する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "env",
      "severity": "should",
      "reason": "Web は environment.secrets.ts、Android は local.properties/manifestPlaceholders という供給経路分離が env.config 系仕様と一致しているか確認が必要"
    },
    {
      "domain": "middleware",
      "severity": "could",
      "reason": "Web 側 mapsKey の取得元が environment.secrets.ts 前提のため middleware.map.service の参照先整合を確認してもよい"
    }
  ],
  "requirements_context": "# infra.google.maps — Google Maps API（Web JS / Android SDK）\n\n## 概要\n地図表示は Web（Maps JavaScript API）と Android ネイティブ（Maps SDK for Android）の 2 経路で構成される。Web 側は `@googlemaps/js-api-loader` を用いて Google Maps JS API をブラウザ側で 1 度だけロードする。API キーは Web（JS）側を供給経路 `environment.secrets.ts`（`environment.mapsKey` 等）に、Android ネイティブ側を `local.properties` / `manifestPlaceholders` および `AndroidManifest.xml` の `com.google.android.geo.API_KEY` に配置する。供給経路は分離維持する。\n\n## 関連ユースケース\n- UC06: 運転診断の実行（走行中の地図表示・車両マーカー・軌跡描画）\n- UC08: ヒヤリ地点確認（ヒヤリマーカー表示・地図操作）\n\n## 真実源\n- `src/data/package.json` — `\"@googlemaps/js-api-loader\": \"^1.15.2\"`\n- `src/data/src/app/services/map.service.ts` — Loader 設定\n- Web キー供給: `environment.secrets.ts`（およびこれを参照する environment 系）\n- Android キー供給: `local.properties` / `manifestPlaceholders`、`src/data/android/app/src/main/AndroidManifest.xml` — `com.google.android.geo.API_KEY`\n\n## API キー方針\n- **開発／実機検証フェーズ**に限り、キー値の同一共用を許容する（Web JS と Android Native で同一キー値でよい）。\n- **供給経路は分離維持**する: Web は `environment.secrets.ts`、Android は `local.properties` / `manifestPlaceholders`（および Manifest の `API_KEY`）。経路を一本化しない。\n- Google Cloud 上で **Maps JavaScript API** と **Maps SDK for Android** の両方を有効化する。\n- **Application restrictions（アプリ制限）**は、開発／実機検証フェーズでは **無し、または緩い制限**を許容する。\n- **本番 release**（`local.properties.release` 等）におけるキー分離・制限の方針は **別判断**とし、本ノードでは確定しない。\n- API キーの管理ガバナンス・未解決の運用詳細は必要に応じて `spec/unknowns.md` を参照する。\n\n## Loader 設定\n```\nnew Loader({\n  apiKey: environment.mapsKey,\n  version: 'weekly',\n  region: 'JP',\n  language: 'ja'\n});\n```\n- `region=JP` / `language=ja` により日本向け表記・地図データを取得する。\n- ロード完了までコールバックをキューして、以降のマップ生成を許可する（`isInitialize` フラグで再ロードを防止）。\n\n## 使用 API\n- `google.maps.Map`（`mapTypeControl` / `zoomControl` / `streetViewControl` / `fullscreenControl` / `rotateControl` はすべて false）\n- `google.maps.Marker`（ヒヤリマーカー・軌跡円マーカー・S/E マーカー・車両マーカー）\n- `google.maps.LatLng` / `google.maps.LatLngBounds`\n- `google.maps.SymbolPath.CIRCLE` / `SymbolPath.FORWARD_CLOSED_ARROW`\n- Map リスナ: `drag` / `idle` / Marker `click`\n\n## 関連ノード\n- 実装ラッパ: [[middleware.map.service]]\n- 呼び出し元: [[ui.opening.page]] / [[ui.driving.page]] / [[ui.badspot.page]]\n- 環境・Capacitor 設定: [[env.config.environment]] / [[env.config.capacitor]]\n",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "開発/実機検証では Maps キー値の同一共用を許容",
      "statement": "開発／実機検証フェーズに限り、Google Maps API キー値は Web JS と Android Native で同一共用を許容する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "Maps キー供給経路は Web と Android で分離",
      "statement": "Maps API キーの供給経路は Web 側 environment.secrets.ts と Android 側 local.properties / manifestPlaceholders を分離維持する",
      "status": "approved"
    },
    {
      "type": "external_integration_rule",
      "title": "GCP で Maps JS API と Android SDK を両有効化",
      "statement": "Google Cloud で Maps JavaScript API と Maps SDK for Android の両方を有効化する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "開発/実機検証のアプリ制限は無しまたは緩い制限",
      "statement": "開発／実機検証フェーズでは Maps API キーの Application restrictions は無しまたは緩い制限を許容する",
      "status": "approved"
    },
    {
      "type": "open_question",
      "title": "本番 release の Maps キー分離方針は別判断",
      "statement": "本番 release（local.properties.release 等）における Maps API キーの分離・制限方針は本ノードでは未確定（別判断）である",
      "status": "open_question"
    },
    {
      "type": "external_integration_rule",
      "title": "Maps JS Loader は weekly / JP / ja",
      "statement": "Google Maps JS API は @googlemaps/js-api-loader により apiKey=environment.mapsKey、version=weekly、region=JP、language=ja でロードする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Maps JS API はブラウザで一度だけロード",
      "statement": "Google Maps JS API はブラウザ側で一度だけロードし、isInitialize フラグで再ロードを防止する",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "Android 側キーは Manifest の geo.API_KEY に注入",
      "statement": "Android ネイティブの Maps キーは AndroidManifest.xml の com.google.android.geo.API_KEY に manifestPlaceholders 経由で注入される",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "UC06/UC08 は Google Maps 経路に依存する",
      "statement": "運転診断の実行（UC06）およびヒヤリ地点確認（UC08）は Google Maps API（Web JS / Android SDK）の地図表示に依存する",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "本番 release（local.properties.release 等）のキー分離・Application restrictions・CI/Secrets 注入の方針が未確定。別判断待ちのため、本番用 GCP キー運用・ローテーション・平文コミット有無が確定しない（env/CI ドメイン判断が必要）",
    "environment.mapsKey の実体が environment.secrets.ts からの export/再 export か、ビルド時置換かなど Web 側の具体的な注入・参照チェーンが未確定。env.config 側の確定が必要で、決まらないとローカル開発手順とシークレット管理に影響する",
    "開発/実機検証で『緩い制限』を用いる場合の具体的 allow 値（HTTP referrer、package name + SHA-1 の有無と範囲）が未確定。GCP Console 設定の再現性および実機ビルドの地図表示可否に影響する（infra/env 判断が必要）",
    "UC06/UC08 における Maps API 呼び出し量（マーカー数・タイル取得）に対するクォータ・課金上限の前提が未確定。負荷試験や長時間走行検証時の到達可否に影響する"
  ],
  "rationale_notes": [
    "node=infra.google.maps の approved design_decision を真とし、既存 md と矛盾がなかったためキー方針本文はそのまま維持した",
    "今回の context で指定された UC06/UC08 を「関連ユースケース」節として追記し、地図依存のトレーサビリティを明示した",
    "node 不一致の approved design_decision（ログ書き出しルート、スコアロジック実装実態など）は本ノードの Maps API キー／Loader 範囲外のため仕様本文へ取り込まない",
    "Loader オプション・使用 API 面・一度だけのロードは approved fact による否定がないため既存記述を維持した",
    "キー値の共用を許容しても供給経路を分離維持するのは、本番フェーズでキー分離へ移行する際にコード変更を最小化するためである"
  ]
}
```
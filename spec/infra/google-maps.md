<!-- 作成: 2026-07-20 09:55:53 JST | 更新: 2026-07-23 19:33:14 JST -->

```json
{
  "required_changes": [
    {
      "node": "infra.google.maps",
      "entrypoint": "spec/infra/google-maps.md",
      "description": "approved facts に合わせ API キー本数（dev/prod 各1・Web+Android共用）、Application restrictions、CI の GitHub Secrets 注入と REPLACE_ME フォールバックを仕様へ反映し矛盾記述を改訂"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "middleware",
      "severity": "could",
      "reason": "mapsKey の取得元・環境差（dev/prod）が Loader 初期化に影響し得るため middleware.map.service 側の参照整合を確認してもよい"
    }
  ],
  "requirements_context": "# infra.google.maps — Google Maps JavaScript API\n\n## 概要\n`@googlemaps/js-api-loader` を用いて Google Maps JS API をブラウザ側で 1 度だけロードする。API キーは Web（JS）側を [[env.config.environment]] の `environment.mapsKey` に、Android ネイティブ側を [[env.config.capacitor]] の `AndroidManifest.xml` `com.google.android.geo.API_KEY`（およびビルド時の manifestPlaceholders / local.properties）に配置する。用途分離は「別フィールドに配置する」こととし、同一環境では同一キー値でよい。\n\n## 真実源\n- `src/data/package.json` — `\"@googlemaps/js-api-loader\": \"^1.15.2\"`\n- `src/data/src/app/services/map.service.ts` — Loader 設定\n- `src/data/src/environments/environment.ts` — mapsKey\n- `src/data/android/app/src/main/AndroidManifest.xml` — geo.API_KEY\n\n## API キー方針\n- キー本数: **dev 1 本 + prod 1 本 = 合計 2 本**。\n- dev キーは Web JS と Android Native で共用する。prod キーも同様に Web JS と Android Native で共用する。\n- 「用途分離」は別フィールド（`environment.mapsKey` と Android `API_KEY` / manifestPlaceholders 等）へ置くことを指し、**同一環境内でキー値を分ける必要はない**（同一キー値でよい）。\n- 各キーの Application restrictions には **HTTP referrers と Android package + SHA-1 の両方**を許可する。\n- CI では GitHub Secrets 経由で実キー（または専用の非本番キー）を `manifestPlaceholders` / `local.properties` へ注入する。\n- `REPLACE_ME` はキー未設定時のみのフォールバックに限定する（本番・通常 CI 経路で常駐させない）。\n- API キーの管理ガバナンス・未解決の運用詳細は必要に応じて `spec/unknowns.md` を参照する。\n\n## Loader 設定\n```\nnew Loader({\n  apiKey: environment.mapsKey,\n  version: 'weekly',\n  region: 'JP',\n  language: 'ja'\n});\n```\n- `region=JP` / `language=ja` により日本向け表記・地図データを取得する。\n- ロード完了までコールバックをキューして、以降のマップ生成を許可する（`isInitialize` フラグで再ロードを防止）。\n\n## 使用 API\n- `google.maps.Map`（`mapTypeControl` / `zoomControl` / `streetViewControl` / `fullscreenControl` / `rotateControl` はすべて false）\n- `google.maps.Marker`（ヒヤリマーカー・軌跡円マーカー・S/E マーカー・車両マーカー）\n- `google.maps.LatLng` / `google.maps.LatLngBounds`\n- `google.maps.SymbolPath.CIRCLE` / `SymbolPath.FORWARD_CLOSED_ARROW`\n- Map リスナ: `drag` / `idle` / Marker `click`\n\n## 関連ノード\n- 実装ラッパ: [[middleware.map.service]]\n- 呼び出し元: [[ui.opening.page]] / [[ui.driving.page]] / [[ui.badspot.page]]\n- 環境・Capacitor 設定: [[env.config.environment]] / [[env.config.capacitor]]\n",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "Maps API キーは dev 1 本 + prod 1 本",
      "statement": "Google Maps API キーは dev 用 1 本と prod 用 1 本の合計 2 本とし、各環境で Web JS と Android Native が同一キーを共用する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Maps キーの用途分離は別フィールド配置",
      "statement": "Maps API キーの用途分離は environment.mapsKey と Android API_KEY（manifestPlaceholders / local.properties 等）など別フィールドへ配置することを指し、同一環境内では同一キー値でよい",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Maps キーの Application restrictions",
      "statement": "各 Maps API キーの Application restrictions には HTTP referrers と Android package+SHA-1 の両方を許可する",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "CI の Maps キーは GitHub Secrets から注入",
      "statement": "CI の Maps キーは GitHub Secrets 経由で実キー（または専用の非本番キー）を manifestPlaceholders / local.properties へ注入する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "REPLACE_ME はキー未設定時のみのフォールバック",
      "statement": "REPLACE_ME は Maps キー未設定時のみのフォールバックに限定する",
      "status": "candidate"
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
    }
  ],
  "open_questions": [
    "prod/dev それぞれの HTTP referrers と Android package 名 + SHA-1 証明書指紋の具体値一覧はどこを真実源とするか（env/CI ドメイン確認）。決まらないと GCP Console 側 restrictions の実装と CI シークレット設計が確定しない",
    "Web 用 mapsKey のビルド時注入経路（environment.ts の置換有無）が Android の Secrets 注入と対称か、env.config 側の確定が必要。決まらないと平文コミット有無とローテーション手順に影響する"
  ],
  "rationale_notes": [
    "既存 MD の『値は 2 箇所で異なる』は approved fact（同一キー値でよい／dev・prod 各1本共用）と矛盾するため facts を真として削除・改訂した",
    "scoping レポート永続化の design_decision は docs/design のみ対象で spec 非変更指示のため本ノード本文には取り込まない",
    "Loader オプション・使用 API 面は既存仕様に approved fact による否定がなく維持した"
  ]
}
```
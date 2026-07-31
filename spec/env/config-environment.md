<!-- 作成: 2026-07-20 10:30:36 JST | 更新: 2026-07-23 19:32:37 JST -->

```json
{
  "required_changes": [
    {
      "node": "env.config.environment",
      "entrypoint": "spec/env/config-environment.md",
      "description": "mapsKey を平文埋め込みから secrets 分離供給（.env 相当 + .gitignore + .example）へ改訂し、既存キー失効・新キー入れ替えと値の非掲載を反映する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "Infra-agent",
      "severity": "must",
      "reason": "Android 側 geo.API_KEY も manifestPlaceholders + local.properties による secrets 分離へ同期改訂が必要（同一 drift の 3 spec ノード改訂対象）"
    },
    {
      "domain": "Middleware-agent",
      "severity": "should",
      "reason": "middleware.map.service が参照する mapsKey の供給元が環境ファイル平文から secrets 注入後の environment 値へ変わるため整合確認が必要"
    }
  ],
  "requirements_context": "環境設定ノード env.config.environment は Angular fileReplacements による environment.ts / environment.prod.ts 切替を真実源とする。production 以外のキーは dev/prod 同一。mapsKey は @googlemaps/js-api-loader（Google Maps JS API Loader）専用の JS Maps API キーであり、AndroidManifest の geo.API_KEY（ネイティブ Maps SDK 専用）とは用途分離された別キーである。approved fact（drift-20260720-gmaps-key-envs, commit d6b1de5）により、旧来のリポジトリ平文埋め込みは廃止し、.env 相当 + .gitignore + .example テンプレによる secrets 分離供給へ改訂する。既存キー 2 本は失効させ新キーへ入れ替える。仕様書・リポジトリに実キー値を掲載・コミットしない。Android 側は manifestPlaceholders + local.properties（env.config.capacitor 等で扱い）。ロール定義（driver=主ユーザー／運転診断対象、operator・developer=運用・開発上の役割区分）は概念上の区分であり、アプリ内に RBAC 等の技術的権限制御ゲートはなく、認証は LoginService による単一ユーザー認証のみでロールベース権限分岐コードは存在しない。geolocation 系・Storage キー群・sensorStockTime 等の他環境値は現行どおり維持。staging 用分岐は存在しない。鍵ローテーションポリシーや API キー制限の運用詳細は未確定のまま unknowns とし得る。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "Maps API キーは secrets 分離で供給する",
      "statement": "mapsKey はリポジトリに平文コミットせず、.env 相当ファイルと .gitignore および .example テンプレートによる secrets 分離実装で environment に供給される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "既存 Maps API キー2本は失効し新キーへ入れ替える",
      "statement": "従前埋め込みされていた Maps 用 API キー2本は失効させ、secrets 分離後の新キーへ入れ替える",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "mapsKey は Google Maps JS API 専用キー",
      "statement": "environment.mapsKey は @googlemaps/js-api-loader（Google Maps JS API Loader）に渡す JS Maps API 専用の API キーである",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "geo.API_KEY はネイティブ Maps SDK 専用で用途分離",
      "statement": "AndroidManifest の geo.API_KEY はネイティブ Maps SDK 専用キーであり mapsKey とは用途が分離された別キーである",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "environment に実キー値を仕様へ平文記載しない",
      "statement": "仕様書およびソースのコミット対象に mapsKey の実値を平文で記載してはならない",
      "status": "candidate"
    },
    {
      "type": "permission_rule",
      "title": "driver は主ユーザー（運転診断対象）",
      "statement": "ロール driver はアプリの主ユーザーであり運転診断の対象である",
      "status": "candidate"
    },
    {
      "type": "permission_rule",
      "title": "operator/developer は技術的権限ゲートを持たない",
      "statement": "ロール operator および developer は運用・開発上の役割区分でありアプリ内の技術的権限制御ゲートを持たず区別は画面到達可否程度に留まる",
      "status": "candidate"
    },
    {
      "type": "permission_rule",
      "title": "認証は LoginService の単一ユーザー認証のみ",
      "statement": "認証実装は LoginService による単一ユーザー認証のみでロールに基づく権限分岐コードはアプリ内に存在しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "staging 用 environment 分岐は存在しない",
      "statement": "環境ファイルは dev/prod の2種類のみで staging 用の分岐は存在しない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "新 mapsKey / geo.API_KEY のローテーションポリシー・API キー制限（HTTP リファラ制限・パッケージ名署名制限等）の設定有無と管理責任者は未確定。運用・セキュリティ担当または Infra ドメインの判断が必要。決まらないと鍵管理ガバナンス仕様が確定しない。",
    "operator/developer ロールの『画面到達可否程度の区別』が具体的にどの画面/ルートで生じるかは UI/ルーティング側の確認が必要。",
    "secrets 注入のビルド時手順（CI での .env 供給方法を含む）の確定範囲が env のみか Infra/CI 仕様まで跨るかは Infra ドメイン確認が必要。決まらないとデプロイ手順が確定しない。"
  ],
  "rationale_notes": [
    "approved fact drift-20260720-gmaps-key-envs を真とし、既存 md の平文キー掲載・平文埋め込み前提を破棄して secrets 分離供給に改訂した。",
    "用途分離（JS Maps API 専用 vs ネイティブ Maps SDK 専用）は維持し、Android 側の manifestPlaceholders + local.properties は suggested_impacts で Infra/capacitor 側へ連携する。",
    "ロール定義は RBAC 実装を伴わない概念上の区分である旨を維持し、実装誤解を防ぐ。",
    "geolocation 系・Storage キー群・sensorStockTime 等は本 integrate のスコープ外として現行記述を維持する。",
    "検討段階の scoping レポート永続化 fact は canonical spec に触れない設計判断のため本ノード本文には反映しない。"
  ]
}
```

# env.config.environment — アプリ全体で共有する設定値

## 概要
Angular の `fileReplacements` により `environment.ts`（開発用）と `environment.prod.ts`（本番用）を切り替える。`production` 以外の値は 2 ファイルとも同一。

## 真実源
- `src/data/src/environments/environment.ts`
- `src/data/src/environments/environment.prod.ts`
- Maps API キー（`mapsKey`）の供給源: **secrets 分離**（`.env` 相当 + `.gitignore` + `.example` テンプレート）。実キーはリポジトリにコミットしない。

## 定義される値
| キー | 型 | 値 | 用途 |
|---|---|---|---|
| `production` | boolean | dev=false / prod=true | [[env.app.bootstrap]] が `enableProdMode()` を呼ぶ判定 |
| `mapsKey` | string | **（secrets から供給。実値はリポジトリ・本仕様に平文掲載しない）** | [[middleware.map.service]] が Google Maps **JS API Loader**（`@googlemaps/js-api-loader`）に渡す **JS Maps API 専用キー** |
| `geolocationMaximumAge` | number | `0` | `Geolocation.watchPosition` の `maximumAge`（ms） |
| `geolocationTimeout` | number | `1000` | `Geolocation.watchPosition` の `timeout`（ms） |
| `geolocationLastPosKey` | string | `'geolocation-last-pos-key'` | Ionic Storage キー: 最後に取得できた緯度経度（`{lat,lng}` を JSON 文字列で保存） |
| `sensorStockTime` | number | `60000` | [[middleware.score.logic]] が古いセンサーサンプルを間引く上限（ms） |
| `scoreLogicKey` | string | `'driving-score-logic'` | Ionic Storage キー: 動的評価する運転診断ロジック JS 本体 |
| `scoreLogicJsonKey` | string | `'score-logic-json'` | Ionic Storage キー: スコアメッセージ辞書 JSON |
| `loginKey` | string | `'login'` | Ionic Storage キー: 自動ログイン用 `{timestamp, userId, userPassword}` |
| `lastLoginUserId` | string | `'last-login-user-id'` | Ionic Storage キー: 直近ログインした userId |
| `settingRecording` | string | `'setting-recording'` | Ionic Storage キー: 録画 ON/OFF |
| `settingGpsDemo` | string | `'setting-gps-demo'` | Ionic Storage キー: GPS デモモード ON/OFF |
| `settingLogStorage` | string | `'setting-log-storage'` | Ionic Storage キー: デバッグログ保存 ON/OFF |
| `settingSensorLogStorage` | string | `'setting-sensor-log-storage'` | Ionic Storage キー: センサログ保存 ON/OFF |
| `settingSelectedSensorMode` | string | `'setting-selected-sensor-mode'` | Ionic Storage キー: センサーモード（`smartphoneOnly` / `canDataOnly` / `combination`） |

## ロール定義
アプリで想定されるロールは以下のとおり。**これらは概念上の役割区分であり、アプリ内に RBAC（ロールベースアクセス制御）等の技術的な権限制御ゲートは実装されていない。**

| ロール | 位置づけ | 権限制御 |
|---|---|---|
| `driver` | アプリの主ユーザー。運転診断（スコアリング）の対象。 | なし（技術的ゲートなし） |
| `operator` | 運用上の役割区分。 | なし（区別は到達可能な画面の違い程度に留まる） |
| `developer` | 開発上の役割区分。 | なし（区別は到達可能な画面の違い程度に留まる） |

- 認証は [[middleware.login.service]]（LoginService）による**単一ユーザー認証のみ**で、ログイン成否のみを扱う。
- **ロールに基づく権限分岐コードはアプリ内に存在しない。** operator / developer と driver の違いは、機能的な権限差ではなく「どの画面に到達し得るか」という運用上の区別に留まる。

## 注意事項
- **Maps API キーは用途別に 2 種類存在し、用途分離された正当な別キーである（値が異なることは矛盾ではない）。**
  - `mapsKey`（環境ファイルへ **secrets 注入**）… **Google Maps JS API 専用キー**。`@googlemaps/js-api-loader` 経由で Web/JS の地図描画に使用する（[[middleware.map.service]]）。
  - `AndroidManifest.xml` の `com.google.android.geo.API_KEY`（[[env.config.capacitor]]）… **ネイティブ Maps SDK 専用キー**。供給は **manifestPlaceholders + local.properties** による secrets 分離とする（実値はリポジトリ・本仕様に平文掲載しない）。
- **secrets 分離（必須）**
  - 採用実装: `drift-20260720-gmaps-key-envs`（commit `d6b1de5`）。
  - JS 側: `.env` 相当 + `.gitignore` + `.example` テンプレートで `mapsKey` を供給し、`environment*.ts` に実キーを平文コミットしない。
  - Android 側: `manifestPlaceholders` + `local.properties`（詳細は [[env.config.capacitor]]）。
  - **既存キー 2 本は失効させ、新キーへ入れ替える。** 旧平文埋め込み値は無効として扱う。
  - キー管理ガバナンス（ローテーション方針・API キー制限の設定有無・管理責任者等）の運用詳細は未整理の場合 `spec/unknowns.md` を参照。
- 環境ファイルは dev/prod の 2 種類のみで、staging 用の分岐は存在しない。

## 関連ノード
- 参照元: 全サービス/ページ（`import { environment }` から利用）
- [[middleware.map.service]]: `mapsKey`（JS Maps API 専用）を利用
- [[env.config.capacitor]]: `AndroidManifest.xml` の `geo.API_KEY`（ネイティブ Maps SDK 専用）を secrets 分離で保持
- [[middleware.login.service]]: 単一ユーザー認証を担い、ロールベースの権限分岐は持たない
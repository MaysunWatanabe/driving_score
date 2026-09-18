<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:28:10 JST -->

```json
{
  "required_changes": [
    {
      "node": "env.config.environment",
      "entrypoint": "spec/env/config-environment.md",
      "description": "secrets 供給の実体を environment.secrets.ts として明記し、読み込み順（secrets → environment/environment.prod の fileReplacements）と未配置時の ionic build 失敗（cap sync へ進まない）を追記する"
    },
    {
      "node": "env.config.environment",
      "entrypoint": "spec/env/config-environment.md",
      "description": "開発／実機検証フェーズ限定で Web(JS API) と Android(SDK) の Maps キー値共用を許容する旨と、供給経路（environment.secrets.ts / local.properties+manifestPlaceholders）の分離維持、本番 release 方針は未決である旨を明記する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "Infra-agent",
      "severity": "must",
      "reason": "Android 側は local.properties + manifestPlaceholders 経路で geo.API_KEY を供給する前提であり、値共用許容と経路分離維持、未配置時のビルド失敗挙動を capacitor/Gradle 側仕様と同期させる必要がある"
    },
    {
      "domain": "Infra-agent",
      "severity": "should",
      "reason": "environment.secrets.ts と local.properties は VCS 管理外のため、CI/ローカル環境での secrets 供給手順とテンプレート（.example）配置がビルド成立条件になる"
    },
    {
      "domain": "Middleware-agent",
      "severity": "should",
      "reason": "middleware.map.service が参照する environment.mapsKey の供給元が environment.secrets.ts 経由となるため、UC06 の地図描画・UC01 後の初期化経路で値未設定時の挙動整合を確認する必要がある"
    }
  ],
  "requirements_context": "env.config.environment は Angular の fileReplacements による environment.ts（開発）/ environment.prod.ts（本番）切替を真実源とし、production 以外の値は両ファイル同一である。secrets の実体は environment.secrets.ts であり、environment.ts / environment.prod.ts の双方がこれを import して mapsKey 等の秘匿値を取得する（読み込み順: environment.secrets.ts → environment(.prod).ts → 各サービスの import { environment }）。environment.secrets.ts は VCS 管理外（.gitignore）で、テンプレート（.example）を配布物とする。environment.secrets.ts が未配置の場合、ionic build は失敗しなければならず、黙殺して cap sync に進んではならない。approved fact により、Google Maps キーは開発／実機検証フェーズに限り Web(JS API) と Android(SDK) で同一キー値の共用を許容するが、供給経路は environment.secrets.ts（JS 側）と local.properties + manifestPlaceholders（Android 側）で分離を維持する。本番 release における Web/Android キー分離方針は本仕様では未決とする。従前リポジトリに平文埋め込みされていた既存キー 2 本は失効させ新キーへ入れ替え、仕様書・リポジトリに実キー値を掲載・コミットしない。UC01（未ログインのログイン）は loginKey / lastLoginUserId 等の Storage キー定義、UC06（運転診断の実行）は sensorStockTime / scoreLogicKey / scoreLogicJsonKey / geolocation 系設定および mapsKey に依存する。ロール定義（driver=主ユーザー／運転診断対象、operator・developer=運用・開発上の役割区分）は概念上の区分であり、アプリ内に RBAC 等の技術的権限制御ゲートはなく、認証は LoginService による単一ユーザー認証のみでロールベース権限分岐コードは存在しない。geolocation 系・Storage キー群・sensorStockTime 等の他環境値は現行どおり維持し、staging 用分岐は存在しない。鍵ローテーションポリシーや API キー制限の運用詳細、本番 release の鍵分離方針は未確定。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "秘匿値は environment.secrets.ts に分離される",
      "statement": "mapsKey 等の秘匿値は environment.secrets.ts に定義され、environment.ts / environment.prod.ts はこれを import して参照する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "environment.secrets.ts は VCS 管理外",
      "statement": "environment.secrets.ts は .gitignore 対象でリポジトリにコミットせず、テンプレートとして .example ファイルのみを配布する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "environment.secrets.ts 未配置時は ionic build を失敗させる",
      "statement": "environment.secrets.ts が未配置の場合 ionic build は失敗しなければならず、エラーを黙殺して cap sync に進んではならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "環境設定の読み込み順は secrets → environment → 利用側",
      "statement": "設定値は environment.secrets.ts が environment.ts / environment.prod.ts に取り込まれ、production ビルドでは fileReplacements により environment.ts が environment.prod.ts に差し替えられた上で各サービスが import { environment } で参照する",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "開発／実機検証フェーズは Maps キー値の共用を許容する",
      "statement": "Google Maps キーは開発および実機検証フェーズに限り Web(JS API) と Android(SDK) で同一キー値を共用してよい",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "Maps キーの供給経路は分離を維持する",
      "statement": "Maps キーの値を共用する場合でも、供給経路は JS 側が environment.secrets.ts、Android 側が local.properties + manifestPlaceholders として分離を維持する",
      "status": "approved"
    },
    {
      "type": "open_question",
      "title": "本番 release の Maps キー分離方針は未決",
      "statement": "本番 release における Web(JS API) と Android(SDK) の Maps キー分離方針は本仕様では未決として扱う",
      "status": "open_question"
    },
    {
      "type": "constraint",
      "title": "既存 Maps API キー2本は失効し新キーへ入れ替える",
      "statement": "従前リポジトリに平文埋め込みされていた Maps 用 API キー2本は失効させ、secrets 分離後の新キーへ入れ替える",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "実キー値を仕様・リポジトリに平文記載しない",
      "statement": "仕様書およびコミット対象のソースに Maps API キーの実値を平文で記載してはならない",
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
      "title": "geo.API_KEY はネイティブ Maps SDK 専用の設定項目",
      "statement": "AndroidManifest の com.google.android.geo.API_KEY はネイティブ Maps SDK 用の設定項目であり、mapsKey とは供給経路が分離されている",
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
    "本番 release で Web(JS API) と Android(SDK) の Maps キーを分離するか同一キーのまま制限設定で運用するかは未決。セキュリティ／運用方針判断（Infra ドメイン含む）が必要で、決まらないとリリース時の鍵発行手順が確定しない。",
    "ionic build の失敗をどのレイヤで検出するか（TypeScript の import 解決エラーに委ねるか、prebuild スクリプトで存在チェックして明示メッセージを出すか）は未確定。Infra/ビルド設定側の判断が必要で、決まらないと開発者向けエラー体験が定まらない。",
    "新 mapsKey / geo.API_KEY のローテーションポリシーおよび API キー制限（HTTP リファラ制限・パッケージ名+署名制限等）の設定有無と管理責任者は未確定。運用・セキュリティ担当または Infra ドメインの判断が必要で、決まらないと鍵管理ガバナンス仕様が確定しない。",
    "CI での environment.secrets.ts / local.properties の供給方法（シークレットストア連携・生成スクリプト）が env 仕様の範囲か Infra/CI 仕様の範囲かは未確定。Infra ドメイン確認が必要で、決まらないとデプロイ手順が確定しない。",
    "operator/developer ロールの『画面到達可否程度の区別』が具体的にどの画面/ルートで生じるかは UI/ルーティング側の確認が必要。"
  ],
  "rationale_notes": [
    "secrets の実体を『.env 相当』という抽象表現から environment.secrets.ts という具体ファイルへ改め、読み込み順（secrets → environment(.prod) → 利用側 import）を明示した。",
    "キー値の共用許容はあくまで開発／実機検証フェーズ限定の運用緩和であり、供給経路の分離は緩和対象に含めない。経路を分離しておくことで本番で値を分ける判断に移行してもコード構造を変えずに済む。",
    "未配置時にビルドを失敗させるのは、mapsKey が undefined のまま cap sync/実機配布まで進み『地図が表示されない』という遅い失敗になることを防ぐため（UC06 の地図描画に直結）。",
    "UC01 は loginKey / lastLoginUserId、UC06 は sensorStockTime / scoreLogicKey / scoreLogicJsonKey / geolocation 系と mapsKey を参照するため、これらの定義は本ノードが真実源であることを維持した。",
    "ロール定義は RBAC 実装を伴わない概念上の区分である旨を維持し、実装誤解を防ぐ。",
    "geolocation 系・Storage キー群・sensorStockTime 等は本 compose のスコープ外として現行記述を維持する。"
  ]
}
```

# env.config.environment — アプリ全体で共有する設定値

## 概要
Angular の `fileReplacements` により `environment.ts`（開発用）と `environment.prod.ts`（本番用）を切り替える。`production` 以外の値は 2 ファイルとも同一。秘匿値（Maps API キー等）は両ファイルから **`environment.secrets.ts`** を import して供給する。

## 真実源
- `src/data/src/environments/environment.ts` … 開発用の設定値
- `src/data/src/environments/environment.prod.ts` … 本番用の設定値（`fileReplacements` で `environment.ts` を置換）
- `src/data/src/environments/environment.secrets.ts` … **秘匿値のみ**を保持。**VCS 管理外（`.gitignore`）**
- `src/data/src/environments/environment.secrets.example.ts` … 上記のテンプレート（キー名のみ／実値は空）。**これのみをコミットする**

## ファイルの役割と読み込み順

| # | ファイル | 役割 | VCS |
|---|---|---|---|
| 1 | `environment.secrets.ts` | 秘匿値（`mapsKey` 等）を定義 | 管理外 |
| 2 | `environment.ts` / `environment.prod.ts` | 非秘匿の設定値を定義し、1 を import して合成 | 管理対象 |
| 3 | 各サービス/ページ | `import { environment }` で 2 を参照 | 管理対象 |

読み込み順は **`environment.secrets.ts` → `environment.ts`（production ビルドでは `fileReplacements` により `environment.prod.ts` に差し替え）→ 利用側の `import { environment }`** となる。

### ビルド時の必須条件
- **`environment.secrets.ts` が未配置の場合、`ionic build` は失敗しなければならない。**
- **エラーを黙殺して `cap sync` に進んではならない。** 秘匿値が `undefined` のまま実機へ配布され、地図が表示されない等の遅い失敗を防ぐため。
- 初回セットアップでは `environment.secrets.example.ts` を複製し、実キーを設定する。

## 定義される値
| キー | 型 | 値 | 用途 |
|---|---|---|---|
| `production` | boolean | dev=false / prod=true | [[env.app.bootstrap]] が `enableProdMode()` を呼ぶ判定 |
| `mapsKey` | string | **`environment.secrets.ts` から供給（実値はリポジトリ・本仕様に平文掲載しない）** | [[middleware.map.service]] が Google Maps **JS API Loader**（`@googlemaps/js-api-loader`）に渡すキー（UC06 の地図描画） |
| `geolocationMaximumAge` | number | `0` | `Geolocation.watchPosition` の `maximumAge`（ms） |
| `geolocationTimeout` | number | `1000` | `Geolocation.watchPosition` の `timeout`（ms） |
| `geolocationLastPosKey` | string | `'geolocation-last-pos-key'` | Ionic Storage キー: 最後に取得できた緯度経度（`{lat,lng}` を JSON 文字列で保存） |
| `sensorStockTime` | number | `60000` | [[middleware.score.logic]] が古いセンサーサンプルを間引く上限（ms） |
| `scoreLogicKey` | string | `'driving-score-logic'` | Ionic Storage キー: 動的評価する運転診断ロジック JS 本体 |
| `scoreLogicJsonKey` | string | `'score-logic-json'` | Ionic Storage キー: スコアメッセージ辞書 JSON |
| `loginKey` | string | `'login'` | Ionic Storage キー: 自動ログイン用 `{timestamp, userId, userPassword}`（UC01） |
| `lastLoginUserId` | string | `'last-login-user-id'` | Ionic Storage キー: 直近ログインした userId（UC01） |
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

- 認証は [[middleware.login.service]]（LoginService）による**単一ユーザー認証のみ**で、ログイン成否のみを扱う（UC01）。
- **ロールに基づく権限分岐コードはアプリ内に存在しない。** operator / developer と driver の違いは、機能的な権限差ではなく「どの画面に到達し得るか」という運用上の区別に留まる。

## Maps API キーの取り扱い

### 供給経路（分離維持）
| 用途 | 参照箇所 | 供給経路 |
|---|---|---|
| Web / JS（Maps JS API） | `environment.mapsKey` → [[middleware.map.service]] | **`environment.secrets.ts`** |
| Android ネイティブ（Maps SDK） | `AndroidManifest.xml` の `com.google.android.geo.API_KEY` | **`local.properties` + `manifestPlaceholders`**（[[env.config.capacitor]]） |

- **供給経路は常に分離を維持する。** 一方のファイルからもう一方を参照する構成にしてはならない。

### キー値の共用（フェーズ限定）
- **開発／実機検証フェーズに限り、Web(JS API) と Android(SDK) で同一キー値を共用してよい。**（承認済み判断）
- ただし上記のとおり **供給経路の分離は維持する**（共用の対象は「値」のみ）。
- **本番 release における分離方針は別判断であり、本仕様では未決として扱う。** 詳細は `spec/unknowns.md` を参照。

### その他の遵守事項
- **既存キー 2 本は失効させ、新キーへ入れ替える。** 旧平文埋め込み値は無効として扱う。
- **仕様書・リポジトリに実キー値を掲載・コミットしない。**
- キー管理ガバナンス（ローテーション方針・API キー制限の設定有無・管理責任者等）の運用詳細は未整理のため `spec/unknowns.md` を参照。

## 注意事項
- 環境ファイルは dev/prod の 2 種類のみで、**staging 用の分岐は存在しない**。
- `environment.secrets.ts` を新設する際、キー名を追加した場合は `environment.secrets.example.ts` にも同名キー（空値）を追加する。テンプレート未更新は他開発者のビルド失敗要因となる。

## 関連ノード
- 参照元: 全サービス/ページ（`import { environment }` から利用）
- [[middleware.map.service]]: `mapsKey`（Maps JS API 用）を利用（UC06）
- [[env.config.capacitor]]: `AndroidManifest.xml` の `geo.API_KEY` を `local.properties` + `manifestPlaceholders` で供給
- [[middleware.login.service]]: 単一ユーザー認証を担い、ロールベースの権限分岐は持たない（UC01）
- [[env.app.bootstrap]]: `production` により `enableProdMode()` を判定
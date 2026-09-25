<!-- 作成: 2026-09-10 17:35:10 JST | 更新: 2026-09-18 18:57:35 JST -->

# infra.google.maps — Google Maps API（Web JS / Android SDK）

## 概要

地図表示は Web（Maps JavaScript API）と Android ネイティブ（Maps SDK for Android）の 2 経路で構成される。Web 側は `@googlemaps/js-api-loader` を用いて Google Maps JS API をブラウザ側で 1 度だけロードする。API キーは Web（JS）側を供給経路 `environment.secrets.ts`（`environment.mapsKey` 等）に、Android ネイティブ側を `local.properties` / `manifestPlaceholders` および `AndroidManifest.xml` の `com.google.android.geo.API_KEY` に配置する。供給経路は分離維持する。

## 関連ユースケース

- UC06: 運転診断の実行（走行中の地図表示・車両マーカー・軌跡描画）
- UC08: ヒヤリ地点確認（ヒヤリマーカー表示・地図操作）
- UC01 相当（1-2 前回結果表示）: 診断開始前画面に過去ヒヤリポイントを地図表示する（2026 年度改修要求①）

## 真実源

- `src/data/package.json` — `"@googlemaps/js-api-loader": "^1.15.2"`
- `src/data/src/app/services/map.service.ts` — Loader 設定
- Web キー供給: `environment.secrets.ts`（およびこれを参照する environment 系）
- Android キー供給: `local.properties` / `manifestPlaceholders`、`src/data/android/app/src/main/AndroidManifest.xml` — `com.google.android.geo.API_KEY`

## API キー方針

- **開発／実機検証フェーズ**に限り、キー値の同一共用を許容する（Web JS と Android Native で同一キー値でよい）。
- **供給経路は分離維持**する: Web は `environment.secrets.ts`、Android は `local.properties` / `manifestPlaceholders`（および Manifest の `API_KEY`）。経路を一本化しない。
- Google Cloud 上で **Maps JavaScript API** と **Maps SDK for Android** の両方を有効化する。
- **Application restrictions（アプリ制限）**は、開発／実機検証フェーズでは **無し、または緩い制限**を許容する。
- **本番 release**（`local.properties.release` 等）におけるキー分離・制限の方針は **別判断**とし、本ノードでは確定しない。
- API キーの管理ガバナンス・未解決の運用詳細は必要に応じて `spec/unknowns.md` を参照する。

## Loader 設定

```
new Loader({
  apiKey: environment.mapsKey,
  version: 'weekly',
  region: 'JP',
  language: 'ja'
});
```

- `region=JP` / `language=ja` により日本向け表記・地図データを取得する。
- ロード完了までコールバックをキューして、以降のマップ生成を許可する（`isInitialize` フラグで再ロードを防止）。

## 使用 API

- `google.maps.Map`（`mapTypeControl` / `zoomControl` / `streetViewControl` / `fullscreenControl` / `rotateControl` はすべて false）
- `google.maps.Marker`（ヒヤリマーカー・軌跡円マーカー・S/E マーカー・車両マーカー）
- `google.maps.LatLng` / `google.maps.LatLngBounds`
- `google.maps.SymbolPath.CIRCLE` / `SymbolPath.FORWARD_CLOSED_ARROW`
- Map リスナ: `drag` / `idle` / Marker `click`

## 2026 年度改修にともなう影響（インフラ観点）

2026 年度改修要求（日産自動車受領資料 2 件に基づく 5 本の要求）のうち、本ノードに関係するのは以下である。インフラ構成そのものの変更（新規サービス追加・キー方針変更）は現時点で発生しない。

- **診断開始前画面（1-2）への過去ヒヤリポイント表示**により、地図生成・マーカー生成の呼び出し箇所が増える。表示する過去ヒヤリの件数上限は未確定であり、上限が定まらない場合、単一画面のマーカー数が増加して Maps JS API の描画負荷が増える。マーカー数の増加自体は課金対象のリクエスト数には直結しないが、地図ロード回数が増える画面が追加される点は運用上の前提として記録する。
- **画面の縦横変更要求**は地図ビューのリサイズを伴うが、Maps API 側のキー・有効化 API に影響しない（`ui` / `middleware` 側の責務）。
- **レーダーチャート化・録画データサイズ改善・BLE 安定化**は、Google Maps 経路に対するインフラ要件の変更を含まない。

開発スケジュール（2026 年 11 月末完了、12 月より高齢者を招いた実験開始）を前提とすると、実機検証が 11 月まで継続する。したがって上記「開発／実機検証フェーズ」のキー方針（同一値共用・制限なし／緩い制限の許容）は少なくとも 2026 年 11 月末までは有効な前提として維持する。実験フェーズ（2026 年 12 月以降）における本番相当キーの扱いは本ノードでは確定しない（別判断）。

## 関連ノード

- 実装ラッパ: [[middleware.map.service]]
- 呼び出し元: [[ui.opening.page]] / [[ui.driving.page]] / [[ui.badspot.page]]
- 環境・Capacitor 設定: [[env.config.environment]] / [[env.config.capacitor]]

```json
{
  "required_changes": [
    {
      "node": "infra.google.maps",
      "entrypoint": "spec/infra/google-maps.md",
      "description": "approved design_decision（開発/実機検証のキー同一値共用・供給経路分離・GCP両API有効化・制限は無しまたは緩い・本番分離は別判断）を確定記述として維持し、2026年度改修（1-2 前回結果表示の地図利用追加、11月末完了/12月実験開始スケジュール）を受けたインフラ観点の影響節を追記する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "env",
      "severity": "should",
      "reason": "Web は environment.secrets.ts、Android は local.properties/manifestPlaceholders という供給経路分離が env.config 系仕様と一致しているか、および 2026/12 実験フェーズ向けキー注入方針の確定が必要"
    },
    {
      "domain": "middleware",
      "severity": "should",
      "reason": "1-2 診断開始前画面での地図生成・過去ヒヤリマーカー描画が追加されるため、middleware.map.service の Loader 再利用（isInitialize）とマーカー生成上限の扱いを確認する必要がある"
    },
    {
      "domain": "ui",
      "severity": "could",
      "reason": "縦横変更要求により地図ビューのリサイズ処理が必要になるが、Maps API 側のキー/有効化 API には影響しない"
    }
  ],
  "requirements_context": "infra.google.maps は Google Maps API の実行前提（キー供給・API 有効化・Loader 設定）を定めるノードである。\n\n【構成】地図表示は Web（Maps JavaScript API、@googlemaps/js-api-loader ^1.15.2）と Android ネイティブ（Maps SDK for Android）の 2 経路。Web 側はブラウザで 1 度だけロードし、isInitialize フラグで再ロードを防止、ロード完了までコールバックをキューする。Loader 設定は apiKey=environment.mapsKey / version=weekly / region=JP / language=ja。\n\n【キー方針（approved）】開発／実機検証フェーズに限り Web JS と Android Native でキー値の同一共用を許容する。ただし供給経路は分離維持し、Web は environment.secrets.ts、Android は local.properties / manifestPlaceholders および AndroidManifest.xml の com.google.android.geo.API_KEY とする。Google Cloud 上で Maps JavaScript API と Maps SDK for Android の両方を有効化する。Application restrictions は開発／実機検証フェーズでは無しまたは緩い制限を許容する。本番 release（local.properties.release 等）のキー分離・制限方針は本ノードでは確定せず別判断とする。\n\n【使用 API 面】google.maps.Map（mapTypeControl / zoomControl / streetViewControl / fullscreenControl / rotateControl はすべて false）、google.maps.Marker（ヒヤリ／軌跡円／S・E／車両）、LatLng / LatLngBounds、SymbolPath.CIRCLE / FORWARD_CLOSED_ARROW、リスナは drag / idle / Marker click。\n\n【関連ユースケース】UC06 運転診断の実行（走行中の地図表示・車両マーカー・軌跡描画）、UC08 ヒヤリ地点確認（ヒヤリマーカー表示・地図操作）、および 2026 年度改修で追加される 1-2 診断開始前画面の過去ヒヤリポイント地図表示。\n\n【2026 年度改修の影響】改修要求は日産自動車受領の 2 資料（一次仕様 2026-08-04、要求仕様確認 2026-09-17）に基づく 5 本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE 安定化 ⑤録画データサイズ改善）。本ノードへの影響は、1-2 画面が新たに地図とマーカーを使用することによる地図ロード箇所・マーカー数の増加のみで、新規インフラサービス追加やキー方針変更は発生しない。1-2 に表示する過去ヒヤリ件数の上限は未確定であり、上限が無い場合は単一画面のマーカー数が増大して描画負荷が上がる。縦横変更要求は地図ビューのリサイズを伴うが Maps API の有効化・キーには影響しない。レーダーチャート化・録画改善・BLE 安定化はインフラ要件の変更を含まない。\n\n【スケジュール前提】アプリ開発は 2026 年 11 月末完了目標、2026 年 12 月から高齢者を招いた実験が開始される。したがって開発／実機検証フェーズ向けキー方針は少なくとも 2026 年 11 月末まで有効な前提として維持し、実験フェーズ（2026/12 以降）の本番相当キー運用は別判断とする。",
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
    },
    {
      "type": "external_integration_rule",
      "title": "1-2 診断開始前画面も Google Maps 経路に依存する",
      "statement": "2026 年度改修で追加される診断開始前画面（1-2）の過去ヒヤリポイント表示は Google Maps API の地図表示およびマーカー生成に依存する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "開発/実機検証フェーズは 2026 年 11 月末まで継続する前提",
      "statement": "アプリ開発完了目標が 2026 年 11 月末、実験開始が 2026 年 12 月であるため、開発／実機検証向けの Maps キー方針は少なくとも 2026 年 11 月末まで有効な前提とする",
      "status": "assumption"
    },
    {
      "type": "assumption",
      "title": "2026 年度改修で Maps 関連の新規インフラ追加は発生しない",
      "statement": "2026 年度改修要求 5 本のうち Google Maps 経路に対しては新規インフラサービス追加・キー方針変更は発生せず、既存の Web JS / Android SDK 2 経路で充足する",
      "status": "assumption"
    }
  ],
  "open_questions": [
    "本番 release（local.properties.release 等）のキー分離・Application restrictions・CI/Secrets 注入の方針が未確定。別判断待ちのため、本番用 GCP キー運用・ローテーション・平文コミット有無が確定しない（env/CI ドメイン判断が必要）",
    "2026 年 12 月開始の高齢者実験フェーズで使用するビルドが開発／実機検証フェーズ扱いか本番相当扱いかが未確定。扱いによりキー分離・アプリ制限・クォータ設定の要否が変わる（infra/env と先方の合意が必要）",
    "environment.mapsKey の実体が environment.secrets.ts からの export/再 export か、ビルド時置換かなど Web 側の具体的な注入・参照チェーンが未確定。env.config 側の確定が必要で、決まらないとローカル開発手順とシークレット管理に影響する",
    "開発/実機検証で『緩い制限』を用いる場合の具体的 allow 値（HTTP referrer、package name + SHA-1 の有無と範囲）が未確定。GCP Console 設定の再現性および実機ビルドの地図表示可否に影響する（infra/env 判断が必要）",
    "1-2 診断開始前画面に表示する過去ヒヤリ件数の上限が未確定（既存 open_question）。上限が無い場合、単一画面のマーカー数が増大し地図描画性能に影響するため、UI/DB 側の件数決定が必要",
    "1-2 画面追加および画面縦横変更により地図の再ロード／再生成が発生する条件が未確定。isInitialize による一度ロード前提で足りるか、リサイズ時に Map 再生成が必要かは middleware 判断が必要で、Maps JS API のロード回数に影響する",
    "UC06/UC08/1-2 における Maps API 呼び出し量（地図ロード回数・マーカー数・タイル取得）に対するクォータ・課金上限の前提が未確定。実験期間中の長時間走行検証で上限到達可否に影響する"
  ],
  "rationale_notes": [
    "node=infra.google.maps の approved design_decision を真とし、既存 md と矛盾がなかったためキー方針本文はそのまま維持した",
    "今回追加した approved facts（2026 年度改修要求 5 本の出所、11 月末完了/12 月実験開始スケジュール、1-2 前回結果表示）を踏まえ、インフラ観点の影響節を新設した。改修内容自体は UI/middleware 主体だが、地図利用箇所が増えるという運用前提は infra 側に記録しておく必要がある",
    "スケジュール fact から『開発／実機検証フェーズ』の有効期限をおおよそ 2026 年 11 月末と読み替えたが、これは推論であるため assumption として分離し、実験フェーズの扱いは open_question に置いた",
    "レーダーチャート・BLE 安定化・録画データサイズ改善は Maps 経路のインフラ要件を変えないため、影響なしと明記して誤った波及解釈を防いだ",
    "Loader オプション・使用 API 面・一度だけのロードは approved fact による否定がないため既存記述を維持した",
    "キー値の共用を許容しても供給経路を分離維持するのは、本番フェーズでキー分離へ移行する際にコード変更を最小化するためである",
    "node 不一致の approved/open_question fact（スコアロジック、CAN ペイロード、動画生成方式など）は本ノードの Maps API 範囲外のため仕様本文へ取り込まず、地図に関係する 1-2 表示件数のみ open_question として引き継いだ"
  ]
}
```
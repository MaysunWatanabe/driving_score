<!-- 作成: 2026-09-10 17:31:19 JST | 更新: 2026-09-18 17:49:01 JST -->

# middleware.map.service — Google Maps 描画サービス

## 概要
`MapService` は Google Maps JS API のロードと、地図・マーカー・軌跡の管理を一元化する。ヒヤリマーカー・軌跡円・車両・S/E マーカーを持ち、`drag` / `idle` イベントで自車位置追従の解除と可視領域外マーカーの表示切り替えを行う。

## 真実源
- `src/data/src/app/services/map.service.ts`

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `LogService`（[[middleware.log.service]]）
- `mapService` は複数ページで共有されるシングルトン（`providedIn: 'root'`）。マーカー配列も持続するため、`removeAll()` / `clearMarker()` の呼び分けが必要。

## 内部状態
```
map: google.maps.Map
mapDragFunc / markClickFunc: (…) => void | null
isInitialize: boolean         // Loader 完了フラグ
markers, markersTimestamp, markersComments, markersVideoTime: Array
circleMarkers: Array          // 走行軌跡（円マーカー）、上限 1000 個
selectMarkerPos: number
carMarker, startMarker, endMarker: google.maps.Marker | null
```

## API（主要）
| メソッド | 挙動 |
|---|---|
| `loadGoogleInstance(func)` | `isInitialize=false` のときのみ Loader を実行し、成功時に `func()`。以降は同期的に `func()` を呼ぶ |
| `createMap(element, uluru, zoom)` | Map を生成し、既存の markers/circleMarkers/S/E/car を map に再アタッチ。`drag`/`idle` リスナを登録 |
| `setZoom(zoom)` / `setCenter(uluru)` | ズーム・中心変更（try/catch でログ） |
| `addListener('drag', fn)` / `addListener('mark', fn)` | ドラッグ・マーカークリック時のコールバック登録 |
| `stop()` | 上記リスナを null 化（マーカーはそのまま残す） |
| `removeAll()` | `stop()` + `clearMarker()` + `clearCarMarker()` + `map=null` |
| `clearMarker()` | ヒヤリマーカー・軌跡円・S/E をすべて `setMap(null)` して配列を空に |
| `drawMarker(uluru, title, videoTime, comments)` | ヒヤリマーカー（`assets/images/hiyari.png` 40×40、`zIndex=2`）を追加。`click` で `markClickFunc(title, pos)` |
| `drawCarMarker(uluru, rotation)` | 車両アイコン（`SymbolPath.FORWARD_CLOSED_ARROW`、青塗り、`zIndex=3`）を描画・移動。**現行実装では地図上の矢印は上向きで固定されており、進行方向は反映されていない**（後述「自車マーカーの進行方向反映」参照） |
| `drawStartMarker(uluru)` / `drawEndMarker(uluru)` | S / E ラベル付き白丸マーカー（`zIndex=1`） |
| `drawCircleMarker(uluru)` | 走行軌跡の点（薄青、`zIndex=0`）。直前マーカーとのユークリッド距離 (deg) が **`<0.0006`** ならスキップ。1000 個を超えたら先頭を削除 |
| `setBigMarkerIcon(pos)` | 指定 pos のヒヤリマーカーだけ `hiyar_big.png` (60×60) に、他は `hiyari.png` (40×40) にリセット |
| `resetMarkerIcon()` | すべて 40×40 に戻す |
| `fitBounds()` | すべてのヒヤリ + S + E を含む `LatLngBounds` にフィット |
| `checkVisibleElements(elements, bounds)` (private) | `bounds.contains(getPosition())` かつ `getVisible()` の要素だけ `setMap(map)`、それ以外は `setMap(null)` |
| `setSelectMarkerPos(pos)` / `getSelectMarkerPos()` | 選択中のヒヤリマーカー index |
| `getMarkerLength()` / `getMarkerPosition(pos)` / `getMarkerTimestamp(pos)` / `getMarkerVideoTime(pos)` / `getMarkerComment(pos, key)` | ヒヤリマーカー情報の取得 |

## 業務ルール
- Loader パラメータ: `region: 'JP'` / `language: 'ja'` / `version: 'weekly'` / `apiKey` は後述の「API キー供給」で解決された値を使用する。
- Map の UI コントロールはすべて非表示（`mapTypeControl` / `zoomControl` / `streetViewControl` / `fullscreenControl` / `rotateControl` を false）。
- ヒヤリマーカーの comment 形式は `{ msg1, msg2, msg3, msg4 }`（`brake/handle/speed/accelerator/over_all` の複合）。[[ui.driving.page]] の `pushBadPoint` が生成する。

## 自車マーカーの進行方向反映（2026 年度改修要求 / 優先度 want）
### 実装実態
- 現行では地図上の自車マーカー（進行方向を示す矢印アイコン）は **上向きで固定** されており、実際の進行方向（方位）は矢印の向きに反映されていない。
- `drawCarMarker(uluru, rotation)` は `rotation` 引数を受け取るシグネチャを持つが、地図表示上の結果として矢印は上向きのままである。呼び出し側（[[ui.driving.page]]）から意味のある方位値が渡されていないか、または `rotation` が最終的なアイコン描画に効いていない可能性がある（実装上の原因は要調査）。

### 要求
- 自車マーカーの矢印を **進行方向に合わせた向き** で描画するよう変更する。
- 本要求は日産自動車提供資料において **優先度 want** として記載されている。必須要求（前回結果表示・タブ切り替え・レーダーチャート・BLE 安定化・録画データサイズ改善）よりも優先度は低い。

### 責務境界
- 「方位値をどう算出するか」（GPS の heading を使うか、直前座標との差分から方位を計算するか、CAN 由来の値を使うか）は本ノードの責務外とし、方位の供給元は呼び出し側または [[middleware.sensor.service]] 側で確定させる。
- `MapService` は **渡された方位値（度）をマーカーアイコンの `rotation` に反映して描画する** 責務のみを持つ。
- 方位が未取得・不定（停車中など）の場合の扱いは未確定（後述 open question）。

## API キー供給（承認済み方針）
- 開発フェーズおよび実機検証フェーズにおいて、Web（Maps JS API）と Android（Maps SDK）で **同一のキー値を共用することを許容する**。
- ただし **キーの供給経路は Web と Android で分離する**。`MapService` は Web 側の供給経路（TS の解決結果）からのみキーを受け取り、Android 側の供給経路を参照しない。
- キーが未配置の場合のエラーメッセージは、**既存の `loadMapsKey` / TS 解決の挙動に従う**。`MapService` 側で独自のエラーメッセージを追加・変更しない。
- `loadGoogleInstance()` はキー解決に失敗した場合も既存の失敗経路（`isInitialize` を true にせず、`LogService` にログを残す）のままとし、リトライ・フォールバックの追加は行わない。
- キー値・供給経路の実体は [[infra.google.maps]] の責務であり、本ノードは「解決済みキーを Loader に渡す」責務のみを持つ。

## 2026 年度改修にともなう関連事項（未確定・影響確認中）
- **1-2 前回結果表示での過去ヒヤリマーカー表示**: 診断開始前画面に過去のヒヤリポイントをマップ表示する要求がある。過去をすべて描画するとマーカーで地図が埋まるため件数制限を検討中であり、`drawMarker()` を何件呼ぶか（＝呼び出し側で絞るか、`MapService` 側に上限を持たせるか）は未確定。
- **画面の縦横変更対応**: 先方から縦横変更の要求があり、現行は Android で縦固定。回転時に地図コンテナのサイズが変化するため、`createMap()` 済みの map に対するリサイズ／`fitBounds()` 再実行の要否が未確定。
- **ヒヤリ動画の個別化**: ヒヤリ前後 15 秒の個別動画に変わった場合、`markersVideoTime` が保持する「通し動画内の再生位置」の意味が変わる可能性がある。データ意味の再定義が必要。

## 関連ノード
- 依存: [[infra.google.maps]]、[[middleware.log.service]]
- 呼び出し元: [[ui.opening.page]] / [[ui.driving.page]] / [[ui.badspot.page]]
- 関連ユースケース: UC06（運転診断の実行）／UC08（ヒヤリ地点確認）／1-2（診断開始前画面の前回結果表示）

```json
{
  "required_changes": [
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "自車マーカーの矢印が上向き固定である実装実態を明記し、進行方向反映（優先度 want）の要求と責務境界を新設節として追加した"},
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "drawCarMarker の表の記述に「rotation 引数はあるが地図上は上向き固定」という実装実態の注記を追加した"},
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "2026 年度改修（1-2 過去ヒヤリ表示・縦横変更・ヒヤリ動画個別化）が本ノードに与える未確定影響を関連事項節として追加した"}
  ],
  "suggested_impacts": [
    {"domain": "middleware", "severity": "must", "reason": "自車マーカーの方位値の供給元（GPS heading / 座標差分 / CAN 由来）が未定義であり sensor.service 側の提供責務を確定する必要がある"},
    {"domain": "ui", "severity": "must", "reason": "ui.driving.page が drawCarMarker へ渡す rotation 値の実際の内容と、1-2 で drawMarker を何件呼ぶかの絞り込み責務を確認する必要がある"},
    {"domain": "ui", "severity": "should", "reason": "画面縦横変更対応時に地図コンテナのサイズ変化へ追従するリサイズ/再フィット呼び出しが必要になる可能性がある"},
    {"domain": "db", "severity": "should", "reason": "1-2 で過去ヒヤリを描画する際の取得件数制限・期間指定のクエリ仕様が未確定"},
    {"domain": "infra", "severity": "could", "reason": "Web/Android のキー供給経路分離と loadMapsKey の実体定義は infra.google.maps の責務であり従来どおり整合が必要"}
  ],
  "requirements_context": "MapService は Google Maps JS API の初期化（loadGoogleInstance）、地図生成（createMap）、ヒヤリマーカー・走行軌跡円・車両マーカー・S/E マーカーの描画と可視制御を担う。UC06（運転診断の実行）では走行中の車両位置追従と軌跡描画、UC08（ヒヤリ地点確認）ではヒヤリマーカーの選択強調（setBigMarkerIcon）と fitBounds による全体表示を担う。Loader は region=JP / language=ja / version=weekly で初期化し、地図 UI コントロールは全非表示。軌跡円は直前点との距離 0.0006deg 未満でスキップ、最大 1000 点で先頭から破棄。API キーについては開発／実機検証フェーズで Web(JS API) と Android(SDK) のキー値共用を許容するが供給経路は分離し、MapService は Web 側 TS 解決結果のみを参照、キー未配置時は既存 loadMapsKey / TS 解決の挙動に従い独自メッセージ・リトライを追加しない（実体は infra.google.maps の責務）。今回追加の要件として、2026 年度改修要求（日産自動車提供の一次仕様 2026-08-04 および要求仕様確認 2026-09-17）に基づき、地図上の自車マーカーの矢印が現在上向き固定である実装実態を記録し、進行方向に合わせた向きで描画するよう変更する（優先度 want、必須 5 要求より低優先）。drawCarMarker は rotation 引数を持つがその値が地図表示に反映されていないため原因は要調査であり、方位値の算出責務は呼び出し側または sensor.service に置き、MapService は渡された方位値をアイコン rotation に反映する責務のみを持つ。停車中など方位不定時の扱いは未確定。加えて 2026 年度改修に付随する未確定影響として、(1) 1-2 前回結果表示で過去ヒヤリポイントをマップ表示する際の件数制限と絞り込み責務、(2) 画面縦横変更要求にともなう地図コンテナのリサイズ／fitBounds 再実行の要否、(3) ヒヤリ動画個別化にともなう markersVideoTime の意味変更の可能性を本ノードの関連事項として記載する。開発完了目標は 2026 年 11 月末（12 月に高齢者実験開始）。",
  "fact_candidates": [
    {
      "type": "display_rule",
      "title": "現行の自車マーカーの矢印は上向き固定である",
      "statement": "現行実装では地図上の自車マーカーの矢印は上向きで固定され、実際の進行方向は矢印の向きに反映されていない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "自車マーカーの矢印を進行方向に合わせて描画する",
      "statement": "自車マーカーの矢印は進行方向に合わせた向きで描画する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "自車マーカーの進行方向反映は優先度 want である",
      "statement": "自車マーカーを進行方向に向ける変更は先方資料で優先度 want と記載され、必須 5 要求より優先度が低い",
      "status": "approved"
    },
    {
      "type": "api_contract",
      "title": "drawCarMarker は rotation 引数を受け取る",
      "statement": "drawCarMarker(uluru, rotation) は位置と回転角を引数に取り、車両アイコン（SymbolPath.FORWARD_CLOSED_ARROW、青塗り、zIndex=3）を描画・移動する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "方位値の算出責務は MapService の外にある",
      "statement": "進行方向（方位）の算出は呼び出し側またはセンサ層の責務であり、MapService は渡された方位値をマーカーアイコンの rotation に反映する責務のみを持つ",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "開発／実機検証フェーズは Web と Android で Maps API キー値の共用を許容する",
      "statement": "開発フェーズおよび実機検証フェーズにおいて、Web(Maps JS API) と Android(Maps SDK) は同一の Maps API キー値を共用してよい",
      "status": "approved"
    },
    {
      "type": "external_integration_rule",
      "title": "Maps API キーの供給経路は Web と Android で分離する",
      "statement": "Maps API キーの供給経路は Web 側と Android 側で分離され、MapService は Web 側の供給経路から解決されたキーのみを参照する",
      "status": "approved"
    },
    {
      "type": "external_integration_rule",
      "title": "キー未配置時のエラーメッセージは既存 loadMapsKey / TS 解決に従う",
      "statement": "Maps API キーが未配置の場合のエラーメッセージは既存の loadMapsKey / TS 解決の挙動に従い、MapService 側で独自のメッセージを追加・変更しない",
      "status": "approved"
    },
    {
      "type": "api_contract",
      "title": "loadGoogleInstance は未初期化時のみ Loader を実行する",
      "statement": "loadGoogleInstance(func) は isInitialize が false のときのみ Loader を実行し、成功後は同期的に func() を呼ぶ",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "Loader は region=JP / language=ja / version=weekly で初期化する",
      "statement": "Google Maps Loader は region='JP'、language='ja'、version='weekly' を指定して初期化する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "軌跡円は直前点との距離が 0.0006deg 未満ならスキップする",
      "statement": "drawCircleMarker は直前の円マーカーとのユークリッド距離(deg)が 0.0006 未満の場合、新規マーカーを追加しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "走行軌跡の円マーカーは最大 1000 個",
      "statement": "circleMarkers は 1000 個を超えた時点で先頭要素を削除する",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "removeAll はリスナ解除とマーカー全消去と map 破棄を行う",
      "statement": "removeAll() は stop() / clearMarker() / clearCarMarker() を実行し map を null にするが、stop() 単体ではマーカーを消去しない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "可視領域外のマーカーは map から切り離される",
      "statement": "idle イベント時に bounds 内かつ getVisible() が true の要素のみ setMap(map) され、それ以外は setMap(null) される",
      "status": "candidate"
    },
    {
      "type": "input_rule",
      "title": "地図の UI コントロールは操作不可とする",
      "statement": "Map 生成時に mapTypeControl / zoomControl / streetViewControl / fullscreenControl / rotateControl をすべて false とする",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "自車マーカーの方位値をどこから取得するかが未確定（GPS の heading か、直前座標との差分計算か、CAN 由来の値か）。middleware.sensor.service と ui.driving.page の判断が必要で、決まらないと drawCarMarker の rotation 反映を実装できない",
    "drawCarMarker が rotation 引数を持つにもかかわらず矢印が上向き固定である原因が未特定（呼び出し側が常に固定値を渡しているのか、アイコン定義側で rotation が効いていないのか）。実装調査が必要で、決まらないと修正範囲が確定しない",
    "停車中・低速時など進行方向が不定の場合の矢印の扱いが未確定（直前の向きを維持するか、上向きに戻すか、無回転の丸アイコンにするか）。UI 判断が必要で、決まらないと停車時に矢印が不安定に回転する挙動が残る",
    "方位の更新頻度と平滑化の要否が未確定。GPS 由来の方位はノイズが大きく、毎フレーム反映すると矢印が揺れる可能性がある。UI/センサ側の判断が必要",
    "1-2 前回結果表示で描画する過去ヒヤリマーカーの件数制限を MapService 側に持たせるか呼び出し側で絞るかが未確定。UI/DB 判断が必要で、決まらないとマーカー過多による地図の可読性低下と描画性能劣化が残る",
    "画面縦横変更に対応する場合、既に createMap 済みの map に対するリサイズ処理や fitBounds 再実行の要否が未確定。UI 判断が必要で、決まらないと回転後に地図が欠ける可能性がある",
    "ヒヤリ動画がヒヤリ前後 15 秒の個別動画になった場合、markersVideoTime が保持する再生位置の基準（通し動画内の秒か個別動画内の秒か）が未確定。UI/DB 判断が必要で、決まらないと 6-1 のマーカー追尾が成立しない",
    "本番（リリース）フェーズで Web と Android のキー値共用が許容されるか未確定。infra 判断が必要で、決まらないとキー発行・制限設定（HTTPリファラ／パッケージ名制限）の設計が確定しない",
    "loadMapsKey の実体（配置ファイル・ビルド時注入か実行時読込か）と TS 解決のフォールバック順序が未特定。infra.google.maps の確認が必要で、決まらないと初期化失敗時の挙動記述が確定しない",
    "キー共用時にキーへ適用するプラットフォーム制限（Web はリファラ制限、Android はパッケージ名+SHA-1）が両立可能か未検証。infra 判断が必要で、決まらないと実機検証時に地図が表示されないリスクが残る"
  ],
  "rationale_notes": [
    "approved fact『自車マーカーを進行方向に向ける（現在は上向き固定）』を真として、既存 md の drawCarMarker 記述（rotation 引数を取る）と矛盾しないよう「引数は存在するが地図表示に反映されていない」という実装実態として整理した。引数シグネチャの記述自体は真実源のコードに基づくため削除せず注記を添える形とした",
    "方位の算出責務を MapService の外に置くことで、GPS/CAN いずれを方位源にしても本ノードの仕様が変わらないように責務境界を明示した。MapService は『渡された角度を描画に反映する』だけの薄い責務に留める",
    "優先度 want を仕様書に明記したのは、2026 年 11 月末完了・12 月実験開始というスケジュール制約下で必須 5 要求（前回結果表示・タブ切替・レーダーチャート・BLE 安定化・録画サイズ改善）が優先されるべきであり、本変更が後回しになりうることを実装者に伝える意図がある",
    "1-2 の過去ヒヤリ表示・縦横変更・ヒヤリ動画個別化は他ノード主管の要求だが、いずれも MapService の呼び出し方やデータ意味に波及するため『未確定・影響確認中』として節を分け、確定事実と混在させないようにした",
    "既存記述（マーカー種別・zIndex・距離閾値 0.0006、上限 1000、シングルトン運用上の removeAll/clearMarker 呼び分け注記、API キー供給方針）は今回の変更対象外のためすべて維持した"
  ]
}
```
<!-- 作成: 2026-09-18 17:49:02 JST | 更新: 2026-09-25 10:57:45 JST -->

# middleware.map.service — Google Maps 描画サービス

## 概要
`MapService` は Google Maps JS API のロードと、地図・マーカー・軌跡の管理を一元化する。

- 管理するマーカーは、ヒヤリマーカー・軌跡円・車両・S/E マーカーの 4 種類である。
- `drag` / `idle` イベントを受けて、次の 2 つを行う。
  - 自車位置追従の解除
  - 可視領域外マーカーの表示切り替え

## 真実源
- `src/data/src/app/services/map.service.ts`

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `LogService`（[[middleware.log.service]]）
- `mapService` は複数ページで共有されるシングルトン（`providedIn: 'root'`）である。
  - マーカー配列もページをまたいで保持される。
  - そのため、`removeAll()` と `clearMarker()` を場面に応じて使い分ける必要がある。

## 内部状態
```
map: google.maps.Map
mapDragFunc / markClickFunc: (…) => void | null
isInitialize: boolean         // Loader 完了フラグ
markers, markersTimestamp, markersComments, markersVideoTime: Array
markersVideoPath: Array       // 2026 年度改修で追加。各ヒヤリマーカーが属するヒヤリ動画のファイル名（または同等の内部配列）
circleMarkers: Array          // 走行軌跡（円マーカー）、上限 1000 個
selectMarkerPos: number
carMarker, startMarker, endMarker: google.maps.Marker | null
```

- ヒヤリマーカー関連の配列は、同じ index で同じマーカーを指す並列配列として扱う。
  - 対象は `markers` / `markersTimestamp` / `markersComments` / `markersVideoTime` / `markersVideoPath`。
  - `markersVideoPath` もこの対応関係を崩さないよう、追加と消去を他の配列と同期させる（後述「ヒヤリ動画ファイル名の保持」参照）。

## API（主要）
| メソッド | 挙動 |
|---|---|
| `loadGoogleInstance(func)` | `isInitialize=false` のときだけ Loader を実行し、成功したら `func()` を呼ぶ。初期化済みの場合は同期的に `func()` を呼ぶ |
| `createMap(element, uluru, zoom)` | Map を生成し、既存の markers / circleMarkers / S / E / car を新しい map に再アタッチする。`drag` / `idle` リスナを登録する |
| `setZoom(zoom)` / `setCenter(uluru)` | ズーム・中心を変更する（例外は try/catch でログに残す） |
| `addListener('drag', fn)` / `addListener('mark', fn)` | ドラッグ時・マーカークリック時のコールバックを登録する |
| `stop()` | 上記リスナを null にする（マーカーは残す） |
| `removeAll()` | `stop()` + `clearMarker()` + `clearCarMarker()` を実行し、`map=null` にする |
| `clearMarker()` | ヒヤリマーカー・軌跡円・S/E をすべて `setMap(null)` し、配列を空にする（`markersVideoPath` を含む） |
| `drawMarker(uluru, title, videoTime, comments, <ヒヤリ動画ファイル名>)` | ヒヤリマーカー（`assets/images/hiyari.png` 40×40、`zIndex=2`）を追加する。`click` で `markClickFunc(title, pos)` を呼ぶ。**2026 年度改修で、ヒヤリ動画のファイル名を受け取る引数を 1 つ追加する**（後述「ヒヤリ動画ファイル名の保持」参照）。`videoTime` の意味は「元の録画ストリーム内のオフセット秒」である |
| `drawCarMarker(uluru, rotation)` | 車両アイコン（`SymbolPath.FORWARD_CLOSED_ARROW`、青塗り、`zIndex=3`）を描画・移動する。**現行実装では地図上の矢印が上向きで固定されており、進行方向は反映されていない**（後述「自車マーカーの進行方向反映」参照） |
| `drawStartMarker(uluru)` / `drawEndMarker(uluru)` | S / E ラベル付きの白丸マーカー（`zIndex=1`）を描画する |
| `drawCircleMarker(uluru)` | 走行軌跡の点（薄青、`zIndex=0`）を描画する。直前マーカーとのユークリッド距離 (deg) が **`<0.0006`** ならスキップする。1000 個を超えたら先頭を削除する |
| `setBigMarkerIcon(pos)` | 指定 pos のヒヤリマーカーだけ `hiyar_big.png` (60×60) にし、他は `hiyari.png` (40×40) に戻す |
| `resetMarkerIcon()` | すべてのヒヤリマーカーを 40×40 に戻す |
| `fitBounds()` | すべてのヒヤリ + S + E を含む `LatLngBounds` にフィットさせる |
| `checkVisibleElements(elements, bounds)` (private) | `bounds.contains(getPosition())` かつ `getVisible()` の要素だけ `setMap(map)` し、それ以外は `setMap(null)` する |
| `setSelectMarkerPos(pos)` / `getSelectMarkerPos()` | 選択中のヒヤリマーカーの index を設定・取得する |
| `getMarkerLength()` / `getMarkerPosition(pos)` / `getMarkerTimestamp(pos)` / `getMarkerVideoTime(pos)` / `getMarkerComment(pos, key)` | ヒヤリマーカー情報を取得する。`getMarkerVideoTime(pos)` は元の録画ストリーム内のオフセット秒を返す |

## 業務ルール
- Loader パラメータは次のとおり。
  - `region: 'JP'`
  - `language: 'ja'`
  - `version: 'weekly'`
  - `apiKey`: 後述の「API キー供給」で解決された値
- Map の UI コントロールはすべて非表示にする。
  - `mapTypeControl` / `zoomControl` / `streetViewControl` / `fullscreenControl` / `rotateControl` をすべて false にする。
- ヒヤリマーカーの comment 形式は `{ msg1, msg2, msg3, msg4 }` である。
  - 中身は `brake/handle/speed/accelerator/over_all` の組み合わせ。
  - 生成元は [[ui.driving.page]] の `pushBadPoint`。

## ヒヤリ動画ファイル名の保持（2026 年度改修 / 承認済み）
### 背景
- 2026 年度改修要求⑤（ヒヤリ発生時の録画データサイズ改善）で、ヒヤリ動画を個別に確認できる形に変わる。
- 30 秒以内に連続したヒヤリは、1 本に継続録画しても、ヒヤリポイントごとに個別生成してもよい（実装都合で選択可）。
- そのため、ヒヤリマーカーごとに「どの動画ファイルに属するか」を保持する必要がある。

### API 変更
- `drawMarker(uluru, title, videoTime, comments)` に引数を **1 つ追加** する。
  - 追加するのは、当該マーカーが属するヒヤリ動画の **ファイル名** である。
  - 既存 4 引数の意味と順序は変更しない。
- 受け取ったファイル名は、内部配列 `markersVideoPath`（または同等の内部配列）に、`markers` と同じ index で保持する。
- `clearMarker()` / `removeAll()` によるヒヤリマーカー消去時は、`markersVideoPath` も他の並列配列と同時に空にする。

### `markersVideoTime` の定義（fact #4635 撤回後の確定定義）
- 既存の `markersVideoTime` は **維持** する。
- その値の意味は **「元の録画ストリーム内のオフセット秒」** と定義する（proposal #241 / fact #4648）。
  - 以前の fact #4635（個別動画内の再生位置へ再定義する案）は撤回済みである。
- 値の生成元である [[ui.driving.page]] の `pushBadPoint()` は **変更しない**。
  - 算出式は `Math.floor(getLastSensorTime()/1000)` のまま。
- 値の利用側である [[ui.badspot.page]] の `seekVideo()` も **変更しない**。
- 録画区間の開始時刻（`t_start`）の保持は **不要** である。

### 責務境界
- `MapService` の責務は次の 2 点に限る。
  - 渡されたファイル名とオフセット秒を、マーカーと対応づけて保持すること。
  - 保持した値を呼び出し側へ提供すること。
- ヒヤリ動画の生成方式（連続ヒヤリを 1 本にまとめるか個別にするか）と、ファイル名の命名・格納先は、本ノードの責務外である。

## 自車マーカーの進行方向反映（2026 年度改修要求 / 優先度 want）
### 実装実態
- 現行では、地図上の自車マーカー（進行方向を示す矢印アイコン）は **上向きで固定** されている。実際の進行方向（方位）は矢印の向きに反映されていない。
- `drawCarMarker(uluru, rotation)` は `rotation` 引数を受け取るが、地図上の矢印は上向きのままである。原因として次の 2 つが考えられるが、どちらかは要調査である。
  - 呼び出し側（[[ui.driving.page]]）から意味のある方位値が渡されていない。
  - `rotation` が最終的なアイコン描画に効いていない。

### 要求
- 自車マーカーの矢印を **進行方向に合わせた向き** で描画するよう変更する。
- 本要求は、日産自動車提供資料で **優先度 want** と記載されている。
  - 必須要求（前回結果表示・タブ切り替え・レーダーチャート・BLE 安定化・録画データサイズ改善）よりも優先度は低い。

### 責務境界
- 方位値の算出方法は本ノードの責務外とする。
  - 候補は、GPS の heading を使う、直前座標との差分から計算する、CAN 由来の値を使う、のいずれか。
  - 方位の供給元は、呼び出し側または [[middleware.sensor.service]] 側で確定させる。
- `MapService` は、**渡された方位値（度）をマーカーアイコンの `rotation` に反映して描画する** 責務のみを持つ。
- 停車中など方位が未取得・不定の場合の扱いは未確定である（後述 open question）。

## API キー供給（承認済み方針）
- 開発フェーズおよび実機検証フェーズでは、Web（Maps JS API）と Android（Maps SDK）で **同一のキー値を共用してよい**。
- ただし **キーの供給経路は Web と Android で分離する**。
  - `MapService` は Web 側の供給経路（TS の解決結果）からのみキーを受け取る。
  - Android 側の供給経路は参照しない。
- キー未配置時のエラーメッセージは、**既存の `loadMapsKey` / TS 解決の挙動に従う**。`MapService` 側で独自のメッセージを追加・変更しない。
- `loadGoogleInstance()` はキー解決に失敗した場合も、既存の失敗経路のままとする。
  - `isInitialize` を true にせず、`LogService` にログを残す。
  - リトライやフォールバックは追加しない。
- キー値と供給経路の実体は [[infra.google.maps]] の責務である。本ノードの責務は「解決済みキーを Loader に渡す」ことのみである。

## 2026 年度改修にともなう関連事項（未確定・影響確認中）
- **1-2 前回結果表示での過去ヒヤリマーカー表示**
  - 診断開始前画面に、過去のヒヤリポイントをマップ表示する要求がある。
  - 過去をすべて描画すると地図がマーカーで埋まるため、件数制限を検討中である。
  - `drawMarker()` を何件呼ぶか（呼び出し側で絞るか、`MapService` 側に上限を持たせるか）は未確定。
  - 1-2 の用途で追加引数（ヒヤリ動画ファイル名）に何を渡すかも未確定。
- **画面の縦横変更対応**
  - 先方から縦横変更の要求があるが、現行は Android で縦固定である。
  - 回転すると地図コンテナのサイズが変わるため、`createMap()` 済みの map に対するリサイズや `fitBounds()` 再実行の要否が未確定。
- **ヒヤリ動画の個別化**
  - `markersVideoTime` の意味は「元の録画ストリーム内のオフセット秒」として確定した（上記「ヒヤリ動画ファイル名の保持」参照）。
  - 所属ファイルの情報は、新設の `markersVideoPath` で別に保持する。

## 関連ノード
- 依存: [[infra.google.maps]]、[[middleware.log.service]]
- 呼び出し元: [[ui.opening.page]] / [[ui.driving.page]] / [[ui.badspot.page]]
- 関連ユースケース: UC06（運転診断の実行）／UC08（ヒヤリ地点確認）／1-2（診断開始前画面の前回結果表示）

```json
{
  "required_changes": [
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "drawMarker にヒヤリ動画ファイル名の引数を 1 つ追加し、内部配列 markersVideoPath（または同等）で markers と同 index で保持する仕様を追加した"},
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "markersVideoTime を維持し、その意味を「元の録画ストリーム内のオフセット秒」と確定定義した（fact #4635 撤回、pushBadPoint / seekVideo 不変、t_start 保持不要）"},
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "内部状態に markersVideoPath を追加し、clearMarker / removeAll で他の並列配列と同期して消去する旨を明記した"},
    {"node": "middleware.map.service", "entrypoint": "spec/middleware/map-service.md", "description": "関連事項節の『ヒヤリ動画の個別化による markersVideoTime の意味変更』を未確定から確定済みに改訂した"}
  ],
  "suggested_impacts": [
    {"domain": "ui", "severity": "must", "reason": "ui.driving.page の drawMarker 呼び出しに、ヒヤリ動画ファイル名を渡す引数追加が必要"},
    {"domain": "ui", "severity": "must", "reason": "ui.badspot.page がマーカーごとのヒヤリ動画ファイル名を MapService から取得する手段（getter 追加の要否）を確定する必要がある"},
    {"domain": "middleware", "severity": "must", "reason": "ヒヤリ動画の生成方式とファイル名の命名・格納先を録画担当ノードで確定し、drawMarker に渡す値を定義する必要がある"},
    {"domain": "middleware", "severity": "must", "reason": "自車マーカーの方位値の供給元（GPS heading / 座標差分 / CAN 由来）が未定義であり、sensor.service 側の提供責務を確定する必要がある"},
    {"domain": "ui", "severity": "must", "reason": "ui.driving.page が drawCarMarker へ渡す rotation 値の実際の内容と、1-2 で drawMarker を何件呼ぶかの絞り込み責務を確認する必要がある"},
    {"domain": "qa", "severity": "should", "reason": "個別ヒヤリ動画ファイルに対し、元ストリームのオフセット秒で seekVideo（不変）が正しい位置を再生できるかを実機で検証する必要がある"},
    {"domain": "db", "severity": "should", "reason": "ヒヤリ地点データにヒヤリ動画ファイル名を永続化するか、および 1-2 の過去ヒヤリ取得件数制限のクエリ仕様が未確定"},
    {"domain": "ui", "severity": "should", "reason": "画面縦横変更対応時に、地図コンテナのサイズ変化へ追従するリサイズ／再フィット呼び出しが必要になる可能性がある"},
    {"domain": "infra", "severity": "could", "reason": "Web/Android のキー供給経路分離と loadMapsKey の実体定義は infra.google.maps の責務であり、従来どおり整合が必要"}
  ],
  "requirements_context": "MapService は Google Maps JS API の初期化（loadGoogleInstance）、地図生成（createMap）、ヒヤリマーカー・走行軌跡円・車両マーカー・S/E マーカーの描画と可視制御を担うシングルトン（providedIn root）であり、マーカー配列が持続するため removeAll と clearMarker を使い分ける。UC06（運転診断の実行）では車両位置追従と軌跡描画を担い、UC08（ヒヤリ地点確認）では setBigMarkerIcon による選択強調と fitBounds による全体表示を担う。Loader は region=JP / language=ja / version=weekly で初期化し、地図 UI コントロールは全非表示とする。軌跡円は直前点との距離が 0.0006deg 未満ならスキップし、最大 1000 点を超えたら先頭から破棄する。ヒヤリマーカーの comment は { msg1..msg4 } 形式で ui.driving.page の pushBadPoint が生成する。API キーは開発／実機検証フェーズで Web(JS API) と Android(SDK) のキー値共用を許容するが、供給経路は分離する。MapService は Web 側の TS 解決結果のみを参照し、キー未配置時は既存 loadMapsKey / TS 解決の挙動に従い、独自メッセージやリトライを追加しない（実体は infra.google.maps の責務）。2026 年度改修（日産自動車 一次仕様 2026-08-04 / 要求仕様確認 2026-09-17）に基づき、以下を定める。(a) drawMarker(uluru, title, videoTime, comments) にヒヤリ動画ファイル名の引数を 1 つ追加し、markersVideoPath（または同等の内部配列）で markers と同 index で保持する。(b) markersVideoTime は維持し、意味を『元の録画ストリーム内のオフセット秒』と定義する（fact #4635 撤回、proposal #241 / fact #4648）。driving.page の pushBadPoint（Math.floor(getLastSensorTime()/1000)）と bad-spot.page の seekVideo は変更せず、t_start の保持も不要とする。連続ヒヤリの動画生成方式（1 本継続か個別か）は実装都合で選択可能で、MapService の責務外である。(c) 自車マーカーの矢印は現在上向き固定であり、進行方向に合わせた向きで描画するよう変更する（優先度 want、必須 5 要求より低優先）。drawCarMarker は rotation 引数を持つが地図表示に反映されておらず、原因は要調査である。方位算出は呼び出し側または sensor.service の責務とし、MapService は渡された方位をアイコン rotation に反映する責務のみを持つ。停車時など方位不定時の扱いは未確定。付随する未確定事項として、1-2 過去ヒヤリ表示の件数制限と絞り込み責務（および追加引数に渡す値）、縦横変更時の地図リサイズ／fitBounds 再実行の要否がある。開発完了目標は 2026 年 11 月末（12 月に高齢者実験開始）。",
  "fact_candidates": [
    {"type": "api_contract", "title": "drawMarker にヒヤリ動画ファイル名引数を 1 つ追加する", "statement": "drawMarker(uluru, title, videoTime, comments) は、当該マーカーが属するヒヤリ動画のファイル名を受け取る引数を 1 つ追加する", "status": "approved"},
    {"type": "data_semantics", "title": "ヒヤリ動画ファイル名は markersVideoPath で保持する", "statement": "MapService はヒヤリマーカーが属するヒヤリ動画のファイル名を markersVideoPath（または同等の内部配列）で保持する", "status": "approved"},
    {"type": "data_semantics", "title": "markersVideoTime は元の録画ストリーム内のオフセット秒である", "statement": "markersVideoTime の値は元の録画ストリーム内のオフセット秒を意味する", "status": "approved"},
    {"type": "constraint", "title": "markersVideoTime は廃止せず維持する", "statement": "ヒヤリ動画ファイル名の保持を追加しても、既存の markersVideoTime は維持する", "status": "approved"},
    {"type": "constraint", "title": "pushBadPoint の videoTime 算出は変更しない", "statement": "driving.page.ts の pushBadPoint() における Math.floor(getLastSensorTime()/1000) による算出は変更しない", "status": "approved"},
    {"type": "constraint", "title": "seekVideo は変更しない", "statement": "bad-spot.page.ts の seekVideo() は変更しない", "status": "approved"},
    {"type": "constraint", "title": "t_start の保持は不要", "statement": "markersVideoTime の定義のために録画区間開始時刻 t_start を保持する必要はない", "status": "approved"},
    {"type": "state_rule", "title": "markersVideoPath は markers と同 index で同期する", "statement": "markersVideoPath の要素は markers と同じ index で対応し、clearMarker 実行時は他のヒヤリマーカー配列と同時に空にする", "status": "candidate"},
    {"type": "display_rule", "title": "現行の自車マーカーの矢印は上向き固定である", "statement": "現行実装では地図上の自車マーカーの矢印は上向きで固定され、実際の進行方向は反映されていない", "status": "candidate"},
    {"type": "display_rule", "title": "自車マーカーの矢印を進行方向に合わせて描画する", "statement": "自車マーカーの矢印は進行方向に合わせた向きで描画する", "status": "approved"},
    {"type": "constraint", "title": "自車マーカーの進行方向反映は優先度 want である", "statement": "自車マーカーを進行方向に向ける変更は、先方資料で優先度 want と記載されている", "status": "approved"},
    {"type": "api_contract", "title": "drawCarMarker は rotation 引数を受け取る", "statement": "drawCarMarker(uluru, rotation) は位置と回転角を引数に取り、車両アイコン（SymbolPath.FORWARD_CLOSED_ARROW、青塗り、zIndex=3）を描画・移動する", "status": "candidate"},
    {"type": "business_rule", "title": "方位値の算出責務は MapService の外にある", "statement": "MapService は渡された方位値をマーカーアイコンの rotation に反映する責務のみを持ち、方位の算出は行わない", "status": "candidate"},
    {"type": "external_integration_rule", "title": "開発／実機検証フェーズは Maps API キー値の共用を許容する", "statement": "開発フェーズおよび実機検証フェーズでは、Web(Maps JS API) と Android(Maps SDK) が同一のキー値を共用してよい", "status": "approved"},
    {"type": "external_integration_rule", "title": "Maps API キーの供給経路は Web と Android で分離する", "statement": "MapService は Web 側の供給経路から解決されたキーのみを参照する", "status": "approved"},
    {"type": "external_integration_rule", "title": "キー未配置時のエラーメッセージは既存挙動に従う", "statement": "Maps API キー未配置時のエラーメッセージは既存の loadMapsKey / TS 解決の挙動に従い、MapService は独自メッセージを追加しない", "status": "approved"},
    {"type": "api_contract", "title": "loadGoogleInstance は未初期化時のみ Loader を実行する", "statement": "loadGoogleInstance(func) は isInitialize が false のときのみ Loader を実行し、初期化済みの場合は同期的に func() を呼ぶ", "status": "candidate"},
    {"type": "business_rule", "title": "Loader は region=JP / language=ja / version=weekly で初期化する", "statement": "Google Maps Loader は region='JP'、language='ja'、version='weekly' を指定して初期化する", "status": "candidate"},
    {"type": "business_rule", "title": "軌跡円は直前点との距離が 0.0006deg 未満ならスキップする", "statement": "drawCircleMarker は直前の円マーカーとのユークリッド距離(deg)が 0.0006 未満の場合、新規マーカーを追加しない", "status": "candidate"},
    {"type": "constraint", "title": "走行軌跡の円マーカーは最大 1000 個", "statement": "circleMarkers は 1000 個を超えた時点で先頭要素を削除する", "status": "candidate"},
    {"type": "state_rule", "title": "stop 単体ではマーカーを消去しない", "statement": "stop() はリスナを null 化するのみでマーカーを残し、removeAll() は stop / clearMarker / clearCarMarker を実行して map を null にする", "status": "candidate"},
    {"type": "display_rule", "title": "可視領域外のマーカーは map から切り離される", "statement": "idle イベント時に、bounds 内かつ getVisible() が true の要素のみ setMap(map) され、それ以外は setMap(null) される", "status": "candidate"}
  ],
  "open_questions": [
    "drawMarker に追加するヒヤリ動画ファイル名引数の引数名と位置（第 5 引数か）が資料に明示されていない。実装確認が必要で、決まらないと呼び出し側（ui.driving.page / ui.opening.page）の改修内容が確定しない",
    "ui.badspot.page が markersVideoPath の値を取得する手段（getMarkerVideoPath(pos) のような getter を追加するか）が未定義。UI/Middleware の判断が必要で、決まらないとマーカー選択時に再生すべき動画ファイルを特定できない",
    "個別化されたヒヤリ動画ファイルに対し、元ストリームのオフセット秒を不変の seekVideo でそのまま使って正しい位置が再生されるか（ファイル内タイムスタンプが元ストリーム基準で保たれるか）は資料上未検証。QA の実機確認が必要で、成立しないと 6-1 の再生位置がずれる",
    "1-2 前回結果表示で過去ヒヤリマーカーを drawMarker で描画する際に、追加引数（動画ファイル名）へ何を渡すか（過去動画が参照可能か）が未確定。UI/DB 判断が必要",
    "自車マーカーの方位値の取得元（GPS の heading / 直前座標との差分 / CAN 由来）が未確定。middleware.sensor.service と ui.driving.page の判断が必要で、決まらないと rotation 反映を実装できない",
    "drawCarMarker が rotation 引数を持つのに矢印が上向き固定である原因（呼び出し側の固定値か、アイコン定義側の不具合か）が未特定。実装調査が必要で、決まらないと修正範囲が確定しない",
    "停車中・低速時など方位が不定の場合の矢印の扱い（直前の向きを維持／上向きに戻す／無回転アイコン）が未確定。UI 判断が必要",
    "方位の更新頻度と平滑化の要否が未確定。GPS 由来の方位はノイズが大きく矢印が揺れる恐れがあり、UI/センサ側の判断が必要",
    "1-2 で描画する過去ヒヤリマーカーの件数制限を MapService 側に持たせるか、呼び出し側で絞るかが未確定。UI/DB 判断が必要で、決まらないと地図の可読性と描画性能に影響する",
    "画面縦横変更に対応する場合、createMap 済み map へのリサイズ処理や fitBounds 再実行の要否が未確定。UI 判断が必要で、決まらないと回転後に地図が欠ける可能性がある",
    "本番フェーズで Web と Android のキー値共用が許容されるか未確定。infra 判断が必要で、決まらないとキー制限設定の設計が確定しない",
    "loadMapsKey の実体と TS 解決のフォールバック順序が未特定。infra.google.maps の確認が必要",
    "キー共用時のプラットフォーム制限（Web はリファラ制限、Android はパッケージ名+SHA-1）が両立可能か未検証。infra 判断が必要"
  ],
  "rationale_notes": [
    "fact #4635 の撤回と、markersVideoTime を元ストリーム内オフセット秒とする approved 決定を真とし、既存 md の『ヒヤリ動画個別化で markersVideoTime の意味が変わる可能性』という未確定記述を確定事項に置き換えた",
    "所属動画の識別（ファイル名）と再生位置（オフセット秒）を別配列に分けることで、pushBadPoint と seekVideo を変更せずに個別動画化へ対応できる。これが承認された設計の意図と解釈した",
    "markersVideoPath を他の並列配列と同 index・同時消去とする記述は、既存の並列配列管理（markersTimestamp / markersComments / markersVideoTime）との整合から導いた仕様上の要請である。承認済み fact そのものではないため、fact_candidates では candidate とした",
    "追加引数の名称・位置と getter の有無は承認事実に含まれないため、断定せず open_questions に分離した",
    "自車マーカー進行方向反映・API キー供給方針・既存 API 表・業務ルールは今回の変更対象外のため維持した"
  ]
}
```
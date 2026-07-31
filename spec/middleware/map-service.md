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
| `drawCarMarker(uluru, rotation)` | 車両アイコン（`SymbolPath.FORWARD_CLOSED_ARROW`、青塗り、`zIndex=3`）を描画・移動 |
| `drawStartMarker(uluru)` / `drawEndMarker(uluru)` | S / E ラベル付き白丸マーカー（`zIndex=1`） |
| `drawCircleMarker(uluru)` | 走行軌跡の点（薄青、`zIndex=0`）。直前マーカーとのユークリッド距離 (deg) が **`<0.0006`** ならスキップ。1000 個を超えたら先頭を削除 |
| `setBigMarkerIcon(pos)` | 指定 pos のヒヤリマーカーだけ `hiyar_big.png` (60×60) に、他は `hiyari.png` (40×40) にリセット |
| `resetMarkerIcon()` | すべて 40×40 に戻す |
| `fitBounds()` | すべてのヒヤリ + S + E を含む `LatLngBounds` にフィット |
| `checkVisibleElements(elements, bounds)` (private) | `bounds.contains(getPosition())` かつ `getVisible()` の要素だけ `setMap(map)`、それ以外は `setMap(null)` |
| `setSelectMarkerPos(pos)` / `getSelectMarkerPos()` | 選択中のヒヤリマーカー index |
| `getMarkerLength()` / `getMarkerPosition(pos)` / `getMarkerTimestamp(pos)` / `getMarkerVideoTime(pos)` / `getMarkerComment(pos, key)` | ヒヤリマーカー情報の取得 |

## 業務ルール
- Loader パラメータ: `region: 'JP'` / `language: 'ja'` / `version: 'weekly'` / `apiKey = environment.mapsKey`。
- Map の UI コントロールはすべて非表示（`mapTypeControl` / `zoomControl` / `streetViewControl` / `fullscreenControl` / `rotateControl` を false）。
- ヒヤリマーカーの comment 形式は `{ msg1, msg2, msg3, msg4 }`（`brake/handle/speed/accelerator/over_all` の複合）。[[ui.driving.page]] の `pushBadPoint` が生成する。

## 関連ノード
- 依存: [[infra.google.maps]]、[[middleware.log.service]]
- 呼び出し元: [[ui.opening.page]] / [[ui.driving.page]] / [[ui.badspot.page]]

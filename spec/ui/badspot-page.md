# ui.badspot.page — ヒヤリ地点確認画面 (画面6-1)

## 概要
走行後にヒヤリ地点マーカーを 1 点ずつ確認するページ。ルートパラメータ `path` (`@` 区切り → `/` 復元) から動画パスを取得し、映像を非オートプレイ・ミュートで再生。300ms 周期で `videoElement.currentTime` を監視し、マーカーの `videoTime` を線形走査して現在時刻に対応するヒヤリ地点を自動追尾する。前/次ボタンでヒヤリ地点をリング状に切替、選択マーカーは `hiyar_big.png` で強調表示する。

## 真実源
- `src/data/src/app/bad-spot/bad-spot.page.ts`
- `src/data/src/app/bad-spot/bad-spot.page.html`

## ルーティング
- パス: `/bad-spot/:path`（`:path` は動画パスの `/` を `@` に置換した文字列）

## 状態
```
label1..4: string
videoPath: string        // '@'→'/' 復元後
videoTimer: any          // 300ms setInterval id
spotPos: number = 0      // 選択中のマーカー index
spotTimestamp: string
spotComment1..4: string
```

## ライフサイクル
- **constructor**: `logService.initialize(file)`。
- **`ngOnInit()`**: パスパラメータを取り出し `@` → `/` 復元、label 反映。
- **`ionViewWillEnter()`**: Android のみ `screenOrientation.lock(PORTRAIT)`。
- **`ionViewDidEnter()`**: `loadMap()` + `loadVideo()`。
- **`ionViewWillLeave()`**: `clearInterval(videoTimer)` + `mapService.stop()`（マーカーは残す）。

## `loadMap()`
- `spotPos = mapService.getSelectMarkerPos()` から復帰（[[ui.driving.page]] が設定）。
- 対応する `uluru = mapService.getMarkerPosition(spotPos)` を中心に地図生成。`clearCarMarker()` を実行。
- `onPointer()` を呼び中心と選択マーカーを反映。
- `mark` リスナ: マーカータップで `spotPos = pos`、`onPointer()` + `seekVideo()`。

## `loadVideo()`
- videoElement を `autoplay=false, loop=false, muted=true` に設定。`videoPath` があれば `src` に設定。
- `seekVideo()` で現在マーカーの videoTime を反映。
- **300ms 周期**の setInterval で `videoElement.currentTime` を監視:
  - 変化なしなら return。
  - 変化があれば `spotPos` を初期値に、マーカー配列を先頭から走査して `getMarkerVideoTime(pos) <= currentTime` を満たす最後の pos を採用。
  - `spotPos` が変わったら `onPointer()`。

## 操作
- `onBack()`: `spotPos--`（0 未満なら末尾）。`onPointer()` + `seekVideo()`。
- `onNext()`: `spotPos++`（上限を超えたら 0）。`onPointer()` + `seekVideo()`。
- `onPointer()`:
  - `mapService.getMarkerPosition(spotPos)` を取得。
  - `setBigMarkerIcon(spotPos)`（選択マーカーを `hiyar_big.png` に、それ以外を `hiyari.png` に）。
  - `setCenter(uluru)` + `setZoom(16)`。
  - `spotTimestamp` に `getMarkerTimestamp(spotPos)`。
  - `spotComment1..4` に `getMarkerComment(spotPos, 'msg1'..'msg4')` を反映。
- `seekVideo()`: `videoElement.currentTime = mapService.getMarkerVideoTime(spotPos)`。

## 業務ルール
- 動画が録画されていない診断結果でもマーカーは辿れる（`videoPath === ''` のときは video は空、Map ナビゲーションのみ）。
- 画面向きは縦固定。
- 前後遷移はリング（末尾 → 先頭に戻る）。

## 関連ノード
- 依存: [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]]
- 遷移元: [[ui.driving.page]]

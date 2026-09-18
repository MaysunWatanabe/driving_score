<!-- 作成: 2026-09-10 17:30:30 JST | 更新: 2026-09-18 17:54:52 JST -->

# ui.badspot.page — ヒヤリ地点確認画面 (画面6-1)

## 概要
走行後にヒヤリ地点マーカーを 1 点ずつ確認するページ。ルートパラメータ `path` (`@` 区切り → `/` 復元) から動画パスを取得し、映像を非オートプレイ・ミュートで再生。300ms 周期で `videoElement.currentTime` を監視し、マーカーの `videoTime` を線形走査して現在時刻に対応するヒヤリ地点を自動追尾する。前/次ボタンでヒヤリ地点をリング状に切替、選択マーカーは `hiyar_big.png` で強調表示する。

本画面は **ヒヤリ地点（イベント発生地点）の閲覧専用画面** であり、スコアの減点内容・減点根拠を提示する画面ではない。ヒヤリ判定はスコア値を変更しない（後述「業務ルール」参照）ため、本画面が表示するのは発生時刻・位置・付随メッセージ（評価コメント）と録画動画のみである。

2026 年度改修要求（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 / メイサンソフト『要求仕様確認』2026-09-17）において、**本画面の役割は「従来通り」と確定している**：地図上のヒヤリポイントをタップした際に、録画動画の再生・発生日時・評価コメントの表示を行う。ただし遷移元・動画の粒度・画面向きについては改修要求の影響を受けるため、「2026 年度改修要求による影響」節に整理する。

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
- `spotPos = mapService.getSelectMarkerPos()` から復帰（遷移元画面が設定。現行は [[ui.driving.page]]）。
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

## 表示項目
| 項目 | ソース | 編集 |
| --- | --- | --- |
| 地図（中心＝選択マーカー、ズーム 16 固定） | `mapService.getMarkerPosition(spotPos)` | 不可（マーカータップによる選択のみ） |
| 選択マーカー強調 | `setBigMarkerIcon(spotPos)` | 不可 |
| 発生時刻 `spotTimestamp` | `mapService.getMarkerTimestamp(spotPos)` | 読み取り専用 |
| 評価コメント `spotComment1..4` | `mapService.getMarkerComment(spotPos, 'msg1'..'msg4')` | 読み取り専用 |
| 動画 | `videoPath`（`@`→`/` 復元） | 再生位置は `seekVideo()`／利用者操作で変化 |
| ラベル `label1..4` | 設定（[[middleware.login.service]] 経由の label） | 読み取り専用 |

- 本画面にスコア値・減点値・減点量を示す表示項目は存在しない。レーダーチャート（6 項目 5 段階）も本画面の表示対象ではない（[[ui.result.page]] / [[ui.comment.page]] 側の責務）。
- 本画面に入力・編集フォームは存在しない。ヒヤリ地点の追加・削除・コメント修正は行えない。

## 業務ルール
- 動画が録画されていない診断結果でもマーカーは辿れる（`videoPath === ''` のときは video は空、Map ナビゲーションのみ）。
- 画面向きは縦固定（現行実装）。2026 年度改修要求の「縦横変更できるようにしてください」との衝突は未解決（後述）。
- 前後遷移はリング（末尾 → 先頭に戻る）。
- **ヒヤリはスコア値を変更しない**：`scoreLogicFunction.txt` L843-845 は `result.hiyari = true` とメッセージのみを設定し、スコア値の加減算は行わない（承認済みファクト）。したがって本画面は「減点結果の内訳」ではなく「ヒヤリイベント地点の閲覧」を提供する。UI 文言でヒヤリを減点・失点として説明してはならない。
- 表示されるメッセージ (`msg1..msg4`) はヒヤリ判定時に設定されたメッセージ（評価コメント）であり、スコア算出根拠ではない。
- **ヒヤリポイントタップ時の提供機能は「録画動画の再生 + 発生日時表示 + 評価コメント表示」で確定**（承認済みファクト）。改修要求 1-2（前回結果表示）からのタップ動作もこの 3 点を満たすこと。

## 2026 年度改修要求による影響
改修要求 5 本のうち、本画面に関係するのは ①診断開始前画面（1-2）の前回結果表示、③レーダーチャート表示（導線）、⑤ヒヤリ発生時の録画データサイズ改善である。

### 遷移元の追加（1-2 前回結果表示）
- 1-2 前回結果表示の地図上に描画される過去ヒヤリポイントをタップした場合も、本画面と同等の機能（録画動画の再生・発生日時・評価コメント表示）を提供する。動作は「従来通り」と確定している。
- このため、本画面へ遷移する画面は `mapService.getSelectMarkerPos()`（選択位置）とマーカー集合を事前に設定する責務を持つ。1-2 からの遷移でも同じ契約を満たす必要がある。
- 1-2 に表示する過去ヒヤリの件数（直近何回分に限るか）は未確定。件数制限が入る場合、本画面の前/次ボタンによるリング巡回の対象範囲も 1-2 が渡したマーカー集合に限定される。

### 録画動画の粒度（ヒヤリ前後 15 秒の個別動画化）
- ⑤の改善方針では、ヒヤリ前後（既定 15 秒）を対象とした録画が想定される。連続ヒヤリ（30 秒以内）の場合、1 本に継続録画しても、ヒヤリポイントごとに個別生成してもよい（承認済みファクト）。満たすべき要件は「ヒヤリ時の動画が見られること」「個別にヒヤリポイントの動画を確認できること」。
- 現行実装は **診断全体の通し動画 1 本 + `videoTime` オフセット** を前提とし、300ms 監視で動画再生位置からマーカーを自動追尾する。個別動画方式（マーカー 1 件＝動画 1 本）になった場合、`videoPath` が選択マーカーごとに切り替わるため、以下が再設計対象となる：
  - 自動追尾（`currentTime` → `spotPos` 逆引き）の意味づけ（個別動画では 1 本内に 1 マーカーのみとなり追尾が不要になる可能性）
  - `seekVideo()`（個別動画では 0 秒起点、または前後 15 秒のうちヒヤリ発生時刻へのシーク）
  - 前/次ボタン押下時の動画 `src` 差し替えと再生状態（自動再生するか、停止状態で待つか）
- 上記の再生方式は未確定であり、確定するまで現行の通し動画方式の記述を真実源とする。
- 録画の前後時間（既定 15 秒）を設定で可変にするかも未確定。可変化された場合、本画面が表示する動画尺が可変となるだけで、表示項目の構成は変わらない想定。

### 画面向き
- 先方要求「縦横変更できるようにしてください」に対し、現行は Android で `screenOrientation.lock(PORTRAIT)` を掛けている。本画面を回転対応にするか、横向き時に地図・動画・コメントをどう配置するかは未確定。

## 関連ノード
- 依存: [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]]
- 遷移元: [[ui.driving.page]]（現行） / 1-2 前回結果表示（改修で追加予定、[[ui.opening.page]] 系）
- 参照: [[middleware.score-logicCan]]（ヒヤリ判定がスコアを変更しないこと）

```json
{
  "required_changes": [
    {"node": "ui.badspot.page", "entrypoint": "spec/ui/badspot-page.md", "description": "2026年度改修要求の影響節を追加（1-2からの遷移追加・ヒヤリ個別動画化による再生方式未確定・録画前後時間可変・縦横対応要求との衝突）、ヒヤリポイントタップ時の提供機能は従来通り3点で確定と明記、評価コメント表記へ統一"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "ヒヤリ前後15秒の個別動画化により map.service のマーカー契約（videoPath 単一 / videoTime オフセット）が成立しなくなるため、マーカー毎の動画パス保持方式の再定義が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "1-2 前回結果表示から本画面へ遷移する際も getSelectMarkerPos とマーカー集合の設定契約を満たす必要があり、1-2 側の仕様に遷移責務を明記する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "録画前後時間（既定15秒）の可変化と連続ヒヤリの1本／個別生成の選択が録画サービス側の実装判断であり、本画面の動画尺・本数に直結する"},
    {"domain": "QA-agent", "severity": "should", "reason": "1-2 経由の遷移・個別動画再生・過去ヒヤリ件数制限下でのリング巡回という新しい確認観点が発生する"},
    {"domain": "Infra-agent", "severity": "could", "reason": "個別動画化により動画ファイル数が増えるため保存パス命名規則とストレージ容量方針の確認が望ましい"}
  ],
  "requirements_context": "UC08:ヒヤリ地点確認（画面6-1 / ui.badspot.page）。/bad-spot/:path（:path は動画パスの / を @ に置換した文字列）で、記録されたヒヤリ地点を動画と地図で1点ずつ確認する。ngOnInit でパスを @→/ 復元し label1..4 を反映、ionViewWillEnter で Android のみ縦固定、ionViewDidEnter で loadMap()+loadVideo()、ionViewWillLeave で 300ms タイマ解除と mapService.stop()（マーカーは残す）。loadMap は mapService.getSelectMarkerPos() で遷移元が設定した選択位置を復帰し、そのマーカー位置を中心に地図生成、clearCarMarker、mark リスナでマーカータップ選択→onPointer+seekVideo。loadVideo は autoplay=false/loop=false/muted=true、videoPath があれば src 設定、300ms 周期で currentTime を監視し getMarkerVideoTime(pos)<=currentTime を満たす最後の pos を選択（変化時のみ onPointer）。onBack/onNext は spotPos をリング状に前後移動し onPointer+seekVideo。onPointer は選択マーカーを hiyar_big.png、他を hiyari.png に切替、setCenter+setZoom(16)、spotTimestamp と spotComment1..4 を反映。videoPath が空の診断結果でもマーカー巡回は可能。承認済みファクトにより、ヒヤリ判定は scoreLogicFunction.txt L843-845 で result.hiyari=true とメッセージのみを設定しスコア値を変更しないため、本画面は減点内訳ではなくヒヤリイベント地点の閲覧のみを提供し、スコア値・減点量の表示や編集入力は持たない。2026年度改修要求（日産『運転機能チェックアプリの一次仕様』2026-08-04 / メイサンソフト『要求仕様確認』2026-09-17、開発は2026年11月末完了目標）に関して、1-2 前回結果表示の地図上ヒヤリポイントをタップした時の動作は従来通り（録画動画の再生、発生日時および評価コメントの表示）と確定しており、1-2 も本画面への遷移元となるため選択位置とマーカー集合の設定責務を負う。⑤録画データサイズ改善によりヒヤリ前後15秒の個別動画化が想定され、連続ヒヤリ（30秒以内）は1本継続録画でもヒヤリポイント毎の個別生成でもよいが、個別動画になった場合の再生方式・マーカー対応づけ・前後ボタン挙動は未確定であり、現行の通し動画＋videoTime追尾方式を真実源とする。録画前後時間（既定15秒）の可変化、1-2 に表示する過去ヒヤリ件数の上限、縦横回転対応（現行はPORTRAIT固定）はいずれも未確定。レーダーチャート（6項目5段階）やスコア表示は本画面の責務外。",
  "fact_candidates": [
    {"type": "display_rule", "title": "ヒヤリ地点確認画面はスコア値・減点量を表示しない", "statement": "/bad-spot/:path 画面は選択ヒヤリ地点の位置・発生時刻・評価コメント・動画のみを表示し、スコア値や減点量、レーダーチャートを表示しない", "status": "candidate"},
    {"type": "display_rule", "title": "ヒヤリポイントタップ時の提供機能は録画動画再生・発生日時・評価コメントの3点", "statement": "地図上のヒヤリポイントをタップした際、本画面は録画動画の再生、発生日時の表示、評価コメントの表示を行う", "status": "approved"},
    {"type": "state_rule", "title": "1-2 前回結果表示も本画面への遷移元となる", "statement": "1-2 前回結果表示の地図上の過去ヒヤリポイントをタップした場合も本画面へ遷移し、従来と同じ表示機能を提供する", "status": "candidate"},
    {"type": "constraint", "title": "遷移元は選択マーカー位置とマーカー集合を事前に設定する", "statement": "本画面は loadMap() で mapService.getSelectMarkerPos() を初期 spotPos として読み取るため、遷移元画面が選択位置とマーカー集合を設定していなければならない", "status": "candidate"},
    {"type": "display_rule", "title": "選択中マーカーは大アイコンで強調される", "statement": "onPointer() は選択中マーカーのアイコンを hiyar_big.png、非選択マーカーを hiyari.png にして地図中心を選択マーカー位置、ズームを 16 に設定する", "status": "candidate"},
    {"type": "display_rule", "title": "選択マーカーの発生時刻と評価コメント4件が表示される", "statement": "画面は spotTimestamp に getMarkerTimestamp(spotPos)、spotComment1..4 に getMarkerComment(spotPos,'msg1'..'msg4') を表示する", "status": "candidate"},
    {"type": "input_rule", "title": "ヒヤリ地点情報は編集できない", "statement": "利用者は本画面でヒヤリ地点の発生時刻・評価コメント・位置を追加・編集・削除できない", "status": "candidate"},
    {"type": "state_rule", "title": "前後ボタンはリング状に選択位置を移動する", "statement": "onBack() は spotPos を 1 減らし 0 未満で末尾へ、onNext() は 1 増やし上限超過で 0 へ戻し、いずれも onPointer() と seekVideo() を実行する", "status": "candidate"},
    {"type": "state_rule", "title": "動画再生位置に応じて選択ヒヤリ地点が自動追尾される", "statement": "300ms 周期で videoElement.currentTime を監視し、変化時に getMarkerVideoTime(pos)<=currentTime を満たす最後の pos を選択し、選択が変わった場合のみ onPointer() を実行する", "status": "candidate"},
    {"type": "state_rule", "title": "マーカータップで選択が切り替わる", "statement": "地図上のマーカーをタップすると spotPos が該当 pos になり onPointer() と seekVideo() が実行される", "status": "candidate"},
    {"type": "display_rule", "title": "動画は非自動再生・ループなし・ミュートで表示される", "statement": "videoElement は autoplay=false、loop=false、muted=true で表示され、videoPath が空でない場合のみ src が設定される", "status": "candidate"},
    {"type": "display_rule", "title": "動画未記録でもマーカー巡回は可能", "statement": "videoPath が空の診断結果では動画領域は空となり、地図上のヒヤリ地点巡回のみが可能となる", "status": "candidate"},
    {"type": "constraint", "title": "現行の画面向きは縦固定", "statement": "Android では ionViewWillEnter で screenOrientation.lock(PORTRAIT) により本画面を縦向きに固定する（現行実装）", "status": "candidate"},
    {"type": "state_rule", "title": "離脱時に監視タイマとマップは停止するがマーカーは保持する", "statement": "ionViewWillLeave() で 300ms タイマを clearInterval し mapService.stop() を実行するが、マーカーは破棄しない", "status": "candidate"},
    {"type": "data_semantics", "title": "ルートパラメータ path は @ を / に復元して動画パスとする", "statement": "ルートパラメータ path は動画パスの / を @ に置換した文字列であり、ngOnInit で @ を / に復元して videoPath とする", "status": "candidate"},
    {"type": "business_rule", "title": "ヒヤリ判定はスコア値を変更しない", "statement": "ヒヤリ判定は result.hiyari=true とメッセージのみを設定し、スコア値の加減算を行わない（scoreLogicFunction.txt L843-845）", "status": "approved"},
    {"type": "business_rule", "title": "個別にヒヤリポイントの動画を確認できることが要件", "statement": "連続ヒヤリの録画を1本にまとめるか個別生成するかは実装都合で選べるが、ヒヤリ時の動画が見られること、および個別にヒヤリポイントの動画を確認できることは満たさなければならない", "status": "approved"}
  ],
  "open_questions": [
    "ヒヤリ前後15秒の個別動画方式になった場合の本画面の再生方式が未確定。マーカー1件＝動画1本になると videoPath が選択ごとに切り替わり、300ms 監視による自動追尾・seekVideo の起点・前後ボタン押下時の src 差し替えと再生状態（自動再生/停止待ち）が定義できない。Middleware（録画サービス / map.service のマーカー契約）の判断が必要。決まらないと本画面の主要インタラクションを確定できない。",
    "1-2 前回結果表示に描画する過去ヒヤリの件数上限が未確定。件数制限が入ると本画面の前後ボタンによる巡回対象範囲が遷移元の渡したマーカー集合に限定されるため、巡回範囲の定義が変わる。UI(1-2)とDB/Middlewareの判断が必要。",
    "録画の前後時間（既定15秒）を設定で可変にするかが未確定。可変化時に本画面の動画尺とシーク基準（発生時刻がどのオフセットに来るか）が変わる。Middleware/Infra の判断が必要。",
    "本画面を縦横回転対応にするかが未確定。先方要求は縦横変更可だが現行は PORTRAIT 固定であり、横向き時の地図・動画・評価コメントのレイアウトも未定義。UI 全体方針として確定が必要。",
    "評価コメント msg1..msg4 の各枠が意味する内容（種別・状況説明・アドバイス等）と表示順・未設定時の扱いが UI から断定できない。Middleware（score-logicCan / map.service）の確認が必要。決まらないとコメント欄の空表示・省略ルールを規定できない。",
    "ヒヤリ地点が 0 件の診断結果で本画面へ遷移し得るか、その場合の空状態表示（前後ボタンの無効化・メッセージ）が未定義。遷移元（ui.driving.page / 1-2）と Middleware の判断が必要。",
    "画面内の見出し・ラベル文言（label1..4 を含む）でヒヤリを『減点』『失点』として説明している箇所があるかが資料から確認できない。承認済みファクトと矛盾する文言があれば修正対象となるため、実 HTML と設定 label の確認が必要。",
    "ヒヤリ地点が動画時刻を持たない、または動画尺と整合しない場合の seekVideo() 挙動（先頭固定か無反応か）が UI から断定できない。Middleware の getMarkerVideoTime 仕様確認が必要。"
  ],
  "rationale_notes": [
    "承認済みファクト『1-2 のヒヤリポイントタップ時の動作は従来通り（node=ui.badspot.page）』を本画面の確定要件として明記し、提供機能を録画動画再生・発生日時・評価コメントの3点に整理した。これにより改修で表示項目を増やす提案が出た場合の基準線が明確になる。",
    "1-2 が新たな遷移元になることで、getSelectMarkerPos とマーカー集合を設定する責務が遷移元側にある契約を明文化した。現行は ui.driving.page 前提で暗黙だったため、1-2 実装時の抜けを防ぐ意図。",
    "個別動画化は承認済みファクト（実装都合で1本/個別のいずれでもよい）と open_question（再生方式未確定）が併存する状態のため、現行の通し動画＋videoTime 追尾方式を真実源として維持したまま、影響箇所のみを列挙する形にした。仕様を先取りして書き換えない。",
    "UI は表示責務のみを持ち、ヒヤリ判定・マーカー生成・videoTime の付与・録画分割は Middleware / 録画サービス側の責務とする。",
    "レーダーチャート（6項目5段階・今回と過去平均の2系列）は結果表示/アドバイス画面の責務であり、本画面の表示項目ではないことを明示して責務混在を防いだ。",
    "コード変更を伴う提案は行っていない。本更新は spec 文面のみの整合更新である（スコアロジック凍結の承認済み方針を維持）。"
  ]
}
```
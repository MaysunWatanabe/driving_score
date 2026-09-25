<!-- 作成: 2026-09-18 17:54:52 JST | 更新: 2026-09-25 11:02:05 JST -->

# ui.badspot.page — ヒヤリ地点確認画面 (画面6-1)

## 概要
走行後に、ヒヤリ地点マーカーを 1 点ずつ確認するページです。

- ルートパラメータ `path`（`@` 区切りを `/` に復元）から動画パスを取得します。
- 映像は非オートプレイ・ミュートで再生します。
- 300ms 周期で `videoElement.currentTime` を監視し、マーカーの `videoTime` を線形走査して、現在時刻に対応するヒヤリ地点を自動追尾します。
- 前/次ボタンでヒヤリ地点をリング状に切り替えます。選択中のマーカーは `hiyar_big.png` で強調表示します。

2026 年度改修で、6-1 は **複数の動画ファイルに対応** します。マーカーごとに対応する動画ファイルが異なる場合は、マーカーを選択したときに動画 `src` を差し替えます（「複数動画ファイル対応」節を参照）。

本画面は **ヒヤリ地点（イベント発生地点）を閲覧するための専用画面** です。スコアの減点内容や減点根拠を示す画面ではありません。ヒヤリ判定はスコア値を変更しないため（後述「業務ルール」参照）、本画面が表示するのは次の項目だけです。
- 発生時刻
- 位置
- 付随メッセージ（評価コメント）
- 録画動画

2026 年度改修要求の出所は次の 2 資料です。
- 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04
- メイサンソフト『要求仕様確認』2026-09-17

この改修要求で、**本画面の役割は「従来通り」と確定** しています。地図上のヒヤリポイントをタップしたときに、録画動画の再生、発生日時の表示、評価コメントの表示を行います。

一方で、次の点は改修要求の影響を受けます。これらは「2026 年度改修要求による影響」節に整理します。
- 遷移元
- 動画の粒度（複数ファイル化）
- 画面の向き

## 真実源
- `src/data/src/app/bad-spot/bad-spot.page.ts`
- `src/data/src/app/bad-spot/bad-spot.page.html`
- 複数動画ファイル対応の挙動は、承認済みファクト「6-1 ヒヤリシーン表示の複数ファイル対応」を真実源とします。実装がこのファクトに追随するまでは、コードよりファクトを優先します。

## ルーティング
- パス: `/bad-spot/:path`
- `:path` は、動画パスの `/` を `@` に置換した文字列です。
- 複数ファイル化した後に `:path` が何を指すか（初期選択マーカーの動画か、など）は未確定です。「未確定事項」を参照してください。

## 状態
```
label1..4: string
videoPath: string        // '@'→'/' 復元後（初期動画パス）
videoTimer: any          // 300ms setInterval id
spotPos: number = 0      // 選択中のマーカー index
spotTimestamp: string
spotComment1..4: string
```
- 複数ファイル対応後は、`videoElement.src` に「現在再生対象の動画ファイル」を保持します。この値は、マーカー選択に応じて差し替えます。

## ライフサイクル
| タイミング | 処理 |
| --- | --- |
| constructor | `logService.initialize(file)` を実行します。 |
| `ngOnInit()` | パスパラメータを取り出して `@` を `/` に復元し、label を反映します。 |
| `ionViewWillEnter()` | Android のみ `screenOrientation.lock(PORTRAIT)` を実行します。 |
| `ionViewDidEnter()` | `loadMap()` と `loadVideo()` を実行します。 |
| `ionViewWillLeave()` | `clearInterval(videoTimer)` と `mapService.stop()` を実行します。マーカーは残します。 |

## `loadMap()`
1. `spotPos = mapService.getSelectMarkerPos()` で選択位置を復帰します。この値は遷移元画面が設定します（現行は [[ui.driving.page]]、改修後は 1-2 も含みます）。
2. `uluru = mapService.getMarkerPosition(spotPos)` を中心に地図を生成し、`clearCarMarker()` を実行します。
3. `onPointer()` を呼び、地図の中心と選択マーカーを反映します。
4. `mark` リスナでマーカーのタップを受け付けます。タップされると `spotPos = pos` とし、`onPointer()` を実行してから「マーカー選択時の動画切替」（後述）を行います。

## `loadVideo()`
1. videoElement を `autoplay=false, loop=false, muted=true` に設定します。
2. `videoPath` があれば `src` に設定します。
3. `seekVideo()` で、現在のマーカーの videoTime を反映します。
4. **300ms 周期** の setInterval で `videoElement.currentTime` を監視します。
   - 値に変化がなければ何もしません（return）。
   - 変化があれば、`spotPos` を初期値としてマーカー配列を先頭から走査し、`getMarkerVideoTime(pos) <= currentTime` を満たす最後の pos を採用します。
   - **走査の対象は、現在の `src` と同じ動画ファイルに属するマーカーだけです。** 自動追尾によって別ファイルのマーカーへ移ることはありません。動画が末尾まで再生されても、次のファイルへ自動では切り替えません。
   - `spotPos` が変わった場合は `onPointer()` を実行します（`src` は差し替えません）。

## 複数動画ファイル対応（マーカー選択時の動画切替）
マーカーを選択する操作は次の 3 つです。
- 地図上のマーカーのタップ
- `onBack()`
- `onNext()`

いずれの操作でも、動画は以下の規則で切り替えます。

1. 選択されたマーカーの動画ファイルが、**現在の `src` と異なる** 場合
   - `src` をそのマーカーの動画ファイルに差し替えます。
   - その後に `seekVideo()` を実行します。
2. 選択されたマーカーの動画ファイルが、**現在の `src` と同じ** 場合
   - `src` は差し替えず、`seekVideo()`（シーク）だけを行います。
3. `src` を差し替えた後も、videoElement は `autoplay=false` / `loop=false` / `muted=true` を維持します。
   - 差し替えただけで自動再生が始まることはありません。
4. 300ms 周期の `currentTime` 自動追尾は、同じファイル内のマーカーに限ります。ファイルをまたいで自動で遷移することはありません。
5. 前/次ボタンによるリング巡回は、**全マーカー** を対象とします。
   - 巡回がファイルをまたぐ場合は、`src` の差し替えを伴います。
6. 動画ファイルが存在しない場合の挙動は、現行のまま変更しません。
   - 動画領域は空になり、地図上のマーカー巡回のみ可能です。

## 操作
**`onBack()`**
- `spotPos--` を実行します。0 未満になった場合は末尾に移ります。
- `onPointer()` を実行した後、マーカー選択時の動画切替（`src` 差し替えの判定を行ってから `seekVideo()`）を行います。

**`onNext()`**
- `spotPos++` を実行します。上限を超えた場合は 0 に戻ります。
- `onPointer()` を実行した後、マーカー選択時の動画切替を行います。

**`onPointer()`**
1. `mapService.getMarkerPosition(spotPos)` を取得します。
2. `setBigMarkerIcon(spotPos)` を実行します。選択中のマーカーを `hiyar_big.png` に、それ以外を `hiyari.png` にします。
3. `setCenter(uluru)` と `setZoom(16)` を実行します。
4. `spotTimestamp` に `getMarkerTimestamp(spotPos)` を反映します。
5. `spotComment1..4` に `getMarkerComment(spotPos, 'msg1'..'msg4')` を反映します。

**`seekVideo()`**
- `videoElement.currentTime = mapService.getMarkerVideoTime(spotPos)` を実行します。
- 複数ファイル化した後、この videoTime が「そのマーカーが属するファイル内のオフセット」を意味するかどうかは、Middleware 側で確認が必要です。

## 表示項目
| 項目 | ソース | 編集 |
| --- | --- | --- |
| 地図（中心＝選択マーカー、ズーム 16 固定） | `mapService.getMarkerPosition(spotPos)` | 不可（マーカーのタップによる選択のみ） |
| 選択マーカーの強調 | `setBigMarkerIcon(spotPos)` | 不可 |
| 発生時刻 `spotTimestamp` | `mapService.getMarkerTimestamp(spotPos)` | 読み取り専用 |
| 評価コメント `spotComment1..4` | `mapService.getMarkerComment(spotPos, 'msg1'..'msg4')` | 読み取り専用 |
| 動画 | `videoPath`（`@` を `/` に復元）。複数ファイル時は選択マーカーの動画ファイル | 再生位置は `seekVideo()` または利用者の操作で変化。ファイルの切替はマーカー選択時のみ |
| ラベル `label1..4` | 設定（[[middleware.login.service]] 経由の label） | 読み取り専用 |

- 本画面には、スコア値・減点値・減点量を示す表示項目はありません。
- レーダーチャート（6 項目 5 段階）も本画面の表示対象ではありません。[[ui.result.page]] / [[ui.comment.page]] 側の責務です。
- 本画面には入力・編集フォームがありません。ヒヤリ地点の追加・削除や、コメントの修正はできません。

## 業務ルール
- **動画がない場合**
  - 動画が録画されていない診断結果でも、マーカーは辿れます。
  - `videoPath === ''` のとき、または動画ファイルが存在しないときは、video が空になり、地図でのナビゲーションのみになります。この挙動は複数ファイル対応後も変更しません。
- **画面の向き**
  - 現行実装は縦固定です。
  - 2026 年度改修要求「縦横変更できるようにしてください」との衝突は未解決です（後述）。
- **前後遷移**
  - 前後遷移はリング状です（末尾の次は先頭に戻ります）。
  - 対象は全マーカーで、ファイルをまたぐ場合は `src` を差し替えます。
- **自動追尾**
  - 自動追尾は、同じ動画ファイル内に限ります。
- **ヒヤリはスコア値を変更しません**
  - `scoreLogicFunction.txt` L843-845 は `result.hiyari = true` とメッセージを設定するだけで、スコア値の加減算は行いません（承認済みファクト）。
  - したがって本画面が提供するのは「減点結果の内訳」ではなく「ヒヤリイベント地点の閲覧」です。
  - UI の文言で、ヒヤリを減点や失点として説明してはいけません。
- **評価コメント**
  - 表示されるメッセージ（`msg1..msg4`）は、ヒヤリ判定時に設定されたメッセージ（評価コメント）です。スコア算出の根拠ではありません。
- **ヒヤリポイントをタップしたときに提供する機能は、次の 3 点で確定しています**（承認済みファクト）。
  - 録画動画の再生
  - 発生日時の表示
  - 評価コメントの表示

  改修要求 1-2（前回結果表示）からのタップ動作も、この 3 点を満たす必要があります。

## 2026 年度改修要求による影響
改修要求 5 本のうち、本画面に関係するのは次の 3 本です。
- ① 診断開始前画面（1-2）の前回結果表示
- ③ レーダーチャート表示（導線）
- ⑤ ヒヤリ発生時の録画データサイズ改善

### 遷移元の追加（1-2 前回結果表示）
- 1-2 前回結果表示の地図上に描画される過去ヒヤリポイントをタップした場合も、本画面と同等の機能を提供します（録画動画の再生・発生日時・評価コメントの表示）。この動作は「従来通り」と確定しています。
- 本画面へ遷移する画面は、次の 2 つを事前に設定する責務を持ちます。1-2 からの遷移でも、同じ契約を満たす必要があります。
  - `mapService.getSelectMarkerPos()`（選択位置）
  - マーカー集合（複数ファイル時は、各マーカーの動画ファイル対応を含みます）
- 1-2 は過去の複数回の診断分のヒヤリを表示し得ます。そのため、マーカー集合が複数の動画ファイルにまたがる前提になります。この場合も、上記の複数動画ファイル対応の規則で巡回します。
- 1-2 に表示する過去ヒヤリの件数（直近何回分に限るか）は未確定です。件数制限が入る場合、本画面の前/次ボタンによるリング巡回の対象範囲も、1-2 が渡したマーカー集合に限られます。

### 録画動画の粒度（ヒヤリ前後の個別動画化）
- ⑤の改善方針では、ヒヤリの前後（既定 15 秒）を対象とした録画が想定されています。
- 連続ヒヤリ（30 秒以内）の場合は、1 本に継続して録画しても、ヒヤリポイントごとに個別に生成してもかまいません（承認済みファクト）。満たすべき要件は次の 2 点です。
  - ヒヤリ時の動画が見られること
  - ヒヤリポイントごとに、個別に動画を確認できること
- 本画面の再生方式は、承認済みファクト「6-1 ヒヤリシーン表示の複数ファイル対応」で確定しています（「複数動画ファイル対応」節を参照）。
  - 1 本の動画に複数のマーカーが含まれる場合（通し動画、または連続ヒヤリの継続録画）は、そのファイル内で自動追尾とシークを行います。
  - マーカー 1 件に動画 1 本が対応する場合は、マーカーを選択するたびに `src` を差し替えます。
- 再生方式はこれで確定しましたが、次の点は未確定です。
  - 各マーカーの動画ファイルをどう保持・参照するか（マーカー契約）
  - `videoTime` の基準（ファイル内オフセットかどうか）
  - 録画の前後時間（既定 15 秒）を設定で可変にするかどうか。可変になった場合も、変わるのは本画面の動画尺だけで、表示項目の構成は変わらない想定です。

### 画面の向き
- 先方は「縦横変更できるようにしてください」と要求しています。一方、現行は Android で `screenOrientation.lock(PORTRAIT)` を掛けています。
- 本画面を回転対応にするか、横向き時に地図・動画・コメントをどう配置するかは未確定です。

## 未確定事項（本画面に関わるもの）
- 複数ファイル化した後に、マーカーごとの動画ファイルパスを `mapService` がどう提供するか、またルートパラメータ `:path` の意味（初期表示ファイル）。
- 複数ファイル時の `getMarkerVideoTime()` の基準（ファイル内オフセットか）。
- 1-2 に表示する過去ヒヤリの件数上限。
- 録画の前後時間を可変にするかどうか。
- 縦横回転対応の有無と、横向き時のレイアウト。
- 評価コメント `msg1..msg4` の各枠の意味と、未設定時の表示。
- ヒヤリ地点が 0 件の場合の遷移可否と、空状態の表示。

## 関連ノード
- 依存: [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]]
- 遷移元: [[ui.driving.page]]（現行） / 1-2 前回結果表示（改修で追加予定、[[ui.opening.page]] 系）
- 参照: [[middleware.score-logicCan]]（ヒヤリ判定がスコアを変更しないこと）

```json
{
  "required_changes": [
    {"node": "ui.badspot.page", "entrypoint": "spec/ui/badspot-page.md", "description": "承認済みファクト『6-1 ヒヤリシーン表示の複数ファイル対応』を反映し、マーカー選択時の src 差し替え/seek 規則・自動追尾の同一ファイル限定・リング巡回の全マーカー対象・差し替え後の autoplay=false/loop=false/muted=true 維持・動画ファイル不在時の現行維持を追記し、個別動画時の再生方式未確定の記述を確定内容に改訂"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "複数ファイル対応では map.service がマーカーごとの動画ファイルパスを提供する必要があり、現行の videoPath 単一 + videoTime オフセットのマーカー契約を再定義し videoTime の基準（ファイル内オフセット）を明確化する必要がある"},
    {"domain": "UI-agent", "severity": "must", "reason": "1-2 前回結果表示から本画面へ遷移する際、getSelectMarkerPos とマーカー集合（各マーカーの動画ファイル対応を含む）を設定する契約を 1-2 側仕様に明記する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "録画前後時間（既定15秒）の可変化と連続ヒヤリの1本／個別生成の選択が本画面の動画尺・ファイル数に直結する"},
    {"domain": "QA-agent", "severity": "should", "reason": "ファイル跨ぎのリング巡回時の src 差し替え、同一ファイル時の seek のみ、自動追尾がファイルを跨がないこと、差し替え後も自動再生しないこと、動画ファイル不在時の現行挙動維持が新たな確認観点となる"},
    {"domain": "Infra-agent", "severity": "could", "reason": "動画ファイル数増加に伴う保存パス命名規則とストレージ容量方針の確認が望ましい"}
  ],
  "requirements_context": "UC08:ヒヤリ地点確認（画面6-1 / ui.badspot.page / spec/ui/badspot-page.md）。/bad-spot/:path（:path は動画パスの / を @ に置換した文字列）で記録されたヒヤリ地点を動画と地図で1点ずつ確認する閲覧専用画面。ngOnInit でパスを @→/ 復元し label1..4 を反映、ionViewWillEnter で Android のみ PORTRAIT 固定、ionViewDidEnter で loadMap()+loadVideo()、ionViewWillLeave で 300ms タイマ解除と mapService.stop()（マーカーは残す）。loadMap は mapService.getSelectMarkerPos() で遷移元が設定した選択位置を復帰し、そのマーカー位置を中心に地図生成、clearCarMarker、mark リスナでマーカータップ選択。loadVideo は autoplay=false/loop=false/muted=true、videoPath があれば src 設定、seekVideo、300ms 周期で currentTime を監視し getMarkerVideoTime(pos)<=currentTime を満たす最後の pos を選択（変化時のみ onPointer）。onBack/onNext は spotPos をリング状に前後移動。onPointer は選択マーカーを hiyar_big.png、他を hiyari.png に切替、setCenter+setZoom(16)、spotTimestamp と spotComment1..4（msg1..msg4）を反映。seekVideo は currentTime=getMarkerVideoTime(spotPos)。承認済みファクト『6-1 ヒヤリシーン表示の複数ファイル対応』により、マーカー選択時（地図タップ / onBack() / onNext()）は動画ファイルが現在の src と異なれば src を差し替えてから seekVideo()、同一ファイルなら seek のみ行う。300ms 周期の currentTime 自動追尾は同一ファイル内のマーカーに限定し、ファイルを跨ぐ自動遷移は行わない。前後ボタンのリング巡回は全マーカーを対象とし、ファイルを跨ぐ場合は src 差し替えを伴う。差し替え後も autoplay=false/loop=false/muted=true を維持する。動画ファイルが存在しない場合の挙動は現行のまま（動画領域は空、地図巡回のみ）変更しない。承認済みファクトによりヒヤリ判定は scoreLogicFunction.txt L843-845 で result.hiyari=true とメッセージのみを設定しスコア値を変更しないため、本画面はスコア値・減点量・レーダーチャートを表示せず、入力編集フォームも持たず、UI 文言でヒヤリを減点として説明してはならない。2026年度改修要求（日産『運転機能チェックアプリの一次仕様』2026-08-04 / メイサンソフト『要求仕様確認』2026-09-17、2026年11月末完了目標、12月実験開始）に関し、1-2 前回結果表示の地図上ヒヤリポイントをタップした時の動作は従来通り（録画動画の再生、発生日時および評価コメントの表示）と確定し、1-2 も遷移元として選択位置とマーカー集合（各マーカーの動画ファイル対応を含む）の設定責務を負う。⑤録画データサイズ改善によりヒヤリ前後（既定15秒）の録画が想定され、連続ヒヤリ（30秒以内）は1本継続録画でも個別生成でもよいが、ヒヤリ時の動画が見られることと個別にヒヤリポイントの動画を確認できることは必須。マーカーごとの動画ファイル保持方式・:path の意味・複数ファイル時の videoTime 基準・録画前後時間の可変化・1-2 の過去ヒヤリ件数上限・縦横回転対応（現行PORTRAIT固定）・msg1..4 の意味・ヒヤリ0件時の空状態は未確定。",
  "fact_candidates": [
    {"type": "display_rule", "title": "ヒヤリポイントタップ時の提供機能は録画動画再生・発生日時・評価コメントの3点", "statement": "地図上のヒヤリポイントをタップした際、本画面は録画動画の再生、発生日時の表示、評価コメントの表示を行い、1-2 前回結果表示からのタップでも同じ動作とする", "status": "approved"},
    {"type": "state_rule", "title": "マーカー選択時に動画ファイルが異なれば src を差し替えてから seek する", "statement": "地図タップ・onBack()・onNext() によるマーカー選択時、選択マーカーの動画ファイルが現在の src と異なれば src を差し替えてから seekVideo() を行い、同一ファイルなら seek のみ行う", "status": "approved"},
    {"type": "state_rule", "title": "自動追尾は同一動画ファイル内に限定される", "statement": "300ms 周期の currentTime 自動追尾は現在の src と同一ファイルのマーカーのみを対象とし、ファイルを跨ぐ自動遷移は行わない", "status": "approved"},
    {"type": "state_rule", "title": "前後ボタンのリング巡回は全マーカーを対象とする", "statement": "onBack()/onNext() のリング巡回は全マーカーを対象とし、ファイルを跨ぐ場合は src 差し替えを伴う", "status": "approved"},
    {"type": "display_rule", "title": "src 差し替え後も非自動再生・ループなし・ミュートを維持する", "statement": "動画 src を差し替えた後も videoElement は autoplay=false、loop=false、muted=true を維持する", "status": "approved"},
    {"type": "display_rule", "title": "動画ファイル不在時の挙動は現行維持", "statement": "動画ファイルが存在しない場合、動画領域は空で地図上のヒヤリ地点巡回のみ可能という現行挙動を変更しない", "status": "approved"},
    {"type": "display_rule", "title": "ヒヤリ地点確認画面はスコア値・減点量・レーダーチャートを表示しない", "statement": "/bad-spot/:path 画面は選択ヒヤリ地点の位置・発生時刻・評価コメント・動画のみを表示し、スコア値や減点量、レーダーチャートを表示しない", "status": "candidate"},
    {"type": "constraint", "title": "遷移元は選択マーカー位置とマーカー集合を事前に設定する", "statement": "本画面は loadMap() で mapService.getSelectMarkerPos() を初期 spotPos として読み取るため、遷移元画面（ui.driving.page / 1-2）が選択位置とマーカー集合を設定していなければならない", "status": "candidate"},
    {"type": "display_rule", "title": "選択中マーカーは大アイコンで強調され地図中心・ズーム16に設定される", "statement": "onPointer() は選択中マーカーを hiyar_big.png、非選択マーカーを hiyari.png にし、地図中心を選択マーカー位置、ズームを 16 に設定する", "status": "candidate"},
    {"type": "display_rule", "title": "選択マーカーの発生時刻と評価コメント4件が表示される", "statement": "画面は spotTimestamp に getMarkerTimestamp(spotPos)、spotComment1..4 に getMarkerComment(spotPos,'msg1'..'msg4') を読み取り専用で表示する", "status": "candidate"},
    {"type": "input_rule", "title": "ヒヤリ地点情報は編集できない", "statement": "利用者は本画面でヒヤリ地点の発生時刻・評価コメント・位置を追加・編集・削除できない", "status": "candidate"},
    {"type": "constraint", "title": "現行の画面向きは縦固定", "statement": "Android では ionViewWillEnter で screenOrientation.lock(PORTRAIT) により本画面を縦向きに固定する（現行実装）", "status": "candidate"},
    {"type": "state_rule", "title": "離脱時に監視タイマとマップは停止するがマーカーは保持する", "statement": "ionViewWillLeave() で 300ms タイマを clearInterval し mapService.stop() を実行するが、マーカーは破棄しない", "status": "candidate"},
    {"type": "business_rule", "title": "ヒヤリ判定はスコア値を変更しない", "statement": "ヒヤリ判定は result.hiyari=true とメッセージのみを設定し、スコア値の加減算を行わない（scoreLogicFunction.txt L843-845）", "status": "approved"},
    {"type": "business_rule", "title": "個別にヒヤリポイントの動画を確認できることが要件", "statement": "連続ヒヤリの録画を1本にまとめるか個別生成するかは実装都合で選べるが、ヒヤリ時の動画が見られること、および個別にヒヤリポイントの動画を確認できることは満たさなければならない", "status": "approved"}
  ],
  "open_questions": [
    "複数ファイル対応でマーカーごとの動画ファイルパスを map.service がどう保持・提供するか、およびルートパラメータ :path が何を指すか（初期選択マーカーの動画か）が未確定。src 差し替え判定の入力となるため Middleware の判断が必要で、決まらないと実装契約を確定できない。",
    "複数ファイル時に getMarkerVideoTime() が各ファイル内オフセットを返すかが未確定。seekVideo の位置と同一ファイル内自動追尾の走査基準に直結するため Middleware の確認が必要。",
    "1-2 前回結果表示に描画する過去ヒヤリの件数上限が未確定。件数制限が入ると本画面のリング巡回範囲が遷移元のマーカー集合に限定されるため、UI(1-2)と Middleware/DB の判断が必要。",
    "録画の前後時間（既定15秒）を設定で可変にするかが未確定。動画尺とシーク基準に影響し、Middleware/Infra の判断が必要。",
    "本画面を縦横回転対応にするかが未確定。先方要求は縦横変更可だが現行は PORTRAIT 固定で、横向き時の地図・動画・評価コメントのレイアウトも未定義。UI 全体方針として確定が必要。",
    "評価コメント msg1..msg4 の各枠の意味・表示順・未設定時の扱いが UI から断定できない。Middleware（score-logicCan / map.service）の確認が必要で、決まらないとコメント欄の空表示ルールを規定できない。",
    "ヒヤリ地点が0件の診断結果で本画面へ遷移し得るか、その場合の空状態表示（前後ボタン無効化・メッセージ）が未定義。遷移元と Middleware の判断が必要。",
    "画面内の見出し・ラベル文言（label1..4 を含む）でヒヤリを減点・失点として説明している箇所があるかが資料から確認できない。承認済みファクトと矛盾する文言があれば修正対象となるため実 HTML と設定 label の確認が必要。"
  ],
  "rationale_notes": [
    "承認済みファクト『6-1 ヒヤリシーン表示の複数ファイル対応』により、既存 spec で未確定としていた個別動画時の再生方式（src 差し替え・自動追尾の扱い・前後ボタンの挙動・再生状態）が確定したため、facts を真として該当記述を改訂し専用節を設けた。",
    "自動追尾を同一ファイル内に限定しファイル跨ぎの自動遷移を行わない方針は、利用者の意図しない動画切替を避け、差し替えを明示的な選択操作のみに限定する意図と解釈される。",
    "マーカー選択時は onPointer() による地図・コメント更新の後に動画切替を行う順序で記述したが、順序自体は既存実装（onPointer + seekVideo）の踏襲である。",
    "マーカーごとの動画ファイル保持方式や videoTime 基準は UI から断定できないため、再生規則のみを確定とし、データ契約は open_questions に残した。",
    "レーダーチャートやスコア表示は結果表示/アドバイス画面の責務であり、本画面では扱わないことを維持した。",
    "既存 spec 末尾に埋め込まれていた JSON ブロックは仕様書本文ではないため本文から除去した。"
  ]
}
```
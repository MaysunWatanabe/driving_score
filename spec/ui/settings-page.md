<!-- 作成: 2026-09-10 17:30:00 JST | 更新: 2026-09-25 11:06:56 JST -->

# ui.settings.page — 設定画面 (画面3-1)

## 概要
設定画面では、アプリの各種設定を切り替えます。対象は、録画、ヒヤリ前後秒数、GPSデモ、ログ保存、センサログ保存、センサーモードです。

このほか、次の操作を提供します。
- scoreLogic 本体 (JS) と scoreLogicJson (メッセージ辞書) をファイルから読み込み、検証してから Storage へ更新する。
- 上記を端末ストレージへ書き出す。
- scoreLogic を直接編集する場合は `/edit` へ遷移する。

## 真実源
- `src/data/src/app/settings/settings.page.ts`
- `src/data/src/app/settings/settings.page.html`

## ルーティング
- パス: `/settings`

## 状態
```
settingRecording / settingGpsDemo / settingLogStorage / settingSensorLogStorage: 'enable' | 'disable'
settingRecordingMargin: number   // 「ヒヤリ前後秒数」入力欄の表示値（整数秒）
settingSelectedSensorMode: 'smartphoneOnly' | 'canDataOnly' | 'combination'
hasAndroid: boolean
```

## ライフサイクル
- **constructor**: `logService.initialize(file)` と `init()` を実行する。
- **`ngOnInit()`**: 隠し `<input type="file">` (`#score_json_update` / `#score_logic_update`) に `change` リスナを登録する。
- **`ionViewWillEnter()`**: Android のみ `screenOrientation.lock(PORTRAIT)` を実行する。
- **`init()`**: `storage.create()` の後、`loginService.settings.*` を 'enable'/'disable' 文字列にマップする。
  - `settingRecordingMargin` には、Storage `settingRecordingMargin` の保存値を表示値として設定する。
  - 未設定の場合は `?? 15` により既定値 15 を表示する。

## 画面レイアウト（設定項目の表示順）
設定項目は既存どおり `<div class="button_area">` 内に並べます。表示順は次のとおりです。

1. 利用するセンサー情報
2. 録画機能
3. **ヒヤリ前後秒数（秒）**（新設）
4. アプリログを端末に保存
5. 以降は現行どおり

### ヒヤリ前後秒数（秒）
- **配置**:「録画機能」の `<ion-item>` の直後に、独立した `<ion-item>` を新設します。既存項目と同じく、ラベルは `<div class="button_area">` 内の先頭行に置きます。
- **ラベル文言**:「ヒヤリ前後秒数（秒）」
  - 単位はラベル側に付けます。入力欄には単位を表示しません。
- **入力部品**: `ion-input` に次の属性を付けます。
  - `type="number"` / `min="5"` / `max="60"` / `step="1"` / `inputmode="numeric"`
  - これらの属性は入力補助にとどまり、**検証の正はアプリ側**とします。
- **無効化条件**: `[disabled]="!hasAndroid || settingRecording=='disable'"`
  - 非 Android の場合、または録画機能が `disable` の場合に無効化します。
  - 無効化中も保存済みの値を表示し続けます。15 へ戻すことはしません。
  - 録画機能を `enable` に戻したときも、保存済みの値を表示します。

## 設定変更ハンドラ
| ハンドラ | 効果 |
|---|---|
| `onSettingRecording(e)` | `settings.recording = (e.detail.value=='enable')` を設定し、Storage `settingRecording` を更新する |
| `onSettingRecordingMargin(e)`（`ionBlur`） | 下記「ヒヤリ前後秒数の検証と保存」に従って検証する。有効値のときだけ `settings.recordingMargin` と Storage `settingRecordingMargin` を更新する |
| `onSettingGpsDemo(e)` | `onSettingRecording` と同様（対象は `settingGpsDemo`） |
| `onSettingLogStorage(e)` | 同様に更新したうえで `logService.initialize(file)` を再実行する（バッファをクリアするため） |
| `onSettingSensorLogStorage(e)` | 同様に更新したうえで `logService.initialize(file)` を再実行する |
| `onSettingSelectedSensorMode(e)` | `settings.selectedSensorMode = e.detail.value` を設定し、Storage `settingSelectedSensorMode` を更新する |

### ヒヤリ前後秒数の検証と保存
- **Storage キー**: `settingRecordingMargin`
- **値の型・範囲**: 整数秒、既定 15、閉区間 [5,60]
- **検証のタイミング**: 検証・復帰・保存は `ionBlur` で行います。
  - `ionChange` で 1 文字ごとに検証すると、30 を入力する途中の「3」が範囲外として即座に戻されてしまいます。そのため `ionChange` では検証しません。
- **有効値**: 入力値が次の 2 条件を満たす場合、Storage へ保存し、表示値もその値とします。
  - `Number.isInteger` で整数と判定される
  - 5 以上 60 以下である
- **無効値**: 次のいずれかに該当する値は保存しません。
  - 小数（切り捨てもしない）
  - 非数値
  - 空欄
  - 閉区間 [5,60] の外
- **無効値の場合の復帰**: 入力欄の表示を**直前の保存値**（現在 Storage に保存されている値）へ戻します。未設定の場合は既定値 15 に戻します。
- **エラー通知**: エラーダイアログ・トーストは表示しません。表示値が戻ることだけで扱います。

### 適用タイミング（他画面との整合）
- `ui.driving.page` は `onStart()` で `loginService.settings.recordingMargin` を **1 回だけ** 読み、走行中はその値を固定します。
- 診断中に本画面で値を変更しても、当該走行には反映しません。次回の診断開始時から反映します。

### センサーモードの選択肢
| 値 | 表示上の意味 |
|---|---|
| `smartphoneOnly` | スマートフォン内蔵センサーのみを使用 |
| `canDataOnly` | CAN データ（BLE 受信）のみを使用 |
| `combination` | 両方を併用 |

- 選択値は即時に Storage `settingSelectedSensorMode` へ永続化され、次回起動時も保持されます。
- 設定画面が担うのは、モードの選択と永続化だけです。モード値をどのセンサー入力・スコアロジックに結び付けるかは [[middleware.sensor.service]] / [[middleware.score.logic]] 側の責務であり、本画面では表現しません。

## ScoreJson 操作 `onScoreJsonFile(event)`
- `event === 'update'`: `<input type='file' id='score_json_update'>` を click し、ファイル選択ダイアログを開く。
- `event === 'save'`: Storage の scoreLogicJson を取得し、次のように書き出す。
  - Android: `Documents/driving-score/` を確保して `scoreLogicJson.<日時>.txt` を書き出す。
  - ブラウザ: `<a id="save">` に Blob URL を設定して download させる。
  - 完了後、ダイアログ `showSaveFile(dialogMessage)` を表示する。

## ScoreLogic 操作 `onScoreLogicFile(event)`
- `'update'`: ファイル選択ダイアログを開く。
- `'save'`: Storage の scoreLogicKey を、Android では `scoreLogic.<日時>.txt` に書き出し、ブラウザでは download させる。
- `'edit'`: `navCtrl.navigateForward('/edit')` で編集画面へ遷移する。

## 書き出し先ディレクトリ（承認済み決定）
- Android での書き出しルートは `{externalRootDirectory}/Documents/driving-score/` です。
  - 設定画面からの書き出しでは、同ディレクトリ直下に `scoreLogicJson.<日時>.txt` / `scoreLogic.<日時>.txt` を生成します。
  - ログ系（`debug-log` / `data.YYYYMMDD-HHMMSS`）は同一ルート配下の別サブディレクトリであり、設定画面は関与しません。
- `{externalDataDirectory}/driving-score/...` への移設が一度検討されましたが撤回され、`Documents` 配下へ戻す決定が承認済みです。
  - この決定に伴う `settings.page.ts` の変更は行いません（本画面の書き出しコードは現状維持）。
- 書き出したファイルは、ファイルアプリ、または `adb pull /sdcard/Documents/driving-score/...` で取り出すことを正とします。
- ディレクトリ確保処理（`checkDir` → `createDir`）の呼び出し修正は [[infra.file.storage]] 側で保持されます。

## ファイルアップロード時の処理
### `openScoreJsonFile(evt)`
1. 選択ファイルから `URL.createObjectURL(file)` で URL を作り、**XMLHttpRequest 同期モード** で GET する。
2. `JSON.parse` に成功し、かつ `settings` と `messages` が存在するときだけ、Storage `scoreLogicJsonKey` に保存する。
3. `loginService.initialize()` を再実行し、Settings オブジェクトに反映する。
4. 成功時は `showUpdateJsonFile()`、失敗時は `showUpdateFailedJsonFile(error)` を表示する。

### `openScoreLogicFile(evt)`
1. 選択ファイルを同期 GET し、文字列として取得する。
2. `storage.get(scoreLogicJsonKey)` を取得し、`ScoreLogic.testScoreLogic(logService, scoreLoginJsonText, scoreLogic)` を実行する。
3. 結果が `true` のとき:
   - 先頭行が `//<数字>` 形式なら `Date.now()` で置換する。そうでなければ `//<UnixTime>\n` を先頭に追加する。
   - `storage.set(scoreLogicKey, scoreLogic)` で保存する。
   - `showUpdateScoreLogic()` を表示する。
4. 例外時は `showUpdateFailedScoreLogic(stackText)` を表示する。

## ダイアログ
| ダイアログ | ヘッダ |
|---|---|
| `showUpdateScoreLogic` | 「運転診断スコアロジックを更新しました。」 |
| `showUpdateFailedScoreLogic(errorMsg)` | 「運転診断スコアロジックがエラーになるため更新できません。」／message=stack |
| `showUpdateJsonFile` | 「JSONファイルを更新しました。」 |
| `showUpdateFailedJsonFile(errorMsg)` | 「不正なJSONファイルです。」／message=errorMsg |
| `showSaveFile(message)` | 「ファイルを保存しました。」／message=保存パス |

※「ヒヤリ前後秒数」の不正入力に対しては、ダイアログを表示しません。

## 業務ルール
- 設定は即座に Storage に反映されます（アプリ再起動を待ちません）。
  - ただし「ヒヤリ前後秒数」は `ionBlur` 時点で検証し、有効値の場合だけ反映します。入力途中の値は反映しません。
- `logStorage` / `sensorLogStorage` を切り替えると `logService.initialize()` が再実行され、バッファがクリアされます（未書き出しのログは失われます）。
- ScoreLogic を更新する際は、必ず `testScoreLogic` で構文エラー・実行時エラーを事前チェックします。失敗時は Storage に反映しません。
- ScoreLogic 保存時には、先頭に `//<UnixTime>` を差し込みます。これにより、次回起動時に [[ui.opening.page]] の `saveDefaultScoreLogic()` が assets の古いロジックへ巻き戻すことを防ぎます。
- 次の事項は本画面の対象外です（`showSaveFile` は成功時のみ表示します）。
  - 書き出し失敗時のユーザー向けエラー提示
  - 書き出しファイルの保持期間
  - MediaStore/SAF 経由の共有

## UI 上に存在しないもの（意図的な非提供）
- 設定画面に**デバッグ用のシードデータ投入 UI は追加しません**（承認済み決定）。本画面ではテストデータの投入手段を提供しません。
- BLE 受信時のデバッグログは、[[middleware.sensor.service]] 側で**常時有効**です。設定画面の `settingLogStorage` / `settingSensorLogStorage` による切替対象ではないため、本画面には BLE デバッグログの ON/OFF スイッチを設けません。
- センサーモードごとにスコアロジックを切り替える UI はありません（モード値の保存のみ）。
- 「ヒヤリ前後秒数」の不正入力に対するエラーダイアログ・トーストは表示しません。

## 関連ノード
- 依存: [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.sensor.service]] / [[infra.file.storage]]
- 値の利用先: [[ui.driving.page]]（`recordingMargin` を `onStart()` で 1 回読み込み）
- 遷移先: [[ui.edit.page]]

```json
{
  "required_changes": [
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "録画機能の直後に「ヒヤリ前後秒数（秒）」ion-item を新設し、表示順（センサー情報→録画機能→ヒヤリ前後秒数→アプリログ保存→以降現行）を追記"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "状態に settingRecordingMargin を追加し、init() で Storage 保存値（未設定時 ?? 15）を表示値とする旨を追記"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "ionBlur での検証・復帰・保存（整数・閉区間[5,60]、無効値は保存せず直前の保存値／未設定時15へ戻す、ダイアログ・トーストなし）を追記"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "無効化条件 !hasAndroid || settingRecording=='disable' と無効化中も保存値を表示する規則を追記"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "ui.driving.page が onStart() で recordingMargin を1回だけ読み走行中は固定する適用タイミングを追記し、業務ルールの即時反映記述に ionBlur 例外を追加"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "loginService.settings.recordingMargin を Storage settingRecordingMargin から読み込み未設定時は既定15とする処理が middleware.login.service 側に必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "ui.driving.page の onStart() で recordingMargin を1回だけ読み走行中は固定する仕様を driving page 側仕様書に反映する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "ヒヤリ前後秒数を録画切り出し範囲へ適用する処理および30秒以内連続ヒヤリ時の動画生成方式との関係を録画系仕様で整合させる必要がある"},
    {"domain": "QA-agent", "severity": "should", "reason": "境界値（4/5/60/61）・小数・空欄・非数値・入力途中値・無効化中表示・走行中変更非反映の検証観点追加が必要"}
  ],
  "requirements_context": "UC10（スコアロジック／辞書の更新）、UC11（センサーモード切替）、およびヒヤリ前後秒数設定を担う設定画面 /settings の仕様。(1) scoreLogic.txt / scoreLogic.json は、端末のファイル選択（隠し input[type=file]）から読み込む。scoreLogicJson は、JSON.parse に成功し、かつ settings / messages キーが存在する場合のみ Storage scoreLogicJsonKey へ保存し、loginService.initialize() を再実行する。scoreLogic は、Storage の scoreLogicJson を用いた ScoreLogic.testScoreLogic 検証が true の場合のみ、先頭行に //<UnixTime> を付与または更新して scoreLogicKey へ保存する。失敗時は Storage を更新せず、エラーダイアログ（JSON は errorMsg、Logic は stack）を表示する。(2) 現在内容の書き出しは、Android では {externalRootDirectory}/Documents/driving-score/ 直下に scoreLogicJson.<日時>.txt / scoreLogic.<日時>.txt を生成し、ブラウザでは Blob URL による download とする。成功時のみ showSaveFile で保存パスを提示する。externalDataDirectory への移設案は撤回され、Documents 配下へ戻す決定が承認済みであり、settings.page.ts 自体は変更しない。採取手段はファイルアプリまたは adb pull /sdcard/Documents/driving-score/... とする。(3) センサーモードは smartphoneOnly / canDataOnly / combination の3値で、選択時に即 Storage settingSelectedSensorMode へ永続化する。設定画面は値の保存のみを担い、モード値とセンサー入力・スコアロジックの結線は middleware 側の責務とする。(4) 録画 / GPSデモ / ログ保存 / センサログ保存の各フラグは enable/disable で即時に Storage へ反映する。ログ保存系の切替は logService.initialize(file) を再実行するため、未書き出しバッファが失われる。(5) scoreLogic の直接編集は /edit へ遷移する。(6) 設定画面にデバッグ用シードデータ投入 UI は追加しない。BLE 受信時のデバッグログは sensor.service 側で常時有効であり、本画面のログ保存フラグによる切替対象ではないため、対応スイッチを設けない。(7) 書き出し失敗のユーザー提示、保持期間、MediaStore/SAF 共有は対象外とする。(8) ヒヤリ前後秒数: 「録画機能」ion-item の直後に独立した ion-item を新設し、ラベル「ヒヤリ前後秒数（秒）」を button_area 内の先頭行に置く。単位はラベル側に付け、入力欄には出さない。表示順は、利用するセンサー情報→録画機能→ヒヤリ前後秒数→アプリログを端末に保存→以降現行どおりとする。Storage キーは settingRecordingMargin で、整数秒・既定15・閉区間[5,60]とする。ion-input には type=number min=5 max=60 step=1 inputmode=numeric を付けるが、検証の正はアプリ側とする。検証・復帰・保存は ionBlur で行い、ionChange では検証しない（30 入力途中の 3 が戻される問題を避けるため）。小数（Number.isInteger で判定し、切り捨てない）・非数値・空欄・範囲外は保存せず、入力欄の表示を直前の保存値（現在 Storage の値、未設定時は ?? 15 で 15）へ戻す。エラーダイアログ・トーストは出さない。[disabled]=\"!hasAndroid || settingRecording=='disable'\" とし、無効化中も保存済みの値を表示し、15 に戻さない。ui.driving.page の onStart() で loginService.settings.recordingMargin を1回だけ読み、走行中はその値を固定するため、診断中に設定を変えても当該走行には反映しない。",
  "fact_candidates": [
    {"type": "display_rule", "title": "ヒヤリ前後秒数は録画機能の直後に表示される", "statement": "設定画面3-1では「録画機能」ion-item の直後に独立した ion-item として「ヒヤリ前後秒数（秒）」を表示し、表示順は利用するセンサー情報→録画機能→ヒヤリ前後秒数→アプリログを端末に保存→以降現行どおりとする", "status": "approved"},
    {"type": "display_rule", "title": "ヒヤリ前後秒数の単位はラベル側に表示する", "statement": "ラベル文言は「ヒヤリ前後秒数（秒）」とし、入力欄には単位を表示しない", "status": "approved"},
    {"type": "display_rule", "title": "ヒヤリ前後秒数の初期表示は保存値または15", "statement": "設定画面表示時、ヒヤリ前後秒数入力欄には Storage settingRecordingMargin の保存値を表示し、未設定の場合は15を表示する", "status": "approved"},
    {"type": "input_rule", "title": "ヒヤリ前後秒数の無効化条件", "statement": "ヒヤリ前後秒数入力欄は非Android環境または録画機能が disable の場合に無効化される", "status": "approved"},
    {"type": "display_rule", "title": "無効化中も保存値を表示する", "statement": "ヒヤリ前後秒数入力欄が無効化されている間も保存済みの値を表示し、15に戻さない", "status": "approved"},
    {"type": "validation_rule", "title": "ヒヤリ前後秒数は ionBlur で検証する", "statement": "ヒヤリ前後秒数の検証・復帰・保存はフォーカス喪失時（ionBlur）に行い、1文字入力ごとには検証しない", "status": "approved"},
    {"type": "validation_rule", "title": "ヒヤリ前後秒数は5〜60の整数のみ保存される", "statement": "ヒヤリ前後秒数は整数かつ閉区間[5,60]の値のみ Storage settingRecordingMargin に保存され、小数・非数値・空欄・範囲外は保存されない", "status": "approved"},
    {"type": "validation_rule", "title": "小数は切り捨てずに無効扱いとする", "statement": "ヒヤリ前後秒数に小数が入力された場合は切り捨てて保存せず、無効値として扱う", "status": "approved"},
    {"type": "state_rule", "title": "無効値入力時は表示を直前の保存値へ戻す", "statement": "ヒヤリ前後秒数に無効値が入力された場合、入力欄の表示を直前の保存値（未設定時は15）へ戻す", "status": "approved"},
    {"type": "display_rule", "title": "ヒヤリ前後秒数の不正入力にエラー表示を出さない", "statement": "ヒヤリ前後秒数の不正入力時にエラーダイアログやトーストは表示しない", "status": "approved"},
    {"type": "constraint", "title": "ion-input の属性は補助であり検証の正はアプリ側", "statement": "ヒヤリ前後秒数の ion-input には type=number min=5 max=60 step=1 inputmode=numeric を付与するが、値の妥当性はアプリ側の検証で判定する", "status": "approved"},
    {"type": "state_rule", "title": "走行中の設定変更は当該走行に反映されない", "statement": "ui.driving.page は onStart() で recordingMargin を1回だけ読むため、診断中に設定画面でヒヤリ前後秒数を変更しても当該走行には反映されない", "status": "approved"},
    {"type": "display_rule", "title": "設定画面はセンサーモードを3値の選択肢として表示する", "statement": "/settings 画面はセンサーモードとして smartphoneOnly / canDataOnly / combination の3つの選択肢を表示する", "status": "candidate"},
    {"type": "input_rule", "title": "センサーモードは選択と同時に永続化される", "statement": "利用者がセンサーモードを選択すると、確定操作を待たずに Storage settingSelectedSensorMode が更新される", "status": "candidate"},
    {"type": "input_rule", "title": "録画/GPSデモ/ログ保存/センサログ保存は enable|disable で切替できる", "statement": "設定画面は録画・GPSデモ・ログ保存・センサログ保存の4フラグを enable / disable で切替可能とし、切替時に即時 Storage へ反映する", "status": "candidate"},
    {"type": "state_rule", "title": "ログ保存フラグ切替はログバッファをクリアする", "statement": "settingLogStorage または settingSensorLogStorage を切り替えると logService.initialize(file) が再実行され、未書き出しログバッファは失われる", "status": "candidate"},
    {"type": "validation_rule", "title": "scoreLogicJson は JSON パースと必須キー検証を通過した場合のみ保存される", "statement": "選択された JSON が JSON.parse に成功し settings と messages を持つ場合のみ Storage scoreLogicJsonKey に保存され、そうでない場合は保存せず「不正なJSONファイルです。」ダイアログを表示する", "status": "candidate"},
    {"type": "validation_rule", "title": "scoreLogic は testScoreLogic 成功時のみ保存される", "statement": "選択された scoreLogic.txt は ScoreLogic.testScoreLogic が true を返した場合のみ Storage scoreLogicKey に保存され、例外時は保存せず stack をメッセージとするエラーダイアログを表示する", "status": "candidate"},
    {"type": "business_rule", "title": "scoreLogic 保存時に先頭へ版ヘッダを付与する", "statement": "scoreLogic 保存時、先頭行が //<数字> 形式であれば Date.now() で置換し、そうでなければ //<UnixTime> 行を先頭に追加する", "status": "candidate"},
    {"type": "display_rule", "title": "書き出し成功時に保存パスを提示する", "statement": "ファイル書き出しが成功した場合、showSaveFile ダイアログのメッセージとして保存パスを表示する", "status": "candidate"},
    {"type": "constraint", "title": "Android の書き出しルートは Documents/driving-score である", "statement": "Android では設定画面からの書き出し先を {externalRootDirectory}/Documents/driving-score/ とし、scoreLogicJson.<日時>.txt / scoreLogic.<日時>.txt を同ディレクトリ直下に生成する", "status": "approved"},
    {"type": "design_decision", "title": "設定画面にシード投入 UI を追加しない", "statement": "設定画面にデバッグ用シードデータ投入 UI は追加しない", "status": "approved"},
    {"type": "display_rule", "title": "BLE デバッグログの ON/OFF スイッチは設定画面に存在しない", "statement": "BLE 受信時のデバッグログは sensor.service 側で常時有効であり、設定画面のログ保存フラグによる切替対象ではないため対応する UI 要素を持たない", "status": "candidate"},
    {"type": "state_rule", "title": "設定画面は Android でポートレート固定される", "statement": "ionViewWillEnter 時、Android では画面向きを PORTRAIT にロックする", "status": "candidate"},
    {"type": "business_rule", "title": "scoreLogic の直接編集は編集画面へ遷移する", "statement": "scoreLogic 操作の edit を選択すると /edit へ前方遷移する", "status": "candidate"}
  ],
  "open_questions": [
    "ヒヤリ前後秒数の入力中にフォーカスを外さず戻る（ハードウェアバック等）で画面離脱した場合に ionBlur が発火し検証・保存されるかが未確定。Ionic の挙動確認が UI/QA で必要。決まらないと、入力したつもりの値が保存されないケースが生じうる。",
    "ヒヤリ前後秒数と、30秒以内の連続ヒヤリ時の動画生成方式（1本録画／個別生成）との関係が未確定。例えば前後60秒時の重なりの扱いについて Middleware 判断が必要であり、決まらないと録画データサイズ改善要求⑤の評価に影響する。",
    "loginService.settings.recordingMargin が Storage 未設定時に既定15となる責務が middleware.login.service 側で実装されるかが未確定。Middleware 確認が必要であり、決まらないと driving page が undefined を読む恐れがある。",
    "画面の縦横変更要求（先方要求）と現行の設定画面 PORTRAIT 固定が衝突する。設定画面を回転対応にするか未確定であり、PO／先方確認が必要。決まらないと本画面の横向きレイアウト定義が必要か判断できない。",
    "選択された selectedSensorMode がスコアロジック切替に実際に反映されないことを、設定画面の説明文や注意表示として利用者へ示す必要があるか。PO/Middleware 判断が必要。",
    "ファイル選択が同期 XMLHttpRequest で行われるため、大きなファイルで UI がフリーズする可能性がある。ローディング表示等の UX 対応を行うかは未確定（Middleware/Infra と要確認）。"
  ],
  "rationale_notes": [
    "ヒヤリ前後秒数の検証を ionBlur に置いたのは、ionChange で逐次検証すると 30 を入力する途中の 3 が範囲外として即座に戻され、2桁値が入力できなくなるためである。",
    "不正入力時にダイアログを出さず表示を戻すだけにしたのは、設定画面の操作を軽く保ち、既存の設定トグル群と同様の即時・無言反映の操作感に合わせるためである。",
    "当初の設計判断では不正入力時の戻し先が『別途確定が必要』とされていたが、後続の承認済み決定で『直前の保存値（未設定時15）』に確定したため、仕様書は確定後の内容で記述した。",
    "無効化中も保存値を表示し15に戻さないのは、録画を一時的に disable にしても利用者が設定した秒数を失わないようにするためである。",
    "走行開始時に1回だけ読み固定する設計により、診断中の設定変更が録画区間に途中から混入することを避け、1走行内の録画条件を一貫させている。",
    "既存の書き出し先・非提供UI・センサーモード責務境界の記述は、今回の facts と矛盾しないため維持した。"
  ]
}
```
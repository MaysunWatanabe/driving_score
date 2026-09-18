<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:30:00 JST -->

# ui.settings.page — 設定画面 (画面3-1)

## 概要
アプリの各種設定 (録画/GPSデモ/ログ保存/センサログ保存/センサーモード) を切替、scoreLogic 本体 (JS) と scoreLogicJson (メッセージ辞書) をファイルから読み込み検証後に Storage へ更新、または端末ストレージへ書き出す。scoreLogic の直接編集は `/edit` へ遷移する。

## 真実源
- `src/data/src/app/settings/settings.page.ts`
- `src/data/src/app/settings/settings.page.html`

## ルーティング
- パス: `/settings`

## 状態
```
settingRecording / settingGpsDemo / settingLogStorage / settingSensorLogStorage: 'enable' | 'disable'
settingSelectedSensorMode: 'smartphoneOnly' | 'canDataOnly' | 'combination'
hasAndroid: boolean
```

## ライフサイクル
- **constructor**: `logService.initialize(file)` + `init()`。
- **`ngOnInit()`**: 隠し `<input type="file">` (`#score_json_update` / `#score_logic_update`) に `change` リスナを登録。
- **`ionViewWillEnter()`**: Android のみ `screenOrientation.lock(PORTRAIT)`。
- **`init()`**: `storage.create()` の後、`loginService.settings.*` を 'enable'/'disable' 文字列にマップ。

## 設定変更ハンドラ
| ハンドラ | 効果 |
|---|---|
| `onSettingRecording(e)` | `settings.recording = (e.detail.value=='enable')` → Storage `settingRecording` を更新 |
| `onSettingGpsDemo(e)` | 同上（`settingGpsDemo`） |
| `onSettingLogStorage(e)` | 同上 → `logService.initialize(file)` を再実行（バッファをクリアするため） |
| `onSettingSensorLogStorage(e)` | 同上 → `logService.initialize(file)` |
| `onSettingSelectedSensorMode(e)` | `settings.selectedSensorMode = e.detail.value` → Storage `settingSelectedSensorMode` を更新 |

### センサーモードの選択肢
| 値 | 表示上の意味 |
|---|---|
| `smartphoneOnly` | スマートフォン内蔵センサーのみを使用 |
| `canDataOnly` | CAN データ（BLE 受信）のみを使用 |
| `combination` | 両方を併用 |

- 選択値は即時に Storage `settingSelectedSensorMode` へ永続化され、次回起動時も保持される。
- 設定画面はモードの選択と永続化のみを担う。モード値をどのセンサー入力・スコアロジックに結び付けるかは [[middleware.sensor.service]] / [[middleware.score.logic]] 側の責務であり、本画面では表現しない。

## ScoreJson 操作 `onScoreJsonFile(event)`
- `event === 'update'`: `<input type='file' id='score_json_update'>` を click（ファイル選択ダイアログ）。
- `event === 'save'`: Storage の scoreLogicJson を取得し、
  - Android: `Documents/driving-score/` を確保して `scoreLogicJson.<日時>.txt` を書き出す。
  - ブラウザ: `<a id="save">` に Blob URL を設定して download。
  - 完了ダイアログ `showSaveFile(dialogMessage)` を表示。

## ScoreLogic 操作 `onScoreLogicFile(event)`
- `'update'`: ファイル選択ダイアログ。
- `'save'`: Storage の scoreLogicKey を Android なら `scoreLogic.<日時>.txt` に、ブラウザなら download。
- `'edit'`: `navCtrl.navigateForward('/edit')`。

## 書き出し先ディレクトリ（承認済み決定）
- Android での書き出しルートは `{externalRootDirectory}/Documents/driving-score/` である。
  - 設定画面からの書き出しは同ディレクトリ直下に `scoreLogicJson.<日時>.txt` / `scoreLogic.<日時>.txt` を生成する。
  - ログ系（`debug-log` / `data.YYYYMMDD-HHMMSS`）は同一ルート配下の別サブディレクトリであり、設定画面は関与しない。
- 一度検討された `{externalDataDirectory}/driving-score/...` への移設は撤回され、`Documents` 配下へ戻す決定が承認済みである。この決定に伴う `settings.page.ts` の変更は行わない（本画面の書き出しコードは現状維持）。
- 取り出し手順はファイルアプリ、または `adb pull /sdcard/Documents/driving-score/...` を正とする。
- ディレクトリ確保処理（`checkDir` → `createDir`）の呼び出し修正は [[infra.file.storage]] 側で保持される。

## ファイルアップロード時の処理
### `openScoreJsonFile(evt)`
1. 選択ファイル → `URL.createObjectURL(file)` → **XMLHttpRequest 同期モード** で GET。
2. `JSON.parse` に成功し `settings` と `messages` が存在するときのみ Storage `scoreLogicJsonKey` に保存。
3. `loginService.initialize()` を再実行（Settings オブジェクトに反映）。
4. `showUpdateJsonFile()`（成功）または `showUpdateFailedJsonFile(error)`（失敗）。

### `openScoreLogicFile(evt)`
1. ファイル → 同期 GET → 文字列取得。
2. `storage.get(scoreLogicJsonKey)` を取得し、`ScoreLogic.testScoreLogic(logService, scoreLoginJsonText, scoreLogic)` を実行。
3. `true` のとき:
   - 先頭行が `//<数字>` 形式なら `Date.now()` で置換、そうでなければ `//<UnixTime>\n` を先頭に追加。
   - `storage.set(scoreLogicKey, scoreLogic)` で保存。
   - `showUpdateScoreLogic()`。
4. 例外時: `showUpdateFailedScoreLogic(stackText)`。

## ダイアログ
| ダイアログ | ヘッダ |
|---|---|
| `showUpdateScoreLogic` | 「運転診断スコアロジックを更新しました。」 |
| `showUpdateFailedScoreLogic(errorMsg)` | 「運転診断スコアロジックがエラーになるため更新できません。」／message=stack |
| `showUpdateJsonFile` | 「JSONファイルを更新しました。」 |
| `showUpdateFailedJsonFile(errorMsg)` | 「不正なJSONファイルです。」／message=errorMsg |
| `showSaveFile(message)` | 「ファイルを保存しました。」／message=保存パス |

## 業務ルール
- 設定はすべて即座に Storage に反映される（アプリ再起動を待たない）。
- `logStorage` / `sensorLogStorage` の切替は `logService.initialize()` を再実行するので、バッファがクリアされる（未書き出しログは失われる）。
- ScoreLogic の更新は必ず `testScoreLogic` で構文/実行時エラーを事前チェックし、失敗時は Storage に反映しない。
- ScoreLogic 保存時は先頭に `//<UnixTime>` を差し込むことで、次回起動時の [[ui.opening.page]] `saveDefaultScoreLogic()` が assets の古いロジックへ巻き戻すのを防止する。
- 書き出し失敗時のユーザー向けエラー提示、書き出しファイルの保持期間、MediaStore/SAF 経由の共有は本画面の対象外である（`showSaveFile` は成功時のみ表示）。

## UI 上に存在しないもの（意図的な非提供）
- 設定画面に**デバッグ用のシードデータ投入 UI は追加しない**（承認済み決定）。テストデータ投入手段は本画面では提供しない。
- BLE 受信時のデバッグログは [[middleware.sensor.service]] 側で**常時有効**であり、設定画面の `settingLogStorage` / `settingSensorLogStorage` による切替対象ではない。したがって本画面には BLE デバッグログの ON/OFF スイッチを設けない。
- センサーモードごとのスコアロジック切替を選択する UI は存在しない（モード値の保存のみ）。

## 関連ノード
- 依存: [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.sensor.service]] / [[infra.file.storage]]
- 遷移先: [[ui.edit.page]]

```json
{
  "required_changes": [
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "書き出しルートを {externalRootDirectory}/Documents/driving-score/ と明記し、settings.page.ts は変更しない承認済み決定を記載"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "設定画面にシード投入 UI を追加しないことを『意図的な非提供』として明記"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "BLE 受信デバッグログは sensor.service 側で常時有効であり本画面の切替対象外である旨を明記"},
    {"node": "ui.settings.page", "entrypoint": "spec/ui/settings-page.md", "description": "センサーモード3値の選択肢表と、保存のみを担いロジック結線は担わない責務境界を追記"}
  ],
  "suggested_impacts": [
    {"domain": "Infra-agent", "severity": "must", "reason": "書き出しルートを Documents 配下へ戻す決定と checkDir→createDir 修正の保持は infra.file.storage 側の仕様に反映が必要"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "BLE デバッグログ常時有効および selectedSensorMode の利用実態（切替未配線）は sensor.service / score-logic 側の記述と整合させる必要がある"},
    {"domain": "QA-agent", "severity": "should", "reason": "書き出しファイルの採取手順がファイルアプリ／adb pull /sdcard/Documents/driving-score/... を正とするため検証手順の更新が必要"}
  ],
  "requirements_context": "UC10（スコアロジック/辞書の更新）とUC11（センサーモード切替）を担う設定画面 /settings の仕様。(1) scoreLogic.txt / scoreLogic.json を端末ファイル選択（隠し input[type=file]）から読み込み、scoreLogicJson は JSON.parse 成功かつ settings/messages キー存在時のみ Storage scoreLogicJsonKey へ保存し loginService.initialize() を再実行、scoreLogic は Storage の scoreLogicJson を用いた ScoreLogic.testScoreLogic 検証が true の場合のみ先頭行に //<UnixTime> を付与/更新して scoreLogicKey へ保存する。失敗時は Storage を更新せずエラーダイアログ（JSON は errorMsg、Logic は stack）を表示する。(2) 現在内容の書き出しは Android では {externalRootDirectory}/Documents/driving-score/ 直下に scoreLogicJson.<日時>.txt / scoreLogic.<日時>.txt を生成、ブラウザでは Blob URL による download とし、成功時のみ showSaveFile で保存パスを提示する。externalDataDirectory への移設案は撤回され Documents 配下へ戻す決定が承認済みで、settings.page.ts 自体は変更しない。採取手段はファイルアプリまたは adb pull /sdcard/Documents/driving-score/...。(3) センサーモードは smartphoneOnly / canDataOnly / combination の3値で、選択時に即 Storage settingSelectedSensorMode へ永続化する。設定画面は値の保存のみを担い、モード値とセンサー入力・スコアロジックの結線は middleware 側責務。(4) 録画 / GPSデモ / ログ保存 / センサログ保存の各フラグは enable/disable で即時 Storage 反映され、ログ保存系の切替は logService.initialize(file) を再実行するため未書き出しバッファが失われる。(5) scoreLogic の直接編集は /edit へ遷移する。(6) 設定画面にデバッグ用シードデータ投入 UI は追加しない。BLE 受信時のデバッグログは sensor.service 側で常時有効であり、本画面のログ保存フラグによる切替対象ではないため対応スイッチを設けない。(7) 書き出し失敗のユーザー提示、保持期間、MediaStore/SAF 共有は対象外。",
  "fact_candidates": [
    {"type": "display_rule", "title": "設定画面はセンサーモードを3値の選択肢として表示する", "statement": "/settings 画面はセンサーモードとして smartphoneOnly / canDataOnly / combination の3つの選択肢を表示する", "status": "candidate"},
    {"type": "input_rule", "title": "センサーモードは選択と同時に永続化される", "statement": "利用者がセンサーモードを選択すると、確定操作を待たずに Storage settingSelectedSensorMode が更新される", "status": "candidate"},
    {"type": "input_rule", "title": "録画/GPSデモ/ログ保存/センサログ保存は enable|disable で切替できる", "statement": "設定画面は録画・GPSデモ・ログ保存・センサログ保存の4フラグを enable / disable で切替可能とし、切替時に即時 Storage へ反映する", "status": "candidate"},
    {"type": "state_rule", "title": "ログ保存フラグ切替はログバッファをクリアする", "statement": "settingLogStorage または settingSensorLogStorage を切替えると logService.initialize(file) が再実行され、未書き出しログバッファは失われる", "status": "candidate"},
    {"type": "input_rule", "title": "scoreLogicJson は端末ファイル選択から更新できる", "statement": "設定画面は隠し input[type=file] (#score_json_update) を用いて端末上の scoreLogic.json を選択し辞書を更新できる", "status": "candidate"},
    {"type": "validation_rule", "title": "scoreLogicJson は JSON パースと必須キー検証を通過した場合のみ保存される", "statement": "選択された JSON が JSON.parse に成功し settings と messages を持つ場合のみ Storage scoreLogicJsonKey に保存され、そうでない場合は保存せず「不正なJSONファイルです。」ダイアログを表示する", "status": "candidate"},
    {"type": "validation_rule", "title": "scoreLogic は testScoreLogic 成功時のみ保存される", "statement": "選択された scoreLogic.txt は ScoreLogic.testScoreLogic が true を返した場合のみ Storage scoreLogicKey に保存され、例外時は保存せず stack をメッセージとするエラーダイアログを表示する", "status": "candidate"},
    {"type": "business_rule", "title": "scoreLogic 保存時に先頭へ版ヘッダを付与する", "statement": "scoreLogic 保存時、先頭行が //<数字> 形式であれば Date.now() で置換し、そうでなければ //<UnixTime> 行を先頭に追加する", "status": "candidate"},
    {"type": "display_rule", "title": "書き出し成功時に保存パスを提示する", "statement": "ファイル書き出しが成功した場合、showSaveFile ダイアログのメッセージとして保存パスを表示する", "status": "candidate"},
    {"type": "constraint", "title": "Android の書き出しルートは Documents/driving-score である", "statement": "Android では設定画面からの書き出し先を {externalRootDirectory}/Documents/driving-score/ とし、scoreLogicJson.<日時>.txt / scoreLogic.<日時>.txt を同ディレクトリ直下に生成する", "status": "approved"},
    {"type": "design_decision", "title": "書き出しルート変更に伴う settings.page.ts の変更は行わない", "statement": "externalDataDirectory への移設は撤回され Documents 配下へ戻す決定であり、settings.page.ts は変更しない", "status": "approved"},
    {"type": "design_decision", "title": "設定画面にシード投入 UI を追加しない", "statement": "設定画面にデバッグ用シードデータ投入 UI は追加しない", "status": "approved"},
    {"type": "display_rule", "title": "BLE デバッグログの ON/OFF スイッチは設定画面に存在しない", "statement": "BLE 受信時のデバッグログは sensor.service 側で常時有効であり、設定画面のログ保存フラグによる切替対象ではないため対応する UI 要素を持たない", "status": "candidate"},
    {"type": "display_rule", "title": "ブラウザ実行時はダウンロードで書き出す", "statement": "Android でない実行環境では Blob URL を a#save に設定して download させる", "status": "candidate"},
    {"type": "state_rule", "title": "設定画面は Android でポートレート固定される", "statement": "ionViewWillEnter 時、Android では画面向きを PORTRAIT にロックする", "status": "candidate"},
    {"type": "business_rule", "title": "scoreLogic の直接編集は編集画面へ遷移する", "statement": "scoreLogic 操作の edit を選択すると /edit へ前方遷移する", "status": "candidate"},
    {"type": "constraint", "title": "書き出し失敗のユーザー提示は対象外である", "statement": "書き出し失敗時のユーザー向けエラー提示、ファイル保持期間、MediaStore/SAF 共有は本画面の対象外である", "status": "approved"}
  ],
  "open_questions": [
    "選択された selectedSensorMode がスコアロジックの切替に実際に反映されないこと（scoreLogicFunction_simple.txt 未配線）を、設定画面の説明文や注意表示として利用者へ示す必要があるか。UI 文言かどうかは PO/Middleware 判断が必要で、決まらないと UC11 の期待値がユーザー期待と乖離する。",
    "ファイル選択が同期 XMLHttpRequest で行われるため大きなファイルで UI がフリーズする可能性があるが、ローディング表示等の UX 対応を行うかは未確定（Middleware/Infra と要確認）。",
    "書き出し先が Documents 配下であることを画面上のヘルプ等で利用者へ明示するかは未確定（保存完了ダイアログのパス表示のみで足りるかを QA と要確認）。",
    "scoreLogicJson の検証は settings/messages キーの存在のみで、内部の label3/label4/labelC が空であっても通るが、これを UI 側で警告表示すべきかは未確定（辞書仕様の責務が Middleware/Infra 側にあるため要確認）。"
  ],
  "rationale_notes": [
    "設定画面は「値の保存」までを責務とし、値の意味づけ（センサー入力の選択やスコアロジックの差替）は middleware 側に置く。この境界を明記することで、切替が未配線である実装実態と UI 仕様の矛盾を避けている。",
    "書き出しルートに関する承認済み決定（Documents 配下へ戻す・settings.page.ts は非変更）は、既存の 'Documents/driving-score/' 記述と整合するため本文は維持し、決定の経緯と採取手順のみを節として追記した。",
    "『UI 上に存在しないもの』節を新設し、シード UI 非追加と BLE デバッグログスイッチ不在を明示した。非提供の決定は記載しないと後続で再提案されやすいため、あえて仕様書に残す。",
    "ログ保存フラグ切替でバッファがクリアされる副作用は利用者から見て不可視のデータ喪失につながるため、業務ルールとして維持している。"
  ]
}
```
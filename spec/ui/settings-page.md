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

## 関連ノード
- 依存: [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[infra.file.storage]]
- 遷移先: [[ui.edit.page]]

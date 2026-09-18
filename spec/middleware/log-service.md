<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:31:47 JST -->

```markdown
# middleware.log.service — デバッグ/エラーログ・センサログサービス

## 概要
`LogService` は `console.log` / `console.error` と平行してログをバッファし、Android 実機かつ設定 ON のときに `{externalRootDirectory}/Documents/driving-score/` 配下へ gzip 圧縮テキストとして書き出す。センサログは診断中のみ有効なパス（`data.YYYYMMDD-HHMMSS/`）に切り替えて保存する。

## 真実源
- `src/data/src/app/services/log.service.ts`

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `Storage`（Ionic）
- `initialize(file: File)` で `File` プラグインインスタンスを受け取ってから書き込みが有効になる（各 Page が Page 側の `File` 注入インスタンスを渡す）。

## 内部状態
```
hasLogStorage: boolean          // settingLogStorage の反映
hasSensorLogStorage: boolean    // settingSensorLogStorage の反映
stockLog: string, stockLogLength: number
stockSensorLog: string, stockSensorLogLength: number
saveDefaultLogPath: string      // {externalRootDirectory}/Documents/driving-score/debug-log/
saveLogPath: string             // 診断中は {externalRootDirectory}/Documents/driving-score/data.<日時>/
```

## 書き出しルート
- ルートは `{externalRootDirectory}/Documents/driving-score/` 固定。
  - デバッグ/エラーログ: `…/driving-score/debug-log/`
  - センサログ（診断中）: `…/driving-score/data.YYYYMMDD-HHMMSS/`
- 追加パーミッションは要求しない。`settings.page.ts` は変更しない。
- ログ採取手段は、端末のファイルアプリ、または `adb pull /sdcard/Documents/driving-score/...` を正とする。

## `initialize(file)`
- 非 Android は完全 no-op で即 return。
- Storage の `settingLogStorage` / `settingSensorLogStorage` を読み、無効なら対応バッファをクリア。
- 未初期化なら `{externalRootDirectory}/Documents/driving-score/debug-log/` を作成し、`saveDefaultLogPath` に設定。以降 `saveLogPath` の既定値になる。
- ディレクトリ作成は各階層について `checkDir` で存在確認し、無い場合のみ `createDir` を直接呼び出す（旧実装の無条件 3 段 `createDir` からの修正を維持する）。

## パス切替
- `setLogDir(dirName)`: 現在バッファを force フラッシュ (`saveFile(true)` / `saveSensorFile(true)`) して `{externalRootDirectory}/Documents/driving-score/<dirName>/` に切替。
- `resetLogDir()`: 同じく force フラッシュして `saveLogPath = saveDefaultLogPath` に戻す。
- `getLogDir()`: 現在のパスを返す。

## ロギング API
| メソッド | 挙動 |
|---|---|
| `debug(msg, subMsg?)` | 常に `console.log`。`hasLogStorage && Android` ならバッファに `<日時> [D] msg. subMsg\n` を追記して `saveFile()` |
| `error(msg, error?)` | 常に `console.error`。`error.stack && error.message` を優先し、`. error => …` を付加。上と同様に `[E] …` を追記 |
| `sensor(sensorData)` | `saveLogPath === saveDefaultLogPath` のときは早期 return（=既定パスではセンサログを書かない）。`hasSensorLogStorage && Android` なら `{date, sensor}` を `JSON.stringify` して 1 行 1 レコードで追記（JSON Lines） |

### センサログのエンベロープ
- 1 行 1 レコードの JSON Lines 形式。
- レコード構造は `{"date": "<YYYY-MM-DD HH:mm:ss.SSS>", "sensor": <sensorData>}`。
- `date` は `getDateString()`（`simple=false`）の書式に従う。
- 開発・検証用に生成するモックデータも同一エンベロープ（同じキー構成・同じ `date` 書式・JSON Lines）に従うものとする。

## ファイル書き出し閾値
- 通常ログ: `stockLogLength >= 3,000,000`（3 MB）または force=true でフラッシュ。ファイル名 `log.YYYYMMDD-HHMMSS.txt.gz`
- センサログ: `stockSensorLogLength >= 5,000,000`（5 MB）または force=true でフラッシュ。ファイル名 `sensor-log.YYYYMMDD-HHMMSS.txt.gz`
- gzip 圧縮は `pako.gzip(text).buffer`。書き込みは `file.writeFile(saveLogPath, name, arrayBuffer, { replace: true })`。
- ファイル名規約とフラッシュ閾値は変更しない。

## 日付文字列
- `getDateString(simple=false)` / `getDateString2(date, simple)`:
  - `simple=false`: `YYYY-MM-DD HH:mm:ss.SSS`
  - `simple=true`: `YYYYMMDD-HHmmss`

## 呼び出し側の出力量（実装実態）
- [[middleware.sensor.service]] は BLE 受信コールバック直後で `logService.debug('[DrivingScore][SensorService]', lastCanData)` を毎回・無条件に呼ぶ（間引き・サンプリング・条件分岐なし）。
- このため BLE 受信レートに比例してデバッグログのバッファ増加が発生し、`log.*.txt.gz` のローテーション（3 MB フラッシュ）が高頻度で起きうる。
- ただし本ノードの責務は「渡されたものを記録する」ことであり、出力量の抑制は呼び出し側の責務とする。`LogService` 本体は変更しない。

## 業務ルール
- 非 Android では書き出し不要のため完全 no-op（バッファも `console` にのみ流れる）。
- センサログは診断中のみ出力する（既定パス＝`debug-log` では `sensor()` は無効）。
- ログは PII を含む可能性があるため、[[infra.file.storage]] の保持期間ポリシーは `spec/unknowns.md` を参照。

## 対象外（本ノードでは規定しない）
- 書き込み失敗時のユーザ向け提示（トースト・ダイアログ等）
- ログの保持期間・自動削除ポリシー
- MediaStore / SAF 経由の書き出し

## 関連ノード
- 依存: [[infra.file.storage]]
- 呼び出し元: ほぼ全モジュール（特に [[middleware.sensor.service]]）
```

```json
{
  "required_changes": [
    {"node": "middleware.log.service", "entrypoint": "spec/middleware/log-service.md", "description": "書き出しルートを {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ と明記し、ディレクトリ作成を checkDir→createDir 直接呼び出しに訂正"},
    {"node": "middleware.log.service", "entrypoint": "spec/middleware/log-service.md", "description": "センサログのエンベロープ（JSON Lines / {date, sensor} / date=YYYY-MM-DD HH:mm:ss.SSS）と生成モックの同一エンベロープ準拠を追記"},
    {"node": "middleware.log.service", "entrypoint": "spec/middleware/log-service.md", "description": "sensor.service の BLE 受信コールバックが debug を毎回無条件に呼ぶ実装実態と、LogService 本体は変更しない方針を追記"},
    {"node": "middleware.log.service", "entrypoint": "spec/middleware/log-service.md", "description": "失敗のユーザ提示・保持期間・MediaStore/SAF を対象外として明示"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "should", "reason": "sensor.service 仕様に BLE 受信ごとの無条件 debug 呼び出しとログ量への影響を明記する必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "infra.file.storage 側のパス定義を externalRootDirectory/Documents/driving-score/ に整合させ、採取手順（ファイルアプリ / adb pull /sdcard/Documents/driving-score）を反映する必要がある"},
    {"domain": "QA-agent", "severity": "could", "reason": "モックデータ生成が JSON Lines エンベロープに従う前提のため、検証データ作成手順に影響する"}
  ],
  "requirements_context": "LogService はデバッグ/エラーログとセンサログを console 出力と並行してバッファし、Android 実機かつ設定 ON の場合のみファイル書き出しを行う。書き出しルートは {externalRootDirectory}/Documents/driving-score/ 固定で、デバッグ/エラーログは debug-log/、診断中のセンサログは data.YYYYMMDD-HHMMSS/ に出力する（#79 の externalDataDirectory 案は撤回済み）。パーミッション追加なし、settings.page.ts は変更しない。ログ採取はファイルアプリまたは adb pull /sdcard/Documents/driving-score/... を正とする。ディレクトリ作成は各階層を checkDir で確認し未存在時のみ createDir を直接呼ぶ修正を維持する。ファイル名（log.YYYYMMDD-HHMMSS.txt.gz / sensor-log.YYYYMMDD-HHMMSS.txt.gz）、フラッシュ閾値（通常 3MB / センサ 5MB、force フラッシュ可）、『センサログは診断中のみ（既定パスでは sensor() 早期 return）』は維持する。sensor() は {date, sensor} を JSON.stringify して 1 行 1 レコードの JSON Lines でバッファし、pako.gzip して writeFile({replace:true}) する。date 書式は YYYY-MM-DD HH:mm:ss.SSS（simple=true 時は YYYYMMDD-HHmmss）。開発・検証用の生成モックも同一エンベロープに従う。sensor.service は BLE 受信コールバック直後で logService.debug('[DrivingScore][SensorService]', lastCanData) を毎回・無条件に呼ぶため受信レートに比例してデバッグログが増大するが、LogService 本体は変更せず出力量抑制は呼び出し側責務とする。書き込み失敗のユーザ提示・保持期間ポリシー・MediaStore/SAF 対応は本件の対象外。非 Android では initialize が完全 no-op。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "ログ書き出しルートは externalRootDirectory/Documents/driving-score/",
      "statement": "LogService の書き出しルートは {externalRootDirectory}/Documents/driving-score/ とする",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "デバッグ/エラーログの既定出力先は debug-log ディレクトリ",
      "statement": "デバッグログおよびエラーログは {externalRootDirectory}/Documents/driving-score/debug-log/ に出力する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "診断中のセンサログ出力先は data.YYYYMMDD-HHMMSS ディレクトリ",
      "statement": "診断中は saveLogPath を {externalRootDirectory}/Documents/driving-score/data.YYYYMMDD-HHMMSS/ に切り替えてセンサログを出力する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "ディレクトリ作成は checkDir で存在確認後に createDir を直接呼ぶ",
      "statement": "ログ出力ディレクトリの作成は各階層について checkDir で存在確認し、未存在の場合のみ createDir を直接呼び出す",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "既定パスではセンサログを書かない",
      "statement": "sensor() は saveLogPath が saveDefaultLogPath と等しい場合に早期 return しセンサログを追記しない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "センサログは JSON Lines 形式である",
      "statement": "センサログは 1 行 1 レコードの JSON Lines としてバッファに追記される",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "センサログのレコードは date と sensor の2キーを持つ",
      "statement": "センサログの各レコードは {\"date\": <日時文字列>, \"sensor\": <sensorData>} の構造を持つ",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "センサログの date 書式は YYYY-MM-DD HH:mm:ss.SSS",
      "statement": "センサログレコードの date は YYYY-MM-DD HH:mm:ss.SSS 書式で出力される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "生成モックはセンサログと同一エンベロープに従う",
      "statement": "開発・検証用に生成するモックデータは実センサログと同一のエンベロープ（キー構成・date 書式・JSON Lines）に従う",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "センサログのフラッシュ閾値は5MBまたはforce",
      "statement": "stockSensorLogLength が 5,000,000 以上、または force=true のときにセンサログをファイルへ書き出す",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "通常ログのフラッシュ閾値は3MBまたはforce",
      "statement": "stockLogLength が 3,000,000 以上、または force=true のときに通常ログをファイルへ書き出す",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "センサログのファイル名は sensor-log.YYYYMMDD-HHMMSS.txt.gz",
      "statement": "センサログの書き出しファイル名は sensor-log.YYYYMMDD-HHMMSS.txt.gz とする",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "通常ログのファイル名は log.YYYYMMDD-HHMMSS.txt.gz",
      "statement": "通常ログの書き出しファイル名は log.YYYYMMDD-HHMMSS.txt.gz とする",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "書き出しは pako.gzip 圧縮後に replace で行う",
      "statement": "バッファ内容は pako.gzip で圧縮し、file.writeFile(saveLogPath, name, arrayBuffer, { replace: true }) で書き出す",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "パス切替時は現在バッファを force フラッシュする",
      "statement": "setLogDir および resetLogDir は切替前に saveFile(true) と saveSensorFile(true) を実行する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "sensor.service は BLE 受信ごとに無条件で debug を呼ぶ",
      "statement": "sensor.service の BLE 受信コールバック直後で logService.debug('[DrivingScore][SensorService]', lastCanData) が毎回・無条件に呼ばれる",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "LogService 本体は変更しない",
      "statement": "BLE 受信ごとの debug 呼び出しに対して LogService 側の間引き・抑制処理は実装しない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "非 Android では initialize が no-op",
      "statement": "非 Android 環境では initialize が即 return し、ファイル書き出しは一切行われない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "追加パーミッションは要求しない",
      "statement": "ログ書き出しのために追加のストレージパーミッションは要求しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "settings.page.ts は変更しない",
      "statement": "本件のパス変更に伴う settings.page.ts の変更は行わない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "失敗提示・保持期間・MediaStore/SAF は対象外",
      "statement": "書き込み失敗のユーザ提示、ログ保持期間ポリシー、MediaStore/SAF 経由の書き出しは本ノードの対象外とする",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "BLE 受信ごとの無条件 debug 出力により実測でどの程度のログ量／フラッシュ頻度になるか未計測。LogService を変更しない方針のため、抑制が必要になった場合は sensor.service 側（Middleware）の判断が必要で、決まらないとストレージ消費と書き込み負荷の見積りができない。",
    "ログの保持期間・自動削除ポリシーが未確定（spec/unknowns.md 参照）。本件では対象外としたが、PII を含む可能性があるため運用／セキュリティ判断が必要で、決まらないと長期運用時の残存データ扱いが定まらない。",
    "file.writeFile / createDir が失敗した場合の挙動（リトライ有無・バッファ保持か破棄か）が仕様上未定義。失敗のユーザ提示は対象外だが内部の副作用は Middleware で確定が必要で、決まらないとログ欠損条件が説明できない。",
    "生成モックの生成元・生成手順（どのツール／どのノードが担うか）が未確定。同一エンベロープ準拠のみ合意されており、QA/Middleware のどちらが所有するか判断が必要。"
  ],
  "rationale_notes": [
    "#79 の externalDataDirectory 案は撤回され、既存の externalRootDirectory/Documents 配下に戻す決定が承認済みのため、spec もこの決定に合わせて記述した。",
    "checkDir→createDir の直接呼び出し修正のみを残す判断は、撤回対象がパスであって作成手順の不具合修正ではないという整理に基づく。",
    "ログ量抑制の責務を呼び出し側（sensor.service）に置くことで、LogService は『渡されたものを記録する』単一責務を保つ設計とした。",
    "JSON Lines をエンベロープとして明文化した理由は、gzip 分割ファイルを結合しても行単位でパースできる性質を維持し、モックと実ログを同じ解析経路で扱えるようにするため。",
    "ファイル名とフラッシュ閾値を据え置いたのは、既存の解析スクリプト・採取手順との互換性を壊さないため。"
  ]
}
```
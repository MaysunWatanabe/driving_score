<!-- 作成: 2026-09-10 17:28:04 JST | 更新: 2026-09-18 18:54:24 JST -->

# env.build.installer — 社内配布用フルオートインストーラ／ビルドバッチ群

## 概要
社内配布用に、依存ツールの導入確認・プロキシ登録・Desktop 配下への配置・依存インストール・Android/Browser 向けビルドを一括で行うスクリプト群。
加えて、開発機専用の linux プロファイル（社内配布 OS には含めない）により、リポジトリ上の `src/data` を作業ディレクトリとして Ionic/Capacitor ビルドおよび実機 install/run を行う手順を定義する。

## 真実源
- `src/install-windows.bat`
- `src/install-mac.sh`
- `src/config-npm.bat`
- `src/data/batch/windows/build-android.bat`
- `src/data/batch/windows/build-browser.bat`
- `src/data/batch/mac/build-android.sh`
- `src/data/batch/mac/build-browser.sh`
- `src/data/.nvmrc`（Node バージョンの唯一のピン値: `18.19.1`）

## 共通の定数
- `INSTALL_DIR = %HOMEDRIVE%%HOMEPATH%\Desktop` / `~/Desktop`（Win/Mac 社内配布用。linux 開発機プロファイルでは使用しない）
- `PACKAGE_NAME = driving-score`
- Node.js 正本バージョン: **18.19.1**（許容マッチ: **v18.19.x** = major=18 かつ minor=19）。nvm で管理する。
- npm は Node 同梱版に従い、独立バージョンはピンしない。

## Node / nvm 前提（全プロファイル共通）
- `node --version` が **v18.19.x** であること。存在しない、または major/minor 不一致の場合は非ゼロ終了する。
- 不一致・未インストール時は stderr/stdout に次を表示する:
  1. 要求バージョン **18.19.1**
  2. nvm 導入手順の概略
  3. リポジトリの `src/data` で `nvm install` / `nvm use`（`.nvmrc=18.19.1`）を実行する旨
- `npm --version` は存在確認のみ（独立バージョン比較はしない）。
- スクリプト内マジックナンバーおよび案内文は `18.19.1` / `18.19.x` に合わせる。
- Angular / Ionic / Capacitor 本体バージョンは本ノードでは変更しない。
- CI への Node 供給手順は本ノードの対象外。

## install-mac.sh の流れ
1. `~/Desktop/driving-score` を作成し、`src/data/*` をコピー、既存の `android/` は削除。
2. Node チェック: `node --version` が v18.19.x であること（不一致時は停止し nvm use を案内）。`npm --version` は存在確認のみ。
3. `npm install`。
4. `ionic cap sync` → `npx cap sync` → `ionic build`。
5. `android/` が無ければ `ionic capacitor add android`。
6. `src/data/android/*` を新規 android 配下に上書きコピー、`cd android && ln -s ../src/ .` でリソースのシンボリックリンクを作る。
7. 最後に `ionic capacitor build android` を実行。

## install-windows.bat の流れ
1. `java --version` の確認（失敗時は Java 17 の案内を表示して停止）。
2. `adb --version` の確認（失敗時は `%HOMEDRIVE%%HOMEPATH%\AppData\Local\Android\Sdk` の有無で「PATH 設定」or「SDK インストール」の案内）。
3. Node チェック: `node --version` が v18.19.x であること（不一致時は停止し nvm use を案内）。`npm --version` は存在確認のみ。
4. `mklink /D` で `android\src` のシンボリックリンクを作成するため **管理者権限が必要**。
5. `npm install` 失敗時は `npm config set registry http://…` と `strict-ssl false` にフォールバックして再実行。
6. その後の cap sync / build は Mac 版と同じ流れ。

## config-npm.bat
- 入力プロンプトで `http://user:password@proxy:8080` 形式のプロキシ URL を受け付け、`npm -g config set proxy` / `https-proxy` に登録する。
- 入力に `delete` と入れると `npm -g config delete proxy` / `https-proxy` で削除する。
- ソース中のコメントは Shift-JIS で書かれており文字化けする（表示崩れがあってもロジックには影響しない）。

## batch/windows|mac/build-android.* / build-browser.*
- 薄いラッパで、`ionic capacitor build android` / `ionic build --prod --output-path=…` を単発実行する。
- `install-windows.bat` / `install-mac.sh` / `src/data/batch/**` の社内配布向け挙動は linux プロファイル追加によって変更しない。

## 開発機専用 linux プロファイル
社内配布対象 OS には含めない。Win/Mac 既存の Desktop 展開手順は変更しない。

### 特性
- `dev_platform`: `"linux"`（開発機のみ）
- `linux.workdir`: リポジトリの `src/data`（Desktop へのコピー展開なし、`android/src` の symlink 作成なし）
- `linux.ionic_cli_delivery`: `"npx"`（`@ionic/cli` / `@capacitor/cli` のグローバル必須化なし。`package.json` の devDependencies + npx を使う）

### linux.steps（順序固定）
1. `cd src/data` かつ `nvm use`（`.nvmrc=18.19.1`。未インストール時は `nvm install`。version 不一致は非ゼロ終了で案内）
2. `npm ci`（`package-lock.json` 正本。lock と `package.json` 不整合時のみ `npm install`）
3. `npx ionic build`（www 出力）
4. `npx cap sync android`
5. 実機接続確認後 `npx cap run android --target <adb device id>`

### 実機 install / run
- **正本** `device_install_command`: `npx cap run android --target <device>`（build + install + launch 一括）
- **フォールバック** `device_install_fallback`: `adb install -r src/data/android/app/build/outputs/apk/debug/app-debug.apk`（cap run 不可または APK 手渡し時。パスは workdir=`src/data` 前提の相対）

### 実機前提
- 開発者オプション ON
- USB デバッグ ON
- `adb devices` が device 状態であること
- `unauthorized` / empty のときは `cap run` 前に停止して接続を案内する

### 実行前ゲート
- `environment.secrets.ts` 等、`ionic build` に必要なファイルが未配置なら build ステップで失敗させる（欠落を黙殺して `cap sync` に進まない）
- Maps キー未配置時の失敗メッセージは既存 `loadMapsKey` / TS 解決に従う（キー裁定自体は本ノードの対象外）

### BLE エミュレータ（開発機用）
CAN/BLE 実機が手元にない状態で UC06（運転診断の実行）／UC12（編集とデモ再生）を検証するための開発補助。

- 実行 OS: **Linux 開発機のみ**（Windows / Mac の社内配布プロファイルでは動作対象としない）
- 前提パッケージ: `python3` および `python3-dbus`（BlueZ の D-Bus インタフェース利用のため）
- **新規依存ゼロ**: 上記以外の追加ライブラリ導入やアプリ側 `package.json` への依存追加は行わない
- エミュレータは `npm ci` / `ionic build` / `cap sync` のビルド経路には含めず、ビルド成果物にも同梱しない
- 実機ビルド・実機 install/run の手順（linux.steps）はエミュレータの有無にかかわらず変更しない
- テスト用ナビ端末は先方から貸与される予定だが提供時期が未定のため、実機が無い期間の代替検証手段として本エミュレータを位置づける
- 現行の BLE notify ペイロードは 12 バイト固定長を前提とする。2026 年度改修（標識認識・先行車検知の追加）でペイロード長・バイト割り当てが変更された場合、エミュレータ側の前提（不正長注入 short11 / long13 を含む）も併せて見直す必要がある（ペイロード仕様は本ノードの裁定対象外）

### 対象外
- release 署名・ストア配布
- `install-windows.bat` / `install-mac.sh` / `src/data/batch/**` の変更

## リポジトリ bind 手順（SpecSmith 連携）
本リポジトリを SpecSmith 管理下で扱う際は、初回セットアップ時に bind を実行する。

- コマンド: `projectsmith bind --repo-id <id>`
- 記載先: 本書（`spec/env/build-installer.md`）および／または リポジトリ README に明記する
- 生成物の除外方針は [[env.repo.gitignore]] に従う（bind によって生成されるローカル管理ファイルはコミット対象外）
- bind はビルド手順（linux.steps）の前提ではなく、開発環境セットアップの一環として実施する

## 業務ルール
- スクリプト（Win/Mac）はリポジトリ内配布ではなく、開発者マシン上での Desktop への展開を前提とする。
- linux 開発機プロファイルはリポジトリの `src/data` を直接 workdir とし、Desktop コピーや `android/src` symlink を行わない。
- ソースを差し替えて再ビルドする場合は再度 `install-*` を実行するか、`build-*` 系のみを使う（linux では上記 linux.steps に従う）。
- Node は 18.19.1 を唯一の正とし nvm（`.nvmrc`）で揃える。installer の node チェックは 18.19.x の version_match とし、不一致時は停止して nvm use を案内する。
- BLE エミュレータは開発機（Linux）専用の検証手段であり、社内配布物・ビルド成果物には含めない。

## 2026 年度改修に伴う環境上の前提
本ノードは 2026 年度改修（前回結果表示・タブ切替・レーダーチャート・BLE 安定化・録画データサイズ改善）そのものを裁定しないが、実行環境として次を前提とする。

- 納期前提: アプリ開発は **2026 年 11 月末完了**、**2026 年 12 月から高齢者を招いた実験開始**。実機検証環境（開発機 linux プロファイル・BLE エミュレータ・実機 install/run 手順）はこの期日までに動作可能であること。
- 本改修範囲でも Node / Angular / Ionic / Capacitor の本体バージョンは据え置き（Node 18.19.1 固定）とし、ビルド手順（linux.steps）を変更しない。
- レーダーチャート描画やアイコン素材（いらすとや）の追加によりランタイム依存が増える場合は、`package.json` / `package-lock.json` の更新を伴うため `npm ci` が成立することを確認する（依存追加の可否判断自体は本ノードの対象外）。
- 画面の縦横変更要求（現行は Android で PORTRAIT 固定）は端末設定・Capacitor 設定側の裁定事項であり、本ノードのビルド手順には影響しない。

## 関連ノード
- 依存先: [[env.config.capacitor]]
- 関連: [[env.app.bootstrap]]（ビルド前提として Node 18.19.x + nvm + .nvmrc）
- 関連: [[env.repo.gitignore]]（`projectsmith bind --repo-id <id>` と生成物の除外方針）
- 関連: [[qa.mockdata.ble.emulator]]（BLE エミュレータの検証データ前提／ペイロード長 12 バイト）

```json
{
  "required_changes": [
    {"node": "env.build.installer", "entrypoint": "spec/env/build-installer.md", "description": "approved facts（Node 18.19.1 / linux 開発機プロファイル / 実機 install 正本とフォールバック）を維持したまま、2026年度改修のスケジュール前提・BLE テスト用ナビ端末の提供時期未定・CAN ペイロード長変更時のエミュレータ影響を実行環境の前提として追記する"}
  ],
  "suggested_impacts": [
    {"domain": "qa.mockdata.ble.emulator", "severity": "must", "reason": "CAN ペイロードが 12 バイト固定から変更された場合、BLE エミュレータの符号化規則および不正長注入（short11/long13）前提が失効するため"},
    {"domain": "env.repo.gitignore", "severity": "must", "reason": "bind 手順（projectsmith bind --repo-id <id>）の正本記載先と bind 生成物の除外対象が未確定のため裁定が必要"},
    {"domain": "env.config.capacitor", "severity": "should", "reason": "画面の縦横変更要求は現行の PORTRAIT 固定設定と衝突するため Capacitor / Android 設定側の裁定が必要"},
    {"domain": "env.app.bootstrap", "severity": "should", "reason": "ビルド前提として Node 18.19.x（nvm + .nvmrc）を要求する旨が bootstrap 仕様の前提に含まれる"},
    {"domain": "ui.chart.radar", "severity": "could", "reason": "レーダーチャート描画やいらすとやアイコン素材の追加でランタイム依存が増える場合、package.json / package-lock.json 更新と npm ci 成立確認が必要になるため"}
  ],
  "requirements_context": "env.build.installer は社内配布用インストーラ（install-windows.bat / install-mac.sh / config-npm.bat / batch 配下の build-android・build-browser ラッパ）と、開発機専用 linux プロファイルのビルド・実機 install/run 手順を定義する。共通前提として Node.js は 18.19.1 を唯一の正とし nvm（src/data/.nvmrc）で管理、installer の node チェックは v18.19.x（major=18/minor=19）の version_match で不一致時は非ゼロ終了し 18.19.1・nvm 導入概略・src/data での nvm install/use を案内する。npm は Node 同梱版に従い独立ピンせず存在確認のみ。Angular/Ionic/Capacitor 本体バージョン変更と CI への Node 供給は対象外。Win/Mac は INSTALL_DIR=Desktop、PACKAGE_NAME=driving-score で Desktop 展開、Windows は mklink /D のため管理者権限必須、npm install 失敗時は registry/strict-ssl フォールバック、config-npm.bat は http://user:password@proxy:8080 形式でプロキシ設定と delete 削除を行う。linux プロファイルは開発機専用で社内配布 OS に含めず、workdir=src/data（Desktop コピーや android/src symlink なし）、CLI は npx 経由、手順は (1) cd src/data かつ nvm use (2) npm ci（不整合時のみ npm install） (3) npx ionic build (4) npx cap sync android (5) npx cap run android --target <device> の順に固定。実機 install の正本は npx cap run android --target <device>、フォールバックは adb install -r src/data/android/app/build/outputs/apk/debug/app-debug.apk。実機前提は開発者オプション ON・USB デバッグ ON・adb devices が device 状態で、unauthorized/empty 時は cap run 前に停止して案内。environment.secrets.ts 等 ionic build 必須ファイル未配置時は build で失敗させ cap sync に進まない（Maps キー未配置時メッセージは既存 loadMapsKey/TS 解決に従う）。release 署名・ストア配布、および Win/Mac スクリプトと src/data/batch/** の変更は対象外。開発補助として BLE エミュレータを Linux 開発機限定で用い、前提は python3 と python3-dbus のみ、新規依存ゼロでビルド経路・配布物に含めない。BLE エミュレータはテスト用ナビ端末の提供時期が未定であることの代替検証手段として位置づけ、現行 BLE notify ペイロード 12 バイト固定長を前提とする（2026 年度改修で標識認識・先行車検知が追加されペイロードが変わる場合は前提の見直しが必要）。SpecSmith 連携としてリポジトリ初回セットアップ時に projectsmith bind --repo-id <id> を実行し、生成物の除外は env.repo.gitignore に従う。2026 年度改修の実行環境前提として、開発完了 2026 年 11 月末・2026 年 12 月実験開始の期日までに実機検証環境が稼働すること、本改修でも Node/Angular/Ionic/Capacitor 本体バージョンとビルド手順を変更しないこと、依存追加が発生する場合は npm ci 成立を確認すること、画面の縦横変更要求は Capacitor/Android 設定側の裁定であり本ノードのビルド手順に影響しないことを明記する。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "Node.js 正本は 18.19.1（nvm / .nvmrc）",
      "statement": "Node.js は 18.19.1 を唯一の正とし nvm で管理する。正本ピン値は src/data/.nvmrc の 18.19.1 であり、npm は Node 同梱版に従い独立ピンしない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "installer の node チェックは v18.19.x 必須",
      "statement": "install-windows.bat / install-mac.sh の node チェックは node --version が v18.19.x（major=18, minor=19）であることを検証し、不一致または未インストール時は非ゼロ終了して 18.19.1・nvm 導入概略・src/data での nvm install/use を案内する。npm --version は存在確認のみとする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "Angular / Ionic / Capacitor 本体バージョンと CI Node 供給は対象外",
      "statement": "本ノードは Angular / Ionic / Capacitor 本体バージョンを変更せず、CI への Node 供給手順も対象外とする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "linux は開発機専用プロファイル",
      "statement": "env.build.installer の linux プロファイルは開発機専用であり社内配布対象 OS には含めない。Win/Mac 既存の install/batch 手順は変更しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "linux.workdir は src/data",
      "statement": "linux 開発機プロファイルの workdir はリポジトリの src/data であり、Desktop へのコピー展開および android/src の symlink 作成は行わない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "linux の Ionic/Capacitor CLI は npx 経由",
      "statement": "linux プロファイルでは @ionic/cli / @capacitor/cli のグローバル必須化はせず、package.json の devDependencies と npx を用いる",
      "status": "approved"
    },
    {
      "type": "external_integration_rule",
      "title": "linux ビルド手順の固定順序",
      "statement": "linux.steps は (1) cd src/data かつ nvm use（.nvmrc=18.19.1。未導入時 nvm install。不一致は非ゼロ終了）(2) npm ci（package-lock.json 正本。不整合時のみ npm install）(3) npx ionic build (4) npx cap sync android (5) 実機接続確認後 npx cap run android --target <adb device id> の順で固定する",
      "status": "approved"
    },
    {
      "type": "external_integration_rule",
      "title": "実機 install の正本とフォールバック",
      "statement": "device_install_command の正本は npx cap run android --target <device>（build+install+launch 一括）であり、フォールバックは adb install -r src/data/android/app/build/outputs/apk/debug/app-debug.apk（workdir=src/data 前提の相対パス）である",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "実機接続前提と cap run 前ゲート",
      "statement": "実機利用時は開発者オプション ON・USB デバッグ ON・adb devices が device 状態であることが前提であり、unauthorized または empty のときは cap run 前に停止して接続を案内する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "ionic build 必要ファイル未配置時は build で失敗",
      "statement": "environment.secrets.ts 等 ionic build に必要なファイルが未配置の場合は build ステップで失敗させ、欠落を黙殺して cap sync に進んではならない。Maps キー未配置時の失敗メッセージは既存 loadMapsKey / TS 解決に従う",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "release 署名とストア配布は対象外",
      "statement": "env.build.installer の linux プロファイルおよび本ノード手順は release 署名・ストア配布を対象外とする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "BLE エミュレータは Linux 開発機専用",
      "statement": "BLE エミュレータは Linux 開発機上でのみ動作する前提であり、社内配布対象の Windows / Mac プロファイルの動作対象には含めない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "BLE エミュレータの前提パッケージは python3 と python3-dbus",
      "statement": "BLE エミュレータの動作には python3 および python3-dbus が導入済みであることを前提とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "BLE エミュレータは新規依存ゼロ",
      "statement": "BLE エミュレータは python3 / python3-dbus 以外の新規依存を追加せず、アプリの package.json 依存にも追加しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "BLE エミュレータはビルド経路・配布物に含めない",
      "statement": "BLE エミュレータは npm ci / ionic build / cap sync のビルド経路に含めず、ビルド成果物にも同梱しない",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "リポジトリ bind 手順の明記",
      "statement": "リポジトリを SpecSmith 管理下で扱う際は `projectsmith bind --repo-id <id>` を実行し、その手順を README または spec/env/build-installer.md に明記する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Win/Mac 社内配布の INSTALL_DIR と PACKAGE_NAME",
      "statement": "Win/Mac 社内配布用インストーラは INSTALL_DIR を Desktop（%HOMEDRIVE%%HOMEPATH%\\Desktop または ~/Desktop）、PACKAGE_NAME を driving-score とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Windows インストーラは管理者権限が必要",
      "statement": "install-windows.bat は android\\src への mklink /D シンボリックリンク作成のため管理者権限を必要とする",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "config-npm.bat のプロキシ設定",
      "statement": "config-npm.bat は http://user:password@proxy:8080 形式の入力で npm -g の proxy/https-proxy を設定し、delete 入力で当該設定を削除する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "2026年度改修の実機検証環境は 2026年11月末までに稼働している必要がある",
      "statement": "アプリ開発完了目標が 2026 年 11 月末、2026 年 12 月から高齢者を招いた実験が開始されるため、開発機 linux プロファイル・BLE エミュレータ・実機 install/run 手順はそれまでに動作可能でなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "2026年度改修でもランタイム本体バージョンとビルド手順は据え置く",
      "statement": "2026 年度改修（前回結果表示・タブ切替・レーダーチャート・BLE 安定化・録画サイズ改善）においても Node 18.19.1 固定および linux.steps のビルド手順は変更しない",
      "status": "candidate"
    },
    {
      "type": "assumption",
      "title": "BLE エミュレータは実機ナビ端末未提供期間の代替検証手段",
      "statement": "テスト用ナビ端末の提供時期が未定であるため、その間の UC06 / UC12 検証は Linux 開発機の BLE エミュレータで代替する",
      "status": "assumption"
    }
  ],
  "open_questions": [
    "bind 手順（projectsmith bind --repo-id <id>）の正本記載先が README か spec/env/build-installer.md かが未確定。現状は両方に記載可としたため、env.repo.gitignore 側の裁定が必要。二重管理になると手順の食い違いが生じる",
    "bind 実行で生成されるローカルファイルの具体名と .gitignore への追加要否が未確定。env.repo.gitignore ノードの判断が必要で、決まらないと誤コミットのリスクが残る",
    "BLE エミュレータのスクリプト配置先（リポジトリ内パス）と起動コマンドが未確定。BLE/デバイス側ドメインの確認が必要で、決まらないと本書に手順を記述できない",
    "BLE エミュレータが必要とする BlueZ / Bluetooth アダプタの要件（BlueZ の最低バージョン、実 BT アダプタの要否）が未確定。決まらないと開発機セットアップ要件を確定できない",
    "BLE エミュレータの利用が UC06/UC12 の QA 検証手順として必須か任意かが未確定。QA ドメインの判断が必要",
    "2026 年度改修で CAN/BLE ペイロードが 12 バイト固定長から変更されるかが未確定。device/BLE ドメインの確定が必要で、変わると BLE エミュレータの符号化前提と不正長注入ケース（short11/long13）を改訂する必要がある",
    "レーダーチャート描画に新規ランタイム依存（チャートライブラリ等）を追加するかが未確定。UI ドメインの選定次第で package.json / package-lock.json と npm ci 前提に影響する",
    "画面の縦横変更要求に対し、どの画面で PORTRAIT 固定を解除するかが未確定。Capacitor / Android 設定ドメインの裁定が必要で、決まらないと実機検証手順に追加確認項目が必要か判断できない",
    "テスト用ナビ端末の提供時期が未定のため、実機での BLE 安定化検証をいつ開始できるかが確定できない。11 月末の完了目標に対するリスクとなる"
  ],
  "rationale_notes": [
    "node_id=env.build.installer の approved facts（Node 18.19.1 / 18.19.x version_match、linux 開発機プロファイル、実機 install 正本とフォールバック）を正本とし、既存 MD 本文と矛盾がなかったため社内配布の Win/Mac 手順・定数・config-npm.bat・batch ラッパはそのまま維持した。",
    "今回の facts 追加分（2026 年度改修要求、スケジュール、レーダーチャート仕様、縦横変更要求など）はほとんどが UI/ビジネスロジック領域であり本ノードの責務外のため、実行環境として影響する点（納期、ランタイム据え置き、依存追加時の npm ci 成立、画面回転の裁定先）だけを『2026 年度改修に伴う環境上の前提』節に限定して追記した。",
    "BLE エミュレータ節には『テスト用ナビ端末の提供時期未定』と『CAN ペイロード 12 バイト前提の変更リスク』を追記した。いずれも approved/open_question fact 由来で、実機不在時の代替検証という本エミュレータの存在理由と、前提失効条件を明示するため。",
    "BLE エミュレータの記述は実行環境の前提（Linux・python3/python3-dbus・新規依存ゼロ・ビルド経路非混入）に限定し、実装手段やスクリプト内容には踏み込んでいない。",
    "bind 手順は『README または本書に明記』という指示に従い本書に節を維持したが、正本一元化の観点から記載先の裁定を open_question に残した。",
    "録画データサイズ改善やヒヤリ動画の個別化などのストレージ影響は現時点でストレージ容量要件として数値化されていないため、本ノードには取り込まず open_question にも起票していない（Infra/Storage ドメインの裁定待ち）。"
  ]
}
```
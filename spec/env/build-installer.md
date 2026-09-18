<!-- 作成: 2026-08-31 16:19:34 JST | 更新: 2026-09-10 17:28:03 JST -->

```json
{
  "required_changes": [
    {"node": "env.build.installer", "entrypoint": "spec/env/build-installer.md", "description": "既存の Node 18.19.1 / linux 開発機プロファイル記述を維持したまま、BLE エミュレータ前提（Linux 開発機・python3/python3-dbus・新規依存ゼロ）と projectsmith bind 手順を追記する"}
  ],
  "suggested_impacts": [
    {"domain": "env.repo.gitignore", "severity": "must", "reason": "bind 手順（projectsmith bind --repo-id <id>）の正本記載先が README か build-installer.md かを当該ノードと突き合わせる必要がある"},
    {"domain": "env.app.bootstrap", "severity": "should", "reason": "ビルド前提として Node 18.19.x（nvm + .nvmrc）を要求する旨が bootstrap 仕様の前提に含まれる"},
    {"domain": "env.config.capacitor", "severity": "could", "reason": "cap sync / cap run android 手順は Capacitor 設定ノードと整合が必要"},
    {"domain": "env.dev.ble-emulator", "severity": "should", "reason": "BLE エミュレータの実行環境前提（python3/python3-dbus・Linux 限定）は本ノードの手順記述と整合させる必要がある"}
  ],
  "requirements_context": "# env.build.installer — 社内配布用フルオートインストーラ／ビルドバッチ群\n\n## 概要\n社内配布用に、依存ツールの導入確認・プロキシ登録・Desktop 配下への配置・依存インストール・Android/Browser 向けビルドを一括で行うスクリプト群。\n加えて、開発機専用の linux プロファイル（社内配布 OS には含めない）により、リポジトリ上の `src/data` を作業ディレクトリとして Ionic/Capacitor ビルドおよび実機 install/run を行う手順を定義する。\n\n## 真実源\n- `src/install-windows.bat`\n- `src/install-mac.sh`\n- `src/config-npm.bat`\n- `src/data/batch/windows/build-android.bat`\n- `src/data/batch/windows/build-browser.bat`\n- `src/data/batch/mac/build-android.sh`\n- `src/data/batch/mac/build-browser.sh`\n- `src/data/.nvmrc`（Node バージョンの唯一のピン値: `18.19.1`）\n\n## 共通の定数\n- `INSTALL_DIR = %HOMEDRIVE%%HOMEPATH%\\Desktop` / `~/Desktop`（Win/Mac 社内配布用。linux 開発機プロファイルでは使用しない）\n- `PACKAGE_NAME = driving-score`\n- Node.js 正本バージョン: **18.19.1**（許容マッチ: **v18.19.x** = major=18 かつ minor=19）。nvm で管理する。\n- npm は Node 同梱版に従い、独立バージョンはピンしない。\n\n## Node / nvm 前提（全プロファイル共通）\n- `node --version` が **v18.19.x** であること。存在しない、または major/minor 不一致の場合は非ゼロ終了する。\n- 不一致・未インストール時は stderr/stdout に次を表示する:\n  1. 要求バージョン **18.19.1**\n  2. nvm 導入手順の概略\n  3. リポジトリの `src/data` で `nvm install` / `nvm use`（`.nvmrc=18.19.1`）を実行する旨\n- `npm --version` は存在確認のみ（独立バージョン比較はしない）。\n- スクリプト内マジックナンバーおよび案内文は `18.19.1` / `18.19.x` に合わせる。\n- Angular / Ionic / Capacitor 本体バージョンは本ノードでは変更しない。\n- CI への Node 供給手順は本ノードの対象外。\n\n## install-mac.sh の流れ\n1. `~/Desktop/driving-score` を作成し、`src/data/*` をコピー、既存の `android/` は削除。\n2. Node チェック: `node --version` が v18.19.x であること（不一致時は停止し nvm use を案内）。`npm --version` は存在確認のみ。\n3. `npm install`。\n4. `ionic cap sync` → `npx cap sync` → `ionic build`。\n5. `android/` が無ければ `ionic capacitor add android`。\n6. `src/data/android/*` を新規 android 配下に上書きコピー、`cd android && ln -s ../src/ .` でリソースのシンボリックリンクを作る。\n7. 最後に `ionic capacitor build android` を実行。\n\n## install-windows.bat の流れ\n1. `java --version` の確認（失敗時は Java 17 の案内を表示して停止）。\n2. `adb --version` の確認（失敗時は `%HOMEDRIVE%%HOMEPATH%\\AppData\\Local\\Android\\Sdk` の有無で「PATH 設定」or「SDK インストール」の案内）。\n3. Node チェック: `node --version` が v18.19.x であること（不一致時は停止し nvm use を案内）。`npm --version` は存在確認のみ。\n4. `mklink /D` で `android\\src` のシンボリックリンクを作成するため **管理者権限が必要**。\n5. `npm install` 失敗時は `npm config set registry http://…` と `strict-ssl false` にフォールバックして再実行。\n6. その後の cap sync / build は Mac 版と同じ流れ。\n\n## config-npm.bat\n- 入力プロンプトで `http://user:password@proxy:8080` 形式のプロキシ URL を受け付け、`npm -g config set proxy` / `https-proxy` に登録する。\n- 入力に `delete` と入れると `npm -g config delete proxy` / `https-proxy` で削除する。\n- ソース中のコメントは Shift-JIS で書かれており文字化けする（表示崩れがあってもロジックには影響しない）。\n\n## batch/windows|mac/build-android.* / build-browser.*\n- 薄いラッパで、`ionic capacitor build android` / `ionic build --prod --output-path=…` を単発実行する。\n- `install-windows.bat` / `install-mac.sh` / `src/data/batch/**` の社内配布向け挙動は linux プロファイル追加によって変更しない。\n\n## 開発機専用 linux プロファイル\n社内配布対象 OS には含めない。Win/Mac 既存の Desktop 展開手順は変更しない。\n\n### 特性\n- `dev_platform`: `\"linux\"`（開発機のみ）\n- `linux.workdir`: リポジトリの `src/data`（Desktop へのコピー展開なし、`android/src` の symlink 作成なし）\n- `linux.ionic_cli_delivery`: `\"npx\"`（`@ionic/cli` / `@capacitor/cli` のグローバル必須化なし。`package.json` の devDependencies + npx を使う）\n\n### linux.steps（順序固定）\n1. `cd src/data` かつ `nvm use`（`.nvmrc=18.19.1`。未インストール時は `nvm install`。version 不一致は非ゼロ終了で案内）\n2. `npm ci`（`package-lock.json` 正本。lock と `package.json` 不整合時のみ `npm install`）\n3. `npx ionic build`（www 出力）\n4. `npx cap sync android`\n5. 実機接続確認後 `npx cap run android --target <adb device id>`\n\n### 実機 install / run\n- **正本** `device_install_command`: `npx cap run android --target <device>`（build + install + launch 一括）\n- **フォールバック** `device_install_fallback`: `adb install -r src/data/android/app/build/outputs/apk/debug/app-debug.apk`（cap run 不可または APK 手渡し時。パスは workdir=`src/data` 前提の相対）\n\n### 実機前提\n- 開発者オプション ON\n- USB デバッグ ON\n- `adb devices` が device 状態であること\n- `unauthorized` / empty のときは `cap run` 前に停止して接続を案内する\n\n### 実行前ゲート\n- `environment.secrets.ts` 等、`ionic build` に必要なファイルが未配置なら build ステップで失敗させる（欠落を黙殺して `cap sync` に進まない）\n- Maps キー未配置時の失敗メッセージは既存 `loadMapsKey` / TS 解決に従う（キー裁定自体は本ノードの対象外）\n\n### BLE エミュレータ（開発機用）\nCAN/BLE 実機が手元にない状態で UC06（運転診断の実行）／UC12（編集とデモ再生）を検証するための開発補助。\n\n- 実行 OS: **Linux 開発機のみ**（Windows / Mac の社内配布プロファイルでは動作対象としない）\n- 前提パッケージ: `python3` および `python3-dbus`（BlueZ の D-Bus インタフェース利用のため）\n- **新規依存ゼロ**: 上記以外の追加ライブラリ導入やアプリ側 `package.json` への依存追加は行わない\n- エミュレータは `npm ci` / `ionic build` / `cap sync` のビルド経路には含めず、ビルド成果物にも同梱しない\n- 実機ビルド・実機 install/run の手順（linux.steps）はエミュレータの有無にかかわらず変更しない\n\n### 対象外\n- release 署名・ストア配布\n- `install-windows.bat` / `install-mac.sh` / `src/data/batch/**` の変更\n\n## リポジトリ bind 手順（SpecSmith 連携）\n本リポジトリを SpecSmith 管理下で扱う際は、初回セットアップ時に bind を実行する。\n\n- コマンド: `projectsmith bind --repo-id <id>`\n- 記載先: 本書（`spec/env/build-installer.md`）および／または リポジトリ README に明記する\n- 生成物の除外方針は [[env.repo.gitignore]] に従う（bind によって生成されるローカル管理ファイルはコミット対象外）\n- bind はビルド手順（linux.steps）の前提ではなく、開発環境セットアップの一環として実施する\n\n## 業務ルール\n- スクリプト（Win/Mac）はリポジトリ内配布ではなく、開発者マシン上での Desktop への展開を前提とする。\n- linux 開発機プロファイルはリポジトリの `src/data` を直接 workdir とし、Desktop コピーや `android/src` symlink を行わない。\n- ソースを差し替えて再ビルドする場合は再度 `install-*` を実行するか、`build-*` 系のみを使う（linux では上記 linux.steps に従う）。\n- Node は 18.19.1 を唯一の正とし nvm（`.nvmrc`）で揃える。installer の node チェックは 18.19.x の version_match とし、不一致時は停止して nvm use を案内する。\n- BLE エミュレータは開発機（Linux）専用の検証手段であり、社内配布物・ビルド成果物には含めない。\n\n## 関連ノード\n- 依存先: [[env.config.capacitor]]\n- 関連: [[env.app.bootstrap]]（ビルド前提として Node 18.19.x + nvm + .nvmrc）\n- 関連: [[env.repo.gitignore]]（`projectsmith bind --repo-id <id>` と生成物の除外方針）\n",
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
    }
  ],
  "open_questions": [
    "bind 手順（projectsmith bind --repo-id <id>）の正本記載先が README か spec/env/build-installer.md かが未確定。現状は両方に記載可としたため、env.repo.gitignore 側の裁定が必要。二重管理になると手順の食い違いが生じる",
    "bind 実行で生成されるローカルファイルの具体名と .gitignore への追加要否が未確定。env.repo.gitignore ノードの判断が必要で、決まらないと誤コミットのリスクが残る",
    "BLE エミュレータのスクリプト配置先（リポジトリ内パス）と起動コマンドが未確定。BLE/デバイス側ドメインの確認が必要で、決まらないと本書に手順を記述できない",
    "BLE エミュレータが必要とする BlueZ / Bluetooth アダプタの要件（BlueZ の最低バージョン、実 BT アダプタの要否）が未確定。決まらないと開発機セットアップ要件を確定できない",
    "BLE エミュレータの利用が UC06/UC12 の QA 検証手順として必須か任意かが未確定。QA ドメインの判断が必要"
  ],
  "rationale_notes": [
    "node_id=env.build.installer の approved facts（Node 18.19.1 / 18.19.x version_match、linux 開発機プロファイル）を正本とし、既存 MD 本文と矛盾がなかったため社内配布の Win/Mac 手順・定数・config-npm.bat・batch ラッパはそのまま維持した。",
    "今回追加した BLE エミュレータ記述は「実行環境の前提（Linux・python3/python3-dbus・新規依存ゼロ）」のみに限定し、実装手段やスクリプト内容には踏み込んでいない。本ノードの責務は実行環境要件の明示に留めるため。",
    "BLE エミュレータをビルド経路（npm ci / ionic build / cap sync）に含めないと明記したのは、新規依存ゼロ要件と社内配布物への非同梱を担保するため。",
    "bind 手順は「README または本書に明記」という指示に従い本書に節を設けたが、正本一元化の観点から記載先の裁定を open_question に残した。",
    "外部データ書き出しパスや score-logic 系の approved fact は本ノードの実行環境・インストーラ範囲外のため本文に取り込んでいない。"
  ]
}
```
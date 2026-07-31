# env.build.installer — 社内配布用フルオートインストーラ／ビルドバッチ群

## 概要
社内配布用に、依存ツールの導入確認・プロキシ登録・Desktop 配下への配置・依存インストール・Android/Browser 向けビルドを一括で行うスクリプト群。

## 真実源
- `src/install-windows.bat`
- `src/install-mac.sh`
- `src/config-npm.bat`
- `src/data/batch/windows/build-android.bat`
- `src/data/batch/windows/build-browser.bat`
- `src/data/batch/mac/build-android.sh`
- `src/data/batch/mac/build-browser.sh`

## 共通の定数
- `INSTALL_DIR = %HOMEDRIVE%%HOMEPATH%\Desktop` / `~/Desktop`
- `PACKAGE_NAME = driving-score`

## install-mac.sh の流れ
1. `~/Desktop/driving-score` を作成し、`src/data/*` をコピー、既存の `android/` は削除。
2. `npm install`。
3. `ionic cap sync` → `npx cap sync` → `ionic build`。
4. `android/` が無ければ `ionic capacitor add android`。
5. `src/data/android/*` を新規 android 配下に上書きコピー、`cd android && ln -s ../src/ .` でリソースのシンボリックリンクを作る。
6. 最後に `ionic capacitor build android` を実行。

## install-windows.bat の流れ
1. `java --version` の確認（失敗時は Java 17 の案内を表示して停止）。
2. `adb --version` の確認（失敗時は `%HOMEDRIVE%%HOMEPATH%\AppData\Local\Android\Sdk` の有無で「PATH 設定」or「SDK インストール」の案内）。
3. `node --version` / `npm --version` の確認。
4. `mklink /D` で `android\src` のシンボリックリンクを作成するため **管理者権限が必要**。
5. `npm install` 失敗時は `npm config set registry http://…` と `strict-ssl false` にフォールバックして再実行。
6. その後の cap sync / build は Mac 版と同じ流れ。

## config-npm.bat
- 入力プロンプトで `http://user:password@proxy:8080` 形式のプロキシ URL を受け付け、`npm -g config set proxy` / `https-proxy` に登録する。
- 入力に `delete` と入れると `npm -g config delete proxy` / `https-proxy` で削除する。
- ソース中のコメントは Shift-JIS で書かれており文字化けする（表示崩れがあってもロジックには影響しない）。

## batch/windows|mac/build-android.* / build-browser.*
- 薄いラッパで、`ionic capacitor build android` / `ionic build --prod --output-path=…` を単発実行する。

## 業務ルール
- スクリプトはリポジトリ内配布ではなく、開発者マシン上での Desktop への展開を前提とする。
- ソースを差し替えて再ビルドする場合は再度 `install-*` を実行するか、`build-*` 系のみを使う。

## 関連ノード
- 依存先: [[env.config.capacitor]]

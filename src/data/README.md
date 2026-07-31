# driving-score (src/data)

![CI](https://github.com/wtake4/ds-packages_rev2/actions/workflows/ci.yml/badge.svg?branch=main)

Ionic 7 + Angular 15 + Capacitor 4 の運転診断アプリ。

## セットアップ

### 1. Node.js

Angular 15 は Node.js 18 系が推奨。`.nvmrc` が同梱されている:

```bash
nvm install
nvm use
npm install --legacy-peer-deps
```

### 2. Google Maps API key

秘密鍵は **git 管理外** で供給する。**dev × 1 本 と prod × 1 本 = 合計 2 本** (ProjectSmith proposal #586 案 B)。同じ環境の Web と Android は同じキー値を共有し、Cloud Console 側の Application restrictions で HTTP referrer と Android package+SHA-1 の両方を許可する。

#### 配置場所

| 環境 | Web (JS) | Android Native |
|---|---|---|
| dev | `src/environments/environment.secrets.ts` の `mapsKey` | `android/local.properties` の `GOOGLE_MAPS_API_KEY` |
| prod | `src/environments/environment.prod.secrets.ts` の `mapsKey` | `android/local.properties.release` の `GOOGLE_MAPS_API_KEY` |

**4 箇所とも同じ環境内で同じキー値**（dev の 2 箇所は dev キー、prod の 2 箇所は prod キー）。**dev / prod をまたいだキーの流用は禁止** (fact #4580「REPLACE_ME はキー未設定時のみのフォールバック限定」に反する)。

#### 初期セットアップ

```bash
# Web dev
cp src/environments/environment.secrets.ts.example  src/environments/environment.secrets.ts
# → mapsKey に dev キーを書き込み

# Web prod (prod キー入手前はテンプレのプレースホルダのままにする)
cp src/environments/environment.prod.secrets.ts.example  src/environments/environment.prod.secrets.ts
# → prod キー入手後に mapsKey に prod キーを書き込み

# Android debug
cat >> android/local.properties <<'EOF'
GOOGLE_MAPS_API_KEY=AIzaSy...(dev キー)
EOF

# Android release (prod キー入手前は下記 REPLACE_ME のまま)
cat > android/local.properties.release <<'EOF'
GOOGLE_MAPS_API_KEY=REPLACE_ME
EOF
```

- 4 ファイルとも **`.gitignore` 済み**。commit されない
- `environment.(prod.)secrets.ts` は不在ならビルドが TypeScript コンパイル時に落ちる (秘密鍵の commit 混入を強制的に防止)
- `android/local.properties(.release)` は不在 or `REPLACE_ME` なら Manifest プレースホルダが `REPLACE_ME` となり、`gradle` は成功するが地図初期化は runtime に失敗する

CI (GitHub Actions) では GitHub Secret `GOOGLE_MAPS_API_KEY_DEV` を Android debug の `local.properties` に注入 (`ci.yml`) 。secrets ファイルはテンプレからコピーしてダミー値でビルド通過させる。

### 3. ビルド ↔ 環境ファイルの対応

**Debug ビルドは development configuration、Release ビルドは production configuration** にペアリング (ProjectSmith proposal #586 項目 2)。

| ビルド | Web `ng build --configuration` | 読取される JS secrets | Gradle | 読取される native key |
|---|---|---|---|---|
| Web dev server (`ionic serve`) | development (default) | `environment.secrets.ts` | - | - |
| **Android debug APK** | `--configuration development` | `environment.secrets.ts` (dev) | `assembleDebug` | `local.properties` (dev) |
| **Android release APK** | `--configuration production` | `environment.prod.secrets.ts` (prod) | `assembleRelease` | `local.properties.release` (prod) |

コマンド例:

```bash
# Web dev server
ionic serve                       # → dev キーで localhost:8100 起動

# Android debug APK (dev キー)
npx ng build --configuration development
npx cap sync android
(cd android && ./gradlew assembleDebug)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Android release APK (prod キー、prod キー未発行時は REPLACE_ME で build のみ通過)
npx ng build --configuration production
npx cap sync android
(cd android && ./gradlew assembleRelease)
```

### 4. BLE テスト用 emulator

車載機なしで運転診断を動かすときは `src/tools/ble-can-emulator/` を参照。

## API key 制限の推奨設定 (Google Cloud Console)

各キーを Application Restrictions で用途別に絞る:

| キー | 用途 | 推奨制限 |
|---|---|---|
| dev-web | dev 開発時の Web | HTTP referrers: `http://localhost:*/*`, dev ドメイン |
| prod-web | 本番 Web | HTTP referrers: 本番ドメインのみ |
| dev-android | debug APK | Android app: `jp.co.nissan.drivingscore` + debug keystore SHA-1 |
| prod-android | release APK | Android app: `jp.co.nissan.drivingscore` + release keystore SHA-1 |

> このリポジトリでは 「dev / prod × platform 共通 = 2 本」で運用しているため、
> それぞれのキーで Web / Android **両方の restriction を許可** している。
> より厳格に分ける場合は 4 本構成に拡張する。

## キーが誤って git に入ったら

1. 該当キーを Google Cloud Console で **即座に無効化 (delete)**
2. 新しいキーを発行し、`environment.secrets.ts` / `local.properties` に差し替え
3. `git log -S 'AIzaSy'` で漏洩範囲を確認、必要なら `git filter-repo` で履歴からも除去 + force-push

## CI (GitHub Actions)

`.github/workflows/ci.yml` に定義。ProjectSmith proposal #584 (auto_b) 準拠。

### トリガ

- `push` to `main`
- `pull_request` targeting `main`

### ジョブ構成

| Job | 内容 |
|---|---|
| `build-web` | npm ci → `ng lint` → `ng build` (development + production) |
| `unit-test` | `ng test --browsers=ChromeHeadlessCI --code-coverage` (Karma / Jasmine)。coverage レポートは artifact に |
| `android-build` | `ng build --configuration development` → `cap sync android` → `gradle assembleDebug`。APK は artifact に (`app-debug-apk`, 14 日保管)。dev configuration とペアリング (proposal #586) |

### GitHub Secrets

Android build ジョブは `secrets.GOOGLE_MAPS_API_KEY_DEV` を `android/local.properties` の `GOOGLE_MAPS_API_KEY` に注入する。

- 未設定 (fork PR や repo に secret が未登録) → `REPLACE_ME` フォールバックで build は通過するが地図初期化は失敗
- 設定推奨: Google Cloud で **CI 用の非本番キー** を発行し、Application restrictions を「Android app: `jp.co.nissan.drivingscore` + debug keystore SHA-1」に限定

登録方法:
```
Repo → Settings → Secrets and variables → Actions → New repository secret
Name: GOOGLE_MAPS_API_KEY_DEV
Value: AIzaSy...(CI 用非本番キー)
```

### 手元での CI 相当実行

```bash
# unit test を CI と同じ headless で
cd src/data
npx ng test --watch=false --browsers=ChromeHeadlessCI --code-coverage

# android debug ビルド (dev secrets + dev local.properties から)
npx ng build --configuration development
npx cap sync android
cd android && ./gradlew assembleDebug --no-daemon
```

### 今後の拡張

- coverage 閾値の gate 導入 (現状はレポート artifact のみ、閾値なし)
- `spec/qa/` の QA シナリオを unit / e2e に落とし込み CI job を追加
- Maestro によるモバイル E2E は現状ローカル運用、CI 統合は次フェーズで検討
- BLE emulator (`src/tools/ble-can-emulator`) は fact #4578 と proposal #584 の合意により CI 対象外

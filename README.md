# driving_score

運転診断アプリ（Ionic / Angular + Capacitor、Android 実機向け）と、その検証用ツール群のリポジトリ。

仕様の正本は **ProjectSmith** であり、このリポジトリ内のドキュメントは実装者向けの手引きである。
記述が Smith の応答と食い違った場合は Smith が正しい。詳細は `CLAUDE.md` を参照。

---

## clone 直後にやること

### 1. ProjectSmith への紐付け（`.smith` の生成）

`.smith` は **リポジトリで共有せず、各自が生成する**（proposal #21）。
clone 直後は存在しないので、最初に必ず bind すること。

```bash
projectsmith bind --repo-id <repository_id>
```

紐付けが正しいことを確認する。

```bash
projectsmith identity          # 人間が読む形
projectsmith identity --json   # 機械可読（repository_id / session_id / generation_number）
```

`usable: true` にならない場合、または「別のサーバ用です」と出る場合は、そこに書かれた ID を
使ってはならない。接続先を確認したうえで bind し直すこと。

> **なぜ共有しないのか**
>
> `.smith` は「どの Smith サーバのどのリポジトリ／セッションに紐づくか」という作業環境固有の
> 情報で、signature を含む。以前このファイルが追跡されていた際、別サーバ用の値
> （`repository_id=52` / 別リポジトリ）がコミットされたまま残り、clone した人が
> 他人のリポジトリを指す状態になっていた。proposal #21 でこれを追跡対象から外した。
>
> `.smith` を自分で開いて読んではならない。ID が必要なときは `projectsmith identity --json`
> を使う（`CLAUDE.md` §14-3-1）。

### 2. git hook の導入

commit-msg hook が proposal / fact ID の記載を必須化している。

```bash
bash scripts/install-githooks.sh
git config --get core.hooksPath   # .githooks になっていること
```

### 3. アプリのビルド環境

Node は `src/data/.nvmrc` に固定（18.19.1）。nvm で合わせる。

```bash
cd src/data
nvm use
npm ci --legacy-peer-deps
```

`environment.secrets.ts` は `.gitignore` 済み。テンプレートから作成する。

```bash
cp src/environments/environment.secrets.ts.example src/environments/environment.secrets.ts
cp src/environments/environment.prod.secrets.ts.example src/environments/environment.prod.secrets.ts
```

Google Maps API キーの扱いは proposal #6 を参照（開発／実機検証フェーズは
Maps JavaScript API 用と Maps SDK for Android 用で同一キーの共用を許容。供給経路は分離）。

Android 実機への導入は proposal #7 に従う。

```bash
npx cap run android --target <device>        # 正
# フォールバック
npx ng build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## ディレクトリ

| パス | 内容 |
|---|---|
| `src/data/` | Ionic / Angular アプリ本体（Capacitor / Android プロジェクトを含む） |
| `src/data/tools/` | 検証用ツール（BLE エミュレータ、モックセンサログ生成器） |
| `src/data/mock/` | 正準モックセンサログ 6 ファイル（proposal #10 / #12 / #13） |
| `src/tools/ble-can-emulator/` | BLE エミュレータ実装 B。**凍結**（proposal #16） |
| `spec/` | 仕様ドキュメント（recast 前のため古い可能性あり。正本は Smith） |
| `docs/` | 補助ドキュメント |
| `scripts/` | セットアップ・hook 導入スクリプト |

---

## 検証用ツール

### BLE 車載機エミュレータ

開発 PC（Linux）を BLE ペリフェラル化し、車載機（`DrivingCanData`）になりすまして
12 バイトの CAN パケットを notify する。実車・実車載機なしで BLE 受信経路を検証できる。

実装は 2 系統併存し、**既定は A**（proposal #16）。同時起動はできない。

| | パス | 状態 |
|---|---|---|
| A（既定） | `src/data/tools/ble-can-emulator.py` | Phase 1 = completed（proposal #20） |
| B（代替） | `src/tools/ble-can-emulator/` | 凍結。検証対象外 |

```bash
cd src/data
python3 tools/ble-can-emulator.py --source mock/sensor-log.cruise.canConnected.txt.gz --loop
```

使い方・BLE 契約・トラブルシュート・フェーズの定義は
`src/data/tools/ble-can-emulator.README.txt` に詳しい。

### モックセンサログ生成器

決定的（乱数なし）に 5 シナリオ × 2 モードのセンサログを生成する。再生成しても同一バイト列になる。

```bash
cd src/data
node tools/gen-mock-sensorlog.mjs --canonical   # 正準 6 ファイルを一括生成
```

---

## テスト

```bash
cd src/data
npx ng lint
npx ng build --configuration development
npx ng build --configuration production
CHROME_BIN=$(which chromium) npx ng test --watch=false --browsers=ChromeHeadlessCI
cd android && ./gradlew assembleDebug
```

CI（`.github/workflows/ci.yml`）も同じ内容を実行する。BLE エミュレータは CI 対象外。

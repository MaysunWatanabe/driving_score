# ホーム画面ウィジェット（A案）の退避資産

> **このディレクトリはメンテナンスしない。**
> 周辺コードの変更には追従させない。復活させる場合も、ここのファイルをそのまま使うのではなく、
> 当時の設計意図を読むための資料として扱うこと。正確に復元するなら tag `widget-native-a-plan` を使う。

- 退避日: 2026-10-02
- 根拠: proposal #359（撤去）/ proposal #361（退避方法）
- 対象ノード: `ui.widget.hiyari` / `env.config.capacitor`

---

## なぜ撤去したか

2026-10-02 の先方ミーティングで、ウィジェットの実現方式が **B案（アプリ内の「ウィジェット風の画面」）**
に確定したため。

資料『運転機能チェックアプリ_ミーティング_261002.pptx』スライド 3 より:

```
◎A案
ユーザーログインするとアプリがバックグラウンドに遷移して
androidのデスクトップにウィジェットを表示する
→デスクトップのウィジェットには地図表示ができない仕様のようです

◎B案
ユーザーログインするとアプリはそのままで
新画面に遷移して、ウィジェット風の画面を表示する
```

A案が落ちた理由は**技術制約**である。`2-1b`（ヒヤリ表示＋地図）がホーム画面ウィジェットでは成立しない。
`RemoteViews` は `TextView` / `ImageView` / `LinearLayout` / `ListView` 等しか扱えず、
`WebView` も `MapView` も置けないため、地図を描く手段が無い。

**この制約は恒久的であり、A案が復活する条件は基本的に無い。**
Android 側が RemoteViews で地図を扱えるようになるか、2-1b の地図要件が消えた場合に限られる。

## 撤回された fact

| fact | ノード | 内容 |
|---|---|---|
| `#4760` | `ui.widget.hiyari` | `AppWidgetProvider` / `updatePeriodMillis=0` の `appwidget-provider` 定義 / manifest の receiver / タップで `MainActivity` を起動する `PendingIntent` |
| `#4761` | `env.config.capacitor` | receiver と meta-data を `src/debug/AndroidManifest.xml` へ置き release に出さない |
| `#4765` | `ui.widget.hiyari` | `SharedPreferences`（`hiyari_widget` / `count` / `updatedAt`）と Capacitor プラグイン `HiyariWidget.update({count})` で件数を渡す |
| `#4770` | `ui.widget.hiyari` | 3 列 × 1 行（`minHeight=40dp` / `targetCellWidth=3` / `targetCellHeight=1`） |

### 撤回**されなかった**もの（B案でも使う表示仕様）

| fact | 内容 |
|---|---|
| `#4766` | 空状態も「0 件」と表示する（「—」は使わない） |
| `#4768` | 1 行目は対象日。描画時点の端末ローカル日付を `yyyy/M/d` で常に表示する |
| `#4769` | 並びは 日付 → ラベル → 件数 |

アイコンの切替（0 件＝緑 `#2E7D32` のチェック / 1 件以上＝紺 `#0B2D5B` の注意マーク）も B案で踏襲する。

## 動作していた範囲（実機検証済み）

端末 SH-M29 / Android 13 / debug ビルド。

- 本日のヒヤリ件数のリアルタイム更新（診断中に `1 → 2 → 3 → 4`、別走行で `5 → 6 → 7`）
- 診断終了後に DB の値と一致（`base` ＋ `pending` の二重計上を回避）
- 日付が変わったら 0 件に戻る（描画時のローカル日付比較）
- 深夜 0 時のアラームによる再描画（`AlarmManager.set()` / RTC / 不正確、追加権限なし）
- タップで `MainActivity` を起動
- 3 列 × 1 行（カード縦幅 600px → 283px を実測）
- release APK に receiver が含まれないことを `aapt2` で確認

**2026-10-01 に、実環境で深夜 0 時の日付切り替えが起きたことも確認している**
（9/30 の 7 件が繰り越されず、10/1 の 6 件が表示された）。

## ここに無いもの

既存ファイルへの数行の追記だったため、このディレクトリには含まれていない。

| 場所 | 内容 |
|---|---|
| `MainActivity.java` | `registerPlugin(HiyariWidgetPlugin.class)` と、そのための `onCreate` オーバーライド |
| `src/debug/AndroidManifest.xml` | receiver 宣言と `android.appwidget.provider` の meta-data |
| `res/values/strings.xml` | `widget_hiyari_label` / `widget_hiyari_title` / `widget_hiyari_count_format` |
| `driving.page.ts` | `registerPlugin` のインポート、`HiyariWidget` ハンドル、`updateHiyariWidget()` のプラグイン呼び出し |

`driving.page.ts` の**本日の件数算出ロジックは削除していない**。
`countTodayHiyari(pendingCount)` に改名して残してある（proposal #359）。
「DB に保存済みの本日ぶん ＋ 今回の走行でこれまでに検知したぶん」「診断終了後は `pendingCount=0`」
という規則は実機検証で確定したもので、作り直すと二重計上を再発させるため。

## 復元の起点

| 対象 | 参照 |
|---|---|
| 撤去前の最終状態 | tag **`widget-native-a-plan`**（= `5ee6428`） |
| 骨組みの実装 | PR #18（merge `3adb1a2`） |
| 実データ表示の実装 | PR #20（merge `5ee6428`） |
| 撤去の実装 | proposal #359 / #361 |

```bash
# 撤去前の全体を見る
git show widget-native-a-plan

# 宣言・呼び出しも含めて特定ファイルを戻す
git checkout widget-native-a-plan -- src/data/android/app/src/main/java/jp/co/nissan/drivingscore/MainActivity.java
git checkout widget-native-a-plan -- src/data/android/app/src/debug/AndroidManifest.xml
```

このディレクトリのファイルを `src/data/` 配下へ戻す場合は、
`docs/archive/widget-native-a-plan/android/...` の `android/` 以降の構成が
`src/data/android/...` と一致しているため、そのまま移せる。

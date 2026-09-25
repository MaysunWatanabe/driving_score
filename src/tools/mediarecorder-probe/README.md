# MediaRecorder Probe

ヒヤリ録画（前後 n 秒の切り出し）の実装前に、**端末の MediaRecorder / WebM の挙動を実測**するための単体ページ。

アプリ本体（`src/data/src/app/**`）には一切触れない。`driving.page.ts` の `loadVideo()` と同一の制約で録画し、`chunk[0] + 途中クラスタ` の切り出しを再現して、実装の前提が成り立つかを確かめる。

- 根拠: proposal **#239**（`standalone-probe` で実施すること、測定項目、合格条件）
- 関連: proposal **#227 / #228 / #230**、fact **#4635 / #4636 / #4638**

## 何を測るか

### 測定 1 — 切り出しファイルの `currentTime` の起点

WebM のクラスタは元ストリームのタイムスタンプを保持する。そのため、走行開始から `T` 秒後の区間を切り出したファイルの `videoElement.currentTime` が **0 起点に正規化されるとは限らない**。

| 結果 | 意味 |
|---|---|
| `zero-based` | proposal #228 の `file-relative`（fact #4635）がそのまま成立する。実装に進んでよい |
| `stream-based` | 0 起点で保存した値で seek しても当たらない。**#228 の再 propose が必要**（保存は相対秒のまま seek 時に `t_start` を足す案へ） |

ここが実装の分岐点。`markersVideoTime` の定義・DB 保存値・`seekVideo()` の経路がまとめて変わるため、**本実装の前に必ず確定させる**。

### 測定 2 — 冒頭が再生できるか

1 秒チャンクの先頭がキーフレームとは限らないため、`chunk[0] + 途中クラスタ` で組んだファイルの冒頭が崩れる可能性がある。proposal #227 §5-1 の合格条件。

### 併せて記録する値

1 秒チャンクの実サイズ（実効ビットレート）、`dataavailable` の発火間隔、リングバッファの上限見積もり。本実装のメモリ見積もりの根拠になる。

## 実行手順

カメラを使うため **secure context** が要る。`http://<LAN-IP>` は secure context にならないので、`adb reverse` で端末から `http://localhost` に見せる。

```bash
# 1. 端末が見えていることを確認
adb devices -l

# 2. サーバを起動（このディレクトリで）
./serve.py            # 既定 8765 番。./serve.py 9000 でポート変更

# 3. 別ターミナルで、端末の localhost:8765 をこのマシンへ転送
adb reverse tcp:8765 tcp:8765

# 4. 端末の Chrome で開く（クエリで自動実行。画面を一切タップしない）
adb shell "am start -a android.intent.action.VIEW \
  -n com.android.chrome/com.google.android.apps.chrome.Main \
  -d 'http://localhost:8765/?n=15&T=40&auto=1'"

# ↑ コマンド全体を " " で囲むこと。`&` は端末側のシェルが解釈するため、
#   ローカルのクォートだけでは URL が ?n=15 で切れて auto=1 が届かない。

# 5. WebView のバージョンを記録（proposal #239: Chrome との乖離確認のため）
adb shell dumpsys package com.google.android.webview | grep versionName | head -1
adb shell dumpsys package com.android.chrome        | grep versionName | head -1
```

初回のみカメラ/マイクの許可ダイアログが出る。「サイトへのアクセス時は許可」→ OS 側も
「アプリの使用時のみ」を選ぶ。2 回目以降は無人で走る。

計測は `T + n` 秒かかる。その間、端末を手に持って**少し動かす**（静止画だと測定 2 の
分散判定が鈍り、正常でも NG と出ることがある）。

終了すると結果が `POST /result` でサーバへ送られ、`results/YYYYMMDD-HHMMSS-nNN.md`
に保存される。**画面から読み取らないこと** — 戻るキーやタブ切り替えでページ内の
計測結果は消えるため。

`n` は既定 15 と最大 60 の**両方で実施する**（proposal #239 §5）。

```bash
# 2 回目（n=60 / T=90、所要 150 秒）
adb shell "am start -a android.intent.action.VIEW \
  -n com.android.chrome/com.google.android.apps.chrome.Main \
  -d 'http://localhost:8765/?n=60&T=90&auto=1'"
```

## 後片付け

```bash
adb reverse --remove tcp:8765
```

## 結果の扱い

`results/` に保存されたサマリを、**fact 候補として Smith に投入する**（proposal #239 §5: 測定値は実装判断の根拠になるため、会話や PR 本文に留めない）。

測定 1 が `stream-based` だった場合、**`markersVideoTime` に関わる実装には着手しない**（proposal #239 §5）。先に #228 / fact #4635 を再 propose する。

## 注意

- Chrome と Capacitor の WebView は同一の Chromium メディアスタックを共有するが、**同一プロセスではない**。バージョンが乖離している場合は proposal #239 の B 案（アプリ内計測）へ切り替える判断が要る。手順 5 で必ず両方のバージョンを記録すること
- 録画中は画面を消さない（バックグラウンドに回ると MediaRecorder が止まる端末がある）
- `n=60 / T=90` だと 150 秒かかる。ストレージではなくメモリに溜めるので、実行中にタブを閉じないこと

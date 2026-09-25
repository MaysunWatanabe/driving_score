#!/usr/bin/env python3
"""MediaRecorder Probe の静的サーバ + 結果受け口。

端末からは adb reverse 経由で http://localhost:<PORT> として開く（secure context 確保）。
計測ページは終了時に POST /result で結果を送ってくるので、画面を読まずに
results/ 配下のファイルから確認できる。

    ./serve.py [PORT]
"""

import datetime
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "results")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def do_POST(self):
        if self.path != "/result":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8", "replace")

        os.makedirs(RESULTS, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

        try:
            payload = json.loads(raw)
            n = payload.get("n", "x")
            name = f"{stamp}-n{n}"
            with open(os.path.join(RESULTS, name + ".json"), "w") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            with open(os.path.join(RESULTS, name + ".md"), "w") as f:
                f.write(payload.get("summary", ""))
            print(f"\n=== 結果を受信: results/{name}.md ===")
            print(payload.get("summary", ""))
            print("=" * 40, flush=True)
        except Exception as e:  # 壊れた入力でもサーバは落とさない
            with open(os.path.join(RESULTS, stamp + "-raw.txt"), "w") as f:
                f.write(raw)
            print(f"[WARN] JSON として読めなかった: {e}", flush=True)

        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # 計測のたびに古い JS を掴まないようにする
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"serving {HERE} on http://localhost:{port}")
    print(f"結果の保存先: {RESULTS}/")
    print()
    print("端末から開くには、別ターミナルで:")
    print(f"  adb reverse tcp:{port} tcp:{port}")
    print(f"  adb shell am start -a android.intent.action.VIEW \\")
    print(f"    -n com.android.chrome/com.google.android.apps.chrome.Main \\")
    print(f"    -d 'http://localhost:{port}/?n=15&T=40&auto=1'")
    print()
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()

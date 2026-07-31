#!/usr/bin/env bash
# BlueZ を通常状態に戻すリカバリスクリプト。
#
# 通常は run.sh の EXIT/INT/TERM trap が bluetoothd を復帰させるが、
# SIGKILL・ターミナル強制終了・クラッシュで trap が発火しなかった場合に
# bluetooth.service が masked のまま残る (reboot 後も起動しない)。
# そのとき手動で叩く: sudo ./restore-bluez.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "root で実行してください: sudo $0" >&2
  exit 1
fi

# 念のため残っている emulator プロセスを止める (通常は既に居ない)。
if pgrep -f driving_can_peripheral >/dev/null; then
  echo "[restore] killing lingering emulator process(es) ..."
  pkill -TERM -f driving_can_peripheral || true
  sleep 1
fi

echo "[restore] systemctl unmask bluetooth.service"
systemctl unmask bluetooth.service 2>/dev/null || true

echo "[restore] systemctl start bluetooth.service"
systemctl start bluetooth.service 2>/dev/null || true

echo "[restore] systemctl start obex.service"
systemctl start obex.service 2>/dev/null || true

sleep 1

echo ""
echo "[restore] final state:"
printf '  bluetooth.service : %s (%s)\n' \
  "$(systemctl is-active bluetooth.service 2>&1)" \
  "$(systemctl is-enabled bluetooth.service 2>&1)"
printf '  obex.service      : %s\n' \
  "$(systemctl is-active obex.service 2>&1)"
printf '  hci0              : %s\n' \
  "$(hciconfig hci0 2>/dev/null | awk 'NR==3{$1=$1; print}')"

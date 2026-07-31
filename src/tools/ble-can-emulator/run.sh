#!/usr/bin/env bash
# DrivingCanData BLE ペリフェラルを起動するラッパー。
#
#   1) BlueZ を停止(bluetooth off)してアダプタを解放
#   2) bumble ペリフェラルを起動(publish / advertising)
#   3) 終了時(Ctrl-C 等)に BlueZ を復帰
#
# 要 root: sudo ./run.sh [hci_index]   (省略時 hci0)
set -euo pipefail

HCI="${1:-0}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PY="$DIR/venv/bin/python"

if [ "$(id -u)" -ne 0 ]; then
  echo "root で実行してください: sudo $0 $HCI" >&2
  exit 1
fi

if [ ! -x "$PY" ]; then
  echo "venv が見つかりません。先に作成してください:" >&2
  echo "  cd $DIR && python3 -m venv venv && venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

restore_bluez() {
  echo ""
  echo "[run] restoring BlueZ (unmask + start) ..."
  # Undo the mask we set at start-up so a normal reboot behaves as before.
  systemctl unmask bluetooth.service 2>/dev/null || true
  # bluetoothd will bring hci$HCI back up itself on start.
  systemctl start bluetooth.service 2>/dev/null || true
  systemctl start obex.service 2>/dev/null || true
}
trap restore_bluez EXIT INT TERM

# Mask bluetooth.service before stopping so systemd cannot restart it while we
# are bringing hci down. On some Ubuntu/Debian setups a device unit
# (`sys-subsystem-bluetooth-devices-hci0.device`) or a Wants= edge fires
# `bluetooth.service` back the moment we take hci down, which races with our
# `hciconfig down` and leaves the adapter UP right when bumble tries to bind.
echo "[run] masking bluetooth.service to prevent auto-restart ..."
systemctl mask bluetooth.service 2>/dev/null || true

# Best-effort: power controller off through mgmt API so kernel sets
# HCI_AUTO_OFF (bumble can then bind HCI_CHANNEL_USER even if the interface
# comes back UP).
if command -v bluetoothctl >/dev/null; then
  echo "[run] powering controller off via bluetoothctl (best effort) ..."
  timeout 3 bluetoothctl -- power off 2>/dev/null || true
fi

echo "[run] stopping BlueZ (bluetooth off) to release hci$HCI ..."
systemctl stop bluetooth.service 2>/dev/null || true
# Also stop obexd -- it doesn't touch HCI directly but keeps a mgmt socket
# open to bluetoothd, and stopping it prevents systemd from trying to keep
# the bluetooth stack alive.
systemctl stop obex.service 2>/dev/null || true
sleep 1

# bumble opens hci-socket via HCI_CHANNEL_USER, which requires either
# HCI_UP=0 or HCI_AUTO_OFF=1. Try to force hci$HCI down and re-verify -- on
# this machine something re-ups the interface within ~1s of bluetoothd exit,
# so we retry up to 5x with 2s waits and only proceed once state is DOWN.
bring_down() {
  local i state
  for i in 1 2 3 4 5; do
    hciconfig "hci$HCI" down || true
    sleep 2
    state=$(hciconfig "hci$HCI" 2>/dev/null | awk 'NR==3{print $1}')
    echo "[run] attempt $i: hci$HCI state = ${state:-unknown}"
    if [ "$state" = "DOWN" ]; then
      return 0
    fi
  done
  return 1
}

echo "[run] bringing hci$HCI down (required for HCI_CHANNEL_USER bind) ..."
if ! bring_down; then
  echo ""
  echo "ERROR: hci$HCI keeps coming back UP after 5 attempts."         >&2
  echo "       Something outside this script is auto-managing it."     >&2
  echo "       Likely candidates: another daemon, a systemd device"    >&2
  echo "       unit, or a udev rule. Investigate with:"                >&2
  echo "         systemctl list-units --all | grep hci"                >&2
  echo "         udevadm monitor -k -s bluetooth"                      >&2
  exit 1
fi

echo "[run] final hci$HCI state:"
hciconfig "hci$HCI" 2>&1 | head -4 || true

echo "[run] publishing DrivingCanData peripheral on hci$HCI ..."
exec "$PY" "$DIR/driving_can_peripheral.py" "$HCI"

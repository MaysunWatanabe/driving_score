#!/usr/bin/env python3
"""
DrivingCanData BLE ペリフェラル・エミュレータ (bumble)

Linux ホストを、driving-score アプリが接続する車載機 "DrivingCanData" の
代わりの BLE ペリフェラルにする。実機(Android)アプリはこのデバイスに接続し、
Notify で流れてくる 12 バイトの合成 CAN フレームを受信する。

- ローカル名 : DrivingCanData      (アプリの scan フィルタ条件)
- Service    : 0x2310 (16bit -> 00002310-0000-1000-8000-00805f9b34fb)
- Notify Char: 0x2311
- 12 バイト固定フォーマット (sensor.service / can-decode.ts の decodeCanFrame と対応):
    [0] vehicleSpeed  (uint8)
    [1] longAcc       (uint8)  値 = b*0.01 - 1.28
    [2] latAcc        (uint8)  値 = b*0.01 - 1.28
    [3] frontDistance (uint8)  値 = b*0.5
    [4] lateralDistance(uint8) 値 = b*0.5 - 64
    [5..6] steeringAngle (uint16 BE) 値 = v*0.1 - 1080
    [7] accelPedalPosition (uint8)
    [8] brakePressure (uint8)
    [9] brakeSwitch   (uint8)
    [10] shiftIndication (uint8)
    [11] turnSignal   (uint8)

前提: BlueZ からアダプタを解放しておくこと(sudo systemctl stop bluetooth)。
実行: sudo venv/bin/python driving_can_peripheral.py [hci_index]
"""
import asyncio
import math
import struct
import sys

from bumble.device import Device
from bumble.transport import open_transport_or_link
from bumble.gatt import Service, Characteristic
from bumble.core import AdvertisingData
from bumble.hci import Address

CAN_SERVICE_UUID = '00002310-0000-1000-8000-00805f9b34fb'
CAN_NOTIFY_UUID = '00002311-0000-1000-8000-00805f9b34fb'
DEVICE_NAME = 'DrivingCanData'
NOTIFY_INTERVAL_SEC = 0.1  # 100ms 周期で送信


def build_can_frame(t: float) -> bytes:
    """時間 t に応じて変化する 12 バイトの合成 CAN フレームを作る。"""
    vehicle_speed = int(40 + 20 * (0.5 + 0.5 * math.sin(t * 0.5)))
    long_acc_b = int(128 + 40 * math.sin(t))
    lat_acc_b = int(128 + 30 * math.cos(t))
    front_distance_b = int(60 + 40 * (0.5 + 0.5 * math.sin(t * 0.3)))
    lateral_distance_b = 128
    steering_raw = int(10800 + 2000 * math.sin(t * 0.7))
    accel_pedal = int(30 + 20 * (0.5 + 0.5 * math.sin(t)))
    brake_pressure = int(max(0, 40 * math.sin(t * 0.9)))
    brake_switch = 1 if math.sin(t * 0.9) > 0.6 else 0
    shift_indication = 4
    turn_signal = int(t) % 3

    def u8(v: int) -> int:
        return max(0, min(255, v))

    return struct.pack(
        '>BBBBBHBBBBB',
        u8(vehicle_speed),
        u8(long_acc_b),
        u8(lat_acc_b),
        u8(front_distance_b),
        u8(lateral_distance_b),
        max(0, min(0xFFFF, steering_raw)),
        u8(accel_pedal),
        u8(brake_pressure),
        u8(brake_switch),
        u8(shift_indication),
        u8(turn_signal),
    )


async def main():
    hci_index = sys.argv[1] if len(sys.argv) > 1 else '0'
    transport_spec = f'hci-socket:{hci_index}'
    print(f'[emulator] opening transport {transport_spec} ...')

    async with await open_transport_or_link(transport_spec) as (hci_source, hci_sink):
        # public アドレスタイプで広告する(Android/capacitor-ble は addressType=public で
        # 接続してくるため、random 扱いだと GATT 接続確立に失敗する: status 0x3E)
        device = Device.with_hci(
            DEVICE_NAME,
            Address('F0:F1:F2:F3:F4:F5', Address.PUBLIC_DEVICE_ADDRESS),
            hci_source,
            hci_sink,
        )

        notify_char = Characteristic(
            CAN_NOTIFY_UUID,
            Characteristic.Properties.NOTIFY,
            Characteristic.READABLE,
            bytes(12),
        )
        device.add_service(Service(CAN_SERVICE_UUID, [notify_char]))

        # 広告データにローカル名を載せる(アプリの scan フィルタは name 一致)
        device.advertising_data = bytes(
            AdvertisingData([
                (AdvertisingData.COMPLETE_LOCAL_NAME, DEVICE_NAME.encode('utf-8')),
                (AdvertisingData.INCOMPLETE_LIST_OF_16_BIT_SERVICE_CLASS_UUIDS,
                 struct.pack('<H', 0x2310)),
            ])
        )

        await device.power_on()
        await device.start_advertising(auto_restart=True)
        print(f'[emulator] advertising as "{DEVICE_NAME}" '
              f'(service 0x2310 / notify 0x2311). Ctrl-C to stop.')

        t = 0.0
        while True:
            frame = build_can_frame(t)
            await device.notify_subscribers(notify_char, frame)
            if int(round(t * 10)) % 10 == 0:
                print(f'[emulator] t={t:5.1f} frame={frame.hex()}')
            t += NOTIFY_INTERVAL_SEC
            await asyncio.sleep(NOTIFY_INTERVAL_SEC)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\n[emulator] stopped.')

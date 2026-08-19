//https://github.com/capacitor-community/bluetooth-le
import { AlertInput, AlertController } from "@ionic/angular";
import { BleClient, ScanResult, TimeoutOptions, numberToUUID } from '@capacitor-community/bluetooth-le';
import { LogService } from '../services/log.service';

export class BLEDeviceInfo {
  public deviceId: string = '';
  public service: string = '';
  public characteristic: string = '';
  constructor(deviceId: string, service: string, characteristic: string) {
    this.deviceId = deviceId;
    this.service = service;
    this.characteristic = characteristic;
  }
}

export class BLEDevice {

  private static BLE_SERVICE: string = numberToUUID(0x2310);
  private static BLE_CHARACTERISTIC_NOTIFY: string = numberToUUID(0x2311);
  private static BLE_DEVICE_ID: string = 'D8:3A:DD:6A:A2:15';
  private static BLE_DEVICE_NAME: string = 'DrivingCanData';

  private bluetoothFunc: any = null;
  private scanDeviceIds: Array<string> = Array<string>();
  private connectDevices: Array<BLEDeviceInfo> = Array<BLEDeviceInfo>();

  private timer: any = null;

  constructor(
    private logService: LogService,
    private alertController: AlertController) {
  }

  /**
   * BLE接続を開始する
   *
   * @param bluetoothFunc - 取得したデータを受け渡すコールバック関数
   * @returns 実行の成否のPromise
   */
  public async start(bluetoothFunc: (buffer: ArrayBuffer ) => void) : Promise<boolean> {
    this.logService.debug('[DrivingScore][BLEDevice]start');
    try {
      this.bluetoothFunc = bluetoothFunc;

      await BleClient.initialize();
      await BleClient.isEnabled(); //念のためBLEを有効化する
      await this.scanStart();

    } catch (error) {
      this.logService.error('[DrivingScore][BLEDevice]start failed', error);
      await this.showStartErrorDialog();
      return false;
    }
    return true;
  }

  /**
   * BLE接続を終了する
   */
  public async stop() {
    this.logService.debug('[DrivingScore][BLEDevice]stop');
    this.bluetoothFunc = null;

    try {
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    } catch (error) {
      this.logService.error('[DrivingScore][BLEDevice]stop clearInterval failed', error);
    }

    try {
      await BleClient.stopLEScan();
    } catch (error) {
      this.logService.error('[DrivingScore][BLEDevice]stop stopLEScan failed', error);
    }

    for (const device of this.connectDevices) {
      try {
        await BleClient.stopNotifications(device.deviceId, device.service, device.characteristic);
      } catch (error) {
        this.logService.error('[DrivingScore][BLEDevice]stop stopNotifications failed', error);
      }
      try {
        await BleClient.disconnect(device.deviceId);
      } catch (error) {
        this.logService.error('[DrivingScore][BLEDevice]stop disconnect failed', error);
      }
    }
    this.connectDevices.splice(0);
  }

  /**
   * BLEデバイスに接続して、Notify接続を開始する
   *
   * @param deviceId - BLEデバイスのID
   * @returns void
   */
  private async connect(deviceId: string) {
    try {
      await BleClient.disconnect(deviceId); // 念のため切断してから接続する
      await BleClient.connect(deviceId, async (deviceId) => { /*Disconnect*/ }, {timeout: 10000});

      const deviceInfo = new BLEDeviceInfo(deviceId, BLEDevice.BLE_SERVICE, BLEDevice.BLE_CHARACTERISTIC_NOTIFY);
      this.connectDevices.push(deviceInfo);

      // connect() はサービス探索の完了を待たずに解決することがある
      // （Androidが接続確立時に自発的にMTU交換を行い、プラグインがそのコールバックで
      //   connect を解決するため）。探索前に startNotifications を呼ぶと
      //   Characteristic not found で失敗するので、明示的に探索完了を待つ。
      await BleClient.discoverServices(deviceId);

      await this.startNotification(deviceInfo);

    } catch (error) {
      this.logService.error('[DrivingScore][BLEDevice]connect', deviceId);
      // 切断せずに残すと、ペリフェラルが広告を再開せず再スキャンで見つからなくなり、
      // 次回 connect 冒頭の disconnect もタイムアウトするため、必ず切断してから通知する
      try {
        await BleClient.disconnect(deviceId);
      } catch (disconnectError) {
        this.logService.error('[DrivingScore][BLEDevice]connect disconnect failed', disconnectError);
      }
      await this.showConnectFailedDialog();
    }
  }

  /**
   * BLEデバイスを探す
   */
  private async scanStart() {
    this.logService.debug('[DrivingScore][BLEDevice]scanStart');
    this.scanDeviceIds.splice(0);
    var self = this;
    await BleClient.requestLEScan({services: []},
      async (result: any) => {
        /*{
          "device":{"deviceId":"D8:3A:DD:6A:A2:15","name":"DrivingCanData"},
          "localName":"DrivingCanData",
          "rssi":-44,
          "txPower":127,
          "manufacturerData":{},
          "serviceData":{},
          "uuids":[],
          "rawAdvertisement":{}}
        */
        if (result.device !== undefined && result.device.name === BLEDevice.BLE_DEVICE_NAME) {
          self.logService.debug('[DrivingScore][BLEDevice]requestLEScan', result);
          // 複数のBLEデバイスがあるかもしれないので、一覧にためてから処理する
          self.scanDeviceIds.push(result.device.deviceId);
        }
      }
    );
    this.timer = setTimeout(async () => {
      self.logService.debug('[DrivingScore][BLEDevice]scanStop');
      if (self.bluetoothFunc !== null) {
        await BleClient.stopLEScan();

        if (self.scanDeviceIds.length == 0) {
          await self.showConnectFailedDialog();

        } if (self.scanDeviceIds.length == 1) {
          // デバイスがひとつなら接続
          await self.connect(self.scanDeviceIds[0]);

        } else if (self.scanDeviceIds.length > 1) {
          // デバイスが複数なら選択ダイアログを表示
          await self.showConnectDialog();
        }

      }
    }, 3000);
  }

  /**
   * BLEデバイスとNotify通信を開始する
   *
   * @param deviceId - BLEデバイス情報
   * @returns void
   */
  private async startNotification(device: BLEDeviceInfo) {
    this.logService.debug('[DrivingScore][BLEDevice]startNotification', device);
    var self = this;
    await BleClient.startNotifications(device.deviceId, device.service, device.characteristic,
      (value) => {
        if (self.bluetoothFunc !== null) {
          self.bluetoothFunc(value.buffer);
        }
      }
    );
  }

  private async showStartErrorDialog() {
    var self = this;
    const alert = await this.alertController.create({
      header: 'Bluetoothの接続確認',
      cssClass: 'custom-alert',
      //subHeader: '運転お疲れ様でした。',
      message: 'Bluetoothが無効になっています。\n端末の設定でBluetoothを有効にしてください。',
      buttons: [
        { text: '閉じる', cssClass: 'alert-button-confirm', role: 'confirm', handler: () => {  } }
      ]
    });
    await alert.present();
  }

  /**
   * BLEデバイスの接続先を選択するダイアログを表示する
   * （BLEデバイスが複数ある場合に利用する関数）
   */
  private async showConnectDialog() {
    const inputs = Array<AlertInput>();
    for (const deviceId of this.scanDeviceIds) {
      let label = deviceId + ' (' + BLEDevice.BLE_DEVICE_NAME + ')';
      if (inputs.length === 0) {
        inputs.push({ name: deviceId, label: label, type: 'radio', value: deviceId, checked: true });
      } else {
        inputs.push({ name: deviceId, label: label, type: 'radio', value: deviceId });
      }
    }

    var self = this;
    const alert = await this.alertController.create({
      header: 'Bluetoothの接続先を選択',
      cssClass: 'custom-alert',
      inputs: inputs,
      buttons: [
        { text: 'キャンセル', role: 'cancel', handler: data => {
          self.logService.debug('[DrivingScore][BLEDevice] showConnectDialog: Cancel clicked');
        }},
        { text: 'OK', cssClass: 'alert-button-confirm', handler: data => {
          self.logService.debug('[DrivingScore][BLEDevice] showConnectDialog: OK clicked');
          self.connect(data);
        }}
      ]
    });
    await alert.present();
  }

  /**
   * ログイン失敗ダイアログを表示
   */
  private async showConnectFailedDialog() {
    var self = this;
    const alert = await this.alertController.create({
      header: 'Bluetooth接続に失敗しました。',
      cssClass: 'custom-alert',
      buttons: [
        { text: '閉じる', role: 'confirm', handler: () => { } },
        { text: 'リトライ', cssClass: 'alert-button-confirm', handler: data => {
          self.scanStart();
        }}
      ]
    });
    await alert.present();
  }
}
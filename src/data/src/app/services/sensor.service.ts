import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController } from "@ionic/angular";
import { Subscription } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Motion } from '@capacitor/motion';
import { PluginListenerHandle } from '@capacitor/core';
import { Storage } from '@ionic/storage-angular';

import { Geolocation, PositionOptions, Position, GeolocationPluginPermissions } from '@capacitor/geolocation';
import { DeviceMotion, DeviceMotionAccelerationData } from '@awesome-cordova-plugins/device-motion/ngx';
import { Magnetometer, MagnetometerReading } from '@awesome-cordova-plugins/magnetometer/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';

import { DemoData } from '../data/demo-data';
import { SensorManager } from '../data/sensor-manager';
import { BLEDevice, BLEDeviceInfo } from '../data/ble';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SensorService {

  private magnetometerSubscription: Subscription;

  private onMotionEvent : any;
  private onOrientationEvent : any;

  private geolocationCallbackId: string = '';

  private lastGeolocation: any = null;
  private lastAcceleration: any = null;
  private lastGyroscope: any = null;
  private lastMagnetometer: any = null;
  private lastCanData: any = null;

  private sensorTimer: any;
  private sensorListenerFunc: any;

  private demoData: DemoData;

  private startTimestamp: number = 0;
  private lastSensorTime: number = 0;

  private runScoreLogic: boolean = false;

  private cordovaAvailable: boolean;

  private bleDevice: BLEDevice;

  // コンストラクタ
  constructor(
    private deviceMotion: DeviceMotion,
    private magnetometer: Magnetometer,
    private alertController: AlertController,
    private http: HttpClient,
    private storage: Storage,
    private loginService: LoginService,
    private logService: LogService) {

    this.cordovaAvailable = Capacitor.getPlatform() == 'android';

    this.storage.create();

    this.bleDevice = new BLEDevice(this.logService, this.alertController);//, this.ble);
  }

  /**
   * センサー情報の取得開始
   */
  public start(sensorListenerFunc: any) {
    this.logService.debug('[DrivingScore][SensorService] start: device='+Capacitor.getPlatform());

    this.sensorListenerFunc = sensorListenerFunc;

    this.startSensorTimer();

    if (this.cordovaAvailable) {
      this.logService.debug('[DrivingScore][SensorService] start sensor handler');
      // GPS
      this.initializeGeolocationListener();
      // 加速度計
      this.initializeAccelerationListener();
      // ジャイロスコープ
      this.initializeGyroscopeListener();
      // 磁力計
      this.initializeMagnetometerListener();
      // BLE
      this.initializeBluetooth();

    } else {

      // センサーデモデータあり
      const sensorData = DemoData.instance().getSensorLogData();
      if (sensorData !== undefined) {
        const saveData = {
          lat: sensorData.geolocation.latitude,
          lng: sensorData.geolocation.longitude
        };
        this.storage.set(environment.geolocationLastPosKey, JSON.stringify(saveData));
      }
    }
  }

  /**
   * センサー情報の取得終了
   */
  public stop() {
    this.logService.debug('[DrivingScore][SensorService] stop');

    // 運転診断を終了
    this.stopScoreLogic();

    // センサー情報の通知を停止
    clearInterval(this.sensorTimer);

    if (this.geolocationCallbackId != '') {
      Geolocation.clearWatch({id: this.geolocationCallbackId});
      this.geolocationCallbackId = '';
    }

    if (this.magnetometerSubscription != null) {
      this.magnetometerSubscription.unsubscribe();
    }

    if (this.onMotionEvent != null) {
      window.removeEventListener("devicemotion", this.onMotionEvent, true);
      this.onMotionEvent = null;
    }

    if (this.onOrientationEvent != null) {
      window.removeEventListener("deviceorientationabsolute", this.onOrientationEvent, true);
      this.onOrientationEvent = null;
    }

    if (this.cordovaAvailable)
      this.bleDevice.stop();
  }

  /**
   * 運転診断開始
   */
  public startScoreLogic() {
    this.logService.debug('[DrivingScore][SensorService] startScoreLogic');

    this.runScoreLogic = true;
    this.startTimestamp = Date.now();

    // キャリブレーション情報をクリア
    SensorManager.initializeCalibration();

    // センサー情報のデモデータをリセット
    DemoData.instance().reset();
  }

  /**
   * 運転診断終了
   */
  public stopScoreLogic() {
    this.runScoreLogic = false;
  }

  public getLastSensorTime(): number {
    return this.lastSensorTime;
  }

  /**
   * 過去に取得できた一番新しい位置情報を取得
   */
  public async getLastLatLng(): Promise<any> {
    const lastPos = await this.storage.get(environment.geolocationLastPosKey);
    if (lastPos != null) {
      return JSON.parse(lastPos);
    }
    return { lat: 35.46360426879202, lng: 139.62615701335773 };
  }

  /**
   * GPS
   */
  private async initializeGeolocationListener() {
    this.lastGeolocation = null;
    /*
    const status = await Geolocation.checkPermissions();
    this.logService.debug('[DrivingScore][SensorService] initializeGeolocationListener 1', status);
    const newStatus = await Geolocation.requestPermissions();
    this.logService.debug('[DrivingScore][SensorService] initializeGeolocationListener 2', newStatus);
    */
    var self = this;
    const option = { maximumAge: environment.geolocationMaximumAge, timeout: environment.geolocationTimeout, enableHighAccuracy: true };
    //this.geolocationSubscription = await this.geolocation.watchPosition(option).subscribe((data: any) => {
    this.geolocationCallbackId = await Geolocation.watchPosition(option, (data: Position | null, err?: any) => {
      if( data !== null && data.coords ) {
        self.lastGeolocation = {
          latitude : data.coords.latitude,
          longitude : data.coords.longitude,
          accuracy : data.coords.accuracy,
          altitude : data.coords.altitude,
          altitudeAccuracy : data.coords.altitudeAccuracy,
          heading : data.coords.heading,
          speed : data.coords.speed,
          repeat: -1
        };

        const sensorData = {
          geolocation: self.lastGeolocation
        };
        self.sensorListenerFunc('Geolocation', sensorData, true);

        const saveData = {
          lat: data.coords.latitude,
          lng: data.coords.longitude
        };
        self.storage.set(environment.geolocationLastPosKey, JSON.stringify(saveData));
      } else {
        //const positionError = (data as GeolocationPositionError);
        const positionError = err;
        self.logService.error('[DrivingScore][SensorService] initializeGeolocationListener', positionError);
      }
    });
  }

  /**
   * 加速度計
   * 端末をどの向きにしても、動かさないと「x, y, z」は「0, 0, 0」になる
   * 止まっていても「0, 0, 0」の通知が常に飛んでくる
   */
  private async initializeAccelerationListener() {
    this.lastAcceleration = null;
    var self = this;
    this.onMotionEvent = (data: any) => {
      try {
        if (!self.runScoreLogic) {
          return;
        }

        //let x = data.acceleration.x;
        //let y = data.acceleration.y;
        //let z = data.acceleration.z;
        let gravity_x = data.accelerationIncludingGravity.x;
        let gravity_y = data.accelerationIncludingGravity.y;
        let gravity_z = data.accelerationIncludingGravity.z;
        let beta = data.rotationRate.beta;
        let gamma = data.rotationRate.gamma;
        let alpha = data.rotationRate.alpha;
        let interval = data.interval;

        if (self.lastAcceleration !== null && self.lastAcceleration.repeat == -1) {
          // 処理が追いついていないため、前回の値で平均値に置き換える
          //x = (x + self.lastAcceleration.x) / 2.0;
          //y = (y + self.lastAcceleration.y) / 2.0;
          //z = (z + self.lastAcceleration.z) / 2.0;
          gravity_x = (gravity_x + self.lastAcceleration.accelerationIncludingGravity.x) / 2.0;
          gravity_y = (gravity_y + self.lastAcceleration.accelerationIncludingGravity.y) / 2.0;
          gravity_z = (gravity_z + self.lastAcceleration.accelerationIncludingGravity.z) / 2.0;
          beta  = (beta  + self.lastAcceleration.rotationRate.beta)  / 2.0;
          gamma = (gamma + self.lastAcceleration.rotationRate.gamma) / 2.0;
          alpha = (alpha + self.lastAcceleration.rotationRate.alpha) / 2.0;
          interval = interval + self.lastAcceleration.interval;
        }

        // アプリで利用するセンサー情報を作成
        self.lastAcceleration = {
          /*x : x,
          y : y,
          z : z,*/
          accelerationIncludingGravity: {
            x : gravity_x, y : gravity_y, z : gravity_z,
          },
          rotationRate: {
            beta : beta, gamma: gamma, alpha: alpha,
          },
          interval: interval,
          repeat: -1
        };
      } catch (error) {
        self.logService.error('[DrivingScore][SensorService] onOrientationEvent', error);
      }
    };
    window.addEventListener("devicemotion", this.onMotionEvent, true);
  }

  /**
   * ジャイロスコープ
   *　端末の向きに合わせた値が取得できる
   * 端末を動かさないと通知は飛んでこない
   * 「x, y, z」の代わりに「beta, gamma, alpha」の値が取得できる
   */
  private async initializeGyroscopeListener() {
    this.lastGyroscope = null;
    var self = this;
    this.onOrientationEvent = (data: any) => {
      try {
        if (!self.runScoreLogic) {
          return;
        }

        let beta  = data.beta;
        let gamma = data.gamma;
        let alpha = data.alpha;
        if (self.lastGyroscope !== null && self.lastGyroscope.repeat == -1) {
          // 処理が追いついていないため、前回の値で平均値に置き換える
          beta  = (beta  + self.lastGyroscope.beta)  / 2.0;
          gamma = (gamma + self.lastGyroscope.gamma) / 2.0;
          alpha = (alpha + self.lastGyroscope.alpha) / 2.0;
        }

        self.lastGyroscope = {
          beta : beta, gamma : gamma, alpha : alpha,
          repeat: -1
        };
      } catch (error) {
        self.logService.error('[DrivingScore][SensorService] onOrientationEvent', error);
      }
    };
    window.addEventListener("deviceorientationabsolute", this.onOrientationEvent, true);
  }

  /**
   * 磁力計
   *　端末の向きに合わせた値が取得できる
   * 止まっていても通知が常に飛んでくる
   */
  private async initializeMagnetometerListener() {
    this.lastMagnetometer = null;
    var self = this;
    this.magnetometerSubscription = await this.magnetometer.watchReadings().subscribe((data: MagnetometerReading) => {
      if (!self.runScoreLogic) {
        return;
      }

      let x = data.x;
      let y = data.y;
      let z = data.z;
      if (self.lastMagnetometer !== null && self.lastMagnetometer.repeat == -1) {
        // 処理が追いついていないため、前回の値で平均値に置き換える
        x = (x + self.lastMagnetometer.x) / 2.0;
        y = (y + self.lastMagnetometer.y) / 2.0;
        z = (z + self.lastMagnetometer.z) / 2.0;
      }

      self.lastMagnetometer = {
        x : x,
        y : y,
        z : z,
        repeat: -1
      };
    });
  }

  /**
   * BLEで車載機に接続
   */
  private async initializeBluetooth() {
    this.lastCanData = null;
    this.logService.debug('[DrivingScore][SensorService]', this.loginService.settings.selectedSensorMode);
    if (this.loginService.settings.selectedSensorMode === 'smartphoneOnly') {
      return;
    }
    var self = this;
    const bluetoothEnable = await this.bleDevice.start((buffer: ArrayBuffer ) =>{
      const dv = new DataView(buffer);
      let vehicleSpeed       = (dv.getUint8(0) * 1);
      let longAcc            = (dv.getUint8(1) * 0.01) - 1.28;
      let latAcc             = (dv.getUint8(2) * 0.01) - 1.28;
      let frontDistance      = (dv.getUint8(3) * 0.5);
      let lateralDistance    = (dv.getUint8(4) * 0.5) - 64;
      let steeringAngle      = (dv.getUint16(5, false) * 0.1) - 1080;
      let accelPedalPosition = (dv.getUint8(7) * 1);
      let brakePressure      = (dv.getUint8(8) * 1);
      let brakeSwitch        = dv.getUint8(9);
      let shiftIndication    = dv.getUint8(10);
      let turnSignal         = dv.getUint8(11);

      self.lastCanData = {
        vehicleSpeed: vehicleSpeed,
        longAcc: longAcc,
        latAcc: latAcc,
        frontDistance: frontDistance,
        lateralDistance: lateralDistance,
        steeringAngle: steeringAngle,
        accelPedalPosition: accelPedalPosition,
        brakePressure: brakePressure,
        brakeSwitch: brakeSwitch,
        shiftIndication: shiftIndication,
        turnSignal: turnSignal,
        repeat: -1
      };
      self.logService.debug('[DrivingScore][SensorService]', self.lastCanData);
    });
  }

  /**
   * 定期的にセンサー情報を集めて運転診断に渡す
   */
  private startSensorTimer() {
    this.logService.debug('[DrivingScore][SensorService] startSensorTimer');
    var self = this;
    var sensorCount = 10;
    this.sensorTimer = setInterval(function() {
      if (!self.runScoreLogic) {
        return;
      }

      try {
        var sensorData;
        // デモ／実センサーの切替閾値は 0。センサログが 1 レコードでも積まれていれば
        // デモ再生、0 件なら実センサーを使う (proposal #10)
        if (DemoData.instance().getSensorLogDataSize() <= 0) {
          // 起動時ゲートは selectedSensorMode 別 (proposal #28)
          //   canDataOnly    : GPS + canData
          //   smartphoneOnly : GPS + 加速度計 + 方位 + 磁力計
          //   combination    : 両方
          // GPS は全モード必須。地図表示・ヒヤリ地点の座標・車両マーカーの向き
          // (geolocation.heading) に要るため。
          const mode = self.loginService.settings.selectedSensorMode;
          const needPhoneSensors = (mode === 'smartphoneOnly' || mode === 'combination');
          const needCanData      = (mode === 'canDataOnly'    || mode === 'combination');

          if (self.lastGeolocation === null) {
            return;
          }
          if (needPhoneSensors
            && (self.lastAcceleration === null
              || self.lastGyroscope === null
              || self.lastMagnetometer === null)) {
            return;
          }
          if (needCanData && self.lastCanData === null) {
            return;
          }

          // ゲート対象外のセンサーが未取得なら構造を保ったゼロ値で埋める (proposal #30)
          // キーを欠落させたり null を入れたりしない。レコード形式が
          // middleware.log.service の実機書出形式と共通で、DemoData の必須キー判定と
          // モックの正準形 (proposal #10) がこの形式に依存しているため。
          // ★ ゲートの後で行うこと。前に置くと必須センサーの null を隠してしまう。
          if (!needPhoneSensors) {
            if (self.lastAcceleration === null) {
              // interval を 0 にしてはならない。SensorManager が
              // calibrationTotalTime に積算しており、0 だとキャリブレーションが
              // 永久に完了せず ScoreLogic へ 1 件も積まれなくなる。
              self.lastAcceleration = {
                accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
                rotationRate: { beta: 0, gamma: 0, alpha: 0 },
                interval: 10,
                repeat: -1
              };
            }
            if (self.lastGyroscope === null) {
              self.lastGyroscope = { beta: 0, gamma: 0, alpha: 0, repeat: -1 };
            }
            if (self.lastMagnetometer === null) {
              self.lastMagnetometer = { x: 0, y: 0, z: 0, repeat: -1 };
            }
          }
          if (!needCanData && self.lastCanData === null) {
            self.lastCanData = {
              vehicleSpeed: 0, longAcc: 0, latAcc: 0,
              frontDistance: 0, lateralDistance: 0, steeringAngle: 0,
              accelPedalPosition: 0, brakePressure: 0, brakeSwitch: 0,
              shiftIndication: 0, turnSignal: 0, repeat: -1
            };
          }

          const canData = self.lastCanData;

          self.lastGeolocation.repeat++;
          self.lastAcceleration.repeat++;
          self.lastGyroscope.repeat++;
          self.lastMagnetometer.repeat++;
          canData.repeat++;

          const now = Date.now();
          const videoTime = now - self.startTimestamp;
          sensorData = {
            timestamp: now,
            videoTime: videoTime,
            geolocation: self.lastGeolocation,
            acceleration: self.lastAcceleration,
            gyroscope: self.lastGyroscope,
            magnetometer: self.lastMagnetometer,
            canData: canData
          };

        } else {
          // センサーデモデータあり
          sensorData = DemoData.instance().getSensorLogData();
          if (sensorData === undefined) {
            // 全てのセンサーデモデータの読み込みが完了
            self.sensorListenerFunc('Geolocation', null, false);
            return;
          }

          sensorCount++;
          if (10 <= sensorCount) {
            // 10ms x 10回 => 100msに1回地図を更新
            sensorCount = 0;
            self.sensorListenerFunc('Geolocation', sensorData, true);
          }
        }

        // キャリブレーション
        SensorManager.calibration(sensorData);

        //撮影動画とセンサーの時間を同期させるために値を残す
        self.lastSensorTime = sensorData.videoTime;

        self.sensorListenerFunc('Geolocation', sensorData, false);

      } catch (error) {
        self.logService.error('[DrivingScore][SensorService] sensorTimer', error);
      }
    }, 10); //10ms
  }
}

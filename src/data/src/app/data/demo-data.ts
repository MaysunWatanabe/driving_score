import { environment } from '../../environments/environment';

import { File } from '@awesome-cordova-plugins/file/ngx';

import * as pako from 'pako';
/*
import * as zlib from 'zlib';
import { Buffer } from 'buffer';
import * as fs from 'fs';
*/

import { LogService } from '../services/log.service';

export class DemoData {

  private file: File;
  private logService: LogService;

  private sensorLogDataSize: number = 0;

  private sensorLogFiles: Array<string> = [];
  private sensorLogFilesInfo: Array<any> = [];
  private sensorLogFilesIndex: number = 0;

  private sensorLogData: Array<any> = [];
  private sensorLogDataIndex: number = 0;

  private drivingVideFile: string = '';

  private _minVideoTime: number = -1;
  private _maxVideoTime: number = -1;

  private _movieFile: any = '';

  private static demoData: DemoData;

  public static initialize(file: File, logService: LogService) {
    DemoData.instance().setFileInstance(file);
    DemoData.instance().setLogInstance(logService);
  }

  public static instance(): DemoData {
    if (DemoData.demoData === undefined) {
      DemoData.demoData = new DemoData();
    }
    return DemoData.demoData;
  }

  constructor() {
  }

  public setFileInstance(file: File) {
    this.file = file;
  }

  public setLogInstance(logService: LogService) {
    this.logService = logService;
  }

  clearAll() {
    this.logService.debug('[DrivingScore][DemoData] clearAll');
    this.sensorLogDataSize = 0;

    this.sensorLogFiles.splice(0);
    this.sensorLogFilesInfo.splice(0);
    this.sensorLogFilesIndex = 0;

    this.sensorLogData.splice(0);
    this.sensorLogDataIndex = 0;

    this.drivingVideFile = '';

    this._minVideoTime = -1;
    this._maxVideoTime = -1;
    this._movieFile = '';
  }

  reset() {
    this.logService.debug('[DrivingScore][DemoData] reset');
    this.sensorLogFilesIndex = 0;
    this.load();
  }

  private load() {
    this.logService.debug('[DrivingScore][DemoData] load. file index='+this.sensorLogFilesIndex);
    this.sensorLogData.splice(0);
    this.sensorLogDataIndex = 0;

    if (this.sensorLogFilesIndex < this.sensorLogFiles.length) {
      const base64Encoded = this.sensorLogFiles[this.sensorLogFilesIndex];
      this.sensorLogFilesIndex++;
      this.unzipped(base64Encoded);
    }
  }

  pushSensorLogFile(base64Encoded: string) {
    this.logService.debug('[DrivingScore][DemoData] pushSensorLogFile');

    const result = this.unzipped(base64Encoded, true);
    const size = result.length;
    if (size == 0) {
      return;
    }

    result.index = this.sensorLogFilesInfo.length;
    this.sensorLogFilesInfo.push(result);

    this.sensorLogFiles.push(base64Encoded);
    if (this.sensorLogFiles.length == 1) {
      this.reset();
    }
    this.sensorLogDataSize += size;
  }

  getSensorLogData(): any {
    if (this.sensorLogData.length == 0) {
      //this.logService.debug('[DrivingScore][DemoData] getSensorLogData nothing');
      return undefined;
    }

    if (this.sensorLogDataIndex < this.sensorLogData.length) {
      //this.logService.debug('[DrivingScore][DemoData] getSensorLogData');
      const value = this.sensorLogData[this.sensorLogDataIndex];
      //センサーログのタイムスタンプは最新に更新して渡す
      value.timestamp = Date.now();
      this.sensorLogDataIndex++;
      this.convertOldData(value);
      return value;
    }

    this.load();

    return this.getSensorLogData();
  }

  seekSensorLogData(videoTime: number): number {
    this.reset();
    if (this.sensorLogDataSize == 0) {
      return 0;
    }

    for (const fileInfo of this.sensorLogFilesInfo) {
      if (fileInfo.minVideoTime <= videoTime && videoTime <= fileInfo.maxVideoTime) {
        this.sensorLogFilesIndex = fileInfo.index;
        this.load();
        break;
      }
    }

    let sensorLogData = this.getSensorLogData();
    if (sensorLogData === undefined) {
      return 0;
    }
    let currentVideoTime = sensorLogData.videoTime;
    while (currentVideoTime < videoTime && 0 < this.sensorLogData.length) {
      sensorLogData = this.getSensorLogData();
      if (sensorLogData === undefined) {
        break;
      }
      currentVideoTime = sensorLogData.videoTime;
    }
    return currentVideoTime;
  }

  private unzipped(base64Encoded: string, notPush: boolean = false): any {
    //this.logService.debug('[DrivingScore][DemoData] unzipped. notPush='+notPush);
    if (notPush == false) {
      this.sensorLogData.splice(0);
      this.sensorLogDataIndex = 0;
    }

    //const unzipped = zlib.gunzipSync(Buffer.from(base64Encoded, 'base64')).toString();
    // Base64エンコードされた文字列をデコード
    const compressedData = Uint8Array.from(
      atob(base64Encoded), // Base64をデコード
      (char) => char.charCodeAt(0) // 各文字をUint8値に変換
    );
    const unzipped = pako.ungzip(compressedData, { to: 'string' });

    const sensorLogData = [];
    const lines = unzipped.split('\n');
    for(const line of lines) {
      if (line == '') {
        continue;
      }
      try {
        const sensorLog = JSON.parse(line).sensor;
        if (sensorLog.msec !== undefined && sensorLog.videoTime === undefined) {
          sensorLog.videoTime = sensorLog.msec;
        }
        if (sensorLog.gyroscope.x !== undefined && sensorLog.gyroscope.beta === undefined) {
          sensorLog.gyroscope.beta = sensorLog.gyroscope.x;
          sensorLog.gyroscope.gamma = sensorLog.gyroscope.y;
          sensorLog.gyroscope.alpha = sensorLog.gyroscope.z;
        }

        if (sensorLog === undefined
          || sensorLog.videoTime === undefined
          || sensorLog.geolocation === undefined
          || sensorLog.acceleration === undefined
          || sensorLog.gyroscope === undefined
          || sensorLog.magnetometer === undefined) {
          continue;
        }

        if (this._minVideoTime == -1 || sensorLog.videoTime < this._minVideoTime) {
          this._minVideoTime = sensorLog.videoTime;
        }
        if (this._maxVideoTime < sensorLog.videoTime) {
          this._maxVideoTime = sensorLog.videoTime;
        }

        sensorLogData.push(sensorLog);
      } catch (error) {
        this.logService.error('[DrivingScore][DemoData] unzipped', error);
      }
    }

    if (notPush == false) {
      this.sensorLogData = sensorLogData;
    }

    if (sensorLogData.length == 0) {
      return {length:0, minVideoTime:0, maxVideoTime:0};
    }

    return {
      length: sensorLogData.length,
      minVideoTime: sensorLogData[0].videoTime,
      maxVideoTime: sensorLogData[sensorLogData.length-1].videoTime
    };
  }

  public getSensorLogDataSize(): number {
    return this.sensorLogDataSize;
  }

  public get minVideoTime(): number {
    return this._minVideoTime;
  }

  public get maxVideoTime(): number {
    return this._maxVideoTime;
  }

  get movieFile(): any {
    return this._movieFile;
  }

  set movieFile(movieFile: any) {
    this._movieFile = movieFile;
  }

  private convertOldData(sensorData: any) {
    // delete acceleration x,y,z
    delete sensorData.acceleration.x;
    delete sensorData.acceleration.y;
    delete sensorData.acceleration.z;

    // delete acceleration lowPass,lowPassG,highPass
    delete sensorData.lowPass;
    delete sensorData.lowPassG;
    delete sensorData.highPass;
    delete sensorData.acceleration.accelerationIncludingGravity.lowPass;

    // delete acceleration,gyroscope rotate
    delete sensorData.rotate;
    delete sensorData.acceleration.accelerationIncludingGravity.rotate;
    delete sensorData.gyroscope.rotate;

    // move acceleration gravity_x,gravity_y,gravity_z
    if (sensorData.acceleration.gravity_x !== undefined) {
      sensorData.acceleration.accelerationIncludingGravity = {
        x: sensorData.acceleration.gravity_x,
        y: sensorData.acceleration.gravity_y,
        z: sensorData.acceleration.gravity_z
      }
      delete sensorData.acceleration.gravity_x;
      delete sensorData.acceleration.gravity_y;
      delete sensorData.acceleration.gravity_z;
    }

    // move acceleration beta,gamma,alpha
    if (sensorData.acceleration.beta !== undefined) {
      sensorData.acceleration.rotationRate = {
        beta: sensorData.acceleration.beta,
        gamma: sensorData.acceleration.gamma,
        alpha: sensorData.acceleration.alpha
      };
      delete sensorData.acceleration.beta;
      delete sensorData.acceleration.gamma;
      delete sensorData.acceleration.alpha;
    }

    // add canData
    if (sensorData.canData === undefined) {
      sensorData.canData = {
        speed: 0,
        strgAng: 0,
        accelPos: 0,
        brakePos: 0,
        accG: 0,
        shiftPos: 0,
        blinker: 0,
        longCar2Car: 0,
        latCar2Car: 0,
        repeat: 0
      };
    }
  }
}

import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { environment } from '../../environments/environment';
import { Capacitor } from '@capacitor/core';

import * as pako from 'pako';
/*
import * as zlib from 'zlib';
import { Buffer } from 'buffer';
*/

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private file: File;

  private hasLogStorage: boolean = false;
  private hasSensorLogStorage: boolean = false;

  private stockLog: string = '';
  private stockLogLength: number = 0;

  private stockSensorLog: string = '';
  private stockSensorLogLength: number = 0;

  private saveDefaultLogPath: string = '';
  private saveLogPath: string = '';

  constructor(
    private storage: Storage) {
  }

  async initialize(_file: File) {
    this.debug('[DrivingScore][Log] initialize');
    if (Capacitor.getPlatform() != 'android') {
      return;
    }
    this.file = _file;

    this.hasLogStorage = await this.storage.get(environment.settingLogStorage) ?? false;
    this.debug('[DrivingScore][Log] hasLogStorage = ' + this.hasLogStorage);
    if (this.hasLogStorage == false) {
      this.stockLog = '';
      this.stockLogLength = 0;
    }

    this.hasSensorLogStorage = await this.storage.get(environment.settingSensorLogStorage) ?? false;
    this.debug('[DrivingScore][Log] hasSensorLogStorage = ' + this.hasSensorLogStorage);
    if (this.hasSensorLogStorage == false) {
      this.stockSensorLog = '';
      this.stockSensorLogLength = 0;
    }

    if (this.saveLogPath != '') {
      return;
    }

    var dirPath = this.file.externalRootDirectory;

    // checkDir はディレクトリが無いとき false を返さず NOT_FOUND_ERR で reject する
    // （@awesome-cordova-plugins/file の checkDir は resolveDirectoryUrl の結果を
    //   そのまま返すため）。`status === false` を待つ書き方だと初回は catch に飛び、
    // createDir が一度も呼ばれずディレクトリが永久に作られなかった (proposal #80)。
    // createDir は replace=true なら既存でも成功するので、直接呼ぶ。
    var dirName = 'Documents';
    try {
      await this.file.createDir(dirPath, dirName, true);
      dirPath += dirName + '/';
    } catch (error: any) {
      this.error('[DrivingScore][Log] createDir failed. ' + dirPath + dirName, error);
      return;
    }

    dirName = 'driving-score';
    try {
      await this.file.createDir(dirPath, dirName, true);
      dirPath += dirName + '/';
    } catch (error: any) {
      this.error('[DrivingScore][Log] createDir failed. ' + dirPath + dirName, error);
      return;
    }

    dirName = 'debug-log';
    try {
      await this.file.createDir(dirPath, dirName, true);
      dirPath += dirName + '/';
    } catch (error: any) {
      this.error('[DrivingScore][Log] createDir failed. ' + dirPath + dirName, error);
      return;
    }
    this.saveDefaultLogPath = dirPath;
    this.saveLogPath = this.saveDefaultLogPath;
  }

  async setLogDir(dirName: string) {
    if (Capacitor.getPlatform() != 'android') {
      return;
    }
    this.saveFile(true);
    this.saveSensorFile(true);

    var dirPath = this.file.externalRootDirectory + 'Documents/driving-score/';
    try {
      await this.file.createDir(dirPath, dirName, true);
      dirPath += dirName + '/';
    } catch (error: any) {
      this.error('[DrivingScore][Log] createDir failed. ' + dirPath + dirName, error);
      return;
    }
    this.saveLogPath = dirPath;
    this.debug('[DrivingScore][Log] setLogDir. ' + this.saveLogPath);
  }

  resetLogDir() {
    this.saveFile(true);
    this.saveSensorFile(true);

    this.saveLogPath = this.saveDefaultLogPath;
    this.debug('[DrivingScore][Log] saveLogPath. ' + this.saveLogPath);
  }

  getLogDir() {
    return this.saveLogPath;
  }

  debug(message: any, subMessage: any = '') {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    if (typeof subMessage === 'object') {
      subMessage = JSON.stringify(subMessage);
    }
    if (subMessage !== '') {
      subMessage = '. ' + subMessage;
    }
    message = message + subMessage;
    if (this.hasLogStorage && Capacitor.getPlatform() == 'android') {
      const dateString = this.getDateString();
      const logMessage = dateString + ' [D] ' + message + '\n';
      this.stockLog += logMessage;
      this.stockLogLength += logMessage.length;
      this.saveFile();
    }
    console.log(message);
  }

  error(message: any, error: any = null) {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    const errorMessage = this.getErrorMessage(error);
    if (this.hasLogStorage && Capacitor.getPlatform() == 'android') {
      const dateString = this.getDateString();
      const logMessage = dateString + ' [E] ' + message + errorMessage + '\n';
      this.stockLog += logMessage;
      this.stockLogLength += logMessage.length;
      this.saveFile();
    }
    console.error(message + errorMessage);
  }

  sensor(sensorData: any) {
    if (this.saveLogPath == this.saveDefaultLogPath) {
      return;
    }
    if (this.hasSensorLogStorage && Capacitor.getPlatform() == 'android') {
      const logSensorData = {
        date: this.getDateString2(new Date(sensorData.timestamp)),
        sensor: sensorData
      };
      const logMessage = JSON.stringify(logSensorData) + '\n';
      this.stockSensorLog += logMessage;
      this.stockSensorLogLength += logMessage.length;
      this.saveSensorFile();
    }
  }

  private getErrorMessage(error: any) {
    try {
      let message = error;
      if (error.stack !== undefined && error.message !== undefined) {
        message = error.message;
      } else if (typeof message === 'object') {
        message = JSON.stringify(message);
      }
      return '. error => ' + message;
    } catch(e) {
    }
    return '. error';
  }

  getDateString(simple: boolean = false): string {
    return this.getDateString2(new Date(), simple);
  }

  getDateString2(date: Date, simple: boolean = false) {
    const split1 = simple ? '' : '-';
    const split2 = simple ? '-' : ' ';
    const split3 = simple ? '' : ':';

    var text = '';
    text += String(date.getFullYear());
    text += split1;
    text += (date.getMonth()+1) < 10 ? '0'+(date.getMonth()+1) : String(date.getMonth()+1);
    text += split1;
    text += date.getDate() < 10 ? '0'+date.getDate() : String(date.getDate());

    text += split2;

    text += date.getHours() < 10 ? '0'+date.getHours() : String(date.getHours());
    text += split3;
    text += date.getMinutes() < 10 ? '0'+date.getMinutes() : String(date.getMinutes());
    text += split3;
    text += date.getSeconds() < 10 ? '0'+date.getSeconds() : String(date.getSeconds());
    if (simple == false) {
      text += '.';
      if (date.getMilliseconds() < 10) {
        text += '00'+date.getMilliseconds();
      } else if (date.getMilliseconds() < 100) {
        text += '0'+date.getMilliseconds();
      } else {
        text += date.getMilliseconds();
      }
    }
    return text;
  }

  private saveFile(force: boolean = false) {
    const dateString = this.getDateString(true);

    // 3000000 => 3MB
    if (3000000 <= this.stockLogLength || (force && 0 < this.stockLogLength )) {
      try {
        //const buffer = zlib.gzipSync(this.stockLog);
        //const arrayBuffer = this.toArrayBuffer(buffer);
        const compressedData = pako.gzip(this.stockLog);
        const arrayBuffer = compressedData.buffer;

        const saveFileName = 'log.' + dateString + '.txt.gz';
        this.debug('[DrivingScore][Log] saveFile. ' + this.saveLogPath + saveFileName);
        this.file.writeFile(this.saveLogPath, saveFileName, arrayBuffer, {replace:true});
      } catch (error) {
        this.error('[DrivingScore][Log] saveFile failed.', error);
      }
      this.stockLog = '';
      this.stockLogLength = 0;
    }
  }

  private saveSensorFile(force: boolean = false) {
    const dateString = this.getDateString(true);
    // 5000000 => 5MB
    if (5000000 <= this.stockSensorLogLength || (force && 0 < this.stockSensorLogLength )) {
      try {
        //const buffer = zlib.gzipSync(this.stockSensorLog);
        //const arrayBuffer = this.toArrayBuffer(buffer);
        const compressedData = pako.gzip(this.stockSensorLog);
        const arrayBuffer = compressedData.buffer;

        const saveFileName = 'sensor-log.' + dateString + '.txt.gz';
        this.debug('[DrivingScore][Log] saveSensorFile. ' + this.saveLogPath + saveFileName);
        this.file.writeFile(this.saveLogPath, saveFileName, arrayBuffer, {replace:true});
      } catch (error) {
        this.error('[DrivingScore][Log] saveSensorFile failed.', error);
      }
      this.stockSensorLog = '';
      this.stockSensorLogLength = 0;
    }
  }

  /*
  private toArrayBuffer(buffer: Buffer) {
    let ab = new ArrayBuffer(buffer.length);
    let view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return ab;
  }
  */
}

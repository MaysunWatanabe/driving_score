import { Storage } from '@ionic/storage-angular';
import { environment } from '../../environments/environment';

import { LogService } from '../services/log.service';
import { Score, Message } from '../data/score';

export class ScoreLogic {
  private geolocationList = Array();
  private accelerationList = Array();
  private gyroscopeList = Array();
  private magnetometerList = Array();
  private canDataList = Array();

  private scoreLogicFunction: Function;
  private scoreLogicLocalData: {};

  private isStart: boolean = false;
  private isPause: boolean = false;
  private sensorTimer: any;

  public scoreLogicResultList = Array();
  public scoreList = Array<Score>();

  public startTimestamp: number = -1;
  public lastTimestamp: number = -1;

  public scoreOverAll: number = 100;
  public score1: number = 100;
  public score2: number = 100;
  public score3: number = 100;
  public score4: number = 100;

  constructor(
    private logService: LogService,
    private storage: Storage) {
  }

  // 運転診断スコアロジックを初期化
  async init() {
    await this.storage.create();
    // 運転診断スコアロジックを実行するFunctionを生成
    const scoreLogic = await this.storage.get(environment.scoreLogicKey);
    this.scoreLogicFunction = new Function(
        'currentTimestamp', 'lastTimestamp',
        'geolocationList', 'accelerationList', 'gyroscopeList', 'magnetometerList', 'canDataList',
        'scoreLogicJson', 'scoreLogicResultList', 'localData',
        'log', 'drawGraph',
        scoreLogic);

    this.scoreLogicLocalData = {};

    this.logService.debug('[DrivingScore][ScoreLogic] init: finish');
  }

  pushSensorData(sensorData: any) {
    if (this.isStart == false)
      return;

    // センサー情報をログに保存
    const sensorDataTemp = JSON.parse(JSON.stringify(sensorData));
    delete sensorDataTemp.acceleration.accelerationIncludingGravity.lowPass;
    delete sensorDataTemp.acceleration.accelerationIncludingGravity.rotate;
    delete sensorDataTemp.gyroscope.rotate;
    this.logService.sensor(sensorDataTemp);

    if (sensorData.calibration) {
      // キャリブレーションが終わったら追加する

      // 診断ロジックの内部処理用にインスタンスをコピー
      const geolocation      = Object.assign({timestamp: sensorData.timestamp}, sensorData.geolocation);
      const acceleration     = Object.assign({timestamp: sensorData.timestamp}, sensorData.acceleration);
      const gyroscope        = Object.assign({timestamp: sensorData.timestamp}, sensorData.gyroscope);
      const magnetometer     = Object.assign({timestamp: sensorData.timestamp}, sensorData.magnetometer);
      const canData          = Object.assign({timestamp: sensorData.timestamp}, sensorData.canData);

      // GPS
      this.geolocationList.push(geolocation);
      // 加速度計
      this.accelerationList.push(acceleration);
      // ジャイロスコープ
      this.gyroscopeList.push(gyroscope);
      // 磁力計
      this.magnetometerList.push(magnetometer);
      // 車載CANデータ
      this.canDataList.push(canData);
    }
  }

  // 全てのデータを削除
  clearAll() {
    this.logService.debug('[DrivingScore][ScoreLogic] clearAll');
    this.isStart = false;
    clearInterval(this.sensorTimer);

    this.geolocationList.splice(0);
    this.accelerationList.splice(0);
    this.gyroscopeList.splice(0);
    this.magnetometerList.splice(0);
    this.canDataList.splice(0);

    this.scoreLogicResultList.splice(0);
    this.scoreList.splice(0);

    this.startTimestamp = -1;
    this.lastTimestamp = -1;
  }

  // 容量不足回避のために、古いデータを削除
  clearOldData() {
    //this.logService.debug('[DrivingScore][ScoreLogic] this.geolocationList='+this.geolocationList.length);
    // 古いセンサー情報を削除
    this.spliceList();
  }

  // 容量不足回避のために、古いデータを削除
  spliceList() {
    const list = this.geolocationList;
    const timestamp = Date.now() - environment.sensorStockTime;
    let spliceSize = 0;
    for (let i = 0; i < list.length; i++) {
      if (timestamp < list[i].timestamp) {
        break;
      }
      spliceSize++;
    }
    if (0 < spliceSize) {
      this.geolocationList.splice(0, spliceSize);
      this.accelerationList.splice(0, spliceSize);
      this.gyroscopeList.splice(0, spliceSize);
      this.magnetometerList.splice(0, spliceSize);
      this.canDataList.splice(0, spliceSize);
    }
  }

  // 運転診断ロジックの定期実行を開始
  async start(interval: number, func: any, drawGraphFunc: any = null) {
    this.logService.debug('[DrivingScore][ScoreLogic] start');
    await this.init();

    this.isStart = true;
    this.isPause = false;
    this.startTimestamp = Date.now();

    this.scoreOverAll = 100;
    this.score1 = 100;
    this.score2 = 100;
    this.score3 = 100;
    this.score4 = 100;

    const scoreLogicJsonText = await this.storage.get(environment.scoreLogicJsonKey);
    const scoreLogicJson = JSON.parse(scoreLogicJsonText);

    // smartphoneOnly, canDataOnly, combination
    scoreLogicJson.settings.selectedSensorMode = await this.storage.get(environment.settingSelectedSensorMode);

    var self = this;
    setTimeout(function() {
      func(new Score(null, Date.now()), null);
    }, 0);

    this.sensorTimer = setInterval(function() {
      self.clearOldData();
      self.execScoreLogic(scoreLogicJson, func, drawGraphFunc);
    }, interval);
  }

  // 運転診断ロジックの定期実行を終了
  stop() {
    try {
      this.logService.debug('[DrivingScore][ScoreLogic] stop');
      this.isStart = false;
      this.isPause = false;
      clearInterval(this.sensorTimer);
      this.logService.debug('[DrivingScore][ScoreLogic] 運転診断の確認用ログ ここから');
      this.logService.debug('[DrivingScore][ScoreLogic] score over_all='+this.scoreOverAll+', score1='+this.score1+', score2='+this.score2+', score3='+this.score3+', score4='+this.score4);
      this.logService.debug('[DrivingScore][ScoreLogic] 運転診断の確認用ログ ここまで');
    } catch (error) {
      this.logService.error('[DrivingScore][ScoreLogic] stop', error);
    }
  }

  pause(status: boolean) {
    this.logService.debug('[DrivingScore][ScoreLogic] pause status='+status);
    if (this.isStart) {
      this.isPause = status;
    }
  }

  // 運転診断ロジックを実行
  execScoreLogic(scoreLogicJson: {}, func: any, drawGraphFunc: any = null) {
    if (this.isStart == false || this.isPause)
      return;

    // 運転診断スコアロジックを実行
    try {
      const currentTimestamp = Date.now();

      const result = this.scoreLogicFunction(
        currentTimestamp,
        this.lastTimestamp,
        this.geolocationList,
        this.accelerationList,
        this.gyroscopeList,
        this.magnetometerList,
        this.canDataList,
        scoreLogicJson,
        this.scoreLogicResultList,
        this.scoreLogicLocalData,
        this.logService,
        (keyName:string, data:number, type:string) => { // drawGraph
          if (drawGraphFunc != null) {
            drawGraphFunc(keyName, data, type);
          }
        }
      );
      const score = new Score(result, currentTimestamp);

      this.lastTimestamp = currentTimestamp;

      if (score.initialize) {
        this.scoreLogicResultList.push(result);
        this.scoreList.push(score);
        this.calculator();

        func(score, null);
      }
    } catch( error: any ) {
      this.logService.error('[DrivingScore][ScoreLogic] execScoreLogic eval', error);
      this.logService.error(error.stack ?? 'none stack trace.', error);
      func(null, error.stack.replace(/\(http:\/\/localhost[^\)]+\)/g, '(scoreLogic)'));
    }
  }

  calculator() {
    //this.logService.debug('[DrivingScore][ScoreLogic] calculator');
    const calc = {
      overAll : { count:0, sum:0 },
      score1 : { count:0, sum:0 },
      score2 : { count:0, sum:0 },
      score3 : { count:0, sum:0 },
      score4 : { count:0, sum:0 },
    };

    for (let i=0; i<this.scoreList.length; i++) {
      const score = this.scoreList[i];

      if (score.initialize == false)
        continue;

      if (-1 < score.overAll) {
        calc.overAll.sum += score.overAll;
        calc.overAll.count++;
      }
      if (-1 < score.score1) {
        calc.score1.sum += score.score1;
        calc.score1.count++;
      }
      if (-1 < score.score2) {
        calc.score2.sum += score.score2;
        calc.score2.count++;
      }
      if (-1 < score.score3) {
        calc.score3.sum += score.score3;
        calc.score3.count++;
      }
      if (-1 < score.score4) {
        calc.score4.sum += score.score4;
        calc.score4.count++;
      }
    }

    if (0 < calc.overAll.count)
      this.scoreOverAll = calc.overAll.sum / calc.overAll.count;
    if (0 < calc.score1.count)
      this.score1 = calc.score1.sum / calc.score1.count;
    if (0 < calc.score2.count)
      this.score2 = calc.score2.sum / calc.score2.count;
    if (0 < calc.score3.count)
      this.score3 = calc.score3.sum / calc.score3.count;
    if (0 < calc.score4.count)
      this.score4 = calc.score4.sum / calc.score4.count;
  }

  static testScoreLogic(logService: LogService, scoreLogicJsonText: string, scoreLogic: string): any {
    const geolocationList = Array();
    const accelerationList = Array();
    const gyroscopeList = Array();
    const magnetometerList = Array();
    const canDataList = Array();

    const scoreLogicResultList = Array();
    const scoreList = Array();
    const scoreLogicLocalData = {};

    const timestamp = Date.now();

    // けいゆう病院前交差点
    geolocationList.push({
      timestamp: timestamp,
      latitude : 35.46025745017747,
      longitude : 139.63377896689911,
      accuracy : 3.947999954223633,
      altitude : 195.00606167094992,
      altitudeAccuracy : null,
      heading : 292,
      speed : 9.32436752319336,
      repeat: 0
    });

    accelerationList.push({
      timestamp: timestamp,
      accelerationIncludingGravity: {
        x : 0,
        y : 9.8,
        z : -0.5,
        lowPass: {
          x : 0,
          y : 9.8,
          z : -0.5,
        },
        rotate: {
          x : 0,
          y : 9.8,
          z : -0.5,
          lowPass: {
            x : 0,
            y : 9.8,
            z : -0.5,
          }
        }
      },
      rotationRate: {
        beta : -1,
        gamma: 0.2,
        alpha: -0.2,
      },
      interval: 16,
      repeat: 0,
    });

    gyroscopeList.push({
      timestamp: timestamp,
      beta : 93.9,
      gamma : 0.8,
      alpha : 283.3,
      rotate: {
        beta : 93.9,
        gamma : 0.8,
      },
      repeat: 0
    });

    magnetometerList.push({
      timestamp: timestamp,
      x : 6.6489996910095215,
      y : -20.788799285888672,
      z : 1.256600022315979,
      repeat: 0
    });

    canDataList.push({
      speed: 0,
      strgAngUpper: 0,
      strgAngLower: 0,
      accelPos: 0,
      brakePos: 0,
      accG: 0,
      shiftPos: 0,
      blinker: 0,
      longCar2Car: 0,
      latCar2Car: 0
    });

    // 運転診断スコアロジックで使用するJSONファイルを読み込み
    const scoreLogicJson = JSON.parse(scoreLogicJsonText);

    // 運転診断スコアロジックを実行
    try {
      logService.debug('[DrivingScore][score-logic] testScoreLogic');
      const scoreLogicFunction: Function = new Function(
          'currentTimestamp', 'lastTimestamp',
          'geolocationList', 'accelerationList', 'gyroscopeList', 'magnetometerList', 'canDataList',
          'scoreLogicJson', 'scoreLogicResultList', 'localData',
          'log', 'drawGraph',
          scoreLogic);

      const result = scoreLogicFunction(
        timestamp,
        timestamp,
        geolocationList,
        accelerationList,
        gyroscopeList,
        magnetometerList,
        canDataList,
        scoreLogicJson,
        scoreLogicResultList,
        scoreLogicLocalData,
        logService,
        (keyName:string, data:number, type:string) => { /*drawGraph*/ }
      );
      logService.debug('[DrivingScore][score-logic] testScoreLogic: result='+JSON.stringify(result));
      return true;
    } catch( error: any ) {
      logService.error('[DrivingScore][score-logic] testScoreLogic', error);
      logService.error(error.stack ?? 'none stack trace.', error);
      return error.stack.replace(/\(http:\/\/localhost[^\)]+\)/g, '(scoreLogic)');
    }
  }
}

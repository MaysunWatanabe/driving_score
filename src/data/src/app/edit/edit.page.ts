import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { Capacitor } from '@capacitor/core';
import { Chart } from 'chart.js/auto';

import { AlertController, LoadingController } from "@ionic/angular";
import { Storage } from '@ionic/storage-angular';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { ScoreLogic } from '../data/score-logic';
import { Score, Message, CapabilityScore } from '../data/score';
import { DemoData } from '../data/demo-data';
import { SensorManager } from '../data/sensor-manager';

import { environment } from '../../environments/environment';

type Dataset = {
  label: string;
  data: any;
  borderColor: string;
  backgroundColor: string;
  pointRadius: number;
  fill: boolean;
  borderWidth: number;
  yAxisID: string;
  skipNull: boolean;
};

@Component({
  selector: 'app-edit',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
})
export class EditPage implements OnInit {

  @ViewChild('lineCanvas1', {read: ElementRef, static: false}) lineCanvas1: ElementRef;
  @ViewChild('videoElement', {read: ElementRef, static: false}) videoElement: ElementRef;

  // 運転診断ロジックを保存するフォーム
  public ionicForm: FormGroup;

  // Android判定
  public hasAndroid: boolean = false;

  //キャンバス
  private chart: Chart;
  private chartDestroy: boolean = true;

  // センサー情報ファイルの読み込み完了フラグ
  public sensorLogLoaded: boolean = false;
  // センサー情報の処理経過
  private sensorTimer: any;
  private lastSensorTime: number = 0;
  public sensorTimerPause: boolean = true;
  public sensorLogCounterText: string = '　';
  public sensorData: any;

  // センサー情報のレンジ制御
  public rangeMin: number = 0;
  public rangeMax: number = 0;
  public rangeMaxText: string;
  public rangeValue: number = -1;

  // 運転診断動画
  private loadVideoFinish: boolean = false;

  // スコアロジック診断に必要な情報
  public scoreLogic: ScoreLogic;
  public scoreLogicText: string;
  public scoreLogicRunning: boolean = false;
  public labelScoreAll: string;
  public label1: string;
  public label2: string;
  public label3: string;
  public label4: string;
  public labelA: string;
  public labelB: string;
  public labelC: string;
  public resultTitle: string;
  public resultMessages: Array<any> = [];

  // グラフ描画用の変数群
  private sensorDataList = Array();
  private lastDrawTimes = 0;
  private static readonly GRAPH_SIZE: number = 1200;

  public COLORS: { [key: string]: string } = {
    'scoreAll': '#e5171f',
    'score1': '#0078ba',
    'score2': '#019a66',
    'score3': '#522886',
    'score4': '#e44d93',
    'geolocation': '#f62e36',
    'acceleration': '#009bbf',
    'accelerationLowPass': '#00bb85',
    'gyroscope': '#8f76d6',
    'magnetometer': '#9c5e31',
    'canData': '#f39700',
    'rotateAcceleration': '#b6007a',
    'rotateAccelerationLowPass': '#6cbb5a',
    'rotateGyroscope': '#814721',
    'scoreA': '#4b0082',
    'scoreB': '#4b0082',
    'scoreC': '#4b0082',
    'hiyari': '#000000'
  };

  public OTHER_COLORS: Array<string> = [
    '#c1a470', '#b5b5ac', '#00ac9b', '#9caeb7', '#9b7cb6', '#bb641d', '#0079c2', '#e85298', '#a9cc51', '#ee7b1a', '#00a0de', '#ff9500'
  ];

  public DRAW_POINT_GRAPH = [
    'hiyari',
    'muscleStrength',
    'flexibility',
    'wideViews'
  ];

  // グラフ描画チェックボックス用の変数群
  public graphData: { [key: string]: { 'check1': boolean; 'check2': boolean, label: string, data: (number | null)[] } }  = {
    'showAllCheckBox': {'check1': true, 'check2': true, label: '', data: []},
    'scoreLogic': {'check1': false, 'check2': true, label: '', data: []},
    'hiyari': {'check1': false, 'check2': false, label: 'ヒヤリ地点', data: []},
    'scoreAll': {'check1': true, 'check2': false, label: '総合スコア', data: []},
    'score1': {'check1': false, 'check2': false, label: 'score1', data: []},
    'score2': {'check1': false, 'check2': false, label: 'score2', data: []},
    'score3': {'check1': false, 'check2': false, label: 'score3', data: []},
    'score4': {'check1': false, 'check2': false, label: 'score4', data: []},
    'scoreA': {'check1': false, 'check2': false, label: 'scoreA', data: []},
    'scoreB': {'check1': false, 'check2': false, label: 'scoreB', data: []},
    'scoreC': {'check1': false, 'check2': false, label: 'scoreC', data: []},
    'geolocation.speed': {'check1': false, 'check2': false, label: 'geolocation.speed', data: []},
    'geolocation.heading': {'check1': false, 'check2': false, label: 'geolocation.heading', data: []},
    'acceleration.gravity.x': {'check1': false, 'check2': false, label: 'accel.gravity.x', data: []},
    'acceleration.gravity.y': {'check1': false, 'check2': false, label: 'accel.gravity.y', data: []},
    'acceleration.gravity.z': {'check1': false, 'check2': false, label: 'accel.gravity.z', data: []},
    'acceleration.beta': {'check1': false, 'check2': false, label: 'accel.beta', data: []},
    'acceleration.gamma': {'check1': false, 'check2': false, label: 'accel.gamma', data: []},
    'acceleration.alpha': {'check1': false, 'check2': false, label: 'accel.alpha', data: []},
    'accelerationLowPass.gravity.x': {'check1': false, 'check2': false, label: '(LowPass)accel.gravity.x', data: []},
    'accelerationLowPass.gravity.y': {'check1': false, 'check2': false, label: '(LowPass)accel.gravity.y', data: []},
    'accelerationLowPass.gravity.z': {'check1': false, 'check2': false, label: '(LowPass)accel.gravity.z', data: []},
    'gyroscope.beta': {'check1': false, 'check2': false, label: 'gyroscope.beta', data: []},
    'gyroscope.gamma': {'check1': false, 'check2': false, label: 'gyroscope.gamma', data: []},
    'gyroscope.alpha': {'check1': false, 'check2': false, label: 'gyroscope.alpha', data: []},
    'magnetometer.x': {'check1': false, 'check2': false, label: 'magnetometer.x', data: []},
    'magnetometer.y': {'check1': false, 'check2': false, label: 'magnetometer.y', data: []},
    'magnetometer.z': {'check1': false, 'check2': false, label: 'magnetometer.z', data: []},
    'rotateAcceleration.gravity.x': {'check1': false, 'check2': false, label: '(Rotate)accel.gravity.x', data: []},
    'rotateAcceleration.gravity.y': {'check1': false, 'check2': false, label: '(Rotate)accel.gravity.y', data: []},
    'rotateAcceleration.gravity.z': {'check1': false, 'check2': false, label: '(Rotate)accel.gravity.z', data: []},
    'rotateAccelerationLowPass.gravity.x': {'check1': false, 'check2': false, label: '(Rotate)(LowPass)accel.gravity.x', data: []},
    'rotateAccelerationLowPass.gravity.y': {'check1': false, 'check2': false, label: '(Rotate)(LowPass)accel.gravity.y', data: []},
    'rotateAccelerationLowPass.gravity.z': {'check1': false, 'check2': false, label: '(Rotate)(LowPass)accel.gravity.z', data: []},
    'rotateGyroscope.beta': {'check1': false, 'check2': false, label: '(Rotate)gyroscope.beta', data: []},
    'rotateGyroscope.gamma': {'check1': false, 'check2': false, label: '(Rotate)gyroscope.gamma', data: []},
    'canData.vehicleSpeed': {'check1': false, 'check2': false, label: 'CAN.vehicleSpeed', data: []},
    'canData.longAcc': {'check1': false, 'check2': false, label: 'CAN.longAcc', data: []},
    'canData.latAcc': {'check1': false, 'check2': false, label: 'CAN.latAcc', data: []},
    'canData.frontDistance': {'check1': false, 'check2': false, label: 'CAN.frontDistance', data: []},
    'canData.lateralDistance': {'check1': false, 'check2': false, label: 'CAN.lateralDistance', data: []},
    'canData.steeringAngle': {'check1': false, 'check2': false, label: 'CAN.steeringAngle', data: []},
    'canData.accelPedalPosition': {'check1': false, 'check2': false, label: 'CAN.accelPedalPosition', data: []},
    'canData.brakePressure': {'check1': false, 'check2': false, label: 'CAN.brakePressure', data: []},
    'canData.brakeSwitch': {'check1': false, 'check2': false, label: 'CAN.brakeSwitch', data: []},
    'canData.shiftIndication': {'check1': false, 'check2': false, label: 'CAN.shiftIndication', data: []},
    'canData.turnSignal': {'check1': false, 'check2': false, label: 'CAN.turnSignal', data: []}
  };

  public range1Min: number;
  public range1Max: number;
  public range2Min: number;
  public range2Max: number;

  /**
    * コンストラクタ
    */
  constructor(
    public formBuilder: FormBuilder,
    private alertController: AlertController,
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private storage: Storage,
    private file: File,
    private loadingCtrl: LoadingController) {

    // Androidは運転診断ロジックの書き換え機能のみを提供
    this.hasAndroid = (Capacitor.getPlatform() == 'android');

    this.logService.initialize(file);

    DemoData.initialize(file, logService);

    this.init();
  }

  /**
   * コンポーネントの初期化時に実行される
   */
  public ngOnInit() {
    this.ionicForm = this.formBuilder.group({
       scoreLogicText: ['', []],
    });

    // センサーログのgzファイルをブラウザからアップロードするイベントリスナーをセット
    var self = this;
    const uploadFiles = document.getElementById("upload_gz_files") as HTMLInputElement;
    uploadFiles.addEventListener('change', (evt: any) => {
      self.openSensorLogFiles(evt);
    });

    this.loadSensorDemoData();

    // 運転診断結果を初期化
    this.clearResultData();
    this.scoreLogic = new ScoreLogic(this.logService, this.storage);
    this.scoreLogicRunning = false;
  }

  /**
   * ページがアクティブになる直前に実行される
   */
  public ionViewWillEnter() {
    if (this.hasAndroid) {
      this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
    }
    this.loadVideo(DemoData.instance().movieFile);
  }

  /**
   * ページが非アクティブになる直前に実行
   */
  public ionViewWillLeave() {
    // ページを離れるので運転診断を停止
    this.onStopScoreLogic();
  }

  /**
   * センサー情報の読み込み位置を変更するバーの表示
   */
  public pinFormatter(value: number) {
    return EditPage.parseTime(value);
  }

  /**
   * ブラウザのアップロードダイアログを表示
   */
  public showSensorFileUploadDialog() {
      const fileBox = document.getElementById("upload_gz_files") as HTMLInputElement;
      fileBox.click();
  }

  /**
   * ブラウザからアップロードしたセンサーログを開く
   */
  public async openSensorLogFiles(evt: any) {
    // 読み込み中ダイアログを表示
    const loading = await this.loadingCtrl.create({
      message: 'センサーログを取り込み中...'
    });
    loading.present();

    this.onClearSensorLog();

    // ブラウザで選択されたファイル一蘭
    const fileList = [];
    for(const elem of (evt.target.files as any[])) {
      fileList.push(elem);
    }
    // ファイル名に書かれた日付が小さい順に処理する
    fileList.sort((a, b) => {
      const nameA = a.name.toUpperCase(); // 大文字小文字を無視
      const nameB = b.name.toUpperCase(); // 大文字小文字を無視
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    // アップロードしたファイルをセンサーサービスにデモデータとして登録する
    var self = this;
    for(const elem of fileList) {
      this.logService.debug('[DrivingScore][EditPage] openSensorLogFiles ' + elem.name);

      // 動画ファイル
      if (elem.name.endsWith('.webm')) {
        DemoData.instance().movieFile = elem;
        self.loadVideo(elem);
        continue;
      }

      await this.readAsDataURL(elem)
      .then(reader => {
        try {
          // BLOBの先頭に不要な文字列があるので削除する
          const base64Encoded = String(reader.result).replace(/data:.*\/.*;base64,/, '');
          // gzファイルが正しいセンサー情報なのかは気にせずに追加してOK
          DemoData.instance().pushSensorLogFile(base64Encoded);
        } catch (error: any) {
          self.logService.error('[DrivingScore][EditPage] openSensorLogFiles', error);
        }

      }).catch(error => {
          self.logService.error('[DrivingScore][EditPage] openSensorLogFiles', error);
      });
    }

    // センサー情報が読み込まれたら、運転診断の実行を可能にする
    this.loadSensorDemoData();

    // 読み込み中ダイアログを消す
    loading.dismiss();

    this.logService.debug('[DrivingScore][EditPage] openSensorLogFiles finish. sensor data size=' + DemoData.instance().getSensorLogDataSize());
  }

  /**
   * テキストエディタの運転診断ロジックをストレージに保存して、同時にファイルをダウンロード
   */
  public async onSaveScoreLogic() {
    // テキストエディタの運転診断ロジックとストレージの運転診断に必要な設定情報を使ってテスト実行
    const scoreLoginJsonText = await this.storage.get(environment.scoreLogicJsonKey);
    const ret = ScoreLogic.testScoreLogic(this.logService, scoreLoginJsonText, this.ionicForm.value.scoreLogicText);
    if (ret === true) {
      let scoreLogic = this.ionicForm.value.scoreLogicText;

      //更新時間をアップデート
      const now = Date.now();
      const nowDate = new Date(now);
      const nowDateText = this.dateFormat(nowDate);

      const lines = scoreLogic.split('\n'); // 改行で分割
      if (lines[0].match(/^\/\/\d+$/) === null) { /* //1736899200000 */
        // 1行目に空行を追加
        lines.splice(0, 0, '');
      }
      lines[0] = '//' + now;

      console.log(lines[1]);
      if (lines[1].match(/^\/\/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/) === null) { /* //2025-01-15 00:00:00 */
        // 2行目に空行を追加
        lines.splice(1, 0, '');
      }
      lines[1] = '//' + nowDateText;

      scoreLogic = lines.join('\n');

      // テスト実行に成功したのでストレージの情報を書き換える
      await this.storage.set(environment.scoreLogicKey, scoreLogic);

      // テキストエリアに反映
      this.scoreLogicText = scoreLogic;
      this.ionicForm.patchValue({
        scoreLogicText: this.scoreLogicText,
      });

      // 運転診断ロジックをファイルにしてダウンロード
      if (this.hasAndroid == false) {
        const saveFileName = 'scoreLogic.' + this.logService.getDateString(true) + '.txt';
        const a = document.getElementById("save") as HTMLAnchorElement;
        a.href = URL.createObjectURL(new Blob([this.scoreLogicText], {type: "text/plain"}));
        a.download = saveFileName;
        // ファイル保存
        a.click();
      }

      // 成功ダイアログを表示
      this.showSaveScoreLogicDialog();
    } else {
      // テスト実行に失敗したので保存せずにエラーダイアログを表示
      this.showFailedScoreLogicDialog(ret);
    }
  }

  /**
   * スコア診断ロジックを実行
   */
  public async runScoreLogic() {
    this.logService.debug('[DrivingScore][EditPage] runScoreLogic', this.sensorLogLoaded);
    this.logService.debug('[DrivingScore][EditPage] runScoreLogic', this.scoreLogicRunning);
    if (!this.sensorLogLoaded || this.scoreLogicRunning) {
      return;
    }
    this.logService.debug('[DrivingScore][EditPage] runScoreLogic');

    // 前回の診断結果を初期化
    this.onStopScoreLogic();
    this.clearResultData();
    this.scoreLogic.clearAll();

    // 運転診断中に変更
    this.scoreLogicRunning = true;
    this.sensorTimerPause = false;
    this.resultTitle = '運転診断を実行中...';

    // 運転診断スコアロジックを実行
    var self = this;
    const interval = this.loginService.settings.scoreLogicInterval;
    var badPointCount = 0;
    this.scoreLogic.start(interval, (score: Score, error: string) => {
      if (score == null) {
        // 異常終了
        self.onStopScoreLogic('運転診断 異常終了');
        self.showFailedScoreLogicDialog(error);
        return;
      }

      const time = Math.floor(self.lastSensorTime / 1000);
      // センサー情報から経過秒を取得して表示
      const dateText = EditPage.parseTime(time) + '地点';

      if (0 < this.sensorDataList.length) {
        const sensorData = this.sensorDataList[this.sensorDataList.length - 1];

        // ヒヤリ地点を検出できた場合は、一番最後のセンサーデータと一緒に登録することでグラフを描画する
        if (score.hiyari) {
          sensorData.score.hiyari = true;
        }

        // 能力指標スコアが取得できた場合は、一番最後のセンサーデータと一緒に登録することでグラフを描画する
        if (score.capabilityScore.initialize) {
          // 表示にも使うので四捨五入
          score.capabilityScore.scoreA = self.round(score.capabilityScore.scoreA);
          score.capabilityScore.scoreB = self.round(score.capabilityScore.scoreB);
          score.capabilityScore.scoreC = self.round(score.capabilityScore.scoreC);

          sensorData.score.capabilityScore = score.capabilityScore;
          self.resultMessages.unshift({dateText:dateText, capabilityScore: score.capabilityScore, messageData:null});
        }
      }

      interface StringHash  {
        [key: string]: string; // 任意のキー（string）に string 型の値
      }
      interface NumberHash {
        [key: string]: number; // 任意のキー（string）に number 型の値
      }
      interface BooleanHash {
        [key: string]: boolean; // 任意のキー（string）に boolean 型の値
      }
      const messageData:  {
        initialize: BooleanHash;
        hiyari: boolean;
        label: StringHash;
        score: NumberHash;
        message: StringHash;
        intersection: StringHash;
      } = {
        initialize: {},
        hiyari: score.hiyari,
        label: {},
        score: {},
        message: {},
        intersection: {}
      };
      messageData.label['score1'] = self.label1; // string
      messageData.label['score2'] = self.label2;
      messageData.label['score3'] = self.label3;
      messageData.label['score4'] = self.label4;

      messageData.score['score1'] = score.score1; //number
      messageData.score['score2'] = score.score2;
      messageData.score['score3'] = score.score3;
      messageData.score['score4'] = score.score4;

      // 診断結果に含まれるメッセージ情報を取り出して表示
      for (let i=0; i<score.messages.length; i++) {
        const message = score.messages[i];
        if (messageData.label[message.key] !== '') {
          messageData.initialize[message.key] = true;
        }
        // メッセージの文字列に、発生数と交差点情報を反映
        message.text = message.text.replace(/%COUNT/g, '1').replace(/%INTERSECTION/g, message.intersection);
        const key = message.key + '-' + message.type;
        if (messageData.message[key] === undefined) {
          messageData.message[key]  = '';
        }
        // メッセージ
        messageData.message[key] += message.text;
        // 交差点
        messageData.intersection[message.key] = message.intersection;
      }
      if (0 < score.messages.length) {
        // 対象メッセージをリストの先頭に追加して表示
        self.resultMessages.unshift({dateText:dateText, messageData:messageData, capabilityScore: new CapabilityScore(null, 0)});
      }

    }, this.drawScoreLogicGraph.bind(this));

    // Censor読み込み開始
    this.runSensorTimer();

    //動画再生
    if (this.loadVideoFinish) {
      this.videoElement.nativeElement.play();
    }
  }

  /**
   * 運転診断を終了
   */
  public onStopScoreLogic(title: string = '運転診断') {
    this.logService.debug('[DrivingScore][EditPage] onStopScoreLogic');
    // タイトルを更新
    this.resultTitle = title;

    // センサー情報の読み込みを止める
    clearInterval(this.sensorTimer);
    this.sensorLogCounterText = '　';
    this.rangeValue = 0;
    DemoData.instance().reset();

    // 動画データを止める
    if (this.videoElement.nativeElement.paused == false) {
      this.videoElement.nativeElement.pause();
    }
    this.videoElement.nativeElement.currentTime = 0;

    // 運転診断ロジックを止める
    this.scoreLogic.stop();
    this.scoreLogicRunning = false;
    this.sensorTimerPause = true;
  }

  /**
   * 運転診断の一時停止
   */
  public onScoreLogicPause() {
    if (this.scoreLogicRunning) {
      this.logService.debug('[DrivingScore][EditPage] onScoreLogicPause');
      this.sensorTimerPause = true;
      this.scoreLogic.pause(true);
      if (this.videoElement.nativeElement.paused == false) {
        this.videoElement.nativeElement.pause();
      }
    }
  }

  /**
   * 運転診断の一時停止から再開
   */
  public onScoreLogicStart() {
    if (this.scoreLogicRunning) {
      this.logService.debug('[DrivingScore][EditPage] onScoreLogicStart');
      this.sensorTimerPause = false;
      this.scoreLogic.pause(false);
      if (this.loadVideoFinish) {
        this.videoElement.nativeElement.play();
      }
    }
  }

  /**
   * センサー情報のレンジ変更開始イベント
   */
  public onRangeMoveStart(ev: any) {
    this.onScoreLogicPause();
  }

  /**
   * センサー情報のレンジ変更終了イベント
   */
  public onRangeMoveEnd(ev: any) {
    if (this.scoreLogicRunning) {
      // 秒をミリ秒に直して、センサータイマーの10ミリ秒間隔に変換したインデックス
      const videoTime = ev.detail.value * 1000;
      this.logService.debug('[DrivingScore][EditPage] onScoreLogicPause. videoTime='+ev.detail.value);
      // センサー情報レンジを更新
      DemoData.instance().seekSensorLogData(videoTime);
      this.videoElement.nativeElement.currentTime = ev.detail.value;

      this.sensorLogCounterText = '(' + EditPage.parseTime(ev.detail.value) + '経過)';
    }
  }

  /**
   * センサー情報をクリア
   */
  public onClearSensorLog() {
    // 前回の運転診断結果をクリア
    this.clearResultData();
    // センサー情報を情報クリア
    this.clearSensorDemoData();
    // 動画データクリア
    if (this.videoElement.nativeElement.paused == false) {
      this.videoElement.nativeElement.pause();
    }
    this.videoElement.nativeElement.removeAttribute('src');
    this.videoElement.nativeElement.load();
    this.loadVideoFinish = false;
  }

  /**
   * チェックボックス選択
   */
  public changeChecked(key: string, checkBox: 'check1' | 'check2') {
    this.graphData[key][checkBox] = !this.graphData[key][checkBox];
    if (this.chartDestroy == false) {
      this.drawGraph(null);
    }
  }

  private isChecked(key: string) {
    return this.graphData[key]['check1'] || this.graphData[key]['check2'];
  }

  public onChangeRange() {
    if (this.chart !== undefined
      && this.chartDestroy == false
      && this.chart.options.scales !== undefined
      && this.chart.options.scales['y-axis-1'] !== undefined
      && this.chart.options.scales['y-axis-2'] !== undefined) {

      if (this.range1Min < this.range1Max || this.range1Min == null || this.range1Max == null) {
        this.chart.options.scales['y-axis-1'].min = this.range1Min;
        this.chart.options.scales['y-axis-1'].max = this.range1Max;
      }

      if (this.range2Min < this.range2Max || this.range2Min == null || this.range2Max == null) {
        this.chart.options.scales['y-axis-2'].min = this.range2Min;
        this.chart.options.scales['y-axis-2'].max = this.range2Max;
      }

      this.chart.update();
    }
  }

  /**
   * 秒を文字列に変換
   */
  private static parseTime(sec: number): string {
    const _hour = Math.floor(sec % 86400 / 3600);
    const _minute = Math.floor(sec % 3600 / 60);
    const _sec = sec % 60;
    if (0 < _hour) {
      return _hour + '時間' + _minute + '分' + _sec + '秒';
    } else if (0 < _minute) {
      return _minute + '分' + _sec + '秒';
    }
    return _sec + '秒';
  }

  /**
   * asyncが必要な初期化
   */
  private async init() {
    await this.loginService.initialize();

    // 運転診断ロジックのプログラムを読み込み、テキストエディタにセット
    await this.storage.create();
    this.scoreLogicText = await this.storage.get(environment.scoreLogicKey);
    this.ionicForm.patchValue({
      scoreLogicText: this.scoreLogicText,
    });

    this.labelScoreAll = '総合スコア';
    this.label1 = this.loginService.settings.label.label1;
    this.label2 = this.loginService.settings.label.label2;
    this.label3 = this.loginService.settings.label.label3;
    this.label4 = this.loginService.settings.label.label4;
    this.labelA = this.loginService.settings.label.labelA;
    this.labelB = this.loginService.settings.label.labelB;
    this.labelC = this.loginService.settings.label.labelC;
  }

  /**
   * 運転診断ロジックの更新成功ダイアログを表示
   */
  private async showSaveScoreLogicDialog() {
      var self = this;
      const alert = await this.alertController.create({
        header: '運転診断スコアロジックを更新してダウンロードしました。',
        cssClass: 'custom-alert',
        //subHeader: '運転診断コメント',
        //message: 'あいうえおかきくけこさしすせそたちつてと',
        buttons: [
            {
              text: '閉じる',
              cssClass: 'alert-button-confirm',
              role: 'confirm',
              handler: () => {
                //
              }
            }
        ]
      });
      await alert.present();
  }

  /**
   * 運転診断ロジックの更新失敗ダイアログを表示
   */
  private async showFailedScoreLogicDialog(errorMsg: any) {
      const alert = await this.alertController.create({
        header: '運転診断スコアロジックがエラーになるため更新できません。',
        cssClass: 'custom-alert',
        //subHeader: '運転診断コメント',
        message: errorMsg,
        buttons: [
            {
              text: '閉じる',
              cssClass: 'alert-button-confirm',
              role: 'confirm',
              handler: () => {
                //
              }
            }
        ]
      });
      await alert.present();
  }

  /**
    * FileReaderをPromise実行するための関数
    */
  private readAsDataURL(elem: any): Promise<any>{
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(elem);
    });
  }

  /**
   * センサー情報を読み込み
   */
  private loadSensorDemoData() {
    // すでにセンサーログを読み込み済みなら機能をONにする
    if (0 < DemoData.instance().getSensorLogDataSize()) {
      this.sensorLogLoaded = true;

      this.rangeMin = Math.round(DemoData.instance().minVideoTime / 1000);
      this.rangeMax = Math.round(DemoData.instance().maxVideoTime / 1000);
      this.rangeMaxText = EditPage.parseTime(this.rangeMax);
    }
  }

  /**
   * センサー情報をクリア
   */
  private clearSensorDemoData() {
    DemoData.instance().clearAll();
    this.sensorLogLoaded = false;
    this.rangeMin = 0;
    this.rangeMax = 0;
    this.rangeValue = -1;
    this.rangeMaxText = '';
  }

  /**
   * 運転診断結果を初期化
   */
  private clearResultData() {
    this.resultTitle = '運転診断';
    this.sensorLogCounterText = '　';
    this.resultMessages.splice(0);
    if (this.chart !== undefined) {
      this.chart.destroy();
      this.chartDestroy = true;
    }
    this.initializeGraphData();
  }

  /**
   * グラフデータを初期化
   */
  private initializeGraphData() {
    for (const key in this.graphData) {
      this.graphData[key].data = [...Array(EditPage.GRAPH_SIZE)].map(() => null) as (number | null)[];

    }
    this.sensorDataList.splice(0);
  }

  /**
   * 運転診断としてセンサー情報の読み込み開始
   */
  private runSensorTimer() {
    SensorManager.initializeCalibration();

    // ダミーのセンサー情報を運転診断ロジックに送り続ける
    var self = this;
    var lastTimestamp = -1;
    var lastTime = -1;
    this.sensorTimerPause = false;
    this.sensorTimer = setInterval(function() {
      if (self.sensorTimerPause) {
        return;
      }

      try {
        // ダミーのセンサー情報を取得
        // 取得するとセンサーサービスの内部でカウントアップして次のセンサー情報が自動でセットされる
        const sensorData = DemoData.instance().getSensorLogData();
        if (sensorData === undefined) {
          // ダミーのセンサー情報がなくなったら運転診断終了
          self.onStopScoreLogic('運転診断 正常終了');
          return;
        } else {
          self.lastSensorTime = sensorData.videoTime;
        }

        //delete sensorData.calibration;

        // キャリブレーション
        SensorManager.calibration(sensorData);

        // 運転診断スコアを追加
        sensorData.score = {
          scoreAll: self.scoreLogic.scoreOverAll,
          score1: self.scoreLogic.score1,
          score2: self.scoreLogic.score2,
          score3: self.scoreLogic.score3,
          score4: self.scoreLogic.score4,
          hiyari: false,
          capabilityScore: new CapabilityScore(null, 0)
        }

        // グラフを描画
        if (sensorData.calibration) {
          self.drawGraph(sensorData);
        }

        // センサー情報を運転診断ロジックに送る
        self.scoreLogic.pushSensorData(sensorData);

        // センサー情報レンジを更新
        const videoTime = self.lastSensorTime / 1000;
        self.rangeValue = Math.floor(videoTime);
        if (1 <= Math.abs(self.videoElement.nativeElement.currentTime - Math.round(videoTime))) {
          self.videoElement.nativeElement.currentTime = videoTime;
        }

        // このタイマーは10ms間隔で実行しているため、ダミーセンサー情報の残数から残り時間を逆算して表示
        const time = Math.round(sensorData.videoTime / 1000);
        if (lastTime != time) {
          self.sensorLogCounterText = '(' + EditPage.parseTime(time) + '経過)';
          lastTime = time;
        }

        if (lastTimestamp < sensorData.timestamp - 300
          && sensorData !== undefined
          && sensorData.geolocation !== undefined) {

          lastTimestamp = sensorData.timestamp;
          self.sensorData = sensorData;
        }
      } catch (error) {
        self.logService.error('[DrivingScore][EditPage] sensorTimer pushSensorData', error);
        self.onStopScoreLogic('運転診断 異常終了');
      }
    }, 10);
  }

  /**
   * 運転診断動画を読み込み
   */
  private loadVideo(videoPath: any) {
    if (videoPath != '') {
      this.videoElement.nativeElement.autoplay = false;
      this.videoElement.nativeElement.loop = false;
      this.videoElement.nativeElement.muted = true;
      this.videoElement.nativeElement.src = URL.createObjectURL(videoPath);
      this.videoElement.nativeElement.currentTime = 0;
      this.loadVideoFinish = true;
    }
  }

  /**
   * 運転診断スコアロジック側で呼び出すグラフ描画関数
   */
  private drawScoreLogicGraph(keyName:string, data: number, type: string = 'line') {
    if (this.sensorDataList.length == 0 || this.scoreLogicRunning == false) {
      return;
    }

    // 一番最後のセンサーデータにスコアロジックが登録する値も登録することで描画してもらえる
    const sensorData = this.sensorDataList[this.sensorDataList.length - 1];
    if (sensorData.scoreLogicData === undefined) {
      sensorData.scoreLogicData = [];
    }
    sensorData.scoreLogicData.push({keyName:keyName, value:data, type:type});
  }

  private setData(key: string, index: number, data: (number | null)) {
    try {
      if (this.isChecked(key)) this.graphData[key].data[index] = data;
    } catch(error) {
      this.logService.error('[DrivingScore][EditPage] setData. key='+key+', index='+index+', data='+data, error);
    }
  }

  /**
   * グラフを描画
   */
  private drawGraph(saveSensorData: any) {
    if (saveSensorData != null) {
      this.sensorDataList.push(saveSensorData);
    }

    const currentTime = Date.now();
    if (currentTime - this.lastDrawTimes < 300) {
      // 300ms経過するまで描画しない
      return;
    }
    this.lastDrawTimes = currentTime;

    const spliceSize = this.sensorDataList.length - EditPage.GRAPH_SIZE;
    if (0 < spliceSize) {
      this.sensorDataList.splice(0, spliceSize);
    }

    const labels: string[] = [...Array(EditPage.GRAPH_SIZE)].map(() => '');

    // スコアロジックが出力したいグラフデータ用の箱を用意
    const scoreLogicData: {[key: string]: any[]} = {};
    const scoreLogicGraphType: {[key: string]: string} = {};

    // グラフデータを生成
    let index = EditPage.GRAPH_SIZE - this.sensorDataList.length;
    const first = index;
    this.sensorDataList.forEach(sensorData => {
      labels[index] = EditPage.parseTime(Math.round(sensorData.videoTime / 1000));

      if (this.isChecked('scoreLogic')) {
        if (sensorData.scoreLogicData !== undefined) {
          sensorData.scoreLogicData.forEach((data: any) => {
            const keyName: string = data.keyName;
            if (scoreLogicData[keyName] === undefined) {
              scoreLogicData[keyName] = [...Array(EditPage.GRAPH_SIZE)].map(() => null);
              scoreLogicGraphType[keyName] = data.type;
            }
            scoreLogicData[keyName][index] = data.value;
          });
        }
      }

      this.setData('scoreAll', index, sensorData.score.scoreAll);
      this.setData('score1', index, sensorData.score.score1);
      this.setData('score2', index, sensorData.score.score2);
      this.setData('score3', index, sensorData.score.score3);
      this.setData('score4', index, sensorData.score.score4);

      this.setData('hiyari', index, sensorData.score.hiyari ? 1 : null);

      const capability = sensorData.score.capabilityScore;
      this.setData('scoreA', index, -1 < capability.scoreA ? capability.scoreA : null);
      this.setData('scoreB', index, -1 < capability.scoreB ? capability.scoreB : null);
      this.setData('scoreC', index, -1 < capability.scoreC ? capability.scoreC : null);

      this.setData('geolocation.speed', index, sensorData.geolocation.speed * 3.6);
      this.setData('geolocation.heading', index, sensorData.geolocation.heading);

      this.setData('acceleration.gravity.x', index, sensorData.acceleration.accelerationIncludingGravity.x);
      this.setData('acceleration.gravity.y', index, sensorData.acceleration.accelerationIncludingGravity.y);
      this.setData('acceleration.gravity.z', index, sensorData.acceleration.accelerationIncludingGravity.z);
      this.setData('acceleration.beta', index, sensorData.acceleration.rotationRate.beta);
      this.setData('acceleration.gamma', index, sensorData.acceleration.rotationRate.gamma);
      this.setData('acceleration.alpha', index, sensorData.acceleration.rotationRate.alpha);

      if (sensorData.acceleration.accelerationIncludingGravity.lowPass !== undefined) {
        this.setData('accelerationLowPass.gravity.x', index, sensorData.acceleration.accelerationIncludingGravity.lowPass.x);
        this.setData('accelerationLowPass.gravity.y', index, sensorData.acceleration.accelerationIncludingGravity.lowPass.y);
        this.setData('accelerationLowPass.gravity.z', index, sensorData.acceleration.accelerationIncludingGravity.lowPass.z);
      }

      this.setData('gyroscope.beta', index, sensorData.gyroscope.beta);
      this.setData('gyroscope.gamma', index, sensorData.gyroscope.gamma);
      this.setData('gyroscope.alpha', index, sensorData.gyroscope.alpha);

      this.setData('magnetometer.x', index, sensorData.magnetometer.x);
      this.setData('magnetometer.y', index, sensorData.magnetometer.y);
      this.setData('magnetometer.z', index, sensorData.magnetometer.z);

      // 端末の向きを補正してデータを回転した値
      this.setData('rotateAcceleration.gravity.x', index, sensorData.acceleration.accelerationIncludingGravity.rotate.x);
      this.setData('rotateAcceleration.gravity.y', index, sensorData.acceleration.accelerationIncludingGravity.rotate.y);
      this.setData('rotateAcceleration.gravity.z', index, sensorData.acceleration.accelerationIncludingGravity.rotate.z);
      this.setData('rotateAccelerationLowPass.gravity.x', index, sensorData.acceleration.accelerationIncludingGravity.rotate.lowPass.x);
      this.setData('rotateAccelerationLowPass.gravity.y', index, sensorData.acceleration.accelerationIncludingGravity.rotate.lowPass.y);
      this.setData('rotateAccelerationLowPass.gravity.z', index, sensorData.acceleration.accelerationIncludingGravity.rotate.lowPass.z);
      this.setData('rotateGyroscope.beta', index, sensorData.gyroscope.rotate.beta);
      this.setData('rotateGyroscope.gamma', index, sensorData.gyroscope.rotate.gamma);

      // 車載CAN
      this.setData('canData.vehicleSpeed', index, sensorData.canData.vehicleSpeed);
      this.setData('canData.longAcc', index, sensorData.canData.longAcc);
      this.setData('canData.latAcc', index, sensorData.canData.latAcc);
      this.setData('canData.frontDistance', index, sensorData.canData.frontDistance);
      this.setData('canData.lateralDistance', index, sensorData.canData.lateralDistance);
      this.setData('canData.steeringAngle', index, sensorData.canData.steeringAngle);
      this.setData('canData.accelPedalPosition', index, sensorData.canData.accelPedalPosition);
      this.setData('canData.brakePressure', index, sensorData.canData.brakePressure);
      this.setData('canData.brakeSwitch', index, sensorData.canData.brakeSwitch);
      this.setData('canData.shiftIndication', index, sensorData.canData.shiftIndication);
      this.setData('canData.turnSignal', index, sensorData.canData.turnSignal);

      index++;
    });

    const datasets = [];
    let colorIndex = 0;
    //スコアロジックから登録された値をグラフに追加
    if (this.isChecked('scoreLogic')) {
      Object.keys(scoreLogicData).forEach(key => {
        if (this.graphData['scoreLogic']['check1'])
          datasets.push(this.makeDataSet(key+' (L', this.OTHER_COLORS[colorIndex], 1, scoreLogicData[key], scoreLogicGraphType[key]));
        if (this.graphData['scoreLogic']['check2'])
          datasets.push(this.makeDataSet(key+' (R', this.OTHER_COLORS[colorIndex], 2, scoreLogicData[key], scoreLogicGraphType[key]));

        colorIndex++;
        if (this.OTHER_COLORS.length <= colorIndex) {
          colorIndex = 0;
        }
      });
    }

    for (const key in this.graphData) {
      if (key === 'showAllCheckBox' || key === 'scoreLogic')
        continue;

      const graphType = this.DRAW_POINT_GRAPH.includes(key) ? 'point' : 'line';
      const colorKey = key.replace(/\..*/g, '');
      if (this.graphData[key]['check1'])
        datasets.push(this.makeDataSet(this.graphData[key].label + ' (L', this.COLORS[colorKey], 1, this.graphData[key].data, graphType));
      if (this.graphData[key]['check2'])
        datasets.push(this.makeDataSet(this.graphData[key].label + ' (R', this.COLORS[colorKey], 2, this.graphData[key].data, graphType));
    }

    if (this.chart !== undefined && this.chartDestroy == false && datasets.length == this.chart.data.datasets.length) {
      this.chart.data.labels = labels;
      datasets.forEach(data => {
        for (let i=0; i<this.chart.data.datasets.length; i++) {
          if (this.chart.data.datasets[i].label == data.label) {
            this.chart.data.datasets[i].data = data.data;
            //this.chart.data.datasets[i].pointRadius = data.pointRadius;
            this.chart.data.datasets[i].borderWidth = data.borderWidth;
            break;
          }
        }
      });

      this.chart.update();

    } else {
      if (this.chartDestroy == false) {
        this.chart.destroy();
      }

      this.chartDestroy = false;
      this.chart = new Chart(this.lineCanvas1.nativeElement, {
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets,
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          spanGaps: true,
          elements: {
            line: {
              tension: 0 // ベジェ曲線無効化
            }
          },
          scales: {
            'y-axis-1': {
              type: 'linear',
              position: 'left',
              beginAtZero: false,
              //suggestedMax: 3,
              //suggestedMin: -3,
              //suggestedMin: 0,
              ticks: {
                stepSize: 2,
              }
            },
            'y-axis-2': {
              type: 'linear',
              position: 'right',
              beginAtZero: false,
              //min: 0,
              //max: 120,
              //suggestedMin: 0,
              //title: {
                //display: true,
                //text: '時速',
              //},
              grid: {
                lineWidth: 0
              },
              ticks: {
                stepSize: 2,
              }
            },
            x: {
              ticks: {
                autoSkip: true,
                maxTicksLimit: 8,
              }
            },
          },
        }
      });
    }

    this.onChangeRange();
  }

  /**
   * グラフ用のデータセットを作成
   */
  private makeDataSet(label: string, color: string, id: number, data: any, graphType: string = ''): Dataset {
    const dataSet = {
      label: label,
      data: data,
      borderColor: color+'AA',
      backgroundColor: color+'AA',
      pointRadius: 0,
      fill: false,
      borderWidth: 2,
      //lineTension: 0.6,
      yAxisID: 'y-axis-' + id,
      skipNull: true,
    };
    if (graphType == 'point') {
      //グラフが点の時は線を消す
      dataSet.pointRadius = 3;
      dataSet.borderWidth = 0;
    } else if (graphType == 'line') {
      dataSet.pointRadius = 2;
      dataSet.borderWidth = 1;
    }
    return dataSet;
  }

  dateFormat(date: Date) {
    const YY = String(date.getFullYear());
    const MM = (date.getMonth()+1) < 10 ? '0'+(date.getMonth()+1) : String(date.getMonth()+1);
    const DD = date.getDate() < 10 ? '0'+date.getDate() : String(date.getDate());
    const hh = date.getHours() < 10 ? '0'+date.getHours() : String(date.getHours());
    const mm = date.getMinutes() < 10 ? '0'+date.getMinutes() : String(date.getMinutes());
    const ss = date.getSeconds() < 10 ? '0'+date.getSeconds() : String(date.getSeconds());
    return YY+'-'+MM+'-'+DD+' '+hh+':'+mm+':'+ss;
  }

  round(value: number): number {
    return Math.round(value * 100) / 100.0;
  }
}


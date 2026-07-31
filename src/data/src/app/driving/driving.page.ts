import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { Insomnia } from '@awesome-cordova-plugins/insomnia/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { Platform, NavController, AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { Capacitor } from '@capacitor/core';

import { LoginService } from '../services/login.service';
import { MapService } from '../services/map.service';
import { SensorService } from '../services/sensor.service';
import { LogService } from '../services/log.service';

import { ScoreDbService } from '../services/score-db.service';
import { ScoreLogic } from '../data/score-logic';
import { Score, Message } from '../data/score';
import { DemoData } from '../data/demo-data';

import { environment } from '../../environments/environment';

declare var google: any;

@Component({
  selector: 'app-driving',
  templateUrl: './driving.page.html',
  styleUrls: ['./driving.page.scss'],
})
export class DrivingPage implements OnInit {

  @ViewChild('map', {read: ElementRef, static: false}) mapElement: ElementRef;

  public label1: string = '';
  public label2: string = '';
  public label3: string = '';
  public label4: string = '';

  public cssHeader: string;
  public cssMap: string;
  public cssScore: string;
  public cssStart: string;
  public cssPointer: string;

  public scoreShowStarArea1: boolean = true;
  public scoreShowStarArea2: boolean = true;
  public scoreAllText: string = '--';
  public score1Text: string = '--';
  public score2Text: string = '--';
  public score3Text: string = '--';
  public score4Text: string = '--';
  public scoreAll: number = 0;
  public score1: number = 0;
  public score2: number = 0;
  public score3: number = 0;
  public score4: number = 0;

  public recording: boolean = false;

  // 0:遷移直後、1:実行中、2:実行終了
  public status: number = 0;
  private statusValues: any = {
    init: 0,
    running: 1,
    finish: 2
  };

  private landscape: boolean;

  private mediaRecorder: MediaRecorder;
  private videoRecordedPath: string;
  private videoChunks: Array<Blob> = [];

  private autoScrollLock: boolean = false;

  private scoreLogic: ScoreLogic;

  private lastLatLng: any = null;

  private saveDirectoryPath: string;

  public hasAndroid: boolean;

  // コンストラクタ
  constructor(
    private navCtrl: NavController,
    private alertController: AlertController,
    private screenOrientation: ScreenOrientation,
    private platform: Platform,
    private loginService: LoginService,
    private logService: LogService,
    private sensorService: SensorService,
    private mapService: MapService,
    private scoreDbService: ScoreDbService,
    private storage: Storage,
    private insomnia: Insomnia,
    private file: File) {

    this.hasAndroid = (Capacitor.getPlatform() == 'android');

    this.initialize();
  }

  async initialize() {
    await this.loginService.initialize();

    this.label1 = this.loginService.settings.label.label1;
    this.label2 = this.loginService.settings.label.label2;
    this.label3 = this.loginService.settings.label.label3;
    this.label4 = this.loginService.settings.label.label4;

    await this.logService.initialize(this.file);
    this.scoreLogic = new ScoreLogic(this.logService, this.storage);

    DemoData.initialize(this.file, this.logService);
  }

  // コンポーネントの初期化時に実行される
  ngOnInit() {
    this.logService.debug('[DrivingScore][DrivingPage] ngOnInit');
    this.changeOrientation();

    this.scoreShowStarArea1 = this.loginService.settings.scoreShowStar.area1;
    this.scoreShowStarArea2 = this.loginService.settings.scoreShowStar.area2;
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    this.logService.debug('[DrivingScore][DrivingPage] ionViewWillEnter');
    var self = this;
    this.screenOrientation.unlock();
    this.screenOrientation.onChange().subscribe(() => {
      self.changeOrientation();
    });
  }

  // ページがアクティブになったとき実行
  ionViewDidEnter() {
    this.logService.debug('[DrivingScore][DrivingPage] ionViewDidEnter');

    this.loadVideo();

    var self = this;
    this.sensorService.start((message: string, data: any, flag: boolean) => {
      if (message === 'Geolocation') {
        self.updateSensor(data, flag);
      }
    });

    this.mapService.loadGoogleInstance(()=>{
      self.loadMap();
    });

    this.insomnia.keepAwake()
        .then(
          () => self.logService.debug('[DrivingScore][DrivingPage] ionViewDidEnter: keepAwake success'),
          () => self.logService.debug('[DrivingScore][DrivingPage] ionViewDidEnter: keepAwake error')
        );
  }

  // ページが非アクティブになる直前に実行
  ionViewWillLeave() {
    this.sensorService.stop();
    this.scoreLogic.stop();
    this.mapService.stop();
    this.stopVideo();

    var self = this;
    this.insomnia.allowSleepAgain()
      .then(
        () => self.logService.debug('[DrivingScore][DrivingPage] ionViewDidEnter: allowSleepAgain success'),
        () => self.logService.debug('[DrivingScore][DrivingPage] ionViewDidEnter: allowSleepAgain error')
      );
  }

  // 端末の縦横でデザインを変更する
  changeOrientation() {
    this.logService.debug('[DrivingScore][DrivingPage] changeOrientation: type=' + this.screenOrientation.type);

    this.landscape = this.screenOrientation.type.indexOf('landscape') > -1;
    if (this.hasAndroid == false) {
      this.landscape = (this.platform.width() > this.platform.height()); //DUMMY
    }

    this.cssHeader = this.landscape ? 'header_landscape' : 'header_portrait';
    this.cssMap = this.landscape ? 'map_landscape' : 'map_portrait';
    this.cssScore = this.landscape ? 'score_landscape' : 'score_portrait';
    this.cssStart = this.landscape ? 'start_landscape' : 'start_portrait';
    this.cssPointer = this.landscape ? 'pointer_landscape' : 'pointer_portrait';
  }

  async loadMap() {
    if (this.lastLatLng === null) {
      this.lastLatLng = await this.sensorService.getLastLatLng();
    }
    await this.mapService.createMap(this.mapElement.nativeElement, this.lastLatLng, 16);

    // 運転診断済みだとマーカーが保存されているので描画する
    this.mapService.drawCarMarker(this.lastLatLng, 0);

    // 運転診断済みの時はスケールをフィットさせる
    if (this.status == this.statusValues.finish) {
      this.mapService.fitBounds();
    }

    var self = this;
    this.mapService.addListener("drag", () => {
      // 地図を触ったら自車位置追従をOFFにする
      self.autoScrollLock = true;
    });

    this.mapService.addListener("mark", (title: string, pos: number) => {
      if (self.status == self.statusValues.finish) {
        try {
          self.logService.debug('[DrivingScore][DrivingPage] loadMap: mark title='+title+', pos='+pos);
          self.logService.debug('[DrivingScore][DrivingPage] loadMap: videoRecordedPath='+self.videoRecordedPath);
          // ヒヤリ地点を選択したらページ遷移
          self.mapService.setSelectMarkerPos(pos);
          let recordedPath = self.videoRecordedPath ?? '';
          recordedPath = recordedPath.split('/').join('@');
          self.navCtrl.navigateForward('/bad-spot/' + recordedPath);
        } catch (error: any) {
          self.logService.error('[DrivingScore][DrivingPage] loadMap', error);
        }
      }
    });
    this.logService.debug('[DrivingScore][DrivingPage] loadMap: Finish');
  }

  // 運転診断開始
  async onStart() {
    //スコアロジックに使用するJSONと実行ファイルをストレージに保存
    await this.saveScoreLogic();

    this.logService.debug('[DrivingScore][DrivingPage] onStart');

    // センサーに運転診断開始を通知
    this.sensorService.startScoreLogic();

    this.status = this.statusValues.running;
    // 自車位置追従
    this.autoScrollLock = false;
    // 地図を自車位置へ移動
    this.mapService.clearMarker();
    this.mapService.setZoom(16);
    this.mapService.setCenter(this.lastLatLng);
    // 開始地点を描画
    this.lastLatLng = await this.sensorService.getLastLatLng();
    this.mapService.drawStartMarker(this.lastLatLng);

    // 運転診断スコアロジック起動
    this.scoreLogic.clearAll();
    var self = this;
    const interval = this.loginService.settings.scoreLogicInterval;
    this.scoreLogic.start(interval, (score: Score, error: string) => {
      if (score != null) {
        self.checkScoreLogic(score);
      }
    });

    // ビデオ撮影開始
    this.startVideo();
  }

  // 運転診断終了
  onStop() {
    this.logService.debug('[DrivingScore][DrivingPage] onStop');

    this.status = this.statusValues.finish;

    // 運転診断スコアロジック停止
    this.scoreLogic.stop();

    // センサーに運転診断終了を通知
    this.sensorService.stopScoreLogic();

    // ビデオ撮影終了
    this.stopVideo();

    // 終了地点を描画
    this.mapService.drawEndMarker(this.lastLatLng);
    // 全ての地点が収まるスケールにフィットさせる
    this.mapService.fitBounds();

    // 運転診断結果をDBへ保存
    this.scoreDbService.insertScore(this.scoreLogic);

    // 最後の診断件結果のIDを保存（別のページで使う）
    this.loginService.scoreId = this.scoreLogic.startTimestamp;

    // 終了ダイアログを表示
    this.showDrivingFinishDialog();

    this.logService.resetLogDir();
  }

  onHistory() {
    this.navCtrl.navigateForward('/history');
  }

  onScore() {
    if (this.status == this.statusValues.finish) {
      this.navCtrl.navigateForward('/comment');
    }
  }

  onPointer() {
    // 自車位置追従
    this.autoScrollLock = false;

    if (this.status == this.statusValues.finish) {
      // 全ての地点が収まるスケールにフィットさせる
      this.mapService.fitBounds();
    } else {
      // 自車位置を表示
      this.mapService.setZoom(16);
      this.mapService.setCenter(this.lastLatLng);
    }
  }

  async showDrivingFinishDialog() {
    const alert = await this.alertController.create({
      header: '運転診断を終了しました',
      cssClass: 'custom-alert',
      //subHeader: '運転お疲れ様でした。',
      message: '運転お疲れ様でした。\nスコアをタップすると詳細な運転診断結果を確認できます。',
      buttons: [
          { text: '閉じる', cssClass: 'alert-button-confirm', role: 'confirm', handler: () => { } }
      ]
    });
    await alert.present();
  }

  /////////// VIDEO
  async loadVideo() {
    if (this.hasAndroid == false) {
      if (DemoData.instance().movieFile != '') {
        this.videoRecordedPath = URL.createObjectURL(DemoData.instance().movieFile);
      }
      return;
    }
    /*
    let video: any = {facingMode : "environment"
      , width: { min: 640, ideal: 640, max: 1280 }
      , height: { min: 360, ideal: 360, max: 720 }
      , frameRate: { ideal: 30, max: 30 }
    };
    */
    let video: any = {facingMode : "environment"
      , width: { min: 1280, ideal: 1280 }
      , height: { min: 720, ideal: 720 }
    };

    var self = this;
    await navigator.mediaDevices.getUserMedia({
      video: video,
      audio: true,
    })
    .then((stream)=>{
      self.mediaRecorder =  new MediaRecorder(stream, { mimeType: 'video/webm' });

      self.mediaRecorder.addEventListener('dataavailable', event => {
        self.saveVideo(event);
      });

      self.logService.debug('[DrivingScore][DrivingPage] loadVideo: Finish');
    })
    .catch((error: any) => {
      self.logService.error('[DrivingScore][DrivingPage] loadVideo', error);
    });
  }

  startVideo() {
    if (this.hasAndroid == false || this.loginService.settings.recording == false) {
      return;
    }

    try {
      if (this.mediaRecorder != null && this.mediaRecorder.state == 'inactive') {
        this.logService.debug('[DrivingScore][DrivingPage] startVideo');
        this.recording = true;
        this.videoChunks.splice(0);
        this.mediaRecorder.start(60000); //60秒ごとにdataavailableを発火
      }
    } catch (error: any) {
      this.logService.error('[DrivingScore][DrivingPage] startVideo', error);
    }
  }

  stopVideo() {
    if (this.hasAndroid == false || this.loginService.settings.recording == false) {
      return;
    }

    try {
      if (this.mediaRecorder != null && this.mediaRecorder.state != 'inactive') {
        this.logService.debug('[DrivingScore][DrivingPage] stopVideo');
        this.recording = true;
        this.mediaRecorder.stop();
      }
    } catch (error: any) {
      this.logService.error('[DrivingScore][DrivingPage] stopVideo', error);
    }
  }

  async saveVideo(event: any) {
    if (this.hasAndroid == false) {
      return;
    }
    try {
      this.videoChunks.push(event.data);

      this.logService.debug('[DrivingScore][DrivingPage] saveVideo. movie.webm append');
      if (this.videoChunks.length == 1) {
        this.file.writeFile(this.saveDirectoryPath, 'movie.webm', event.data);
      } else {
        this.file.writeFile(this.saveDirectoryPath, 'movie.webm', event.data, { append: true });
      }

      if (this.mediaRecorder.state == 'inactive') {
        const webm = new Blob(this.videoChunks, { 'type' : 'video/webm' });
        this.videoRecordedPath = URL.createObjectURL(webm);
        this.videoChunks.splice(0);
        this.logService.debug('[DrivingScore][DrivingPage] saveVideo finish. videoRecordedPath=' + this.videoRecordedPath);
      }

    } catch (error) {
      this.logService.error('[DrivingScore][DrivingPage] saveFile failed.', error);
    }
  }

  updateSensor(sensorData: any, updateMap: boolean) {
    try {
      if (sensorData === null) {
        // センサー異常発生のため運転診断を終了する
        this.onStop();

      } else if (updateMap == false) {
        this.scoreLogic.pushSensorData(sensorData);

      } else {
        const geolocation = sensorData.geolocation;

        this.lastLatLng = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);

        if (this.status == this.statusValues.running) {
          this.mapService.drawCircleMarker(this.lastLatLng);
        }

        if (this.status != this.statusValues.finish && this.autoScrollLock == false) {
          this.mapService.setCenter(this.lastLatLng);
        }
        this.mapService.drawCarMarker(this.lastLatLng, geolocation.heading);
      }
    } catch (error) {
      this.logService.error('[DrivingScore][DrivingPage] updateSensor', error);
    }
  }

  dateFormat(date: Date) {
    const YY = String(date.getFullYear());
    const MM = (date.getMonth()+1) < 10 ? '0'+(date.getMonth()+1) : String(date.getMonth()+1);
    const DD = date.getDate() < 10 ? '0'+date.getDate() : String(date.getDate());
    const hh = date.getHours() < 10 ? '0'+date.getHours() : String(date.getHours());
    const mm = date.getMinutes() < 10 ? '0'+date.getMinutes() : String(date.getMinutes());
    const ss = date.getSeconds() < 10 ? '0'+date.getSeconds() : String(date.getSeconds());
    return YY+'/'+MM+'/'+DD+' '+hh+':'+mm+':'+ss;
  }

  checkScoreLogic(score: Score) {
    //スコアの平均点を計算
    this.scoreAll = Math.round(this.scoreLogic.scoreOverAll);
    this.score1 = Math.round(this.scoreLogic.score1);
    this.score2 = Math.round(this.scoreLogic.score2);
    this.score3 = Math.round(this.scoreLogic.score3);
    this.score4 = Math.round(this.scoreLogic.score4);

    this.scoreAllText = this.getRank(this.scoreAll);
    this.score1Text = this.getRank(this.score1);
    this.score2Text = this.getRank(this.score2);
    this.score3Text = this.getRank(this.score3);
    this.score4Text = this.getRank(this.score4);

    if (score.initialize && score.hiyari) {
      // ヒヤリ地点だったらマークを登録
      this.pushBadPoint(score);
    }
  }

  /**
   * ヒヤリ地点を地図に描画
   * @param {Score} 運転診断ロジックの実行結果
   */
  pushBadPoint(score: Score) {
    const latLng = this.lastLatLng;
    const time = this.dateFormat(new Date());
    const videoTime = Math.floor(this.sensorService.getLastSensorTime() / 1000);

    let msg1: string = '';
    let msg2: string = '';
    let msg3: string = '';
    let msg4: string = '';
    for (let i=0; i<score.messages.length; i++) {
      const message = score.messages[i];
      if (message.type != 'positive') {
        const text = message.text.replace(/%COUNT/g, '1').replace(/%INTERSECTION/g, message.intersection);
        switch(message.key) {
          case 'score1':
            msg1 += text;
            break;
          case 'score2':
            msg2 += text;
            break;
          case 'score3':
            msg3 += text;
            break;
          case 'score4':
            msg4 += text;
            break;
        }
      }
    }
    this.mapService.drawMarker(
      latLng,
      time,
      videoTime,
      {
        msg1: msg1,
        msg2: msg2,
        msg3: msg3,
        msg4: msg4
      }
    );
    this.logService.debug('[DrivingScore][DrivingPage] pushBadPoint: add bad point');
  }

  private async setLogDir() {
  }

  private async saveScoreLogic() {
    if (this.hasAndroid == false) {
      return;
    }

    // 動画、ログ、センサーログのいずれかを保存する場合はディレクトリを作成
    if (this.loginService.settings.recording
      || this.loginService.settings.logStorage
      || this.loginService.settings.sensorLogStorage) {

      await this.logService.setLogDir('data.' + this.logService.getDateString(true));
      this.saveDirectoryPath = this.logService.getLogDir();
    }

    // ログ、センサーログのいずれかを保存する場合はScoreLogicJsonとScoreLogicを保存
    if (this.loginService.settings.logStorage
      || this.loginService.settings.sensorLogStorage) {

      // 保存するScoreLogicJsonデータ
      let saveText = await this.storage.get(environment.scoreLogicJsonKey);
      // ファイル保存
      this.file.writeFile(this.saveDirectoryPath, 'scoreLogicJson.txt', saveText, {replace:true});

      // 保存するScoreLogicデータ
      saveText = await this.storage.get(environment.scoreLogicKey);
      // ファイル保存
      this.file.writeFile(this.saveDirectoryPath, 'scoreLogic.txt', saveText, {replace:true});
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

  getRank(score: number): string {
    const rank = 101 - Math.round(score);
    return 100 < rank ? "100" : rank.toString();
  }
}

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

  //////// ヒヤリ録画（2026年度改修⑤）
  // fact #4679 / #4703 / #4706 / #4708 / #4709、proposal #227 / #230 / #242 / #244 / #245 / #256
  //
  // 通し録画は作らない。録画は診断中ずっと回し、1 秒ごとに届くチャンクを
  // メモリ上のリングバッファに積む。ヒヤリを検知したら、その前後 n 秒を
  // hiyari.NN.webm として切り出す。
  //
  // 時刻はすべて「録画開始からの経過 ms」で扱う（proposal #256 = video-clock）。
  // センサー時計（startScoreLogic 原点）とは原点が異なる点に注意。

  /** 録画開始時刻。mediaRecorder.start() の直前に Date.now() を入れる */
  private videoStartTimestamp: number = 0;
  /** chunk[0]。EBML ヘッダを含むため常時保持し、切り詰めの対象外とする */
  private videoHeadChunk: Blob | null = null;
  /** リングバッファ。直近 n+5 秒ぶんだけ持つ */
  private videoChunks: Array<{ blob: Blob, receivedAt: number, prevReceivedAt: number }> = [];
  /** 診断開始時に 1 回読む前後秒数（fact #4684）。走行中は固定 */
  private recordingMarginSec: number = 15;
  /** 書き出し中のヒヤリ動画。null なら区間は開いていない */
  private hiyariFileName: string | null = null;
  /** 現区間の終端（録画開始からの ms）。連結のたびに延長する */
  private hiyariSegmentEnd: number = 0;
  /** hiyari.NN.webm の NN。診断ごとに 1 から */
  private hiyariFileSeq: number = 0;

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
          // 動画パスはマーカーが持つ（proposal #257）。ルートパラメータは
          // 使わないが、ルート定義 /bad-spot/:path は互換のため残す
          self.navCtrl.navigateForward('/bad-spot/-');
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

    // ヒヤリ前後秒数は診断開始時に 1 回だけ読む。走行中に設定を変えても
    // この走行には反映しない（fact #4684）
    this.recordingMarginSec = this.loginService.settings.recordingMargin ?? 15;

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

        // 診断ごとに録画状態をリセットする
        this.videoHeadChunk = null;
        this.videoChunks.splice(0);
        this.hiyariFileName = null;
        this.hiyariSegmentEnd = 0;
        this.hiyariFileSeq = 0;

        // 録画時計の原点。start() の直前に取る（proposal #256 §3-1）
        this.videoStartTimestamp = Date.now();

        // センサー時計（startScoreLogic 原点）とのギャップを実測して残す。
        // 補正の要否は実測後に判断する（fact #4707）。
        const gap = this.videoStartTimestamp - this.sensorService.getStartTimestamp();
        this.logService.debug('[DrivingScore][DrivingPage] startVideo. videoStartOffset=' + gap + 'ms');

        this.mediaRecorder.start(1000); //1秒ごとにdataavailableを発火（fact #4679）
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

  /**
   * chunk[0] から EBML ヘッダ部分だけを取り出す（fact #4708）
   *
   * WebM は EBML ヘッダ → Segment(Info / Tracks) → Cluster... の順に並ぶので、
   * 最初の Cluster ID (0x1F43B675) の手前で切れば再生に必要な定義部が得られる。
   * chunk[0] は実測で 99.2〜99.93% が映像（録画開始直後の無関係な絵）なので、
   * 丸ごと付けると全ヒヤリ動画の冒頭にそれが入ってしまう。
   */
  private async extractWebmHeader(chunk0: Blob): Promise<Blob> {
    const buf = new Uint8Array(await chunk0.arrayBuffer());
    for (let i = 0; i + 4 < buf.length; i++) {
      if (buf[i] == 0x1f && buf[i + 1] == 0x43 && buf[i + 2] == 0xb6 && buf[i + 3] == 0x75) {
        return chunk0.slice(0, i);
      }
    }
    // Cluster が見つからない場合は丸ごと使う（再生できないよりはまし）
    this.logService.error('[DrivingScore][DrivingPage] extractWebmHeader: Cluster ID not found', null);
    return chunk0;
  }

  /**
   * ヒヤリ検知時に区間を開く、または既存区間を延長する（fact #4703 / #4706）
   *
   * 連結の判定は厳密不等号。t2 == t_end のときは連結せず別ファイルにする。
   * このとき新区間 [t2-n, t2+n] は前区間の末尾と最大 n 秒重複するが、
   * 構造的に避けられないため許容する（fact #4723）。
   *
   * @returns 当該ヒヤリが属するファイル名
   */
  private async openOrExtendHiyariSegment(): Promise<string> {
    const n = this.recordingMarginSec * 1000;
    const t = Date.now() - this.videoStartTimestamp;

    if (this.hiyariFileName != null && t < this.hiyariSegmentEnd) {
      // 連結。終端だけ延ばす
      this.hiyariSegmentEnd = t + n;
      this.logService.debug('[DrivingScore][DrivingPage] hiyari extend. file='
        + this.hiyariFileName + ' end=' + this.hiyariSegmentEnd);
      return this.hiyariFileName;
    }

    // 開いている区間があれば先に閉じる
    if (this.hiyariFileName != null) {
      this.closeHiyariSegment();
    }

    this.hiyariFileSeq++;
    const name = 'hiyari.' + ('0' + this.hiyariFileSeq).slice(-2) + '.webm';
    this.hiyariFileName = name;
    this.hiyariSegmentEnd = t + n;

    // ヘッダ + 区間先頭からのクラスタを書き出す。
    // 受信時刻はチャンクの終端側なので、区間 [t-n, t+n] と少しでも重なる
    // チャンクをすべて含める（proposal #256 §2）。そうしないと区間の
    // 冒頭を含むチャンクを取りこぼし、最大 1 秒欠ける。
    const from = t - n;
    const parts: Array<Blob> = [];
    if (this.videoHeadChunk != null) {
      parts.push(await this.extractWebmHeader(this.videoHeadChunk));
    }
    for (const c of this.videoChunks) {
      if (c.receivedAt > from) {
        parts.push(c.blob);
      }
    }

    const head = new Blob(parts, { 'type': 'video/webm' });
    await this.file.writeFile(this.saveDirectoryPath, name, head);
    this.logService.debug('[DrivingScore][DrivingPage] hiyari open. file=' + name
      + ' from=' + from + ' end=' + this.hiyariSegmentEnd + ' chunks=' + (parts.length - 1));

    return name;
  }

  /** 区間を閉じる。NN は次のヒヤリで繰り上がる */
  private closeHiyariSegment() {
    if (this.hiyariFileName == null) {
      return;
    }
    this.logService.debug('[DrivingScore][DrivingPage] hiyari close. file=' + this.hiyariFileName);
    this.hiyariFileName = null;
    this.hiyariSegmentEnd = 0;
  }

  /**
   * dataavailable の受け口（fact #4679 / #4699 / #4703）
   *
   * 通し動画 movie.webm は作らない。チャンクを受信時刻つきでリングバッファに
   * 積み、直近 n+5 秒だけ残す。区間が開いていればそのファイルへ append する。
   */
  async saveVideo(event: any) {
    if (this.hasAndroid == false) {
      return;
    }
    try {
      const now = Date.now() - this.videoStartTimestamp;
      const prev = this.videoChunks.length > 0
        ? this.videoChunks[this.videoChunks.length - 1].receivedAt
        : 0;

      if (this.videoHeadChunk == null) {
        // 先頭チャンク。EBML ヘッダを含むので捨てずに別枠で保持する
        this.videoHeadChunk = event.data;
      }
      this.videoChunks.push({ blob: event.data, receivedAt: now, prevReceivedAt: prev });

      // 区間が開いていれば、届いたチャンクをそのまま追記する
      if (this.hiyariFileName != null) {
        await this.file.writeFile(this.saveDirectoryPath, this.hiyariFileName,
          event.data, { append: true });

        // 終端を超えたら閉じる（proposal #256 §3-3）
        if (this.hiyariSegmentEnd < now) {
          this.closeHiyariSegment();
        }
      }

      // 直近 n+5 秒より古いものを捨てる。区間が開いているかに関わらず常に行う。
      // 区間内のチャンクは既にファイルへ書かれているのでメモリに残す必要がない。
      const keepFrom = now - (this.recordingMarginSec + 5) * 1000;
      while (this.videoChunks.length > 0 && this.videoChunks[0].receivedAt < keepFrom) {
        this.videoChunks.shift();
      }

      if (this.mediaRecorder.state == 'inactive') {
        // 診断終了。未確定の区間はこの時点までで確定させる（fact #4680）
        this.closeHiyariSegment();
        this.videoChunks.splice(0);
        this.videoHeadChunk = null;
        this.logService.debug('[DrivingScore][DrivingPage] saveVideo finish. files=' + this.hiyariFileSeq);
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
      // ヒヤリ地点だったらマークを登録。
      // 区間を先に開いてからマーカーを打つ（マーカーに動画ファイル名を持たせるため）
      this.onHiyariDetected(score);
    }
  }

  /**
   * ヒヤリ検知時の処理（proposal #256 §4）
   *
   * 録画が有効なら先に区間を開き、そのファイル名をマーカーに持たせる。
   * 録画が無効・非 Android のときはファイル名を持たないマーカーになる。
   */
  private async onHiyariDetected(score: Score) {
    let fileName: string = '';
    if (this.hasAndroid && this.loginService.settings.recording && this.mediaRecorder != null
      && this.mediaRecorder.state != 'inactive') {
      try {
        fileName = await this.openOrExtendHiyariSegment();
      } catch (error) {
        this.logService.error('[DrivingScore][DrivingPage] openOrExtendHiyariSegment failed.', error);
      }
    }
    this.pushBadPoint(score, fileName);
  }

  /**
   * ヒヤリ地点を地図に描画
   * @param {Score} 運転診断ロジックの実行結果
   */
  pushBadPoint(score: Score, videoPath: string = '') {
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
      },
      // マーカーにはフルパスを持たせる（proposal #257）。
      // 1-2（前回結果表示）はマーカーごとに走行ディレクトリが異なるため、
      // ディレクトリを画面単位で 1 つ持つ方式では表現できない。
      videoPath == '' ? '' : (this.saveDirectoryPath + videoPath)
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

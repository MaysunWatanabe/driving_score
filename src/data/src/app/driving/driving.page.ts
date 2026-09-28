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
  // fact #4679 / #4703 / #4706 / #4708
  // proposal #227 / #230 / #242 / #244 / #245 / #256 / #262 / #263 / #266
  //
  // proposal #262 で fact #4709（Timecode を書き換えない）と fact #4705 /
  // #4742 の一部（markersVideoTime はストリーム基準）を撤回した。
  // Cluster Timecode をファイル先頭起点へ振り直し、markersVideoTime も
  // ファイル先頭起点にする。
  //
  // 振り直しはチャンク単位で書き込み直前に行う（proposal #266）。ファイル
  // 全体の読み戻しは実機で返ってこない（3.6MB で恒久停止を実測）。Android の
  // File プラグインは位置 0 への書き込みでファイルを切り詰めるため
  // （LocalFilesystem.writeToFileAtURL）、途中の差し替えもできない。
  // したがって書き込みは追記のみとし、Duration はファイルに書かず
  // bad-spot 側で解決する（proposal #266 で #262 の Duration 書き込みを撤回）。
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
  /**
   * 現区間の開始時刻（録画開始からの ms）。連結しても動かさない。
   * markersVideoTime をファイル先頭起点で出すための基準（proposal #262）
   */
  private hiyariSegmentFrom: number = 0;
  /** hiyari.NN.webm の NN。診断ごとに 1 から */
  private hiyariFileSeq: number = 0;
  /**
   * 当該ヒヤリのマーカーに載せる videoTime（秒、ファイル先頭起点 / proposal #262）
   * 区間を開いた（延長した）その瞬間に確定させる。後続の await で時刻がずれても
   * マーカーの値は動かさない。
   */
  private hiyariMarkerVideoTime: number = 0;
  /**
   * 区間ファイルへの書き込みを直列化するキュー（proposal #263）
   *
   * open の初回書き込み・append・finalize を 1 本のチェーンに連結する。
   * 直列化しないと、Cordova の FileWriter が古いファイル長で seek(0) して
   * 先に書かれたヘッダを潰す（実測で 19 本中 2 本が先頭欠落）。
   */
  private hiyariWriteQueue: Promise<void> = Promise.resolve();
  /** 書き込みの通し番号。順序検証ログ用（proposal #263） */
  private hiyariWriteSeq: number = 0;
  /**
   * 現区間の Cluster Timecode 振り直し基準 t0（proposal #266）
   * 区間で最初に見つかった Cluster の値。null なら未確定
   */
  private hiyariTimecodeBase: number | null = null;
  /**
   * 次のチャンクへ繰り越すバイト列（proposal #266）
   * Cluster ヘッダがチャンク境界で分断されるのを防ぐため、末尾を保留する
   */
  private hiyariPendingTail: Uint8Array | null = null;

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
        this.hiyariSegmentFrom = 0;
        this.hiyariFileSeq = 0;
        this.hiyariMarkerVideoTime = 0;
        this.hiyariWriteQueue = Promise.resolve();
        this.hiyariWriteSeq = 0;
        this.hiyariTimecodeBase = null;
        this.hiyariPendingTail = null;

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
   * 区間ファイルへの書き込みをキューへ積む（proposal #263）
   *
   * open の初回書き込みと append が並走すると、Cordova の FileWriter が
   * createWriter した時点のファイル長で seek するため、先に書かれたヘッダを
   * 後続が上書きしてしまう。どちらも例外を投げずに成功するため検知もできない。
   * 1 本のチェーンに連結して順序を保証する。
   *
   * 失敗はログに残したうえでチェーンを回復させる。1 件の書き込み失敗で
   * 後続の書き込みを止めない。
   */
  private enqueueHiyariWrite(label: string, name: string, task: () => Promise<any>): Promise<void> {
    const seq = ++this.hiyariWriteSeq;
    this.hiyariWriteQueue = this.hiyariWriteQueue
      .then(async () => {
        this.logService.debug('[DrivingScore][DrivingPage] hiyari write start op=' + label
          + ' file=' + name + ' seq=' + seq);
        await task();
        this.logService.debug('[DrivingScore][DrivingPage] hiyari write done op=' + label
          + ' file=' + name + ' seq=' + seq);
      })
      .catch((error) => {
        this.logService.error('[DrivingScore][DrivingPage] hiyari write failed. op=' + label
          + ' file=' + name + ' seq=' + seq, error);
      });
    return this.hiyariWriteQueue;
  }

  /**
   * EBML の可変長整数（vint）の長さを先頭バイトから求める
   *
   * 先頭バイトの最上位から数えて最初に立っているビットの位置が長さになる。
   * 立っているビットが無ければ不正なので 0 を返す。
   */
  private vintLength(first: number): number {
    for (let k = 0; k < 8; k++) {
      if (first & (0x80 >> k)) {
        return k + 1;
      }
    }
    return 0;
  }

  /** EBML の可変長整数を読む。length=0 は不正 */
  private readVint(buf: Uint8Array, i: number): { value: number, length: number } {
    const length = this.vintLength(buf[i]);
    if (length == 0) {
      return { value: 0, length: 0 };
    }
    let value = buf[i] & (0xff >> length);
    for (let k = 1; k < length; k++) {
      value = value * 256 + buf[i + k];
    }
    return { value: value, length: length };
  }

  /**
   * Cluster の位置を列挙する（proposal #262）
   *
   * ID 0x1F43B675 と同じ 4 バイト列は映像データ中にも偶然現れうる。
   * 直後にサイズ vint と Timecode 要素 0xE7 が続くものだけを Cluster と認める。
   * ストリーミング録画なので Cluster のサイズは UNKNOWN で、境界は
   * 次の Cluster ID で決まる（実測）。
   */
  private findClusters(buf: Uint8Array)
    : Array<{ timecodeAt: number, timecodeSize: number }> {

    const list = Array<{ timecodeAt: number, timecodeSize: number }>();
    for (let i = 0; i + 8 < buf.length; i++) {
      if (buf[i] != 0x1f || buf[i + 1] != 0x43 || buf[i + 2] != 0xb6 || buf[i + 3] != 0x75) {
        continue;
      }
      const size = this.readVint(buf, i + 4);
      if (size.length == 0) {
        continue;
      }
      const at = i + 4 + size.length;
      if (buf[at] != 0xe7) {
        continue;
      }
      const timecode = this.readVint(buf, at + 1);
      if (timecode.length == 0) {
        continue;
      }
      list.push({
        timecodeAt: at + 1 + timecode.length,
        timecodeSize: timecode.value
      });
    }
    return list;
  }

  /**
   * 繰り越しの開始位置を決める（proposal #266）
   *
   * Cluster ヘッダ（ID 4B + サイズ vint 8B + 0xE7 + サイズ 1B + 値 2〜3B ≒ 17B）が
   * チャンク境界で分断されると振り直しに失敗する。末尾 32 バイトを常に次へ
   * 繰り越し、さらにその手前 22 バイトの範囲に Cluster ID が見つかった場合は
   * そこまで繰り越しを広げて、ヘッダが分断されないようにする。
   */
  private findCarryStart(buf: Uint8Array): number {
    let carryStart = Math.max(0, buf.length - 32);
    const scanFrom = Math.max(0, buf.length - 54);
    for (let i = scanFrom; i < carryStart; i++) {
      if (buf[i] == 0x1f && buf[i + 1] == 0x43 && buf[i + 2] == 0xb6 && buf[i + 3] == 0x75) {
        carryStart = i;
        break;
      }
    }
    return carryStart;
  }

  /**
   * Cluster Timecode をファイル先頭起点へ振り直す（proposal #262 / #266）
   *
   * 区間で最初に見つかった Cluster の値を t0 とし、以降は (元値 - t0) で
   * 上書きする。バイト長は変えない。桁が縮んでも元の長さのままゼロ詰めする。
   * limit より後ろに掛かる Cluster は、まだ全体が揃っていない可能性があるので
   * 触らない（繰り越して次回処理する）。
   */
  private rebaseClusterTimecodes(buf: Uint8Array, limit: number) {
    for (const c of this.findClusters(buf)) {
      if (limit < c.timecodeAt + c.timecodeSize) {
        continue;
      }
      let value = 0;
      for (let k = 0; k < c.timecodeSize; k++) {
        value = value * 256 + buf[c.timecodeAt + k];
      }
      if (this.hiyariTimecodeBase == null) {
        this.hiyariTimecodeBase = value;
      }
      let rest = Math.max(0, value - this.hiyariTimecodeBase);
      for (let k = c.timecodeSize - 1; 0 <= k; k--) {
        buf[c.timecodeAt + k] = rest % 256;
        rest = Math.floor(rest / 256);
      }
    }
  }

  /**
   * 区間ファイルへ 1 回ぶん書き込む（proposal #266）
   *
   * 前回の繰り越しを先頭に付けてから Cluster Timecode を振り直し、
   * 末尾を次へ繰り越して残りを書く。書き込みは追記のみで、ファイル全体の
   * 読み戻しや書き直しはしない。Android の File プラグインは位置 0 への
   * 書き込みでファイルを切り詰めるため、途中を差し替える手段が無い
   * （LocalFilesystem.writeToFileAtURL）。
   */
  private async writeHiyariChunk(name: string, blob: Blob, isFirst: boolean) {
    const incoming = new Uint8Array(await blob.arrayBuffer());

    let buf = incoming;
    const carried = this.hiyariPendingTail;
    if (carried != null && 0 < carried.length) {
      buf = new Uint8Array(carried.length + incoming.length);
      buf.set(carried, 0);
      buf.set(incoming, carried.length);
    }

    const carryStart = this.findCarryStart(buf);
    this.rebaseClusterTimecodes(buf, carryStart);
    this.hiyariPendingTail = buf.slice(carryStart);

    if (carryStart == 0) {
      // 全部が繰り越しに入った。書くものが無い
      return;
    }
    await this.file.writeFile(this.saveDirectoryPath, name,
      new Blob([buf.subarray(0, carryStart)], { 'type': 'video/webm' }),
      isFirst ? {} : { append: true });
  }

  /** 繰り越し分を書き出して区間を閉じる（proposal #266） */
  private async flushHiyariTail(name: string) {
    const tail = this.hiyariPendingTail;
    this.hiyariPendingTail = null;

    if (tail != null && 0 < tail.length) {
      this.rebaseClusterTimecodes(tail, tail.length);
      await this.file.writeFile(this.saveDirectoryPath, name,
        new Blob([tail], { 'type': 'video/webm' }), { append: true });
    }
    this.logService.debug('[DrivingScore][DrivingPage] hiyari flush. file=' + name
      + ' tail=' + (tail == null ? 0 : tail.length) + 'B base=' + this.hiyariTimecodeBase + 'ms');
    this.hiyariTimecodeBase = null;
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
      // 2 個目以降のマーカーは n+Δ 秒になる（proposal #262）
      this.hiyariMarkerVideoTime = Math.max(0,
        Math.floor((t - this.hiyariSegmentFrom) / 1000));
      this.logService.debug('[DrivingScore][DrivingPage] hiyari extend. file='
        + this.hiyariFileName + ' end=' + this.hiyariSegmentEnd);
      return this.hiyariFileName;
    }

    // 開いている区間があれば先に閉じる
    if (this.hiyariFileName != null) {
      await this.closeHiyariSegment();
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
    // markersVideoTime の基準（proposal #262）。連結しても動かさない
    this.hiyariSegmentFrom = from;
    // 区間の 1 個目のマーカーは n 秒になる
    this.hiyariMarkerVideoTime = Math.max(0, Math.floor((t - from) / 1000));

    // ここから enqueue までの間に await を挟まないこと（proposal #263）。
    // 挟むと、その隙に saveVideo の append がキューへ先に積まれ、
    // ヘッダを書く前に本文が書かれて先頭が壊れる。
    // 対象チャンクは同期的にスナップショットし、以降に届いたチャンクは
    // append 経由でのみ書く（open 側に重複させない）。
    const headChunk = this.videoHeadChunk;
    const bodies: Array<Blob> = [];
    for (const c of this.videoChunks) {
      if (c.receivedAt > from) {
        bodies.push(c.blob);
      }
    }

    this.logService.debug('[DrivingScore][DrivingPage] hiyari open. file=' + name
      + ' from=' + from + ' end=' + this.hiyariSegmentEnd + ' chunks=' + bodies.length);

    await this.enqueueHiyariWrite('open', name, async () => {
      const parts: Array<Blob> = [];
      if (headChunk != null) {
        // ヘッダの切り出しはタスクの内側で行う（proposal #263）
        parts.push(await this.extractWebmHeader(headChunk));
      }
      for (const body of bodies) {
        parts.push(body);
      }
      // 区間の最初の書き込み。ここで t0 が確定する（proposal #266）
      await this.writeHiyariChunk(name, new Blob(parts, { 'type': 'video/webm' }), true);
    });

    return name;
  }

  /**
   * 区間を閉じる。NN は次のヒヤリで繰り上がる
   *
   * 閉じた直後に Cluster Timecode の振り直しと Duration の書き込みを行う
   * （proposal #262）。整形に失敗しても録画は続けたいので、例外は握りつぶして
   * ログだけ残す。整形前のファイルでも再生自体はできる。
   */
  private async closeHiyariSegment() {
    if (this.hiyariFileName == null) {
      return;
    }
    const name = this.hiyariFileName;
    // null 化はここで同期的に行う。これ以降このファイルへの append は
    // 積まれないので、finalize が最後の書き込みになる（proposal #263）
    this.hiyariFileName = null;
    this.hiyariSegmentEnd = 0;
    this.hiyariSegmentFrom = 0;
    this.logService.debug('[DrivingScore][DrivingPage] hiyari close. file=' + name);

    await this.enqueueHiyariWrite('flush', name, () => this.flushHiyariTail(name));
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

      // 区間が開いていれば、届いたチャンクをそのまま追記する。
      // 対象ファイル名は同期的に取り出し、タスク内で this.hiyariFileName を
      // 再参照しない。区間が切り替わった後に別ファイルへ書くのを防ぐ
      // （proposal #263）
      const target = this.hiyariFileName;
      if (target != null) {
        await this.enqueueHiyariWrite('append', target, () =>
          this.writeHiyariChunk(target, event.data, false));

        // 終端を超えたら閉じる（proposal #256 §3-3）
        if (this.hiyariSegmentEnd < now) {
          await this.closeHiyariSegment();
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
        await this.closeHiyariSegment();
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

    // markersVideoTime は「切り出しファイルの先頭からのオフセット秒」
    // （proposal #262。fact #4705 と fact #4742 の該当部分を撤回）。
    // 区間の 1 個目は n 秒、連結された 2 個目以降は n+Δ 秒になる。
    // 動画を持たないマーカーは基準が無いので 0 とする。
    // 値は openOrExtendHiyariSegment() が区間を開いた（延長した）時点で
    // 確定させている。直列化（proposal #263）で await が挟まるため、
    // ここで Date.now() を取り直すと僅かにずれる
    const videoTime = videoPath == '' ? 0 : this.hiyariMarkerVideoTime;

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

import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { Router, ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { MapService } from '../services/map.service';

@Component({
  selector: 'app-bad-spot',
  templateUrl: './bad-spot.page.html',
  styleUrls: ['./bad-spot.page.scss'],
})
export class BadSpotPage implements OnInit {

  @ViewChild('map', {read: ElementRef, static: false}) mapElement: ElementRef;
  @ViewChild('video', {read: ElementRef, static: false}) videoElement: ElementRef;

  // Label
  public label1: string;
  public label2: string;
  public label3: string;
  public label4: string;

  // Video
  private videoPath: string;
  private videoTimer: any;

  // Spot values
  private spotPos: number = 0;
  public spotTimestamp: string = '';
  public spotComment1: string = '';
  public spotComment2: string = '';
  public spotComment3: string = '';
  public spotComment4: string = '';

  // コンストラクタ
  constructor(
    private route: ActivatedRoute,
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private mapService: MapService,
    private file: File) {

    this.logService.initialize(file);
  }

  // コンポーネントの初期化時に実行される
  ngOnInit() {
    // 動画パスはマーカーが持つ（proposal #257）。ルートパラメータは参照しない。
    // videoPath は「現在 src に入っているマーカーのパス」を保持する用途に変えた。
    this.videoPath = '';

    this.label1 = this.loginService.settings.label.label1;
    this.label2 = this.loginService.settings.label.label2;
    this.label3 = this.loginService.settings.label.label3;
    this.label4 = this.loginService.settings.label.label4;

    console.log('[DrivingScore][BadSpotPage] ngOnInit: videoPath='+this.videoPath);
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    if (Capacitor.getPlatform() == 'android') {
      this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
    }
  }

  // ページがアクティブになったとき実行
  ionViewDidEnter() {
    this.loadMap();
    this.loadVideo();
  }

  // ページが非アクティブになる直前に実行
  ionViewWillLeave() {
    clearInterval(this.videoTimer);
    this.mapService.stop();
  }

  async loadMap() {
    this.spotPos = this.mapService.getSelectMarkerPos();
    const uluru = this.mapService.getMarkerPosition(this.spotPos);

    await this.mapService.createMap(this.mapElement.nativeElement, uluru, 16);
    this.mapService.clearCarMarker();

    this.onPointer();

    var self = this;
    this.mapService.addListener("mark", (title: string, pos: number) => {
      self.spotPos = pos;
      self.onPointer();
      self.applyVideoForSpot();
    });

    console.log('[DrivingScore][BadSpotPage] loadMap: Finish');
  }

  async loadVideo() {
    const videoRecorded = this.videoElement.nativeElement;
    videoRecorded.autoplay = false;
    videoRecorded.loop = false;
    videoRecorded.muted = true;

    // 読み込みに失敗したら空表示に落とす（proposal #257 §5-2）。
    // ファイルの存在確認はしない。
    videoRecorded.addEventListener('error', () => {
      this.logService.error('[DrivingScore][BadSpotPage] video error. path=' + this.videoPath, null);
      this.videoPath = '';
      videoRecorded.removeAttribute('src');
    });

    await this.applyVideoForSpot();

    var self = this;
    var lastTime = videoRecorded.currentTime;
    this.videoTimer = setInterval(function() {
      if (lastTime == videoRecorded.currentTime) {
        return;
      }
      lastTime = videoRecorded.currentTime;

      // 自動追尾は「現在 src に入っているファイルに属するマーカー」だけを
      // 走査する（fact #4683）。ヒヤリ動画が複数に分かれたため、全マーカーを
      // 対象にすると他ファイルのマーカーを誤って拾う。
      // ファイル末尾まで再生しても次のファイルへは自動遷移しない。
      let targetPos = self.spotPos;
      const length = self.mapService.getMarkerLength();
      for (let pos=0; pos<length; pos++) {
        if (self.mapService.getMarkerVideoPath(pos) != self.videoPath) {
          continue;
        }
        let time = self.mapService.getMarkerVideoTime(pos);
        if (lastTime < time) {
          break;
        }
        targetPos = pos;
      }
      if (self.spotPos != targetPos) {
        console.log('[DrivingScore][BadSpotPage] loadVideo: change num='+targetPos);
        self.spotPos = targetPos;
        self.onPointer();
      }
    }, 300);
    console.log('[DrivingScore][BadSpotPage] loadVideo: Finish');
  }

  /**
   * 選択中マーカーの動画を表示に反映する（fact #4683 / proposal #257 / #258）
   *
   * ファイルが現在の src と異なるときだけ差し替える。差し替えたときは
   * loadedmetadata を待ってから seek する（待たずに currentTime を設定すると
   * 無視される端末があるため）。同一ファイルなら待たずに seek のみ。
   */
  private async applyVideoForSpot() {
    const videoRecorded = this.videoElement.nativeElement;
    const path = this.mapService.getMarkerVideoPath(this.spotPos) ?? '';

    if (path == this.videoPath) {
      // 同じファイル。既に読み込み済みなので待たずに seek する
      this.seekVideo();
      return;
    }

    this.videoPath = path;
    if (path == '') {
      // 動画が無いマーカー。動画領域を空にして地図だけ使える状態にする
      videoRecorded.removeAttribute('src');
      return;
    }

    // file:// は Capacitor の WebView から直接読めないため、src へ入れる
    // 瞬間だけ変換する（proposal #258）。保持値は file:// のまま。
    // 非 Android（DemoData の blob: URL）は変換しない。
    const src = (Capacitor.getPlatform() == 'android')
      ? Capacitor.convertFileSrc(path)
      : path;

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      videoRecorded.addEventListener('loadedmetadata', done, { once: true });
      videoRecorded.addEventListener('error', done, { once: true });
      setTimeout(done, 5000);
      videoRecorded.src = src;
    });

    this.logService.debug('[DrivingScore][BadSpotPage] applyVideoForSpot. path=' + path
      + ' duration=' + videoRecorded.duration);
    this.seekVideo();
  }

  async onBack() {
    let pos = this.spotPos - 1;
    if (pos < 0) {
      pos = this.mapService.getMarkerLength() - 1;
    }
    this.spotPos = pos;
    console.log('[DrivingScore][BadSpotPage] onBack '+this.spotPos);

    this.onPointer();
    await this.applyVideoForSpot();
  }

  async onNext() {
    let pos = this.spotPos + 1;
    if (pos >= this.mapService.getMarkerLength()) {
      pos = 0;
    }
    this.spotPos = pos;
    console.log('[DrivingScore][BadSpotPage] onNext '+this.spotPos);

    this.onPointer();
    await this.applyVideoForSpot();
  }

  async onPointer() {
    const uluru = this.mapService.getMarkerPosition(this.spotPos);
    this.mapService.setBigMarkerIcon(this.spotPos);
    this.mapService.setCenter(uluru);
    this.mapService.setZoom(16);

    this.spotTimestamp = this.mapService.getMarkerTimestamp(this.spotPos);
    //文字列型。brake/handle/speed/accelerator/over_all
    this.spotComment1 = this.mapService.getMarkerComment(this.spotPos, 'msg1');
    this.spotComment2 = this.mapService.getMarkerComment(this.spotPos, 'msg2');
    this.spotComment3 = this.mapService.getMarkerComment(this.spotPos, 'msg3');
    this.spotComment4 = this.mapService.getMarkerComment(this.spotPos, 'msg4');
  }

  async seekVideo() {
    this.videoElement.nativeElement.currentTime = this.mapService.getMarkerVideoTime(this.spotPos);
  }
}

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
    const path = "" + this.route.snapshot.paramMap.get('path') ?? '';
    this.videoPath = path.split('@').join('/');

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
      self.seekVideo();
    });

    console.log('[DrivingScore][BadSpotPage] loadMap: Finish');
  }

  async loadVideo() {
    const videoRecorded = this.videoElement.nativeElement;
    videoRecorded.autoplay = false;
    videoRecorded.loop = false;
    videoRecorded.muted = true;
    if (this.videoPath != '' ) {
      videoRecorded.src = this.videoPath;
    }
    this.seekVideo();

    var self = this;
    var lastTime = videoRecorded.currentTime;
    this.videoTimer = setInterval(function() {
      if (lastTime == videoRecorded.currentTime) {
        return;
      }
      lastTime = videoRecorded.currentTime;

      let targetPos = self.spotPos;
      const length = self.mapService.getMarkerLength();
      for (let pos=0; pos<length; pos++) {
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

  async onBack() {
    let pos = this.spotPos - 1;
    if (pos < 0) {
      pos = this.mapService.getMarkerLength() - 1;
    }
    this.spotPos = pos;
    console.log('[DrivingScore][BadSpotPage] onBack '+this.spotPos);

    this.onPointer();
    this.seekVideo();
  }

  async onNext() {
    let pos = this.spotPos + 1;
    if (pos >= this.mapService.getMarkerLength()) {
      pos = 0;
    }
    this.spotPos = pos;
    console.log('[DrivingScore][BadSpotPage] onNext '+this.spotPos);

    this.onPointer();
    this.seekVideo();
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

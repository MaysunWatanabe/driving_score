import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform, NavController, AlertController } from "@ionic/angular";
import { File } from '@awesome-cordova-plugins/file/ngx';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { Capacitor } from '@capacitor/core';
import { Storage } from '@ionic/storage-angular';
import { Md5 } from 'ts-md5';

import { environment } from '../../environments/environment';
import { MapService } from '../services/map.service';
import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { ScoreDbService } from '../services/score-db.service';
import { Score, Message } from '../data/score';

@Component({
  selector: 'app-opening',
  templateUrl: './opening.page.html',
  styleUrls: ['./opening.page.scss'],
})
export class OpeningPage implements OnInit {

  // レイアウト用の変数
  public loginStatus: boolean = false;
  public accountId: string = "";
  public accountPassword: string = "";

  // コンストラクタ
  constructor(
    public navCtrl: NavController,
    private alertController: AlertController,
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private scoreDbService: ScoreDbService,
    private mapService: MapService,
    private storage: Storage,
    private http: HttpClient,
    private androidPermissions: AndroidPermissions,
    private file: File,
    private platform: Platform) {
  }

  // コンポーネントの初期化時に実行される
  async ngOnInit() {
    await this.initialize();

    // 自動ログイン
    try {
      const login = await this.loginService.autoLogin();
      // ログインステータスで画面の表示を切り替える
      this.loginStatus = this.loginService.loginStatus;
      if (login) {
        await this.showLoginDialog();
      }
    } catch (error) {
      this.logService.error('[DrivingScore][OpeningPage] ngOnInit', error);
    }
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    if (Capacitor.getPlatform() == 'android') {
      this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
    }

    // ログインステータスで画面の表示を切り替える
    this.loginStatus = this.loginService.loginStatus;

    this.mapService.removeAll()
  }

  // 運転診断ボタンを押下
  onDrivingClick() {
    this.navCtrl.navigateForward('/driving');
  }

  // アカウント作成ボタンを押下
  onAccountCreateClick() {
    this.navCtrl.navigateForward('/account/create');
  }

  // アカウント編集ボタンを押下
  onAccountModifyClick() {
    this.navCtrl.navigateForward('/account/modify');
  }

  // 設定ボタンを押下
  onSettingsClick() {
    this.navCtrl.navigateForward('/settings');
  }

  async initialize() {
    await this.checkPermission();
    await this.loginService.initialize();
    await this.scoreDbService.initialize();
    await this.logService.initialize(this.file);
    // 初期値を保存
    await this.saveDefaultData();
    // GoogleMapのJSを読み込む
    this.mapService.loadGoogleInstance(()=>{});
  }

  async checkPermission() {
    if (Capacitor.getPlatform() == 'android') {
      var permissions = this.androidPermissions.PERMISSION;
      var list = [
        permissions.INTERNET,
        permissions.ACCESS_FINE_LOCATION,
        permissions.ACCESS_COARSE_LOCATION,
        permissions.CAMERA,
        permissions.RECORD_AUDIO,
        permissions.MODIFY_AUDIO_SETTINGS,
        permissions.READ_EXTERNAL_STORAGE,
        permissions.WRITE_EXTERNAL_STORAGE,
        permissions.BLUETOOTH_SCAN,
        permissions.BLUETOOTH_CONNECT,
        permissions.BLUETOOTH_ADVERTISE,
      ];
      for (const element of list) {
        try {
          let result = await this.androidPermissions.checkPermission(element);
          this.logService.debug('[DrivingScore][OpeningPage] checkPermission: ' + element + ' = ' + result.hasPermission);
          if(result.hasPermission == false) {
            result = await this.androidPermissions.requestPermission(element);
            this.logService.debug('[DrivingScore][OpeningPage] requestPermission: ' + element + ' = ' + result.hasPermission);
          }
        } catch (error) {
          this.logService.error('[DrivingScore][OpeningPage] checkPermission', error);
        }
      }
    }
  }

  // ログインボタン押下
  async onLoginClick() {
    await this.loginService.initialize();

    // 前回ログインしたユーザーIDを表示
    const lastLoginUserId = await this.loginService.getLastLoginUserId();
    this.logService.debug('[DrivingScore][OpeningPage] onLoginClick', lastLoginUserId);

    var self = this;
    const alert = await this.alertController.create({
      header: 'ログイン',
      cssClass: 'custom-alert',
      inputs: [
        { name: 'userId', placeholder: 'ID', value: lastLoginUserId },
        { name: 'userPassword', placeholder: 'PASSWORD', type: 'password' }
      ],
      buttons: [
        { text: 'キャンセル', role: 'cancel', handler: data => {
          self.logService.debug('[DrivingScore][OpeningPage] onLoginClick: Cancel clicked');
        }},
        { text: 'ログイン', cssClass: 'alert-button-confirm', handler: data => {
          const userId = data.userId;
          const userPassword = Md5.hashStr(data.userPassword).toString();

          // 入力されたIDとPASSWORDでログインを試みる
          self.loginService.login(userId, userPassword)
          .then((login) => {
            if (login) {
              // ログインステータスで画面の表示を切り替える
              self.loginStatus = self.loginService.loginStatus;
              // ログインに成功
              self.showLoginDialog();
            } else {
              // ログイン失敗
              self.showLoginFailedDialog();
            }
          })
          .catch((error: any) => {
            self.logService.error('[DrivingScore][OpeningPage] onLoginClick', error);
          });
        }}
      ]
    });
    await alert.present();
  }

  // ログアウトボタンを押下
  onLogoutClick() {
    this.loginService.logout();
    this.loginStatus = false;
  }

  // ログイン成功ダイアログを表示
  async showLoginDialog() {
    const loginComment = await this.getLoginComment();
    let subHeader = (loginComment == '') ? '' : '運転診断コメント';

    const alert = await this.alertController.create({
      header: 'ログインしました。',
      cssClass: 'custom-alert',
      subHeader: subHeader,
      message: loginComment,
      buttons: [
          { text: '閉じる', cssClass: 'alert-button-confirm', role: 'confirm', handler: () => { } }
      ]
    });
    await alert.present();
  }

  // ログイン失敗ダイアログを表示
  async showLoginFailedDialog() {
    const alert = await this.alertController.create({
      header: 'ログインに失敗しました。',
      cssClass: 'custom-alert',
      buttons: [
          { text: '閉じる', cssClass: 'alert-button-confirm', role: 'confirm', handler: () => { } }
      ]
    });
    await alert.present();
  }

  // 動画機能を読み込む
  async loadVideo() {
    var self = this;
    await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream)=>{
      self.logService.debug('[DrivingScore][OpeningPage] loadVideo: Finish');
    })
    .catch((error: any)=>{
      self.logService.error('[DrivingScore][OpeningPage] loadVideo', error);
    });
  }

  // 初期値を保存
  async saveDefaultData() {
    await this.storage.create();
    await this.saveDefaultScoreLogic();
    this.saveDefaultScoreLogicJson();
  }

  // 運転診断スコアロジックの初期値を保存
  async saveDefaultScoreLogic() {
    // ローカルストレージに無ければ初期値を保存する
    const scoreLogic = await this.storage.get(environment.scoreLogicKey);

    var lastUpdate = -1;
    if (scoreLogic != null) {
      const line = scoreLogic.slice(0, scoreLogic.indexOf('\n'));
      if (line.match(/^\/\/\d+$/) != null) {
        lastUpdate = Number(line.replace('//', ''));
      }
    }

    var self = this;

    // assetsに保存されているデータをHttp.getで取得して、初期値として保存する
    const request = new XMLHttpRequest();
    request.open("GET", 'assets/data/scoreLogicFunction.txt', false);
    request.onreadystatechange = function () {

      const scoreLogic = String(request.responseText);
      let update = -1;
      const line = scoreLogic.slice(0, scoreLogic.indexOf('\n'));
      if (line.match(/^\/\/\d+$/) != null) {
        update = Number(line.replace('//', ''));
      }

      if (lastUpdate == -1 || lastUpdate < update) {
        // 内部ストレージに保存する
        self.logService.debug('[DrivingScore][OpeningPage] saveDefaultScoreLogic');
        self.storage.set(environment.scoreLogicKey, scoreLogic);
      }
    }
    request.send(null);
  }

  // 運転診断スコアロジックで使用するJSONデータの初期値を保存
  saveDefaultScoreLogicJson() {
    var self = this;

    // assetsに保存されているデータをHttp.getで取得して、初期値として保存する
    const request = new XMLHttpRequest();
    request.open("GET", 'assets/data/scoreLogic.json', false);
    request.onreadystatechange = async function () {
      try {
        // JSONフォーマットに問題ないか確認して、例外が発生しなければ内部ストレージに保存する
        const newJson = JSON.parse(String(request.responseText));

        // ローカルストレージに無ければ初期値を保存する
        const scoreLogicJson = await self.storage.get(environment.scoreLogicJsonKey);
        if (scoreLogicJson !== null) {
          const oldJson = JSON.parse(scoreLogicJson);
          if (oldJson.version !== undefined && newJson.version < oldJson.version) {
            //バージョンが古いので何もしない
            return;
          }
        }

        self.storage.set(environment.scoreLogicJsonKey, String(request.responseText));
        self.logService.debug('[DrivingScore][OpeningPage] saveDefaultScoreLogicJson', newJson.version);
      } catch (error: any) {
        self.logService.error('[DrivingScore][OpeningPage] saveDefaultScoreLogicJson', error);
      }
    }
    request.send(null);
  }

  async getLoginComment(): Promise<string> {
    const scoreList: Array<Score> = await this.scoreDbService.selectLastScore();
    if (scoreList.length == 0) {
      return '';
    }

    const score = scoreList[scoreList.length-1];

    // 総合（over_all）のコメントは、一番最後に出現した "message" を表示する
    // SELECTで取得したレコードは新しい順になっているので、一番初めに出現するレコードが対象
    //　一番最後に出現した "message" を、画面1-1のログインダイアログに表示する
    try {
      let message;
      for (let i=0; i<score.messages.length; i++) {
        if (score.messages[i].key == 'over_all') {
          message = score.messages[i];
          break;
        }
      }
      if (message == null) {
        return '';
      }

      let count = 0;
      for (let i=0; i<score.messages.length; i++) {
        if (message.id == score.messages[i].id) {
          count++;
        }
      }

      let text = message.text;
      text = text.replace(/%COUNT/g, String(count));
      text = text.replace(/%INTERSECTION/g, '');
      return text;
    } catch(error) {
      this.logService.error('[DrivingScore][OpeningPage]getLoginComment', error);
    }
    return '';
  }
}

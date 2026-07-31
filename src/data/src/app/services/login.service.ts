import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Capacitor } from '@capacitor/core';

import { environment } from '../../environments/environment';

import { LogService } from '../services/log.service';
import { UserDbService } from '../services/user-db.service';

import { User } from '../data/user';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  // ログインしたユーザーの情報
  public loginUser: User;
  // ログイン状態
  public loginStatus: boolean = false;

  public scoreId: number;

  // 0:positive,negative 1:negative,positive
  //public orderOfMessage: number = 0;

  public settings = {
    recording: false,
    gpsDemo: true,
    logStorage: false,
    sensorLogStorage: false,
    selectedSensorMode: '',
    orderOfMessage: 0,
    label: {
      label1: "ラベル1",
      label2: "ラベル2",
      label3: "",
      label4: "",
      labelA: "ラベル5",
      labelB: "ラベル6",
      labelC: ""
    },
    scoreLogicInterval: 300,
    capabilityScoreTargetDays: 30,
    scoreShowStar: {
      area1: true,
      area2: true,
      area3: true
    }
  };

  // コンストラクタ
  constructor(
    private logService: LogService,
    private db: UserDbService,
    private storage: Storage) {

    //this.init();
  }

  public async initialize () {
    await this.db.initialize();

    await this.storage.create();

    this.settings.selectedSensorMode = await this.storage.get(environment.settingSelectedSensorMode) ?? '';
    if (this.settings.selectedSensorMode === '') {
      this.settings.selectedSensorMode = 'smartphoneOnly';
      await this.storage.set(environment.settingSelectedSensorMode, this.settings.selectedSensorMode);
    }

    this.settings.recording = await this.storage.get(environment.settingRecording) ?? true;
    this.settings.gpsDemo = await this.storage.get(environment.settingGpsDemo) ?? false;
    this.settings.logStorage = await this.storage.get(environment.settingLogStorage) ?? false;
    this.settings.sensorLogStorage = await this.storage.get(environment.settingSensorLogStorage) ?? false;

    if (Capacitor.getPlatform() != 'android') {
      this.settings.recording = false;
      this.settings.gpsDemo = true;
      this.settings.logStorage = false;
      this.settings.sensorLogStorage = false;
    }

    const scoreLogicJsonText = await this.storage.get(environment.scoreLogicJsonKey);
    //this.logService.debug('[DrivingScore][LoginService] init: scoreLogicJsonText='+scoreLogicJsonText);

    const scoreLogicJson = JSON.parse(scoreLogicJsonText);
    if (scoreLogicJson == null || scoreLogicJson.settings == null) {
      return;
    }

    this.settings.orderOfMessage = scoreLogicJson.settings.order_of_message ?? 0;

    if (scoreLogicJson.settings.label != null) {
      this.settings.label.label1 = scoreLogicJson.settings.label.label1 ?? 'ラベル1';
      this.settings.label.label2 = scoreLogicJson.settings.label.label2 ?? 'ラベル2';
      this.settings.label.label3 = scoreLogicJson.settings.label.label3 ?? '';
      this.settings.label.label4 = scoreLogicJson.settings.label.label4 ?? '';
      this.settings.label.labelA = scoreLogicJson.settings.label.labelA ?? 'ラベル1';
      this.settings.label.labelB = scoreLogicJson.settings.label.labelB ?? 'ラベル2';
      this.settings.label.labelC = scoreLogicJson.settings.label.labelC ?? '';
    }

    this.settings.scoreLogicInterval = scoreLogicJson.settings.score_logic_interval_ms ?? 300;

    this.settings.capabilityScoreTargetDays = scoreLogicJson.settings.capability_score_target_days ?? 30;

    this.settings.scoreShowStar.area1 = scoreLogicJson.settings.score_show_star.area1 ?? true;
    this.settings.scoreShowStar.area2 = scoreLogicJson.settings.score_show_star.area2 ?? true;
    this.settings.scoreShowStar.area3 = scoreLogicJson.settings.score_show_star.area3 ?? true;

    this.logService.debug('[DrivingScore][LoginService] initialize finish.');
  }

  // 自動ロクイン
  async autoLogin(): Promise<boolean> {
    if (this.loginStatus) {
      // ログイン済みなら実行しない
      return false;
    }

    await this.storage.create();
    const loginData = await this.storage.get(environment.loginKey);
    if (loginData == null){
      // 自動ロクインに必要な情報がローカルストレージに無ければ実行しない
      return false;
    }

    // ログインして3日間は自動ログインする
    const timestamp = Date.now() - (1000 * 60 * 60 * 24 * 3);
    if ( timestamp <= loginData.timestamp) {
      // ログイン
      this.loginUser = await this.db.selectUser(loginData.userId, loginData.userPassword);
      this.loginStatus = (this.loginUser.userId != '');
      this.logService.debug('[DrivingScore][LoginService] autoLogin: userId='+this.loginUser.userId);
      return this.loginStatus;
    }
    return false;
  }

  // ログイン
  async login(userId: string, userPassword: string): Promise<boolean> {
    this.loginUser = await this.db.selectUser(userId, userPassword);
    this.loginStatus = (this.loginUser.userId != '');

    if (this.loginStatus) {
      const loginData = {
        timestamp: Date.now(),
        userId: this.loginUser.userId,
        userPassword: this.loginUser.userPassword
      };
      // 自動ログインに必要な情報を保存
      this.storage.set(environment.loginKey, loginData);
      // 最後にログインしたユーザーのIDを保存
      this.storage.set(environment.lastLoginUserId, this.loginUser.userId);
    }
    return this.loginStatus;
  }

  // ログアウト
  logout() {
    this.loginUser = new User();
    this.loginStatus = false;
    // 自動ログインの情報を削除
    this.storage.remove(environment.loginKey);
    this.scoreId = -1;
  }

  // 追加
  async insert(user: User): Promise<boolean> {
    this.logout();
    const ret = await this.db.insertUser(user, false);
    return (ret.userId != '');
  }

  // 更新
  async update(user: User): Promise<boolean> {
    this.logout();
    const ret = await this.db.updateUser(user);
    return (ret.userId != '');
  }

  // 削除
  async delete(userId: string): Promise<boolean> {
    this.logout();
    //  最後にログインしたユーザのIDを削除
    this.storage.remove(environment.lastLoginUserId);
    // ユーザー削除
    return await this.db.deleteUser(userId);
  }

  // 最後にログインしたユーザのIDを取得
  async getLastLoginUserId(): Promise<string> {
    let lastLoginUserId = await this.storage.get(environment.lastLoginUserId);
    this.logService.debug('[DrivingScore][LoginService]', lastLoginUserId);
    if (lastLoginUserId === null) {
      lastLoginUserId = '';
    }
    return lastLoginUserId;
  }
}

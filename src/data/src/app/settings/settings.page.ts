import { Component, OnInit } from '@angular/core';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Capacitor } from '@capacitor/core';

import { NavController, AlertController } from "@ionic/angular";
import { Storage } from '@ionic/storage-angular';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { environment } from '../../environments/environment';
import { ScoreLogic } from '../data/score-logic';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  public settingRecording: string;
  public settingGpsDemo: string;
  public settingLogStorage: string;
  public settingSensorLogStorage: string;
  public settingSelectedSensorMode: string;

  public hasAndroid: boolean = false;

  // コンストラクタ
  constructor(
    public navCtrl: NavController,
    private alertController: AlertController,
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private storage: Storage,
    private file: File) {

    this.logService.initialize(file);
    this.init();
  }

  // コンポーネントの初期化時に実行される
  ngOnInit() {
    var self = this;

    const scoreJsonFileBox = document.getElementById("score_json_update") as HTMLInputElement;
    scoreJsonFileBox.addEventListener('change', (evt: any) => {
      self.openScoreJsonFile(evt);
    });

    const scoreLogicFileBox = document.getElementById("score_logic_update") as HTMLInputElement;
    scoreLogicFileBox.addEventListener('change', (evt: any) => {
      self.openScoreLogicFile(evt);
    });
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    if (Capacitor.getPlatform() == 'android') {
      this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
    }
  }

  async init() {
    await this.storage.create();

    this.settingRecording = this.loginService.settings.recording ? 'enable' : 'disable';
    this.settingGpsDemo = this.loginService.settings.gpsDemo ? 'enable' : 'disable';
    this.settingLogStorage = this.loginService.settings.logStorage ? 'enable' : 'disable';
    this.settingSensorLogStorage = this.loginService.settings.sensorLogStorage ? 'enable' : 'disable';
    this.settingSelectedSensorMode = this.loginService.settings.selectedSensorMode ?? '';

    this.hasAndroid = (Capacitor.getPlatform() == 'android');
  }

  async onSettingRecording(e: any) {
    this.loginService.settings.recording = (e.detail.value == 'enable');
    await this.storage.set(environment.settingRecording, this.loginService.settings.recording);
  }

  async onSettingGpsDemo(e: any) {
    this.loginService.settings.gpsDemo = (e.detail.value == 'enable');
    await this.storage.set(environment.settingGpsDemo, this.loginService.settings.gpsDemo);
  }

  async onSettingLogStorage(e: any) {
    this.loginService.settings.logStorage = (e.detail.value == 'enable');
    await this.storage.set(environment.settingLogStorage, this.loginService.settings.logStorage);

    await this.logService.initialize(this.file);
  }

  async onSettingSensorLogStorage(e: any) {
    this.loginService.settings.sensorLogStorage = (e.detail.value == 'enable');
    await this.storage.set(environment.settingSensorLogStorage, this.loginService.settings.sensorLogStorage);

    await this.logService.initialize(this.file);
  }

  async onSettingSelectedSensorMode(e: any) {
    this.loginService.settings.selectedSensorMode = e.detail.value;
    await this.storage.set(environment.settingSelectedSensorMode, this.loginService.settings.selectedSensorMode);
  }

  async showUpdateScoreLogic() {
      const alert = await this.alertController.create({
        header: '運転診断スコアロジックを更新しました。',
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

  async showUpdateFailedScoreLogic(errorMsg: any) {
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

  async showUpdateJsonFile() {
      const alert = await this.alertController.create({
        header: 'JSONファイルを更新しました。',
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

  async showUpdateFailedJsonFile(errorMsg: any) {
      const alert = await this.alertController.create({
        header: '不正なJSONファイルです。',
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

  async showSaveFile(message: string) {
      const alert = await this.alertController.create({
        header: 'ファイルを保存しました。',
        cssClass: 'custom-alert',
        //subHeader: '運転診断コメント',
        message: message,
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

  async onScoreJsonFile(event: any) {
    this.logService.debug('[DrivingScore][SettingsPage] onScoreJsonFile event=' + event);
    // ScoreJsonを更新
    if (event == 'update') {
      const fileBox = document.getElementById("score_json_update") as HTMLInputElement;
      fileBox.click();

    // ScoreJsonを保存
    } else if(event == 'save') {
      // 保存するScoreJsonデータ
      const saveText = await this.storage.get(environment.scoreLogicJsonKey);
      const saveFileName = 'scoreLogicJson.' + this.logService.getDateString(true) + '.txt';
      var dialogMessage = saveFileName;

      // Androidは端末内に保存
      if (this.hasAndroid) {
        var dirPath = this.file.externalRootDirectory + 'Documents/';
        const dirName = 'driving-score';
        try {
          await this.file.createDir(dirPath, dirName, true);
          dirPath += dirName + '/';
        } catch (error: any) {
          this.logService.error('[DrivingScore][SettingsPage] onScoreJsonFile: createDir', error);
          return;
        }
        // ファイル保存
        this.file.writeFile(dirPath, saveFileName, saveText, {replace:true});
        dialogMessage = dirPath + saveFileName;

      // ブラウザはダウンロードして保存
      } else {
        const a = document.getElementById("save") as HTMLAnchorElement;
        a.href = URL.createObjectURL(new Blob([saveText], {type: "text/plain"}));
        a.download = saveFileName;
        // ファイル保存
        a.click();
      }
      this.showSaveFile(dialogMessage);
    }
  }

  async onScoreLogicFile(event: any) {
    this.logService.debug('[DrivingScore][SettingsPage] onScoreLogicFile event=' + event);
    if (event == 'update') {
      const fileBox = document.getElementById("score_logic_update") as HTMLInputElement;
      fileBox.click();

    } else if(event == 'save') {
      // 保存するScoreLogicデータ
      const saveText = await this.storage.get(environment.scoreLogicKey);
      const saveFileName = 'scoreLogic.' + this.logService.getDateString(true) + '.txt';
      var dialogMessage = saveFileName;

      // Androidは端末内に保存
      if (this.hasAndroid) {
        var dirPath = this.file.externalRootDirectory + 'Documents/';
        const dirName = 'driving-score';
        try {
          await this.file.createDir(dirPath, dirName, true);
          dirPath += dirName + '/';
        } catch (error: any) {
          this.logService.error('[DrivingScore][SettingsPage] onScoreLogicFile: createDir', error);
          return;
        }
        // ファイル保存
        this.file.writeFile(dirPath, saveFileName, saveText, {replace:true});
        dialogMessage = dirPath + saveFileName;

      // ブラウザはダウンロードして保存
      } else {
        const a = document.getElementById("save") as HTMLAnchorElement;
        a.href = URL.createObjectURL(new Blob([saveText], {type: "text/plain"}));
        a.download = saveFileName;
        // ファイル保存
        a.click();
      }
      this.showSaveFile(dialogMessage);

    } else if(event == 'edit') {
      this.navCtrl.navigateForward('/edit');
    }
  }

  openScoreJsonFile(evt: any) {
    const files = evt.target.files as any[]; //as File[]
    const objectURL = URL.createObjectURL(files[0]);

    var self = this;

    const request = new XMLHttpRequest();
    request.open("GET", objectURL, false);
    request.onreadystatechange = function () {
      try {
        self.logService.debug('[DrivingScore][SettingsPage] openFile');
        const result = String(request.responseText);
        const jsonResult = JSON.parse(result);
        if (jsonResult.settings == null) {
          self.showUpdateFailedJsonFile('no "settings" data in json file.');
          return;
        }
        if (jsonResult.messages == null) {
          self.showUpdateFailedJsonFile('no "messages" data in json file.');
          return;
        }

        self.storage.set(environment.scoreLogicJsonKey, result);

        self.loginService.initialize();

        self.showUpdateJsonFile();
      } catch (error: any) {
        self.logService.error('[DrivingScore][SettingsPage] openFile', error);
        self.showUpdateFailedJsonFile(error);
      }
    }
    request.send(null);
  }

  openScoreLogicFile(evt: any) {
    const files = evt.target.files as any[]; //as File[]
    const objectURL = URL.createObjectURL(files[0]);

    var self = this;

    const request = new XMLHttpRequest();
    request.open("GET", objectURL, false);
    request.onreadystatechange = async function () {
      try {
        self.logService.debug('[DrivingScore][SettingsPage] openFile');
        let scoreLogic = String(request.responseText);

        const scoreLoginJsonText = await self.storage.get(environment.scoreLogicJsonKey);
        const ret = ScoreLogic.testScoreLogic(self.logService, scoreLoginJsonText, scoreLogic);
        if (ret === true) {

          //更新時間をアップデート
          const line = scoreLogic.slice(0, scoreLogic.indexOf('\n'));
          if (line.match(/^\/\/\d+$/) != null) {
            scoreLogic = scoreLogic.replace(line, '//' + Date.now());
          } else {
            scoreLogic = '//' + Date.now() + '\n' + scoreLogic;
          }

          await self.storage.set(environment.scoreLogicKey, scoreLogic);
          self.showUpdateScoreLogic();
        } else {
          self.showUpdateFailedScoreLogic(ret);
        }
      } catch (error: any) {
        self.logService.error('[DrivingScore][SettingsPage] openFile', error);
        self.showUpdateFailedScoreLogic(error.message);
      }
    }
    request.send(null);
  }
}


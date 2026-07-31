import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { NavController, AlertController } from "@ionic/angular";
import { File } from '@awesome-cordova-plugins/file/ngx';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { Md5 } from 'ts-md5';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { ScoreDbService } from '../services/score-db.service';
import { User } from '../data/user';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {

  // レイアウト用の変数
  ionicForm: FormGroup;
  pageType: string = 'create'; // create or modify
  pageTitle: string = '';
  userId: string = '';
  userPassword: string = '';
  selectSexId: number = 1;
  selectBirthdayYear: string = '1980年';
  selectBirthdayMonth: string = '1月';
  selectPrefecture: number = 13;

  // 性別
  sexList: any[] = [
    {id: 1, value: '　男　'},
    {id: 2, value: '　女　'},
    {id: 3, value: 'その他'},
  ];
  // 年代
  yearList = Array();
  monthList = Array();
  // 身長
  height: number;
  // 都道府県
  prefectureList: any[] = [
    {id: 1, value: '北海道'},
    {id: 2, value: '青森県'},
    {id: 3, value: '岩手県'},
    {id: 4, value: '宮城県'},
    {id: 5, value: '秋田県'},
    {id: 6, value: '山形県'},
    {id: 7, value: '福島県'},
    {id: 8, value: '茨城県'},
    {id: 9, value: '栃木県'},
    {id: 10, value: '群馬県'},
    {id: 11, value: '埼玉県'},
    {id: 12, value: '千葉県'},
    {id: 13, value: '東京都'},
    {id: 14, value: '神奈川県'},
    {id: 15, value: '新潟県'},
    {id: 16, value: '富山県'},
    {id: 17, value: '石川県'},
    {id: 18, value: '福井県'},
    {id: 19, value: '山梨県'},
    {id: 20, value: '長野県'},
    {id: 21, value: '岐阜県'},
    {id: 22, value: '静岡県'},
    {id: 23, value: '愛知県'},
    {id: 24, value: '三重県'},
    {id: 25, value: '滋賀県'},
    {id: 26, value: '京都府'},
    {id: 27, value: '大阪府'},
    {id: 28, value: '兵庫県'},
    {id: 29, value: '奈良県'},
    {id: 30, value: '和歌山県'},
    {id: 31, value: '鳥取県'},
    {id: 32, value: '島根県'},
    {id: 33, value: '岡山県'},
    {id: 34, value: '広島県'},
    {id: 35, value: '山口県'},
    {id: 36, value: '徳島県'},
    {id: 37, value: '香川県'},
    {id: 38, value: '愛媛県'},
    {id: 39, value: '高知県'},
    {id: 40, value: '福岡県'},
    {id: 41, value: '佐賀県'},
    {id: 42, value: '長崎県'},
    {id: 43, value: '熊本県'},
    {id: 44, value: '大分県'},
    {id: 45, value: '宮崎県'},
    {id: 46, value: '鹿児島県'},
    {id: 47, value: '沖縄県'},
  ];

  // コンストラクタ
  constructor(
    public navCtrl: NavController,
    public formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private scoreDbService: ScoreDbService,
    private file: File) {

    this.logService.initialize(file);
  }

  // コンポーネントの初期化時に実行される
  ngOnInit() {
    this.pageType = this.route.snapshot.paramMap.get('type')?? 'create';
    this.pageTitle = this.pageType == 'create' ? 'アカウント作成' : 'アカウント編集';

    for (let i=1900; i<=2020; i++) {
      this.yearList[i-1900] = i + '年';
    }
    for (let i=1; i<=12; i++) {
      this.monthList[i-1] = i + '月';
    }

    if (this.pageType == 'modify') {
      // アカウント編集はログインユーザーの情報を復元
      const loginUser = this.loginService.loginUser;
      this.userId = loginUser.userId;
      this.userPassword = '****';
      this.selectSexId = loginUser.sex;
      this.selectBirthdayYear = loginUser.birthYear + '年';
      this.selectBirthdayMonth = loginUser.birthMonth + '月';
      this.height = loginUser.height;
      this.selectPrefecture = loginUser.prefecture;
    }

    this.ionicForm = this.formBuilder.group({
       userId: ['', [Validators.required, Validators.minLength(1), Validators.pattern('^[a-zA-Z0-9]+$')]],
       userPassword: ['', [Validators.required, Validators.minLength(1), Validators.pattern('^[a-zA-Z0-9!-/:-@¥[-`{-~]+$')]],
       selectSexId: ['', []],
       selectBirthdayYear: ['', []],
       selectBirthdayMonth: ['', []],
       height: ['', [Validators.required, Validators.minLength(1), Validators.pattern('^[1-2][0-9]{2}(\.[0-9]+)?$')]],
       selectPrefecture: ['', []],
    });

    this.ionicForm.patchValue({
      userId: this.userId,
      userPassword: this.userPassword,
      selectSexId: String(this.selectSexId),
      selectBirthdayYear: this.selectBirthdayYear,
      selectBirthdayMonth: this.selectBirthdayMonth,
      height: this.height,
      selectPrefecture: String(this.selectPrefecture),
    });
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
  }

  compareWithFn(o1:any, o2:any) {
    return o1 === o2;
  }

  // アカウント作成ボタンを押下
  onCreateAccount() {
    if (!this.ionicForm.valid) {
      this.showCreateFailDialog();
      return;
    }
    const formValue = this.ionicForm.value;

    const user = new User();
    user.userId = formValue.userId;
    user.userPassword =  Md5.hashStr(formValue.userPassword).toString();
    user.sex = formValue.selectSexId;
    user.birthYear = Number(formValue.selectBirthdayYear.replace('年', ''));
    user.birthMonth = Number(formValue.selectBirthdayMonth.replace('月', ''));
    user.height = formValue.height;
    user.prefecture = formValue.selectPrefecture;

    this.loginService.insert(user).then((finish) => {
      if (finish) {
        this.showCreateFinishDialog();
      } else {
        this.showCreateFailDialog();
      }
    });
  }

  // アカウント編集ボタンを押下
  onModifyAccount() {
    if (!this.ionicForm.valid) {
      this.showModifyFailedDialog();
      return;
    }

    const user = this.loginService.loginUser;
    if (this.ionicForm.value.userPassword != '****' && user.userPassword != this.ionicForm.value.userPassword) {
      user.userPassword = Md5.hashStr(this.ionicForm.value.userPassword).toString();
    }
    user.sex = this.ionicForm.value.selectSexId;
    user.birthYear = Number(this.ionicForm.value.selectBirthdayYear.replace('年', ''));
    user.birthMonth = Number(this.ionicForm.value.selectBirthdayMonth.replace('月', ''));
    user.height = this.ionicForm.value.height;
    user.prefecture = this.ionicForm.value.selectPrefecture;

    var self = this;
    this.loginService.update(user).then((finish) => {
      if (finish) {
        self.showModifyFinishDialog();
      } else {
        self.showModifyFailedDialog();
      }
    });
  }

  onDeleteAccount() {
    var self = this;
    const user = this.loginService.loginUser;
    this.loginService.delete(user.userId).then((finish) => {
      self.scoreDbService.delete(user.userId);
      self.showDeleteDialog();
    });
  }

  async showCreateFinishDialog() {
    this.loginService.logout();
    var self = this;
    const alert = await this.alertController.create({
      header: 'アカウントを作成しました。',
      cssClass: 'custom-alert',
      //subHeader: '運転診断コメント',
      //message: 'あいうえおかきくけこさしすせそたちつてと',
      buttons: [
          {
            text: '閉じる',
            cssClass: 'alert-button-confirm',
            role: 'confirm',
            handler: () => {
              self.navCtrl.navigateBack('opening');
            }
          }
      ]
    });
    await alert.present();
  }

  async showCreateFailDialog() {
    const alert = await this.alertController.create({
      header: 'アカウントを作成できませんでした。',
      cssClass: 'custom-alert',
      //subHeader: '運転診断コメント',
      //message: 'あいうえおかきくけこさしすせそたちつてと',
      buttons: [
          {
            text: '閉じる',
            cssClass: 'alert-button-confirm',
            role: 'confirm',
            handler: () => { }
          }
      ]
    });
    await alert.present();
  }

  async showModifyFinishDialog() {
    this.loginService.logout();
    var self = this;
    const alert = await this.alertController.create({
      header: 'アカウントを更新しました。',
      cssClass: 'custom-alert',
      //subHeader: '運転診断コメント',
      //message: 'あいうえおかきくけこさしすせそたちつてと',
      buttons: [
          {
            text: '閉じる',
            cssClass: 'alert-button-confirm',
            role: 'confirm',
            handler: () => {
              self.navCtrl.navigateBack('opening');
            }
          }
      ]
    });
    await alert.present();
  }

  async showModifyFailedDialog() {
    const alert = await this.alertController.create({
      header: 'アカウントを更新できませんでした。',
      cssClass: 'custom-alert',
      //message: 'あいうえおかきくけこさしすせそたちつてと',
      buttons: [
          {
            text: '閉じる',
            cssClass: 'alert-button-confirm',
            role: 'confirm',
            handler: () => { }
          }
      ]
    });
    await alert.present();
  }

  async showDeleteDialog() {
    var self = this;
    const alert = await this.alertController.create({
      header: '本当にアカウントを削除しますか？',
      cssClass: 'custom-alert',
      //subHeader: '運転診断コメント',
      //message: 'あいうえおかきくけこさしすせそたちつてと',
      buttons: [
        {
          text: 'キャンセル',
          role: 'cancel',
          handler: data => { }
        },
        {
          text: '削除',
          cssClass: 'alert-button-confirm',
          handler: data => {
            self.showDeleteFinishDialog();
          }
        }
      ]
    });
    await alert.present();
  }

  async showDeleteFinishDialog() {
    var self = this;
    const alert = await this.alertController.create({
      header: 'アカウントを削除しました。',
      cssClass: 'custom-alert',
      //subHeader: '運転診断コメント',
      //message: 'あいうえおかきくけこさしすせそたちつてと',
      buttons: [
          {
            text: '閉じる',
            cssClass: 'alert-button-confirm',
            role: 'confirm',
            handler: () => {
              self.loginService.logout();
              self.navCtrl.navigateBack('opening');
            }
          }
      ]
    });
    await alert.present();
  }
}

import { Component, OnInit } from '@angular/core';
import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Capacitor } from '@capacitor/core';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';
import { ScoreDbService } from '../services/score-db.service';
import { Score, Message } from '../data/score';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.page.html',
  styleUrls: ['./comment.page.scss'],
})
export class CommentPage implements OnInit {

  public label1: string;
  public label2: string;
  public label3: string;
  public label4: string;

  public scoreShowStarArea1: boolean = true;
  public scoreShowStarArea2: boolean = true;

  public scoreOverAll: number = 0;
  public score1: number = 0;
  public score2: number = 0;
  public score3: number = 0;
  public score4: number = 0;

  public rankScoreOverAll: number = 0;
  public rankScore1: number = 0;
  public rankScore2: number = 0;
  public rankScore3: number = 0;
  public rankScore4: number = 0;

  public msgOverAll: String;
  public msg1: String;
  public msg2: String;
  public msg3: String;
  public msg4: String;

  // コンストラクタ
  constructor(
    private screenOrientation: ScreenOrientation,
    private loginService: LoginService,
    private logService: LogService,
    private scoreDbService: ScoreDbService,
    private file: File) {

    this.logService.initialize(file);
  }

  // コンポーネントの初期化時に実行される
  ngOnInit() {
    this.label1 = this.loginService.settings.label.label1;
    this.label2 = this.loginService.settings.label.label2;
    this.label3 = this.loginService.settings.label.label3;
    this.label4 = this.loginService.settings.label.label4;

    this.scoreShowStarArea1 = this.loginService.settings.scoreShowStar.area1;
    this.scoreShowStarArea2 = this.loginService.settings.scoreShowStar.area2;
  }

  // ページがアクティブになる直前に実行される
  ionViewWillEnter() {
    if (Capacitor.getPlatform() == 'android') {
      this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.PORTRAIT);
    }

    var self = this;
    this.scoreDbService.selectScore(this.loginService.scoreId).then((scoreList: Array<Score>)=>{
      if (scoreList.length == 0)
        return;

      const score = scoreList[scoreList.length - 1];

      self.scoreOverAll = score.overAll;
      self.score1 = score.score1;
      self.score2 = score.score2;
      self.score3 = score.score3;
      self.score4 = score.score4;

      self.rankScoreOverAll = self.getRank(self.scoreOverAll);
      self.rankScore1 = self.getRank(self.score1);
      self.rankScore2 = self.getRank(self.score2);
      self.rankScore3 = self.getRank(self.score3);
      self.rankScore4 = self.getRank(self.score4);

      // スコア値の一番低いIDを採用、同点の場合は新しいIDを採用
      const messages: any = {};
      const countKey = Array('over_all', 'score1', 'score2', 'score3', 'score4');
      const countType = Array('positive', 'negative');
      for (let i=0; i<countKey.length; i++) {
        const key = countKey[i];
        messages[key] = {};

        for (let n=0; n<countType.length; n++) {
          const type = countType[n];

          let msgId = -1;
          let msgText = '';
          let msgScore = type == 'positive' ? -1 : 9999;
          let msgCount = 0;
          for (let i=0; i<score.messages.length; i++) {
            if (score.messages[i].score === -1) {
              continue;
            }
            if (score.messages[i].key == key && score.messages[i].type == type) {
              if ((type == 'positive' && msgScore < score.messages[i].score)
                || (type == 'negative' && msgScore > score.messages[i].score)) {

                msgId = score.messages[i].id;
                msgText = score.messages[i].text.replace(/%INTERSECTION/g, score.messages[i].intersection);
                msgScore = score.messages[i].score;
              }
            }
          }
          for (let i=0; i<score.messages.length; i++) {
            if (msgId == score.messages[i].id) {
              msgCount++;
            }
          }
          messages[key][type] = msgText.replace(/%COUNT/g, String(msgCount));;
        }
      }

      const positive = self.loginService.settings.orderOfMessage == 0 ? 'positive' : 'negative';
      const negative = self.loginService.settings.orderOfMessage == 0 ? 'negative' : 'positive';

      const msgOverAll1 = messages['over_all'][positive];
      const msgOverAll2 = messages['over_all'][negative];
      self.msgOverAll = self.joinMessage(msgOverAll1, msgOverAll2);

      const msg1_1 = messages['score1'][positive];
      const msg1_2 = messages['score1'][negative];
      self.msg1 = self.joinMessage(msg1_1, msg1_2);

      const msg2_1 = messages['score2'][positive];
      const msg2_2 = messages['score2'][negative];
      self.msg2 = self.joinMessage(msg2_1, msg2_2);

      const msg3_1 = messages['score3'][positive];
      const msg3_2 = messages['score3'][negative];
      self.msg3 = self.joinMessage(msg3_1, msg3_2);

      const msg4_1 = messages['score4'][positive];
      const msg4_2 = messages['score4'][negative];
      self.msg4 = self.joinMessage(msg4_1, msg4_2);

      console.log('[DrivingScore][CommentPage] アドバイス表示の確認用ログ ここから');
      console.log('[DrivingScore][CommentPage] score over_all='+score.overAll+', score1='+score.score1+', score2='+score.score2+', score3='+score.score3+', score4='+score.score4);
      console.log('[DrivingScore][CommentPage] message over_all='+self.msgOverAll);
      console.log('[DrivingScore][CommentPage] message score1='+self.msg1);
      console.log('[DrivingScore][CommentPage] message score2='+self.msg2);
      console.log('[DrivingScore][CommentPage] message score3='+self.msg3);
      console.log('[DrivingScore][CommentPage] message score4='+self.msg4);
      console.log('[DrivingScore][CommentPage] アドバイス表示の確認用ログ ここまで');
    });
  }

  joinMessage(msg1: string, msg2: string): string {
    if (msg1 != '' && msg2 != '') {
      return msg1 + "\n" + msg2;
    } else if (msg1 != '') {
      return msg1;
    } else if (msg2 != '') {
      return msg2;
    }
    return '';
  }

  getRank(score: number): number {
    const rank = 101 - Math.round(score);
    return 100 < rank ? 100 : rank;
  }
}

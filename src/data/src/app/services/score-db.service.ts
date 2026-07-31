import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';

import { ScoreLogic } from '../data/score-logic';
import { Score, Message, CapabilityScore } from '../data/score';

@Injectable({
  providedIn: 'root'
})
export class ScoreDbService {
  private sqliteObject: SQLiteObject;
  private cordovaAvailable: boolean;

  constructor(
    private loginService: LoginService,
    private logService: LogService,
    private storage: Storage,
    private sqlite: SQLite) {
  }

  public async initialize() {
    this.cordovaAvailable = Capacitor.getPlatform() == 'android';
    if (!this.cordovaAvailable ) {
      return;
    }

    try {
      const db = await this.sqlite.create({ name: 'driving-score.db', location: 'default'});
      this.sqliteObject = db;
      await this.createDb();
    } catch(error) {
      this.logService.error('[DrivingScore][ScoreDbService] constructor', error);
    }
    this.logService.debug('[DrivingScore][ScoreDbService] initialize finish.');
  }

  async createDb() {
    if (!this.cordovaAvailable ) {
      return;
    }
    this.logService.debug('[DrivingScore][ScoreDbService] createDb');

    try {
      await this.sqliteObject.executeSql(
        'CREATE TABLE IF NOT EXISTS score (' +
        ' score_id INTEGER PRIMARY KEY,' +
        ' user_id TEXT,' +
        ' score_over_all INTEGER,' +
        ' score1 INTEGER,' +
        ' score2 INTEGER,' +
        ' score3 INTEGER,' +
        ' score4 INTEGER' +
        ');'
      , []);

      await this.sqliteObject.executeSql(
        'CREATE TABLE IF NOT EXISTS score_history (' +
        ' score_id INTEGER,' +
        ' timestamp INTEGER,' +
        ' message_id INTEGER,' +
        ' message_key TEXT,' +
        ' message_type TEXT,' +
        ' message_text TEXT,' +
        ' intersection TEXT,' +
        ' score INTEGER' +
        ');'
      , []);

      await this.sqliteObject.executeSql(
        'CREATE TABLE IF NOT EXISTS capability_score (' +
        ' score_id INTEGER,' +
        ' timestamp INTEGER,' +
        ' score_a INTEGER,' +
        ' score_a_message TEXT,' +
        ' score_b INTEGER,' +
        ' score_b_message TEXT,' +
        ' score_c INTEGER,' +
        ' score_c_message TEXT' +
        ');'
      , []);
    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] createDb: error='+error.message);
    }
  }

  async insertScore(scoreLogic: ScoreLogic): Promise<boolean> {
    if (!this.cordovaAvailable || scoreLogic.scoreList.length == 0) {
      this.logService.debug('[DrivingScore][ScoreDbService] insertScore: not insert');
      return true;
    }

    const data = [
      scoreLogic.startTimestamp,
      this.loginService.loginUser.userId,
      scoreLogic.scoreOverAll,
      scoreLogic.score1,
      scoreLogic.score2,
      scoreLogic.score3,
      scoreLogic.score4
    ];

    const insert = 'INSERT INTO score (score_id, user_id, score_over_all, score1, score2, score3, score4) VALUES (?, ?, ?, ?, ?, ?, ?)';

    try {
      await this.sqliteObject.executeSql(insert, data);

      // 運転診断メッセージをDBに保存
      const retScoreHistory = await this.insertScoreHistory(scoreLogic, 0);
      if (retScoreHistory === false) {
        return false;
      }

      // 能力指標スコアとメッセージをDBに保存
      const retCapabilityScore = await this.insertCapabilityScore(scoreLogic, 0);
      if (retCapabilityScore === false) {
        return false;
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] insertScore: error='+error.message);
      return false;
    }
    return true;
  }

  async insertScoreHistory(scoreLogic: ScoreLogic, pos: number): Promise<boolean> {
    if (!this.cordovaAvailable || scoreLogic.scoreList.length == 0) {
      this.logService.debug('[DrivingScore][ScoreDbService] insertScoreHistory: not insert');
      return true;
    }

    const length = scoreLogic.scoreList.length;

    let nextPos = pos;
    let values = '';
    const data = Array();
    for (let i=pos; i<scoreLogic.scoreList.length; i++) {
      nextPos++;

      let score = scoreLogic.scoreList[i];
      if (score.initialize == false) {
        continue;
      }

      for (let n=0; n<score.messages.length; n++) {
        if (values != '') {
          values = values + ',';
        }
        values = values + '(?, ?, ?, ?, ?, ?, ?, ?)';

        data.push(scoreLogic.startTimestamp);
        data.push(score.messages[n].timestamp);
        data.push(score.messages[n].id);
        data.push(score.messages[n].key);
        data.push(score.messages[n].type);
        data.push(score.messages[n].text);
        data.push(score.messages[n].intersection);
        data.push(score.messages[n].score);
      }

      if (1000 <= (data.length/8)) //1000 record
        break;
    }

    if (data.length == 0) {
      return true;
    }

    const insert = 'INSERT INTO score_history (score_id, timestamp, message_id, message_key, message_type, message_text, intersection, score) VALUES ' + values;

    try {
      await this.sqliteObject.executeSql(insert, data);

      return this.insertScoreHistory(scoreLogic, nextPos);

    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] insertScoreHistory: error='+error.message);
      return false;
    }
  }

  async insertCapabilityScore(scoreLogic: ScoreLogic, pos: number): Promise<boolean> {
    if (!this.cordovaAvailable || scoreLogic.scoreList.length == 0) {
      this.logService.debug('[DrivingScore][ScoreDbService] insertCapabilityScore: not insert');
      return true;
    }

    const length = scoreLogic.scoreList.length;

    let nextPos = pos;
    let values = '';
    const data = Array();
    for (let i=pos; i<scoreLogic.scoreList.length; i++) {
      nextPos++;

      let score = scoreLogic.scoreList[i];
      if (score.initialize == false) {
        continue;
      }

      if (score.capabilityScore.initialize == false) {
        continue;
      }

      if (values != '') {
        values = values + ',';
      }
      values = values + '(?, ?, ?, ?, ?, ?, ?, ?)';

      data.push(scoreLogic.startTimestamp);
      data.push(score.capabilityScore.timestamp);
      data.push(score.capabilityScore.scoreA);
      data.push(score.capabilityScore.scoreAMessage);
      data.push(score.capabilityScore.scoreB);
      data.push(score.capabilityScore.scoreBMessage);
      data.push(score.capabilityScore.scoreC);
      data.push(score.capabilityScore.scoreCMessage);

      if (1000 <= (data.length/8)) //1000 record
        break;
    }

    if (data.length == 0) {
      return true;
    }

    const insert = 'INSERT INTO capability_score (score_id, timestamp, score_a, score_a_message, score_b, score_b_message, score_c, score_c_message) VALUES ' + values;

    try {
      await this.sqliteObject.executeSql(insert, data);

      return this.insertCapabilityScore(scoreLogic, nextPos);

    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] insertCapabilityScore: error='+error.message);
      return false;
    }
  }

  async selectScore(scoreId: number): Promise<Array<Score>> {
    return await this._selectScore(scoreId, 1);
  }

  async selectAllScore(): Promise<Array<Score>> {
    return await this._selectScore(-1, -1);
  }

  async selectLastScore(): Promise<Array<Score>> {
    return await this._selectScore(-1, 1);
  }

  /**
   * ブラウザ起動で使うダミーデータ
   * @params {number} scoreId スコアID（中身はtimestamp）
   * @return {Score} 運転診断データ
   */
  private _selectDummyScore(scoreId: number): Score {
    scoreId = (scoreId == -1) ? Date.now() : scoreId;

    const score = Score.makeDbScore({
      score_id: scoreId,
      score_over_all: Math.random()*100,
      score1: Math.random()*100,
      score2: Math.random()*100,
      score3: Math.random()*100,
      score4: Math.random()*100,
    });

    const MAX = 20;
    for (let n=0; n<MAX; n++) {
      const timestamp = scoreId - (60000 * n);

      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交A',message_id: 0,message_key: 'score2',message_type: 'negative',message_text: '【ネガティブ】%INTERSECTIONブレーキコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交B',message_id: 1,message_key: 'score4',message_type: 'negative',message_text: '【ネガティブ】%INTERSECTIONハンドルコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交C',message_id: 2,message_key: 'score3',message_type: 'negative',message_text: '徐行が不十分で走行していたことがありました。\n見落としの可能性があります\n十分に速度を落として走行しましょう。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交D',message_id: 3,message_key: 'score1',message_type: 'negative',message_text: '【ネガティブ】%INTERSECTIONアクセルコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交E',message_id: 4,message_key: 'score2',message_type: 'positive',message_text: '【ポジティブ】%INTERSECTIONブレーキコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交F',message_id: 5,message_key: 'score4',message_type: 'positive',message_text: '【ポジティブ】%INTERSECTIONハンドルコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交G',message_id: 6,message_key: 'score3',message_type: 'positive',message_text: '【ポジティブ】%INTERSECTIONスピードコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交H',message_id: 7,message_key: 'score1',message_type: 'positive',message_text: '【ポジティブ】%INTERSECTIONアクセルコメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交I',message_id: 8,message_key: 'over_all',message_type: 'negative',message_text: '【ネガティブ】%INTERSECTION★総合コメント %COUNT回。', score:5}));
      if (Math.random() < 0.1)  score.messages.push(Message.makeDbMessage({timestamp: timestamp,intersection: '交J',message_id: 9,message_key: 'over_all',message_type: 'positive',message_text: '【ポジティブ】%INTERSECTION★総合コメント %COUNT回。', score:5}));

      if (Math.random() < 0.1) {
        const capabilityScore = new CapabilityScore(null, 0);
        capabilityScore.initialize = true;
        capabilityScore.timestamp = timestamp;
        capabilityScore.scoreA = Math.random() * 100;
        capabilityScore.scoreB = Math.random() * 100;
        capabilityScore.scoreC = Math.random() * 100;
        capabilityScore.scoreAMessage = "スコアAの能力値メッセージ ";
        capabilityScore.scoreBMessage = "スコアBの能力値メッセージ ";
        capabilityScore.scoreCMessage = "スコアCの能力値メッセージ ";
        score.graphCapabilityScoreList.push(capabilityScore);
      }
    }
    return score;
  }

  private async _selectScore(scoreId: number, limit: number): Promise<Array<Score>> {
    if (!this.cordovaAvailable ) {
      let result = Array<Score>();
      const max = limit == -1 ? 30 : limit;
      for (let n=0; n<max; n++) {
        const _scoreId = scoreId == -1 ? Date.now()-(86400000*n) : scoreId;
        result.push(this._selectDummyScore(_scoreId));
      }
      return result;
    }

    const andScoreId = 0 <= scoreId ? ' AND score.score_id = ? ' : '';

    const data = 0 <= scoreId ?
      [this.loginService.loginUser.userId, scoreId] :
      [this.loginService.loginUser.userId];

    const selectLimit = (1 <= limit) ? 'LIMIT ' + String(limit) : '';
    const selectScore = 'SELECT * FROM score WHERE user_id = ?' + andScoreId + ' ORDER BY score_id DESC ' + selectLimit;
    const selectCapabilityScore
      = 'SELECT capability_score.score_id, timestamp, score_a, score_a_message, score_b, score_b_message, score_c, score_c_message '+
         'FROM capability_score '+
         'INNER JOIN ( ' + selectScore + ' ) score_tmp ON capability_score.score_id = score_tmp.score_id '+
         'ORDER BY capability_score.score_id DESC, timestamp DESC';
    const selectMessage
      = 'SELECT score_history.score_id, timestamp, message_id, message_key, message_type, message_text, intersection, score '+
         'FROM score_history '+
         'INNER JOIN ( ' + selectScore + ' ) score_tmp ON score_history.score_id = score_tmp.score_id '+
         'ORDER BY score_history.score_id DESC, timestamp DESC';

    let result = Array<Score>();
    try {
      // SELECT CAPABILITY SCORE
      const capabilityScoreArray: any = {};
      const resCapabilityScore = await this.sqliteObject.executeSql(selectCapabilityScore,  data);
      if (resCapabilityScore.rows.length != null) {
        this.logService.debug('[DrivingScore][ScoreDbService] _selectScore: resCapabilityScore.rows.length='+resCapabilityScore.rows.length);
        for (let i = 0; i<resCapabilityScore.rows.length; i++) {
          const scoreId = resCapabilityScore.rows.item(i).score_id;
          if (capabilityScoreArray[scoreId] == null) {
            capabilityScoreArray[scoreId] = Array<CapabilityScore>();
          }
          capabilityScoreArray[scoreId].push( CapabilityScore.makeDbCapabilityScore(resCapabilityScore.rows.item(i)) );
        }
      }

      // SELECT MESSAGES
      const messages: any = {};
      const resMessage = await this.sqliteObject.executeSql(selectMessage,  data);
      if (resMessage.rows.length != null) {
        this.logService.debug('[DrivingScore][ScoreDbService] _selectScore: resMessage.rows.length='+resMessage.rows.length);
        for (let i = 0; i<resMessage.rows.length; i++) {
          const scoreId = resMessage.rows.item(i).score_id;
          if (messages[scoreId] == null) {
            messages[scoreId] = Array<Message>();
          }
          messages[scoreId].push( Message.makeDbMessage(resMessage.rows.item(i)) );
        }
      }

      // SELECT SCORE
      const resScore = await this.sqliteObject.executeSql(selectScore,  data);
      if (resScore.rows.length == null || resScore.rows.length == 0) {
        this.logService.debug('[DrivingScore][ScoreDbService] _selectScore: not score record');
        return result;
      }

      this.logService.debug('[DrivingScore][ScoreDbService] _selectScore: resScore.rows.length='+resScore.rows.length);
      for (let i = 0; i<resScore.rows.length; i++) {
        const scoreId = resScore.rows.item(i).score_id;
        const score = Score.makeDbScore(resScore.rows.item(i));
        score.messages = messages[scoreId] ?? Array<Message>();
        score.graphCapabilityScoreList = capabilityScoreArray[scoreId] ?? Array<CapabilityScore>();
        result.push(score);
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] _selectScore: error='+error.message);
    }
    return result;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.cordovaAvailable ) {
      return true;
    }

    try {
      const deleteTxt1 = 'DELETE FROM capability_score WHERE score_id IN ( SELECT score_id FROM score WHERE user_id = ? )';
      await this.sqliteObject.executeSql(deleteTxt1, [id]);

      const deleteTxt2 = 'DELETE FROM score_history WHERE score_id IN ( SELECT score_id FROM score WHERE user_id = ? )';
      await this.sqliteObject.executeSql(deleteTxt2, [id]);

      const deleteTxt3 = 'DELETE FROM score WHERE user_id = ?';
      await this.sqliteObject.executeSql(deleteTxt3, [id]);

      return true;
    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] delete: error='+error.message);
      return false;
    }
  }

}

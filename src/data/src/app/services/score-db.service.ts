import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { LoginService } from '../services/login.service';
import { LogService } from '../services/log.service';

import { ScoreLogic } from '../data/score-logic';
import { Score, Message, CapabilityScore, HiyariPoint } from '../data/score';

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
    private sqlite: SQLite,
    private file: File) {
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
        ' score_over_all REAL,' +
        ' score1 REAL,' +
        ' score2 REAL,' +
        ' score3 REAL,' +
        ' score4 REAL' +
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
        ' score REAL' +
        ');'
      , []);

      await this.sqliteObject.executeSql(
        'CREATE TABLE IF NOT EXISTS capability_score (' +
        ' score_id INTEGER,' +
        ' timestamp INTEGER,' +
        ' score_a REAL,' +
        ' score_a_message TEXT,' +
        ' score_b REAL,' +
        ' score_b_message TEXT,' +
        ' score_c REAL,' +
        ' score_c_message TEXT' +
        ');'
      , []);

      // ヒヤリ地点（proposal #300）
      //
      // 従来ヒヤリは MapService のメモリ配列にしか無く、次の診断開始で消えていた。
      // 日毎のヒヤリ回数と 1-2 の過去ヒヤリ表示にはどちらも永続化が要るため、
      // db.score.repository §10 の「要整理」を解いて専用テーブルを設ける。
      //
      // 日毎の回数は集計テーブルを作らず、参照時に GROUP BY で都度算出する
      // （ER 図 §7 / repository §7.3 の方針）。
      await this.sqliteObject.executeSql(
        'CREATE TABLE IF NOT EXISTS hiyari (' +
        ' hiyari_id INTEGER PRIMARY KEY,' +
        ' score_id INTEGER,' +      // 走行との紐付け（score.score_id）
        ' timestamp INTEGER,' +     // ヒヤリ発生時刻（epoch ms）
        ' latitude REAL,' +
        ' longitude REAL,' +
        ' video_time INTEGER,' +    // 切り出しファイル先頭からの秒。proposal #272 で常に 0
        ' video_path TEXT' +        // hiyari.NN.webm のフルパス。動画が無ければ空文字
        ');'
      , []);
    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] createDb: error='+error.message);
    }
  }

  /**
   * 走行 1 回ぶんの診断結果を保存する
   *
   * @param hiyariPoints ヒヤリ地点（proposal #300）。診断中に検知した順で渡す。
   *                     score → score_history → capability_score → hiyari の順で書く
   */
  async insertScore(scoreLogic: ScoreLogic,
    hiyariPoints: Array<HiyariPoint> = []): Promise<boolean> {
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

      // ヒヤリ地点をDBに保存（proposal #300）
      const retHiyari = await this.insertHiyari(scoreLogic.startTimestamp, hiyariPoints);
      if (retHiyari === false) {
        return false;
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] insertScore: error='+error.message);
      return false;
    }
    return true;
  }

  /**
   * ヒヤリ地点を保存する（proposal #300）
   *
   * @param scoreId 走行の score_id（scoreLogic.startTimestamp）
   * @param points  ヒヤリ地点。0 件なら何もしない
   */
  async insertHiyari(scoreId: number, points: Array<HiyariPoint>): Promise<boolean> {
    if (!this.cordovaAvailable || points.length == 0) {
      this.logService.debug('[DrivingScore][ScoreDbService] insertHiyari: not insert');
      return true;
    }

    let values = '';
    const data = Array();
    for (const point of points) {
      if (values != '') {
        values += ', ';
      }
      values += '(?, ?, ?, ?, ?, ?)';
      data.push(scoreId);
      data.push(point.timestamp);
      data.push(point.latitude);
      data.push(point.longitude);
      data.push(point.videoTime);
      data.push(point.videoPath);
    }

    const insert = 'INSERT INTO hiyari'
      + ' (score_id, timestamp, latitude, longitude, video_time, video_path)'
      + ' VALUES ' + values;

    try {
      await this.sqliteObject.executeSql(insert, data);
      this.logService.debug('[DrivingScore][ScoreDbService] insertHiyari: count='
        + points.length + ' scoreId=' + scoreId);
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] insertHiyari: error='+error.message);
      return false;
    }
    return true;
  }

  /**
   * 直近のヒヤリ地点を新しい順に取得する（proposal #300）
   *
   * 件数は呼び出し側が渡す。MapService には上限を持たせない
   * （middleware.map.service の未確定点を「呼び出し側で絞る」で解いた）。
   *
   * @param limit 取得件数。設定「地図に表示するヒヤリ件数」の値（既定 10）
   */
  async selectRecentHiyari(limit: number): Promise<Array<HiyariPoint>> {
    const list = Array<HiyariPoint>();
    if (!this.cordovaAvailable) {
      return list;
    }

    const select = 'SELECT score_id, timestamp, latitude, longitude, video_time, video_path'
      + ' FROM hiyari WHERE score_id IN ( SELECT score_id FROM score WHERE user_id = ? )'
      + ' ORDER BY timestamp DESC LIMIT ?';

    try {
      const result = await this.sqliteObject.executeSql(select,
        [this.loginService.loginUser.userId, limit]);
      for (let i=0; i<result.rows.length; i++) {
        const row = result.rows.item(i);
        list.push({
          timestamp: row.timestamp,
          latitude: row.latitude,
          longitude: row.longitude,
          videoTime: row.video_time,
          videoPath: row.video_path
        });
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] selectRecentHiyari: error='+error.message);
    }
    return list;
  }

  /**
   * 日毎のヒヤリ件数を新しい日から順に取得する（proposal #300）
   *
   * 集計テーブルは持たず、参照時に都度算出する（ER 図 §7 / repository §7.3）。
   * timestamp は epoch ms なので、秒へ直してから端末のローカル日付へ変換する。
   *
   * @param limit 取得する日数
   */
  async selectDailyHiyariCount(limit: number): Promise<Array<{ date: string, count: number }>> {
    const list = Array<{ date: string, count: number }>();
    if (!this.cordovaAvailable) {
      return list;
    }

    const select = "SELECT date(timestamp/1000, 'unixepoch', 'localtime') AS d, COUNT(*) AS c"
      + ' FROM hiyari WHERE score_id IN ( SELECT score_id FROM score WHERE user_id = ? )'
      + ' GROUP BY d ORDER BY d DESC LIMIT ?';

    try {
      const result = await this.sqliteObject.executeSql(select,
        [this.loginService.loginUser.userId, limit]);
      for (let i=0; i<result.rows.length; i++) {
        const row = result.rows.item(i);
        list.push({ date: row.d, count: row.c });
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] selectDailyHiyariCount: error='+error.message);
    }
    return list;
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

  /**
   * ヒヤリ録画ファイル本体を削除する（proposal #302）
   *
   * hiyari 行を消すと video_path が引けなくなるため、DELETE より前に呼ぶ。
   * 消すのは hiyari.NN.webm だけで、走行ディレクトリそのものや同居する
   * sensor-log / log / scoreLogic は残す（proposal #302 §4）。
   *
   * ファイル削除は 1 件ずつ握りつぶす。既に無い・権限が無いといった理由で
   * DB の削除まで止まると、緯度・経度が端末に残ってしまう。位置情報の消去を
   * 優先し、失敗はログだけ残して次へ進む。
   */
  private async deleteHiyariVideoFiles(id: string) {
    if (!this.cordovaAvailable) {
      return;
    }

    const select = "SELECT video_path FROM hiyari"
      + " WHERE score_id IN ( SELECT score_id FROM score WHERE user_id = ? )"
      + " AND video_path <> ''";

    let paths = Array<string>();
    try {
      const result = await this.sqliteObject.executeSql(select, [id]);
      for (let i=0; i<result.rows.length; i++) {
        paths.push(result.rows.item(i).video_path);
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] deleteHiyariVideoFiles: select error='
        + error.message);
      return;
    }

    let removed = 0;
    let failed = 0;
    for (const path of paths) {
      const sep = path.lastIndexOf('/');
      if (sep < 0) {
        failed++;
        continue;
      }
      // removeFile はディレクトリとファイル名を分けて渡す
      const dir = path.substring(0, sep + 1);
      const name = path.substring(sep + 1);
      try {
        await this.file.removeFile(dir, name);
        removed++;
      } catch(error: any) {
        // 既に無いファイルもここへ来る。DB の削除は止めない
        failed++;
        this.logService.error('[DrivingScore][ScoreDbService] deleteHiyariVideoFiles: remove failed. path='
          + path, error);
      }
    }

    this.logService.debug('[DrivingScore][ScoreDbService] deleteHiyariVideoFiles: removed='
      + removed + ' failed=' + failed + ' total=' + paths.length);
  }

  async delete(id: string): Promise<boolean> {
    if (!this.cordovaAvailable ) {
      return true;
    }

    // ヒヤリ録画ファイルを先に消す（proposal #302）。
    // DB を消してからでは video_path が引けなくなるため、SELECT はこの順で行う。
    // ファイル削除に失敗しても DB の削除は続ける。位置情報（緯度・経度）の
    // 消去を優先する
    await this.deleteHiyariVideoFiles(id);

    try {
      // ヒヤリ地点も消す（proposal #301）。hiyari は緯度・経度を持つので、
      // アカウント削除後に位置情報だけ端末へ残さない
      const deleteTxt0 = 'DELETE FROM hiyari WHERE score_id IN ( SELECT score_id FROM score WHERE user_id = ? )';
      await this.sqliteObject.executeSql(deleteTxt0, [id]);

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

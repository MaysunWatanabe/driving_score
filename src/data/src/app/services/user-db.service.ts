import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

import { LogService } from '../services/log.service';
import { User } from '../data/user';

@Injectable({
  providedIn: 'root'
})
export class UserDbService {
  private storage: SQLiteObject;

  private cordovaAvailable: boolean = true;

  constructor(
    private logService: LogService,
    private sqlite: SQLite) {

    this.cordovaAvailable = Capacitor.getPlatform() == 'android';
  }

  public async initialize() {
    if (!this.cordovaAvailable ) {
      return;
    }

    try {
      const db = await this.sqlite.create({ name: 'driving-score.db', location: 'default' });
      this.storage = db;
      await this.createDb();
    } catch(error) {
      this.logService.error('[DrivingScore][ScoreDbService] constructor', error);
    }
    this.logService.debug('[DrivingScore][UserDbService] initialize finish.');
  }

  async createDb() {
    if (!this.cordovaAvailable ) {
      return;
    }
    this.logService.debug('[DrivingScore][UserDbService] createDb');

    try {
      await this.storage.executeSql(
        'CREATE TABLE IF NOT EXISTS users('+
        '    user_id TEXT PRIMARY KEY,'+
        '    user_password TEXT,'+
        '    sex INTEGER,'+
        '    birth_year INTEGER,'+
        '    birth_month INTEGER,'+
        '    height INTEGER,'+
        '    prefecture INTEGER'+
        ');'
      , []);
    } catch(error) {
      this.logService.error('[DrivingScore][ScoreDbService] createDb', error);
    }
  }

  // Get list
  async selectUsers(): Promise<any> {
    if (!this.cordovaAvailable ) {
      this.logService.debug('[DrivingScore][ScoreDbService] selectUsers. return dummy account.');
      return [User.dummy()];
    }

    const items = Array();
    try {
      const res = await this.storage.executeSql('SELECT * FROM users', []);
      if (res.rows.length > 0) {
        for (var i = 0; i < res.rows.length; i++) {
          const user = new User();
          user.userId = res.rows.item(i).user_id,
          user.userPassword = res.rows.item(i).user_password,
          user.sex = res.rows.item(i).sex,
          user.birthYear = res.rows.item(i).birth_year,
          user.birthMonth = res.rows.item(i).birth_month,
          user.height = res.rows.item(i).height,
          user.prefecture = res.rows.item(i).prefecture
          items.push(user);
        }
      }
    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] selectUsers: error='+error.message);
    }
    return items;
  }

  async selectUser(id: string, password:string): Promise<User> {
    if (!this.cordovaAvailable ) {
      this.logService.debug('[DrivingScore][ScoreDbService] selectUsers. return dummy account.');
      return User.dummy();
    }

    try {
      const res = await this.storage.executeSql('SELECT * FROM users WHERE user_id = ? AND user_password = ?', [id, password]);
      if (0 < res.rows.length) {
        const user = new User();
        user.userId = res.rows.item(0).user_id,
        user.userPassword = res.rows.item(0).user_password,
        user.sex = res.rows.item(0).sex,
        user.birthYear = res.rows.item(0).birth_year,
        user.birthMonth = res.rows.item(0).birth_month,
        user.height = res.rows.item(0).height,
        user.prefecture = res.rows.item(0).prefecture
        return user;
      }
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] selectUser: error='+error.message);
    }
    return new User();
  }

  async insertUser(user: User, ignore: boolean): Promise<User> {
    if (!this.cordovaAvailable ) {
      return await this.selectUser(user.userId, user.userPassword);
    }

    const ignoreText = ignore ? 'or IGNORE' : '';

    const data = [
      user.userId,
      user.userPassword,
      user.sex,
      user.birthYear,
      user.birthMonth,
      user.height,
      user.prefecture
    ];
    try {
      const res = await this.storage.executeSql('INSERT '+ignoreText+' INTO users (user_id, user_password, sex, birth_year, birth_month, height, prefecture) VALUES (?, ?, ?, ?, ?, ?, ?)', data);
      return await this.selectUser(user.userId, user.userPassword);
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] insertUser: error='+error.message);
    }
    return new User();
  }

  async updateUser(user: User): Promise<User>  {
    if (!this.cordovaAvailable ) {
      return await this.selectUser(user.userId, user.userPassword);
    }

    const id = user.userId;
    const data = [
      user.userPassword,
      user.sex,
      user.birthYear,
      user.birthMonth,
      user.height,
      user.prefecture
    ];
    try {
      const res = await this.storage.executeSql(`UPDATE users SET user_password = ?, sex = ?, birth_year = ?, birth_month = ?, height = ?, prefecture = ? WHERE user_id = '${id}'`, data);
      return await this.selectUser(user.userId, user.userPassword);
    } catch(error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] updateUser: error='+error.message);
    }
    return new User();
  }

  // Delete
  async deleteUser(id: string): Promise<boolean> {
    if (!this.cordovaAvailable ) {
      return true;
    }

    try {
      await this.storage.executeSql('DELETE FROM users WHERE user_id = ?', [id]);
      return true;
    } catch (error: any) {
      this.logService.error('[DrivingScore][ScoreDbService] deleteUser: error='+error.message);
    }
    return false;
  }
}

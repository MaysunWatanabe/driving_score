import { Md5 } from 'ts-md5';

export class User {
    userId: string = '';
    userPassword: string = '';
    sex: number;
    birthYear: number;
    birthMonth: number;
    height: number;
    prefecture: number;

    static dummy() {
      let user = new User();
      user.userId = 'test';
      user.userPassword =  Md5.hashStr('12345678').toString();
      user.sex = 2;
      user.birthYear = 1999;
      user.birthMonth = 9;
      user.height = 185.5;
      user.prefecture = 12;
      return user;
    }
}

// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// mapsKey は git 管理外の environment.secrets.ts から供給する
// (テンプレート: environment.secrets.ts.example)。ファイルが無いと
// TypeScript コンパイル時にエラーになるので、秘密鍵の commit 混入を防げる。
import { secrets } from './environment.secrets';

export const environment = {
  production: false,
  mapsKey: secrets.mapsKey,
  geolocationMaximumAge: 0,
  geolocationTimeout: 1000,
  geolocationLastPosKey: 'geolocation-last-pos-key',
  sensorStockTime: 60000,
  scoreLogicKey: 'driving-score-logic',
  scoreLogicJsonKey: 'score-logic-json',
  loginKey: 'login',
  lastLoginUserId: 'last-login-user-id',
  settingRecording: 'setting-recording',
  settingGpsDemo: 'setting-gps-demo',
  settingLogStorage: 'setting-log-storage',
  settingSensorLogStorage: 'setting-sensor-log-storage',
  settingSelectedSensorMode: 'setting-selected-sensor-mode'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

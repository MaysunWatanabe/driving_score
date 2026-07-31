// mapsKey は git 管理外の environment.prod.secrets.ts から供給する
// (テンプレート: environment.prod.secrets.ts.example)。
import { secrets } from './environment.prod.secrets';

export const environment = {
  production: true,
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

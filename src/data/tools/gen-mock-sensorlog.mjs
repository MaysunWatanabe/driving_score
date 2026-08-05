#!/usr/bin/env node
/**
 * 動作検証用モックセンサログ生成器
 *
 * 仕様根拠:
 *   proposal #10 (synced) — 正準レコードスキーマ / 5 シナリオ / 生成スクリプト / 切替閾値
 *   proposal #12 (synced) — scenario x sensorMode 対応 / 出力ファイル名 / mixed 区間配分 /
 *                           hard_brake タイミング / sharp_curve 周期 / 端末取付姿勢 / CAN 量子化
 *   proposal #13 (synced) — 基準時刻 T0 / 初期 heading / accel_decel プロファイル / pedal 状態規則
 *
 * 出力は middleware.log.service の実機書出と同一形式（JSON Lines を gzip した .txt.gz）。
 * ui.edit.page が FileReader で Base64 化して DemoData.pushSensorLogFile へ渡す前提のため、
 * ファイル自体には Base64 を掛けない。
 *
 * 乱数は一切使わない。同一入力からは常に同一バイト列が出る。
 *
 * 使い方:
 *   node tools/gen-mock-sensorlog.mjs --scenario <name> --sensor-mode <mode> [--duration 60] [--out ./mock]
 *   node tools/gen-mock-sensorlog.mjs --canonical            # 正準 6 ファイルを一括生成
 */

import pako from 'pako';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 定数（すべて proposal #10 / #12 / #13 由来）
// ---------------------------------------------------------------------------

/** 重力加速度 [m/s^2]。G <-> m/s^2 の換算に使う */
const G = 9.80665;

/** センサー tick [ms]。middleware.sensor.service の setInterval と同じ 10ms (#10) */
const TICK_MS = 10;

/** 基準時刻。実行時刻に依存させないための固定値 (#13) */
const DEFAULT_BASE_TIME = '2026-07-01T10:00:00.000+09:00';

/** GPS 起点 = 東京駅 (#10) */
const ORIGIN_LAT = 35.681236;
const ORIGIN_LNG = 139.767125;

/** 初期方位 = 真北 (#13) */
const INITIAL_HEADING_DEG = 0.0;

/** 地磁気 (全磁力 46uT / 伏角 49deg / 偏角 0) の水平・鉛直成分 [uT] (#12) */
const MAG_HORIZONTAL = 30.2;
const MAG_VERTICAL = -34.7;

/** geolocation の定数フィールド (#12) */
const GEO_ALTITUDE = 5.0;
const GEO_ALTITUDE_ACCURACY = 3.0;
const GEO_ACCURACY = 5.0;

/** canData の定数フィールド (#12) */
const CAN_FRONT_DISTANCE = 50.0;
const CAN_LATERAL_DISTANCE = 0.0;
const CAN_SHIFT_INDICATION = 4; // D レンジ相当
const CAN_TURN_SIGNAL = 0;

/** pedal 状態判定の閾値 [G]。longAcc 量子化ステップ 0.01G の 2 倍 (#13) */
const PEDAL_STATE_THRESHOLD_G = 0.02;

/** sharp_curve のヨーレート正弦波の周期 [s] (#12) */
const CURVE_PERIOD_SEC = 8.0;
/** sharp_curve の目標横 G [G] (#10 / #12) */
const CURVE_PEAK_LAT_G = 0.30;
/** sharp_curve の車速 [km/h] (#10) */
const CURVE_SPEED_KMH = 40;
/** sharp_curve の steeringAngle ピーク [deg] (#10 / #12) */
const CURVE_PEAK_STEERING_DEG = 180;

/** cruise の車速 [km/h] (#10) */
const CRUISE_SPEED_KMH = 40;

/** accel_decel の 1 サイクル長 [s] とその内訳 (#13) */
const AD_CYCLE_SEC = 20.0;
const AD_ACCEL_SEC = 8.0;   // 0 -> 60 km/h
const AD_HOLD_SEC = 12.0;   // 60 km/h 定速の終わり
const AD_TOP_SPEED_KMH = 60;

/** hard_brake のイベント配置比率と各フェーズ長 [s] (#12) */
const HB_EVENT_RATIOS = [0.20, 0.45, 0.70];
const HB_BRAKE_SEC = 3.0;      // 60 -> 10 km/h
const HB_RECOVER_SEC = 4.0;    // 10 -> 60 km/h
const HB_BASE_SPEED_KMH = 60;
const HB_LOW_SPEED_KMH = 10;

/** mixed の区間順 (#12) */
const MIXED_SEGMENTS = ['cruise', 'accel_decel', 'hard_brake', 'sharp_curve'];

const SCENARIOS = ['cruise', 'accel_decel', 'hard_brake', 'sharp_curve', 'mixed'];
const SENSOR_MODES = ['smartphoneOnly', 'canConnected'];

/** リポジトリに commit する正準セット (#12) */
const CANONICAL_SET = [
  { scenario: 'cruise', sensorMode: 'smartphoneOnly' },
  { scenario: 'cruise', sensorMode: 'canConnected' },
  { scenario: 'accel_decel', sensorMode: 'canConnected' },
  { scenario: 'hard_brake', sensorMode: 'canConnected' },
  { scenario: 'sharp_curve', sensorMode: 'canConnected' },
  { scenario: 'mixed', sensorMode: 'canConnected' },
];

const DEFAULT_DURATION_SEC = 60;

// ---------------------------------------------------------------------------
// 小道具
// ---------------------------------------------------------------------------

const kmhToMs = (kmh) => kmh / 3.6;
const degToRad = (deg) => (deg * Math.PI) / 180;
const radToDeg = (rad) => (rad * 180) / Math.PI;
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/**
 * 指定ステップに量子化する。BLE デコードの逆量子化に一致させるため (#12)。
 * 浮動小数の桁あふれを避けるため、ステップの小数桁で丸め直す。
 */
function quantize(value, step, min, max) {
  const clamped = clamp(value, min, max);
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number((Math.round(clamped / step) * step).toFixed(decimals));
}

/**
 * epoch ms を JST (UTC+9) 固定で 'YYYY-MM-DD HH:mm:ss.SSS' に整形する。
 * 実行環境の TZ に依存させないため getUTC* のみを使う (#13)。
 */
function formatJst(epochMs) {
  const d = new Date(epochMs + 9 * 60 * 60 * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`
  );
}

/** 方位角を 0..360 に正規化する (#13) */
const normalizeHeading = (deg) => ((deg % 360) + 360) % 360;

// ---------------------------------------------------------------------------
// シナリオ: 各時刻の走行状態 { speedKmh, longAccG, yawRateDeg } を返す
//   localSec … そのシナリオ内での経過秒
//   scopeSec … そのシナリオに割り当てられた総秒数（hard_brake のイベント配置に使う）
// ---------------------------------------------------------------------------

/** 直進定速 40km/h (#10) */
function scenarioCruise() {
  return { speedKmh: CRUISE_SPEED_KMH, longAccG: 0, yawRateDeg: 0 };
}

/** 0 -> 60km/h 加速と緩減速の 20s 周期反復 (#13) */
function scenarioAccelDecel(localSec) {
  const t = localSec % AD_CYCLE_SEC;
  const rateKmhPerSec = AD_TOP_SPEED_KMH / AD_ACCEL_SEC; // 7.5 km/h/s
  const accG = kmhToMs(rateKmhPerSec) / G;               // ≈ +0.2124 G

  if (t < AD_ACCEL_SEC) {
    return { speedKmh: rateKmhPerSec * t, longAccG: accG, yawRateDeg: 0 };
  }
  if (t < AD_HOLD_SEC) {
    return { speedKmh: AD_TOP_SPEED_KMH, longAccG: 0, yawRateDeg: 0 };
  }
  const decelElapsed = t - AD_HOLD_SEC;
  return {
    speedKmh: AD_TOP_SPEED_KMH - rateKmhPerSec * decelElapsed,
    longAccG: -accG,
    yawRateDeg: 0,
  };
}

/**
 * 60km/h 定速から急制動を 3 回 (#12)。
 * イベントが重なる場合（mixed のように scopeSec が短い場合に起きる）は
 * 後発のイベントが先行イベントを上書きする。開始時刻の降順に走査して
 * 最初にヒットしたものを採るため、結果は一意に定まる。
 */
function scenarioHardBrake(localSec, scopeSec) {
  const brakeRateKmhPerSec = (HB_BASE_SPEED_KMH - HB_LOW_SPEED_KMH) / HB_BRAKE_SEC;
  const recoverRateKmhPerSec = (HB_BASE_SPEED_KMH - HB_LOW_SPEED_KMH) / HB_RECOVER_SEC;
  const brakeAccG = -kmhToMs(brakeRateKmhPerSec) / G;     // ≈ -0.4723 G
  const recoverAccG = kmhToMs(recoverRateKmhPerSec) / G;  // ≈ +0.3542 G

  const starts = HB_EVENT_RATIOS.map((r) => scopeSec * r);
  for (let i = starts.length - 1; i >= 0; i--) {
    const elapsed = localSec - starts[i];
    if (elapsed < 0) continue;
    if (elapsed < HB_BRAKE_SEC) {
      return {
        speedKmh: HB_BASE_SPEED_KMH - brakeRateKmhPerSec * elapsed,
        longAccG: brakeAccG,
        yawRateDeg: 0,
      };
    }
    if (elapsed < HB_BRAKE_SEC + HB_RECOVER_SEC) {
      return {
        speedKmh: HB_LOW_SPEED_KMH + recoverRateKmhPerSec * (elapsed - HB_BRAKE_SEC),
        longAccG: recoverAccG,
        yawRateDeg: 0,
      };
    }
    break; // 直近イベントが終了済み -> 定速へ
  }
  return { speedKmh: HB_BASE_SPEED_KMH, longAccG: 0, yawRateDeg: 0 };
}

/**
 * 40km/h 定速で周期 8s の連続カーブ (#12)。
 * 振幅 A は latAcc のピークが 0.30G ちょうどになるよう決定的に算出する。
 */
const CURVE_YAW_AMPLITUDE_DEG = radToDeg(
  (CURVE_PEAK_LAT_G * G) / kmhToMs(CURVE_SPEED_KMH),
); // ≈ 15.1687 deg/s

function scenarioSharpCurve(localSec) {
  const phase = (2 * Math.PI * localSec) / CURVE_PERIOD_SEC;
  return {
    speedKmh: CURVE_SPEED_KMH,
    longAccG: 0,
    yawRateDeg: CURVE_YAW_AMPLITUDE_DEG * Math.sin(phase),
  };
}

/** 4 区間を等分連結 (#12) */
function scenarioMixed(localSec, scopeSec) {
  const segSec = scopeSec / MIXED_SEGMENTS.length;
  const index = Math.min(MIXED_SEGMENTS.length - 1, Math.floor(localSec / segSec));
  return evaluateScenario(MIXED_SEGMENTS[index], localSec - index * segSec, segSec);
}

function evaluateScenario(scenario, localSec, scopeSec) {
  switch (scenario) {
    case 'cruise': return scenarioCruise();
    case 'accel_decel': return scenarioAccelDecel(localSec);
    case 'hard_brake': return scenarioHardBrake(localSec, scopeSec);
    case 'sharp_curve': return scenarioSharpCurve(localSec);
    case 'mixed': return scenarioMixed(localSec, scopeSec);
    default: throw new Error(`unknown scenario: ${scenario}`);
  }
}

// ---------------------------------------------------------------------------
// レコード生成
// ---------------------------------------------------------------------------

/** 量子化前 longAcc からペダル・ブレーキ状態を決める (#13) */
function pedalState(longAccG) {
  if (longAccG > PEDAL_STATE_THRESHOLD_G) {
    return { accelPedalPosition: 120, brakePressure: 0, brakeSwitch: 0 };
  }
  if (longAccG < -PEDAL_STATE_THRESHOLD_G) {
    return { accelPedalPosition: 0, brakePressure: 200, brakeSwitch: 1 };
  }
  return { accelPedalPosition: 40, brakePressure: 0, brakeSwitch: 0 };
}

/**
 * センサログ本体を組み立てる。
 * @returns {{lines: string[], stats: object}}
 */
function buildSensorLog({ scenario, sensorMode, durationSec, baseMs }) {
  const totalTicks = Math.round((durationSec * 1000) / TICK_MS);
  const dtSec = TICK_MS / 1000;

  let headingDeg = INITIAL_HEADING_DEG;
  let lat = ORIGIN_LAT;
  let lng = ORIGIN_LNG;

  const lines = [];
  const stats = { minLongAccG: Infinity, maxLatAccG: -Infinity, maxSteeringDeg: 0, brakeTicks: 0 };

  for (let i = 0; i < totalTicks; i++) {
    const localSec = (i * TICK_MS) / 1000;
    const { speedKmh, longAccG, yawRateDeg } = evaluateScenario(scenario, localSec, durationSec);

    const speedMs = kmhToMs(speedKmh);
    // 横 G は旋回半径ではなくヨーレートから導く: latAcc = v * yawRate[rad/s] / g
    const latAccG = (speedMs * degToRad(yawRateDeg)) / G;
    const steeringDeg =
      CURVE_YAW_AMPLITUDE_DEG === 0
        ? 0
        : (CURVE_PEAK_STEERING_DEG * yawRateDeg) / CURVE_YAW_AMPLITUDE_DEG;

    const headingRad = degToRad(headingDeg);

    const sensor = {
      timestamp: baseMs + i * TICK_MS,
      videoTime: i * TICK_MS,
      geolocation: {
        latitude: lat,
        longitude: lng,
        accuracy: GEO_ACCURACY,
        altitude: GEO_ALTITUDE,
        altitudeAccuracy: GEO_ALTITUDE_ACCURACY,
        heading: headingDeg,
        speed: speedMs,
        repeat: 0,
      },
      acceleration: {
        accelerationIncludingGravity: {
          x: latAccG * G,
          y: longAccG * G,
          z: G,
        },
        rotationRate: {
          beta: 0,
          gamma: 0,
          alpha: yawRateDeg,
        },
        interval: TICK_MS,
        repeat: 0,
      },
      gyroscope: {
        beta: 0,
        gamma: 0,
        alpha: headingDeg,
        repeat: 0,
      },
      magnetometer: {
        x: -MAG_HORIZONTAL * Math.sin(headingRad),
        y: MAG_HORIZONTAL * Math.cos(headingRad),
        z: MAG_VERTICAL,
        repeat: 0,
      },
    };

    if (sensorMode === 'canConnected') {
      const pedal = pedalState(longAccG);
      sensor.canData = {
        vehicleSpeed: quantize(speedKmh, 1, 0, 255),
        longAcc: quantize(longAccG, 0.01, -1.28, 1.27),
        latAcc: quantize(latAccG, 0.01, -1.28, 1.27),
        frontDistance: quantize(CAN_FRONT_DISTANCE, 0.5, 0, 127.5),
        lateralDistance: quantize(CAN_LATERAL_DISTANCE, 0.5, -64, 63.5),
        steeringAngle: quantize(steeringDeg, 0.1, -1080, 1471.5),
        accelPedalPosition: quantize(pedal.accelPedalPosition, 1, 0, 255),
        brakePressure: quantize(pedal.brakePressure, 1, 0, 255),
        brakeSwitch: pedal.brakeSwitch,
        shiftIndication: CAN_SHIFT_INDICATION,
        turnSignal: CAN_TURN_SIGNAL,
        repeat: 0,
      };
      // geolocation.speed は canData.vehicleSpeed と整合させる (#10)
      sensor.geolocation.speed = sensor.canData.vehicleSpeed / 3.6;
      if (sensor.canData.brakeSwitch === 1) stats.brakeTicks++;
    }

    lines.push(JSON.stringify({ date: formatJst(sensor.timestamp), sensor }));

    stats.minLongAccG = Math.min(stats.minLongAccG, longAccG);
    stats.maxLatAccG = Math.max(stats.maxLatAccG, latAccG);
    stats.maxSteeringDeg = Math.max(stats.maxSteeringDeg, Math.abs(steeringDeg));

    // 次 tick の位置・方位を積分する。区間をまたいでも状態は引き継がれる (#12)
    headingDeg = normalizeHeading(headingDeg + yawRateDeg * dtSec);
    const distance = speedMs * dtSec;
    const nextHeadingRad = degToRad(headingDeg);
    lat += (distance * Math.cos(nextHeadingRad)) / 111320;
    lng += (distance * Math.sin(nextHeadingRad)) / (111320 * Math.cos(degToRad(lat)));
  }

  return { lines, stats };
}

// ---------------------------------------------------------------------------
// セルフチェック — DemoData.unzipped() と同じ判定で検証する (#10)
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = ['videoTime', 'geolocation', 'acceleration', 'gyroscope', 'magnetometer'];

function selfCheck(gzipped, expectedCount) {
  const text = pako.ungzip(gzipped, { to: 'string' });
  const lines = text.split('\n').filter((l) => l !== '');
  const errors = [];

  if (lines.length !== expectedCount) {
    errors.push(`行数が一致しません: expected=${expectedCount} actual=${lines.length}`);
  }

  let skipped = 0;
  let lastVideoTime = -1;
  for (const line of lines) {
    let sensor;
    try {
      sensor = JSON.parse(line).sensor;
    } catch (e) {
      errors.push(`JSON parse 失敗: ${e.message}`);
      break;
    }
    if (sensor === undefined || REQUIRED_KEYS.some((k) => sensor[k] === undefined)) {
      skipped++;
      continue;
    }
    if (sensor.videoTime <= lastVideoTime) {
      errors.push(`videoTime が単調増加していません: ${lastVideoTime} -> ${sensor.videoTime}`);
      break;
    }
    lastVideoTime = sensor.videoTime;
  }

  if (skipped !== 0) {
    errors.push(`DemoData に skip される行があります: ${skipped} 行`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// 生成 + 書き出し
// ---------------------------------------------------------------------------

function generate({ scenario, sensorMode, durationSec, baseMs, outDir }) {
  const { lines, stats } = buildSensorLog({ scenario, sensorMode, durationSec, baseMs });
  const text = lines.join('\n') + '\n';
  // mtime を 0 に固定しないと gzip ヘッダに実行時刻が入り、決定的生成にならない
  const gzipped = pako.gzip(text, { level: 9, header: { time: 0, os: 3 } });

  const errors = selfCheck(gzipped, lines.length);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  [NG] ${e}`);
    throw new Error(`セルフチェック失敗: ${scenario} / ${sensorMode}`);
  }

  mkdirSync(outDir, { recursive: true });
  const fileName = `sensor-log.${scenario}.${sensorMode}.txt.gz`;
  const filePath = join(outDir, fileName);
  writeFileSync(filePath, gzipped);

  const summary =
    sensorMode === 'canConnected'
      ? `minLongAcc=${stats.minLongAccG.toFixed(3)}G maxLatAcc=${stats.maxLatAccG.toFixed(3)}G ` +
        `maxSteering=${stats.maxSteeringDeg.toFixed(1)}deg brakeTicks=${stats.brakeTicks}`
      : `minLongAcc=${stats.minLongAccG.toFixed(3)}G maxLatAcc=${stats.maxLatAccG.toFixed(3)}G`;

  console.log(
    `  [OK] ${fileName}  ${lines.length} 行 / ${gzipped.length} bytes (gz) / ${text.length} bytes (raw)`,
  );
  console.log(`       ${summary}`);
  return filePath;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`不明な引数: ${token}`);
    const key = token.slice(2);
    if (key === 'canonical' || key === 'help') {
      args[key] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`--${key} に値がありません`);
    args[key] = value;
  }
  return args;
}

function usage() {
  console.log(`
モックセンサログ生成器 (proposal #10 / #12 / #13)

  node tools/gen-mock-sensorlog.mjs --scenario <name> --sensor-mode <mode> [options]
  node tools/gen-mock-sensorlog.mjs --canonical [options]

必須:
  --scenario <name>       ${SCENARIOS.join(' | ')}
  --sensor-mode <mode>    ${SENSOR_MODES.join(' | ')}

任意:
  --duration <sec>        既定 ${DEFAULT_DURATION_SEC}（行数 = duration x 100）
  --out <dir>             既定 src/data/mock
  --base-time <ISO8601>   既定 ${DEFAULT_BASE_TIME}
  --canonical             commit 対象の正準 6 ファイルを一括生成
`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`エラー: ${e.message}`);
    usage();
    process.exit(1);
  }

  if (args.help || process.argv.length <= 2) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(args.out ?? join(scriptDir, '..', 'mock'));
  const durationSec = Number(args.duration ?? DEFAULT_DURATION_SEC);
  const baseMs = Date.parse(args['base-time'] ?? DEFAULT_BASE_TIME);

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    console.error(`エラー: --duration が不正です: ${args.duration}`);
    process.exit(1);
  }
  if (!Number.isFinite(baseMs)) {
    console.error(`エラー: --base-time が不正です: ${args['base-time']}`);
    process.exit(1);
  }

  const targets = args.canonical
    ? CANONICAL_SET
    : [{ scenario: args.scenario, sensorMode: args['sensor-mode'] }];

  for (const t of targets) {
    if (!SCENARIOS.includes(t.scenario)) {
      console.error(`エラー: --scenario は ${SCENARIOS.join(' | ')} のいずれかです (指定: ${t.scenario})`);
      process.exit(1);
    }
    if (!SENSOR_MODES.includes(t.sensorMode)) {
      console.error(`エラー: --sensor-mode は ${SENSOR_MODES.join(' | ')} のいずれかです (指定: ${t.sensorMode})`);
      process.exit(1);
    }
  }

  console.log(`出力先: ${outDir}`);
  console.log(`基準時刻: ${new Date(baseMs).toISOString()} / duration: ${durationSec}s`);
  for (const t of targets) {
    generate({ ...t, durationSec, baseMs, outDir });
  }
  console.log(`完了: ${targets.length} ファイル`);
}

main();

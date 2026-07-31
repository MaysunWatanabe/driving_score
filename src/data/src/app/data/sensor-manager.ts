export class SensorManager {

  // CALIBRATION_SKIP_TIMEが経過した後からCALIBRATION_SET_TIMEの平均値をキャリブレーションに使う
  private static readonly CALIBRATION_SET_TIME:  number = 1000;
  private static readonly CALIBRATION_SKIP_TIME: number = 100;

  private static calibrationOffset: any;

  private static calibrationTotalTime: number = 0;
  private static calibrationSensorData = Array();

  // 時定数（サンプル周期）
  private static readonly T = 0.0167;
  // カットオフ周波数
  private static readonly F = 0.2;
  // τ=1/(2πF)
  private static readonly tau =　1　/　(2　*　Math.PI　*　SensorManager.F);

  public static calibration(sensorData: any): any {

    if (sensorData.calibration === undefined
      || sensorData.offset === undefined
      || sensorData.orientation === undefined) {

      sensorData.calibration = SensorManager.calculateCalibrationOffset(sensorData);
    }

    if (sensorData.offset === undefined) {
      // センサー情報をログに落として、後で復元できるように必要な情報を追加する
      sensorData.offset = {
        x: SensorManager.calibrationOffset.acceleration.offsetX,
        y: SensorManager.calibrationOffset.acceleration.offsetY,
        z: SensorManager.calibrationOffset.acceleration.offsetZ,
      };
    } else {
      // センサー情報にオフセット値がすでにある場合は、その値でキャリブレーションする
      SensorManager.calibrationOffset.acceleration.offsetX = sensorData.offset.x;
      SensorManager.calibrationOffset.acceleration.offsetY = sensorData.offset.y;
      SensorManager.calibrationOffset.acceleration.offsetZ = sensorData.offset.z;
    }

    if (sensorData.orientation === undefined) {
      // センサー情報をログに落として、後で復元できるように必要な情報を追加する
      sensorData.orientation = {
        pitch: SensorManager.calibrationOffset.orientation.pitch,
        roll: SensorManager.calibrationOffset.orientation.roll
      };
    } else {
      // センサー情報にオフセット値がすでにある場合は、その値でキャリブレーションする
      SensorManager.calibrationOffset.orientation.pitch = sensorData.orientation.pitch;
      SensorManager.calibrationOffset.orientation.roll = sensorData.orientation.roll;
    }

    // ローパスフィルタ1
    // 時定数（サンプル周期）
    const T = SensorManager.T;
    // カットオフ周波数
    const F = SensorManager.F;
    // τ=1/(2πF)
    const tau =　SensorManager.tau;
    // accelerationIncludingGravity
    const x = sensorData.acceleration.accelerationIncludingGravity.x;
    const y = sensorData.acceleration.accelerationIncludingGravity.y;
    const z = sensorData.acceleration.accelerationIncludingGravity.z;
    // accelerationIncludingGravity lowPass
    const lowPassX = SensorManager.calibrationOffset.acceleration.lastX * tau / (T + tau) + x * T / (T + tau);
    const lowPassY = SensorManager.calibrationOffset.acceleration.lastY * tau / (T + tau) + y * T / (T + tau);
    const lowPassZ = SensorManager.calibrationOffset.acceleration.lastZ * tau / (T + tau) + z * T / (T + tau);
    // update last data
    SensorManager.calibrationOffset.acceleration.lastX = x;
    SensorManager.calibrationOffset.acceleration.lastY = y;
    SensorManager.calibrationOffset.acceleration.lastZ = z;

    sensorData.acceleration.accelerationIncludingGravity.lowPass = {
      x: lowPassX,
      y: lowPassY,
      z: lowPassZ
    };

    // Rotate
    const rotate = SensorManager.rotateVector([x, y, z]);
    const rotateLowPass = SensorManager.rotateVector([lowPassX, lowPassY, lowPassZ]);
    sensorData.acceleration.accelerationIncludingGravity.rotate = {
      x: rotate.x,
      y: rotate.y,
      z: rotate.z,
      lowPass: {
        x: rotateLowPass.x,
        y: rotateLowPass.y,
        z: rotateLowPass.z
      }
    };

    const rotateGyroscope = SensorManager.rotateVector([sensorData.gyroscope.beta, sensorData.gyroscope.gamma, 0]);
    sensorData.gyroscope.rotate = {
      beta: rotateGyroscope.x,
      gamma: rotateGyroscope.y
      //アルファ角は端末の上端が地球の北極をまっすぐ向いているときが 0 度になるため、回転で補正するようなデータではない
      //alpha: rotateGyroscope.z,
    };
  }

  public static initializeCalibration() {
    SensorManager.initializeCalibrationOffset();
    SensorManager.calibrationTotalTime = 0;
    SensorManager.calibrationSensorData.splice(0);
    SensorManager.calibrationOffset.acceleration.lastX = 0;
    SensorManager.calibrationOffset.acceleration.lastY = 0;
    SensorManager.calibrationOffset.acceleration.lastZ = 0;
  }

  private static initializeCalibrationOffset() {
    SensorManager.calibrationOffset = {
      acceleration: {
        offsetX:0, offsetY:0, offsetZ:0,
        lastX:0, lastY:0, lastZ:0
      },
      magnetometer: {
        offsetX:0, offsetY:0, offsetZ:0
      },
      orientation: {
        azimuth:0, pitch:0, roll:0
      }
    };
  }

  // キャリプレーション用のサンプルデータを貯める
  private static putCalibrationData(sensorData: any) {
    if ((SensorManager.CALIBRATION_SKIP_TIME + SensorManager.CALIBRATION_SET_TIME) <= SensorManager.calibrationTotalTime) {
      //指定秒以上のセンサーデータを蓄積しない
      return;
    }
    SensorManager.calibrationTotalTime += sensorData.acceleration.interval;
    if (SensorManager.CALIBRATION_SKIP_TIME < SensorManager.calibrationTotalTime) {
      SensorManager.calibrationSensorData.push(sensorData);
    }
  }

  // キャリブレーションデータの計算
  private static calculateCalibrationOffset(sensorData: any): boolean {
    if (SensorManager.calibrationOffset === undefined) {
      SensorManager.initializeCalibration();
    }

    if((SensorManager.CALIBRATION_SKIP_TIME + SensorManager.CALIBRATION_SET_TIME) <= SensorManager.calibrationTotalTime) {
      return true;
    }

    SensorManager.putCalibrationData(sensorData);

    // サンプルデータの平均を計算
    const acceleration = SensorManager.calibrationOffset.acceleration;
    const magnetometer = SensorManager.calibrationOffset.magnetometer;
    if (0 < SensorManager.calibrationSensorData.length) {
      SensorManager.calibrationSensorData.forEach(data => {
        acceleration.offsetX += data.acceleration.accelerationIncludingGravity.x;
        acceleration.offsetY += data.acceleration.accelerationIncludingGravity.y;
        acceleration.offsetZ += data.acceleration.accelerationIncludingGravity.z;
        magnetometer.offsetX += data.magnetometer.x;
        magnetometer.offsetY += data.magnetometer.y;
        magnetometer.offsetZ += data.magnetometer.z;
      });
      let length = SensorManager.calibrationSensorData.length;
      acceleration.offsetX /= length;
      acceleration.offsetY /= length;
      acceleration.offsetZ /= length;
      magnetometer.offsetX /= length;
      magnetometer.offsetY /= length;
      magnetometer.offsetZ /= length;
    }

    //端末をどんな向きで持っていても、縦に持った時と同じになるようデータを回転する
    const accelerationData = [
      acceleration.offsetX,
      acceleration.offsetY,
      acceleration.offsetZ
    ];
    const geomagneticData = [
      magnetometer.offsetX,
      magnetometer.offsetY,
      magnetometer.offsetZ
    ];

    // 回転行列
    const inR: number[] = [...Array(16)].map(() => 0);
    const outR: number[] = [...Array(16)].map(() => 0);
    const I: number[] = [...Array(16)].map(() => 0);
    SensorManager.getRotationMatrix(inR, I, accelerationData, geomagneticData);
    // X=AXIS_X、Y=AXIS_Zは、端末を縦に立てている状態
    SensorManager.remapCoordinateSystem(inR, SensorManager.AXIS_X, SensorManager.AXIS_Z, outR);

    const orientation = SensorManager.calibrationOffset.orientation;
    const orientationValues: number[] = [...Array(3)].map(() => 0);
    SensorManager.getOrientation(outR, orientationValues);
    // -z軸を中心とした回転角。デバイスのy軸と磁北極の間の角度を表します。北向きの場合、この角度は0です。
    orientation.azimuth = (orientationValues[0] * 180 / Math.PI);
    // x軸周りの回転角度。この値は、デバイスの画面に平行な平面と地面に平行な平面の間の角度を表します。
    orientation.pitch = (orientationValues[1] * 180 / Math.PI);
    // y軸周りの回転角度。この値は、デバイスの画面に垂直な平面と地面に垂直な平面の間の角度を表します。
    orientation.roll = (orientationValues[2] * 180 / Math.PI);

    return false;
  }

  public static readonly AXIS_X = 1;
  public static readonly AXIS_Y = 2;
  public static readonly AXIS_Z = 3;
  public static readonly AXIS_MINUS_X = SensorManager.AXIS_X | 0x80;
  public static readonly AXIS_MINUS_Y = SensorManager.AXIS_Y | 0x80;
  public static readonly AXIS_MINUS_Z = SensorManager.AXIS_Z | 0x80;

  private static rotateVector(vector: number[]): {x:number, y:number, z:number} {
    // 回転情報
    let pitch = SensorManager.calibrationOffset.orientation.pitch;
    let roll = SensorManager.calibrationOffset.orientation.roll;

    const vx = vector[0] * (45 <= Math.abs(roll)? -1 :  1);
    const vy = vector[1] * (45 <= Math.abs(roll)? -1 :  1);
    const vz = vector[2];

    const ax = 45 <= Math.abs(roll) ? 0 : -pitch;
    const ay = 45 <= Math.abs(roll) ? (roll < 0 ? -pitch : pitch) : 0;
    const az = roll;

    const rx = ax * (Math.PI / 180);
    const ry = ay * (Math.PI / 180);
    const rz = az * (Math.PI / 180);

    // x軸周りに右回転した座標を取得する表現行列
    const mx = [
      [1, 0, 0],
      [0, Math.cos(rx), -Math.sin(rx)],
      [0, Math.sin(rx),  Math.cos(rx)]
    ];

    // y軸周り右回転した座標を取得する表現行列
    const my = [
      [ Math.cos(ry), 0, Math.sin(ry)],
      [0, 1, 0],
      [-Math.sin(ry), 0, Math.cos(ry)]
    ];

    // z軸周りに右回転した座標を取得する表現行列
    const mz = [
      [Math.cos(rz), -Math.sin(rz), 0],
      [Math.sin(rz),  Math.cos(rz), 0],
      [0, 0, 1]
    ];

    // x軸回りの回転
    let rotation = SensorManager.calc(mx, [vx, vy, vz]);
    // y軸回りの回転
    rotation = SensorManager.calc(my, [rotation.x, rotation.y, rotation.z]);
    // z軸回りの回転
    rotation = SensorManager.calc(mz, [rotation.x, rotation.y, rotation.z]);
    return { x: rotation.x, y: rotation.y, z: rotation.z };
  }

  private static calc(matrix: number[][], vector: [number,number,number]): any {
    const x = matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2];
    const y = matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2];
    const z = matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2];
    return { x: x, y: y, z: z };
  }

  /** SensorManager Android **/
  public static remapCoordinateSystem(inR: number[], X: number, Y: number, outR: number[]): boolean {
    if (Object.is(inR, outR)) {
      const temp: number[] = [...Array(16)].map(() => 0);
      // we don't expect to have a lot of contention
      if (SensorManager.remapCoordinateSystemImpl(inR, X, Y, temp)) {
        const size = outR.length;
        for (let i = 0; i < size; i++) {
          outR[i] = temp[i];
        }
        return true;
      }
    }
    return SensorManager.remapCoordinateSystemImpl(inR, X, Y, outR);
  }

  private static remapCoordinateSystemImpl(inR: number[], X: number, Y: number, outR: number[]): boolean {
    /*
     * X and Y define a rotation matrix 'r':
     *
     *  (X==1)?((X&0x80)?-1:1):0    (X==2)?((X&0x80)?-1:1):0    (X==3)?((X&0x80)?-1:1):0
     *  (Y==1)?((Y&0x80)?-1:1):0    (Y==2)?((Y&0x80)?-1:1):0    (Y==3)?((X&0x80)?-1:1):0
     *                              r[0] ^ r[1]
     *
     * where the 3rd line is the vector product of the first 2 lines
     *
     */
    const length = outR.length;
    if (inR.length != length) {
      return false;   // invalid parameter
    }
    if ((X & 0x7C) != 0 || (Y & 0x7C) != 0) {
      return false;   // invalid parameter
    }
    if (((X & 0x3) == 0) || ((Y & 0x3) == 0)) {
      return false;   // no axis specified
    }
    if ((X & 0x3) == (Y & 0x3)) {
      return false;   // same axis specified
    }
    // Z is "the other" axis, its sign is either +/- sign(X)*sign(Y)
    // this can be calculated by exclusive-or'ing X and Y; except for
    // the sign inversion (+/-) which is calculated below.
    let Z = X ^ Y;
    // extract the axis (remove the sign), offset in the range 0 to 2.
    const x = (X & 0x3) - 1;
    const y = (Y & 0x3) - 1;
    const z = (Z & 0x3) - 1;
    // compute the sign of Z (whether it needs to be inverted)
    const axis_y = (z + 1) % 3;
    const axis_z = (z + 2) % 3;
    if (((x ^ axis_y) | (y ^ axis_z)) != 0) {
      Z ^= 0x80;
    }
    const sx = (X >= 0x80);
    const sy = (Y >= 0x80);
    const sz = (Z >= 0x80);
    // Perform R * r, in avoiding actual muls and adds.
    const rowLength = ((length == 16) ? 4 : 3);
    for (let j = 0; j < 3; j++) {
      const offset = j * rowLength;
      for (let i = 0; i < 3; i++) {
        if (x == i)   outR[offset + i] = sx ? -inR[offset + 0] : inR[offset + 0];
        if (y == i)   outR[offset + i] = sy ? -inR[offset + 1] : inR[offset + 1];
        if (z == i)   outR[offset + i] = sz ? -inR[offset + 2] : inR[offset + 2];
      }
    }
    if (length == 16) {
      outR[3] = outR[7] = outR[11] = outR[12] = outR[13] = outR[14] = 0;
      outR[15] = 1;
    }
    return true;
  }

  public static getRotationMatrix(R: number[], I: number[], acceleration: number[], geomagnetic: number[]): boolean {
    // TODO: move this to native code for efficiency
    let Ax = acceleration[0];
    let Ay = acceleration[1];
    let Az = acceleration[2];
    const normsqA = (Ax * Ax + Ay * Ay + Az * Az);
    const g = 9.81;
    const freeFallGravitySquared = 0.01 * g * g;
    if (normsqA < freeFallGravitySquared) {
      // gravity less than 10% of normal value
      return false;
    }
    const Ex = geomagnetic[0];
    const Ey = geomagnetic[1];
    const Ez = geomagnetic[2];
    let Hx = Ey * Az - Ez * Ay;
    let Hy = Ez * Ax - Ex * Az;
    let Hz = Ex * Ay - Ey * Ax;
    const normH = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
    if (normH < 0.1) {
      // device is close to free fall (or in space?), or close to
      // magnetic north pole. Typical values are  > 100.
      return false;
    }
    const invH = 1.0 / normH;
    Hx *= invH;
    Hy *= invH;
    Hz *= invH;
    const invA = 1.0 / Math.sqrt(Ax * Ax + Ay * Ay + Az * Az);
    Ax *= invA;
    Ay *= invA;
    Az *= invA;
    const Mx = Ay * Hz - Az * Hy;
    const My = Az * Hx - Ax * Hz;
    const Mz = Ax * Hy - Ay * Hx;
    if (R != null) {
      if (R.length == 9) {
        R[0] = Hx;     R[1] = Hy;     R[2] = Hz;
        R[3] = Mx;     R[4] = My;     R[5] = Mz;
        R[6] = Ax;     R[7] = Ay;     R[8] = Az;
      } else if (R.length == 16) {
        R[0]  = Hx;    R[1]  = Hy;    R[2]  = Hz;   R[3]  = 0;
        R[4]  = Mx;    R[5]  = My;    R[6]  = Mz;   R[7]  = 0;
        R[8]  = Ax;    R[9]  = Ay;    R[10] = Az;   R[11] = 0;
        R[12] = 0;     R[13] = 0;     R[14] = 0;    R[15] = 1;
      }
    }
    if (I != null) {
      // compute the inclination matrix by projecting the geomagnetic
      // vector onto the Z (gravity) and X (horizontal component
      // of geomagnetic vector) axes.
      const invE = 1.0 / Math.sqrt(Ex * Ex + Ey * Ey + Ez * Ez);
      const c = (Ex * Mx + Ey * My + Ez * Mz) * invE;
      const s = (Ex * Ax + Ey * Ay + Ez * Az) * invE;
      if (I.length == 9) {
        I[0] = 1;     I[1] = 0;     I[2] = 0;
        I[3] = 0;     I[4] = c;     I[5] = s;
        I[6] = 0;     I[7] = -s;     I[8] = c;
      } else if (I.length == 16) {
        I[0] = 1;     I[1] = 0;     I[2] = 0;
        I[4] = 0;     I[5] = c;     I[6] = s;
        I[8] = 0;     I[9] = -s;     I[10] = c;
        I[3] = I[7] = I[11] = I[12] = I[13] = I[14] = 0;
        I[15] = 1;
      }
    }
    return true;
  }

  public static getOrientation(R: number[], values: number[]): number[] {
    /*
     * 4x4 (length=16) case:
     *   /  R[ 0]   R[ 1]   R[ 2]   0  \
     *   |  R[ 4]   R[ 5]   R[ 6]   0  |
     *   |  R[ 8]   R[ 9]   R[10]   0  |
     *   \      0       0       0   1  /
     *
     * 3x3 (length=9) case:
     *   /  R[ 0]   R[ 1]   R[ 2]  \
     *   |  R[ 3]   R[ 4]   R[ 5]  |
     *   \  R[ 6]   R[ 7]   R[ 8]  /
     *
     */
    if (R.length == 9) {
      values[0] = Math.atan2(R[1], R[4]);
      values[1] = Math.asin(-R[7]);
      values[2] = Math.atan2(-R[6], R[8]);
    } else {
      values[0] = Math.atan2(R[1], R[5]);
      values[1] = Math.asin(-R[9]);
      values[2] = Math.atan2(-R[8], R[10]);
    }
    return values;
  }

  /**
   * Inverts a 4 x 4 matrix.
   * <p>
   * mInv and m must not overlap.
   *
   * @param mInv the array that holds the output inverted matrix
   * @param mInvOffset an offset into mInv where the inverted matrix is
   *        stored.
   * @param m the input array
   * @param mOffset an offset into m where the input matrix is stored.
   * @return true if the matrix could be inverted, false if it could not.
   */
  public static invertM(mInv: number[] , mInvOffset: number, m: number[] , mOffset: number): boolean {
        // Invert a 4 x 4 matrix using Cramer's Rule
        // transpose matrix
        const src0  = m[mOffset +  0];
        const src4  = m[mOffset +  1];
        const src8  = m[mOffset +  2];
        const src12 = m[mOffset +  3];
        const src1  = m[mOffset +  4];
        const src5  = m[mOffset +  5];
        const src9  = m[mOffset +  6];
        const src13 = m[mOffset +  7];
        const src2  = m[mOffset +  8];
        const src6  = m[mOffset +  9];
        const src10 = m[mOffset + 10];
        const src14 = m[mOffset + 11];
        const src3  = m[mOffset + 12];
        const src7  = m[mOffset + 13];
        const src11 = m[mOffset + 14];
        const src15 = m[mOffset + 15];
        // calculate pairs for first 8 elements (cofactors)
        const atmp0  = src10 * src15;
        const atmp1  = src11 * src14;
        const atmp2  = src9  * src15;
        const atmp3  = src11 * src13;
        const atmp4  = src9  * src14;
        const atmp5  = src10 * src13;
        const atmp6  = src8  * src15;
        const atmp7  = src11 * src12;
        const atmp8  = src8  * src14;
        const atmp9  = src10 * src12;
        const atmp10 = src8  * src13;
        const atmp11 = src9  * src12;
        // calculate first 8 elements (cofactors)
        const dst0  = (atmp0 * src5 + atmp3 * src6 + atmp4  * src7)
                          - (atmp1 * src5 + atmp2 * src6 + atmp5  * src7);
        const dst1  = (atmp1 * src4 + atmp6 * src6 + atmp9  * src7)
                          - (atmp0 * src4 + atmp7 * src6 + atmp8  * src7);
        const dst2  = (atmp2 * src4 + atmp7 * src5 + atmp10 * src7)
                          - (atmp3 * src4 + atmp6 * src5 + atmp11 * src7);
        const dst3  = (atmp5 * src4 + atmp8 * src5 + atmp11 * src6)
                          - (atmp4 * src4 + atmp9 * src5 + atmp10 * src6);
        const dst4  = (atmp1 * src1 + atmp2 * src2 + atmp5  * src3)
                          - (atmp0 * src1 + atmp3 * src2 + atmp4  * src3);
        const dst5  = (atmp0 * src0 + atmp7 * src2 + atmp8  * src3)
                          - (atmp1 * src0 + atmp6 * src2 + atmp9  * src3);
        const dst6  = (atmp3 * src0 + atmp6 * src1 + atmp11 * src3)
                          - (atmp2 * src0 + atmp7 * src1 + atmp10 * src3);
        const dst7  = (atmp4 * src0 + atmp9 * src1 + atmp10 * src2)
                          - (atmp5 * src0 + atmp8 * src1 + atmp11 * src2);
        // calculate pairs for second 8 elements (cofactors)
        const btmp0  = src2 * src7;
        const btmp1  = src3 * src6;
        const btmp2  = src1 * src7;
        const btmp3  = src3 * src5;
        const btmp4  = src1 * src6;
        const btmp5  = src2 * src5;
        const btmp6  = src0 * src7;
        const btmp7  = src3 * src4;
        const btmp8  = src0 * src6;
        const btmp9  = src2 * src4;
        const btmp10 = src0 * src5;
        const btmp11 = src1 * src4;
        // calculate second 8 elements (cofactors)
        const dst8  = (btmp0  * src13 + btmp3  * src14 + btmp4  * src15)
                          - (btmp1  * src13 + btmp2  * src14 + btmp5  * src15);
        const dst9  = (btmp1  * src12 + btmp6  * src14 + btmp9  * src15)
                          - (btmp0  * src12 + btmp7  * src14 + btmp8  * src15);
        const dst10 = (btmp2  * src12 + btmp7  * src13 + btmp10 * src15)
                          - (btmp3  * src12 + btmp6  * src13 + btmp11 * src15);
        const dst11 = (btmp5  * src12 + btmp8  * src13 + btmp11 * src14)
                          - (btmp4  * src12 + btmp9  * src13 + btmp10 * src14);
        const dst12 = (btmp2  * src10 + btmp5  * src11 + btmp1  * src9 )
                          - (btmp4  * src11 + btmp0  * src9  + btmp3  * src10);
        const dst13 = (btmp8  * src11 + btmp0  * src8  + btmp7  * src10)
                          - (btmp6  * src10 + btmp9  * src11 + btmp1  * src8 );
        const dst14 = (btmp6  * src9  + btmp11 * src11 + btmp3  * src8 )
                          - (btmp10 * src11 + btmp2  * src8  + btmp7  * src9 );
        const dst15 = (btmp10 * src10 + btmp4  * src8  + btmp9  * src9 )
                          - (btmp8  * src9  + btmp11 * src10 + btmp5  * src8 );
        // calculate determinant
        const det =
                src0 * dst0 + src1 * dst1 + src2 * dst2 + src3 * dst3;
        if (det == 0.0) {
            return false;
        }
        // calculate matrix inverse
        const invdet = 1.0 / det;
        mInv[     mInvOffset] = dst0  * invdet;
        mInv[ 1 + mInvOffset] = dst1  * invdet;
        mInv[ 2 + mInvOffset] = dst2  * invdet;
        mInv[ 3 + mInvOffset] = dst3  * invdet;
        mInv[ 4 + mInvOffset] = dst4  * invdet;
        mInv[ 5 + mInvOffset] = dst5  * invdet;
        mInv[ 6 + mInvOffset] = dst6  * invdet;
        mInv[ 7 + mInvOffset] = dst7  * invdet;
        mInv[ 8 + mInvOffset] = dst8  * invdet;
        mInv[ 9 + mInvOffset] = dst9  * invdet;
        mInv[10 + mInvOffset] = dst10 * invdet;
        mInv[11 + mInvOffset] = dst11 * invdet;
        mInv[12 + mInvOffset] = dst12 * invdet;
        mInv[13 + mInvOffset] = dst13 * invdet;
        mInv[14 + mInvOffset] = dst14 * invdet;
        mInv[15 + mInvOffset] = dst15 * invdet;
        return true;
  }

  /**
   * Multiplies a 4 element vector by a 4x4 matrix and stores the result in a
   * 4-element column vector. In matrix notation: result = lhs x rhs
   * <p>
   * The same float array may be passed for resultVec, lhsMat, and/or rhsVec.
   * This operation is expected to do the correct thing if the result elements
   * overlap with either of the lhs or rhs elements.
   *
   * @param resultVec The float array that holds the result vector.
   * @param resultVecOffset The offset into the result array where the result
   *        vector is stored.
   * @param lhsMat The float array that holds the left-hand-side matrix.
   * @param lhsMatOffset The offset into the lhs array where the lhs is stored
   * @param rhsVec The float array that holds the right-hand-side vector.
   * @param rhsVecOffset The offset into the rhs vector where the rhs vector
   *        is stored.
   *
   * @throws IllegalArgumentException under any of the following conditions:
   * resultVec, lhsMat, or rhsVec are null;
   * resultVecOffset + 4  > resultVec.length
   * or lhsMatOffset + 16 > lhsMat.length
   * or rhsVecOffset + 4  > rhsVec.length;
   * resultVecOffset < 0 or lhsMatOffset < 0 or rhsVecOffset < 0
   */
  public static multiplyMV(resultVec: number[],
            resultVecOffset: number, lhsMat: number[], lhsMatOffset: number,
            rhsVec: number[], rhsVecOffset: number): boolean {
        // error checking
        if (resultVec == null) {
            return false;
        }
        if (lhsMat == null) {
            return false;
        }
        if (rhsVec == null) {
            return false;
        }
        if (resultVecOffset < 0) {
            return false;
        }
        if (lhsMatOffset < 0) {
            return false;
        }
        if (rhsVecOffset < 0) {
            return false;
        }
        if (resultVec.length < resultVecOffset + 4) {
            return false;
        }
        if (lhsMat.length < lhsMatOffset + 16) {
            return false;
        }
        if (rhsVec.length < rhsVecOffset + 4) {
            return false;
        }
        const tmp0 = lhsMat[0 + 4 * 0 + lhsMatOffset] * rhsVec[0 + rhsVecOffset] +
                     lhsMat[0 + 4 * 1 + lhsMatOffset] * rhsVec[1 + rhsVecOffset] +
                     lhsMat[0 + 4 * 2 + lhsMatOffset] * rhsVec[2 + rhsVecOffset] +
                     lhsMat[0 + 4 * 3 + lhsMatOffset] * rhsVec[3 + rhsVecOffset];
        const tmp1 = lhsMat[1 + 4 * 0 + lhsMatOffset] * rhsVec[0 + rhsVecOffset] +
                     lhsMat[1 + 4 * 1 + lhsMatOffset] * rhsVec[1 + rhsVecOffset] +
                     lhsMat[1 + 4 * 2 + lhsMatOffset] * rhsVec[2 + rhsVecOffset] +
                     lhsMat[1 + 4 * 3 + lhsMatOffset] * rhsVec[3 + rhsVecOffset];
        const tmp2 = lhsMat[2 + 4 * 0 + lhsMatOffset] * rhsVec[0 + rhsVecOffset] +
                     lhsMat[2 + 4 * 1 + lhsMatOffset] * rhsVec[1 + rhsVecOffset] +
                     lhsMat[2 + 4 * 2 + lhsMatOffset] * rhsVec[2 + rhsVecOffset] +
                     lhsMat[2 + 4 * 3 + lhsMatOffset] * rhsVec[3 + rhsVecOffset];
        const tmp3 = lhsMat[3 + 4 * 0 + lhsMatOffset] * rhsVec[0 + rhsVecOffset] +
                     lhsMat[3 + 4 * 1 + lhsMatOffset] * rhsVec[1 + rhsVecOffset] +
                     lhsMat[3 + 4 * 2 + lhsMatOffset] * rhsVec[2 + rhsVecOffset] +
                     lhsMat[3 + 4 * 3 + lhsMatOffset] * rhsVec[3 + rhsVecOffset];
        resultVec[ 0 + resultVecOffset ] = tmp0;
        resultVec[ 1 + resultVecOffset ] = tmp1;
        resultVec[ 2 + resultVecOffset ] = tmp2;
        resultVec[ 3 + resultVecOffset ] = tmp3;
        return true;
  }

  /**
   * Transposes a 4 x 4 matrix.
   * <p>
   * mTrans and m must not overlap.
   *
   * @param mTrans the array that holds the output transposed matrix
   * @param mTransOffset an offset into mTrans where the transposed matrix is
   *        stored.
   * @param m the input array
   * @param mOffset an offset into m where the input matrix is stored.
   */
  public static transposeM(mTrans: number[], mTransOffset: number, m: number[],
            mOffset: number) {
        for (let i = 0; i < 4; i++) {
            const mBase = i * 4 + mOffset;
            mTrans[i + mTransOffset] = m[mBase];
            mTrans[i + 4 + mTransOffset] = m[mBase + 1];
            mTrans[i + 8 + mTransOffset] = m[mBase + 2];
            mTrans[i + 12 + mTransOffset] = m[mBase + 3];
        }
  }

}

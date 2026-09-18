<!-- 作成: 2026-09-10 17:37:46 JST -->

```json
{
  "required_changes": [
    {
      "node": "qa.mockdata.sensorlog.generator",
      "entrypoint": "spec/qa/mockdata-sensorlog-generator.md",
      "description": "steer_* 3シナリオ追加・ファイル名への sensorMode 付与・9正準ファイル化・LCG固定乱数・duty保持・改訂量子化値・既存6ファイルのバイト一致維持を反映して仕様書を更新"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "middleware",
      "severity": "should",
      "reason": "steer_wobble_* は canConnected 専用のため、smartphoneOnly 再生時に steering 由来指標が評価されないことをスコアロジック仕様側で明示する必要がある"
    },
    {
      "domain": "app",
      "severity": "could",
      "reason": "編集画面のモックログ投入UIで 9 ファイル（scenario×sensorMode）を選択できることの確認が必要"
    },
    {
      "domain": "infra",
      "severity": "should",
      "reason": "src/data/mock/ 配下の既存6ファイルはバイト一致で維持する必要があり、再生成コミット時の差分検証手順が要る"
    }
  ],
  "requirements_context": "モックセンサログ生成器（src/data/tools/gen-mock-sensorlog.mjs）は Node 18.19.1 単体で実行でき、新規 npm 依存を追加せず既存 pako のみを用いる。CLI は `node tools/gen-mock-sensorlog.mjs --scenario <cruise|accel_decel|hard_brake|sharp_curve|mixed|steer_stable|steer_wobble_weak|steer_wobble_strong> --sensor-mode <smartphoneOnly|canConnected> --duration <sec> --out <dir> [--base-time <ISO8601>]` で、--sensor-mode は必須、duration 既定 60 秒、刻み 10ms（行数 = duration*100）。出力は <out>/sensor-log.<scenario>.<sensorMode>.txt.gz（JSON Lines を pako.gzip、ファイル自体は Base64 しない）。正準コミットセットは src/data/mock/ の 9 ファイル：cruise×smartphoneOnly、cruise×canConnected、accel_decel×canConnected、hard_brake×canConnected、sharp_curve×canConnected、mixed×canConnected、steer_stable×canConnected、steer_wobble_weak×canConnected、steer_wobble_strong×canConnected。steer_* の正準は canConnected のみ（smartphoneOnly は CLI で生成可能だが commit しない）。時刻は T0_MS=Date.parse('2026-07-01T10:00:00.000+09:00') を既定基準とし、行 i の sensor.timestamp=baseMs+i*10、date は常に JST(UTC+9) で 'YYYY-MM-DD HH:mm:ss.SSS' に整形し、process.env.TZ や Date#getHours 等のローカルTZに依存しない。全シナリオの初期 heading=0.0、heading は yawRate(deg/s)*dt_s で積分し ((h%360)+360)%360 に正規化。pedal 状態は量子化前 longAcc により全シナリオ共通判定で決定し、longAcc>+0.02G → accelPedalPosition=120（物理値域上限 100 にクランプ）/brakePressure=0/brakeSwitch=0、longAcc<-0.02G → accelPedalPosition=0/brakePressure=200（126 にクランプ）/brakeSwitch=1、それ以外 → 40/0/0。不規則ふらつきの生成に Math.random を使ってはならず、固定 LCG（seed0=12345、a=1103515245、c=12345、m=0x7fffffff、angle=(u*2-1)*2.0）をシナリオごとにリセットして用いる。duty 判定は区間3の経過秒 t について (t mod 4)/4 < duty で行い、非該当時は直前値を保持する。量子化は floor(x+0.5) を用い物理値域内に適用し、改訂値として accelPedalPosition 100 / brakePressure 126 / steering 1080 / frontDistance 127 を上限とする。canData は canConnected 時のみ全フィールドを出力し、smartphoneOnly では canData キー自体を省略して DemoData.convertOldData のゼロ補充に委譲する。repeat は常に 0。geolocation.speed は canConnected 時 canData.vehicleSpeed/3.6 と一致し、GPS は起点 (35.681236, 139.767125) からの決定的相対計算のみで乱数を使わない。生成後セルフチェックとして自前 ungzip + 行 parse により必須キー欠落 0・skip 0・行数=duration*100 を assert する。スクリプトと正準 9 ファイルを決定的に生成して commit し、同一入力で常にバイト一致の出力になること。既存 6 ファイルはバイト一致を保ち、不一致となった場合は上書きしない。scoreLogicFunction.txt / scoreLogic.json / score-logic.ts / src/data/src/app/** / BLE 符号化 / エミュレータは変更禁止。端末姿勢・磁力・シナリオ物理プロファイル（cruise・accel_decel 20s周期・hard_brake 3イベント・sharp_curve・mixed 4等分連結）は #10/#12/#13 の既決事項を維持する。デモ/実機切替閾値 DemoData.getSensorLogDataSize()>0、ui.edit.page の FileReader Base64→pushSensorLogFile も変更しない。",
  "fact_candidates": [
    {
      "type": "qa_expectation",
      "title": "CLI は 8 シナリオを受理する",
      "statement": "--scenario は cruise / accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong の 8 値のみを受理し、それ以外は非ゼロ終了する",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "--sensor-mode は必須引数である",
      "statement": "--sensor-mode が未指定の場合、生成は実行されずエラー終了する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "出力ファイル名は scenario と sensorMode を含む",
      "statement": "出力ファイルは <out>/sensor-log.<scenario>.<sensorMode>.txt.gz の名前で 1 個だけ生成される",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "行数は duration*100 と一致する",
      "statement": "生成された gz を ungzip して得られる JSON Lines の行数は duration*100 に等しい",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "パース skip が 0 である",
      "statement": "セルフチェックの行 parse で JSON パース失敗により skip される行が 0 件である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "必須キー欠落が 0 である",
      "statement": "全行が date / sensor を持ち、sensor は videoTime / geolocation / acceleration / gyroscope / magnetometer を欠落なく含む",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "timestamp は 10ms 等間隔である",
      "statement": "行 i の sensor.timestamp は baseMs + i*10 であり、隣接行の差は常に 10 である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "date は JST 固定で整形される",
      "statement": "date は timestamp を UTC+9 で 'YYYY-MM-DD HH:mm:ss.SSS' に整形した値であり、実行環境の TZ 設定を変えても同一の値になる",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "既定の基準時刻は 2026-07-01T10:00:00.000+09:00 である",
      "statement": "--base-time 省略時、先頭行の date は '2026-07-01 10:00:00.000' である",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "初期 heading は 0.0 である",
      "statement": "全シナリオで先頭行の heading は 0.0 であり、gyroscope.alpha も 0.0 である",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "heading は 0 以上 360 未満に正規化される",
      "statement": "heading は yawRate*dt で積分され ((h%360)+360)%360 により全行で 0<=h<360 を満たす",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "pedal 状態は量子化前 longAcc で判定される",
      "statement": "pedal 状態の判定には量子化後ではなく量子化前の longAcc を用いる",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "加速時の pedal 状態",
      "statement": "量子化前 longAcc > +0.02G の行は accelPedalPosition が上限クランプ後 100、brakePressure=0、brakeSwitch=0 となる",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "減速時の pedal 状態",
      "statement": "量子化前 longAcc < -0.02G の行は accelPedalPosition=0、brakePressure が上限クランプ後 126、brakeSwitch=1 となる",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "定常時の pedal 状態",
      "statement": "量子化前 longAcc が -0.02G 以上 +0.02G 以下の行は accelPedalPosition=40、brakePressure=0、brakeSwitch=0 となる",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Math.random は使用しない",
      "statement": "生成スクリプトのソースに Math.random の呼び出しが存在しない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "ふらつきは固定 LCG で生成される",
      "statement": "不規則ふらつきは seed0=12345 / a=1103515245 / c=12345 / m=0x7fffffff の LCG により生成され、angle=(u*2-1)*2.0 で角度に変換される",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "LCG はシナリオごとにリセットされる",
      "statement": "LCG の状態はシナリオ生成の開始時に seed0=12345 へリセットされ、同一シナリオ・同一引数なら常に同一系列となる",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "duty 判定式",
      "statement": "区間3の経過秒 t について (t mod 4)/4 < duty のとき当該ステップの値を更新し、条件を満たさない場合は直前値を保持する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "量子化は floor(x+0.5) である",
      "statement": "canData の量子化は Math.round ではなく floor(x+0.5) を用いる",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "量子化後の物理値域上限（改訂値）",
      "statement": "量子化後の accelPedalPosition は 100 以下、brakePressure は 126 以下、steeringAngle の絶対値は 1080 以下、frontDistance は 127 以下である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "steer_* の正準は canConnected のみ",
      "statement": "steer_stable / steer_wobble_weak / steer_wobble_strong は canConnected の組合せのみを src/data/mock/ に commit する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "正準セットは 9 ファイルである",
      "statement": "src/data/mock/ にコミットされる正準モックセンサログは 9 ファイルである",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "既存 6 ファイルはバイト一致を維持する",
      "statement": "再生成後の cruise×smartphoneOnly / cruise×canConnected / accel_decel×canConnected / hard_brake×canConnected / sharp_curve×canConnected / mixed×canConnected の 6 ファイルは従前とバイト一致である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "バイト不一致時は上書きしない",
      "statement": "既存 6 ファイルの再生成結果が従前とバイト不一致になった場合、そのファイルを上書きしてはならない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "生成は決定的である",
      "statement": "同一 CLI 引数で 2 回生成した出力ファイルは常にバイト一致する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "smartphoneOnly は canData キーを持たない",
      "statement": "sensorMode=smartphoneOnly の出力は全行で sensor.canData キー自体を含まない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "canConnected は canData 全フィールドを持つ",
      "statement": "sensorMode=canConnected の出力は全行で vehicleSpeed / longAcc / latAcc / frontDistance / lateralDistance / steeringAngle / accelPedalPosition / brakePressure / brakeSwitch / shiftIndication / turnSignal / repeat を含む",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "repeat は常に 0 である",
      "statement": "canConnected の全行で canData.repeat は 0 であり -1 を含まない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "geolocation.speed は車速と整合する",
      "statement": "canConnected の各行で geolocation.speed は canData.vehicleSpeed/3.6 と一致する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "変更禁止ファイル",
      "statement": "本作業で scoreLogicFunction.txt / scoreLogic.json / score-logic.ts / src/data/src/app/** / BLE 符号化 / エミュレータのいずれも変更されない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "新規 npm 依存を追加しない",
      "statement": "生成スクリプトは Node 18.19.1 標準機能と既存 pako のみで動作し、package.json に新規依存が追加されない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "デモ再生で件数閾値を超える",
      "statement": "生成した正準ファイルを編集画面から投入すると DemoData.getSensorLogDataSize() が 0 より大きくなり、デモ再生モードに切り替わる",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "steer_stable / steer_wobble_weak / steer_wobble_strong の具体的な物理プロファイル（基準車速、区間1〜3の分割、各区間の steeringAngle 振幅・周期、duty の値、wobble_weak と wobble_strong の差分パラメータ）が context に明示されていない。QA としては合格条件（例: wobble_strong は wobble_weak より steeringAngle の変化率が大きい）を書けないため、middleware/仕様策定側の確定が必要。確定しないと steer_* の正準ファイル内容と受け入れ条件が固定できない。",
    "LCG の angle=(u*2-1)*2.0 の単位（deg と推定）と、その角度が steeringAngle に直接加算されるのか yawRate に加算されるのかが未確定。適用先により latAcc/heading の期待値が変わるため、生成器仕様側の確定が必要。",
    "量子化上限の改訂（accelPedalPosition 100 / brakePressure 126 / steering 1080 / frontDistance 127）により、#12 で決めた既存 5 シナリオ（canConnected）の出力値が変化する可能性がある。context は『既存 6 ファイルはバイト一致を保ち、不一致なら上書きしない』としているが、バイト不一致が発生した場合に (a) 旧ファイルを据え置き新旧混在を許容するのか (b) 改訂値の適用を新規 3 ファイルに限定するのか、運用方針が未確定。デモ再生の一貫性に影響する。",
    "brakePressure の量子化前値は #13 で 200 と定義されているが、改訂上限 126 にクランプされる結果 canConnected の減速行は常に 126 となる。BLE 実機由来のスケール（0.01MPa 等）との整合が取れているか、middleware/BLE デコード仕様側の確認が必要。",
    "duty 判定の『区間 3』が steer_* シナリオ固有の区間を指すのか全シナリオ共通の概念なのかが未確定。適用範囲が決まらないと duty 保持ロジックの検証条件を書けない。",
    "steer_* を smartphoneOnly で生成した場合、steering 情報が canData 経由でしか表現されないためシナリオ意図が失われる。CLI が警告を出すべきか、あるいはエラーとして拒否すべきかが未確定。"
  ],
  "rationale_notes": [
    "本ノードは Node CLI スクリプトであり UI を持たないため、ui-runtime-validation 型の pageerror/console.error ゲートは適用対象外。代わりに『CLI 終了コード』『セルフチェック assert』『出力バイト一致』を失敗ゲートとして扱う。",
    "テストは3層に分ける。存在チェック（ファイルが生成される・行数が一致する・必須キーが揃う）、相互作用チェック（CLI 引数バリデーション・base-time 上書き・sensorMode による canData 有無）、業務ルールチェック（pedal 状態遷移・heading 正規化・量子化値域・LCG 決定性）。steer_* のプロファイル未確定でも前2層は先に検証可能で、degraded-mode 検証として成立する。",
    "決定的生成（乱数禁止・固定 LCG・TZ 非依存）は、CI 上で『再生成して git diff が空』という単一のゴールデンテストに集約できることが最大の利点であり、これを最上位の受け入れ条件に置く。",
    "既存 6 ファイルのバイト一致要件は回帰防止ゲートであり、これが破れた時点で『デモ再生の再現性が変わった』ことを意味するため、不一致を検知したら上書きせず fail させる運用が正しい。",
    "セルフチェックで skip 0 を明示的に要求しているのは、行 parse が失敗した行を黙って読み飛ばすと欠陥ファイルが合格してしまうため。skip 件数はレポートに出す。",
    "失敗時の証跡としては CLI では screenshot/trace が取れないため、代わりに CLI 引数・stdout/stderr 全文・出力ファイルの SHA-256・先頭/末尾数行のダンプ・run_id を収集する。",
    "steer_* は canConnected 専用のため、smartphoneOnly 再生時にステアリング系スコアが評価されないことは仕様どおりの挙動であり、スコア 100 の未算出と混同しないよう QA レポート上で区別する必要がある。"
  ]
}
```
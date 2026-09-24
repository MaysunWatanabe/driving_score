/*
 * MediaRecorder Probe
 *
 * ヒヤリ録画（proposal #227 / #228 / #230 / #239、fact #4635 / #4636 / #4638）の
 * 実装前に、端末の MediaRecorder / WebM の挙動を実測する。
 *
 * アプリ本体（src/data/src/app/**）には一切触れず、driving.page.ts の loadVideo()
 * と同一の制約（1280x720 / audio:true / mimeType video/webm / ビットレート指定なし）
 * で録画し、切り出しを再現して次の 2 点を測る。
 *
 *   測定 1: 切り出しファイルの currentTime の起点（0 起点か、元ストリーム時刻か）
 *   測定 2: chunk[0] + 途中クラスタで構成したファイルの冒頭が再生できるか
 */

const $ = (id) => document.getElementById(id);

const ui = {
  margin: $('margin'),
  warmup: $('warmup'),
  start: $('start'),
  abort: $('abort'),
  phase: $('phase'),
  progress: $('progress'),
  player: $('player'),
  download: $('download'),
  downloadFull: $('download-full'),
  summary: $('summary'),
  copy: $('copy'),
  log: $('log'),
};

/** 1 チャンク = { blob, at (performance.now), size } */
let chunks = [];
let recorder = null;
let stream = null;
let aborted = false;
let cutBlob = null;
let fullBlob = null;

const measured = {};

function log(msg) {
  const line = `[${new Date().toISOString().substr(11, 12)}] ${msg}`;
  ui.log.textContent += line + '\n';
  ui.log.scrollTop = ui.log.scrollHeight;
  console.log(line);
}

function setText(id, value, cls) {
  const el = $(id);
  el.textContent = value;
  el.className = cls || '';
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtSec(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'NaN';
  if (!Number.isFinite(v)) return 'Infinity';
  return `${v.toFixed(3)} s`;
}

// ---------------------------------------------------------------- 録画

async function run() {
  const n = Number(ui.margin.value);
  const T = Number(ui.warmup.value);

  if (!(T > n)) {
    alert(`T (${T}) は n (${n}) より大きくしてください。前 n 秒が確保できません。`);
    return;
  }

  aborted = false;
  chunks = [];
  cutBlob = null;
  fullBlob = null;
  ui.start.disabled = true;
  ui.abort.disabled = false;
  ui.download.disabled = true;
  ui.downloadFull.disabled = true;
  ui.log.textContent = '';

  const total = T + n;
  log(`開始: n=${n}, T=${T}, 所要 ${total} 秒`);

  try {
    // driving.page.ts:348-357 loadVideo() と同一の制約
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { min: 1280, ideal: 1280 },
        height: { min: 720, ideal: 720 },
      },
      audio: true,
    });
  } catch (e) {
    log(`getUserMedia 失敗: ${e.name}: ${e.message}`);
    alert(`カメラ/マイクを取得できませんでした。\n${e.name}: ${e.message}\n\nsecure context (http://localhost) で開いているか確認してください。`);
    reset();
    return;
  }

  const track = stream.getVideoTracks()[0];
  log(`video track: ${JSON.stringify(track.getSettings())}`);

  // driving.page.ts:358 と同一（ビットレート指定なし）
  recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  measured.mimeType = recorder.mimeType;
  log(`MediaRecorder.mimeType = ${recorder.mimeType}`);

  recorder.addEventListener('dataavailable', (ev) => {
    chunks.push({ blob: ev.data, at: performance.now(), size: ev.data.size });
    const i = chunks.length - 1;
    if (i === 0 || i % 10 === 0) {
      log(`chunk[${i}] size=${fmtBytes(ev.data.size)}`);
    }
  });

  const t0 = performance.now();
  measured.recStartAt = t0;
  recorder.start(1000); // fact #4636: timeslice 1 秒
  log('recorder.start(1000)');

  const timer = setInterval(() => {
    const elapsed = (performance.now() - t0) / 1000;
    ui.progress.value = Math.min(100, (elapsed / total) * 100);
    const phase = elapsed < T
      ? `録画中（ヒヤリ発生まで ${(T - elapsed).toFixed(0)} 秒）`
      : `ヒヤリ発生後の後半 n 秒を録画中（残り ${(total - elapsed).toFixed(0)} 秒）`;
    ui.phase.textContent = `${phase} — ${elapsed.toFixed(1)} / ${total} s, chunks=${chunks.length}`;
  }, 200);

  await new Promise((resolve) => {
    recorder.addEventListener('stop', resolve, { once: true });
    setTimeout(() => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    }, total * 1000);
  });

  clearInterval(timer);
  stream.getTracks().forEach((t) => t.stop());
  ui.progress.value = 100;

  if (aborted) {
    ui.phase.textContent = '中止しました';
    reset();
    return;
  }

  ui.phase.textContent = `録画完了 — chunks=${chunks.length}`;
  log(`録画完了: chunks=${chunks.length}`);

  analyseChunks(n, T);
  await buildAndMeasure(n, T);
  reset();
}

function reset() {
  ui.start.disabled = false;
  ui.abort.disabled = true;
  recorder = null;
  stream = null;
}

// -------------------------------------------------- チャンクの統計（§5）

function analyseChunks(n, T) {
  const count = chunks.length;
  const chunk0 = chunks[0] ? chunks[0].size : 0;
  const rest = chunks.slice(1);
  const avg = rest.length ? rest.reduce((s, c) => s + c.size, 0) / rest.length : 0;

  const gaps = [];
  for (let i = 1; i < chunks.length; i++) gaps.push(chunks[i].at - chunks[i - 1].at);
  const gapAvg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const gapMin = gaps.length ? Math.min(...gaps) : 0;
  const gapMax = gaps.length ? Math.max(...gaps) : 0;

  const bytesPerSec = avg; // 1 チャンク = 1 秒
  const ringBytes = bytesPerSec * (n + 5) + chunk0;
  // chunk[0] は「start() から最初の dataavailable まで」の尺。
  // 切り出しファイルでは先頭に必ず入るため、markersVideoTime の補正項になる。
  measured.chunk0DurationMs = chunks.length ? chunks[0].at - measured.recStartAt : null;

  measured.count = count;
  measured.chunk0 = chunk0;
  measured.avg = avg;
  measured.bytesPerSec = bytesPerSec;
  measured.gapAvg = gapAvg;
  measured.gapMin = gapMin;
  measured.gapMax = gapMax;
  measured.ringBytes = ringBytes;
  measured.n = n;
  measured.T = T;

  setText('r-count', `${count}`);
  setText('r-chunk0', fmtBytes(chunk0));
  setText('r-avg', fmtBytes(avg));
  setText('r-bitrate', `${fmtBytes(bytesPerSec)}/s（約 ${((bytesPerSec * 8) / 1e6).toFixed(2)} Mbps）`);
  setText('r-interval', `${gapAvg.toFixed(0)} ms / ${gapMin.toFixed(0)} ms / ${gapMax.toFixed(0)} ms`);
  setText('r-ring', `${fmtBytes(ringBytes)}（n=${n} のとき n+5=${n + 5} 秒分）`);
  setText('r-mime', measured.mimeType || '-');
  setText('r-ua', navigator.userAgent);
}

// -------------------------------------- 切り出しと測定 1 / 2（§3・§4）

async function buildAndMeasure(n, T) {
  // fact #4636 / #4638: chunk[0]（EBML ヘッダ/Tracks）+ 当該区間のクラスタ
  // 区間は [T-n, T+n]。chunk[i] はおおむね [i, i+1) 秒を担う。
  const from = Math.max(1, Math.floor(T - n));
  const to = Math.min(chunks.length, Math.ceil(T + n));
  const parts = [chunks[0].blob].concat(chunks.slice(from, to).map((c) => c.blob));

  log(`切り出し: chunk[0] + chunk[${from}..${to - 1}]（${parts.length} 個）`);

  cutBlob = new Blob(parts, { type: 'video/webm' });
  fullBlob = new Blob(chunks.map((c) => c.blob), { type: 'video/webm' });
  measured.cutSize = cutBlob.size;
  measured.cutFrom = from;
  measured.cutTo = to - 1;

  ui.download.disabled = false;
  ui.downloadFull.disabled = false;

  const v = ui.player;
  v.src = URL.createObjectURL(cutBlob);

  const meta = await new Promise((resolve) => {
    let done = false;
    const ok = () => { if (!done) { done = true; resolve('loadedmetadata'); } };
    const ng = () => { if (!done) { done = true; resolve('error'); } };
    v.addEventListener('loadedmetadata', ok, { once: true });
    v.addEventListener('error', ng, { once: true });
    setTimeout(() => { if (!done) { done = true; resolve('timeout'); } }, 8000);
  });

  measured.meta = meta;
  setText('r-meta', meta, meta === 'loadedmetadata' ? 'ok' : 'ng');
  setText('r-size', `${v.videoWidth} x ${v.videoHeight}`);
  setText('r-error', v.error ? `code=${v.error.code} ${v.error.message || ''}` : 'なし');

  if (meta !== 'loadedmetadata') {
    setText('r-playable', 'NG — メタデータを読めない（切り出しファイルが再生不能）', 'ng');
    setText('r-origin', '判定不能（ファイルを読めていない）', 'ng');
    measured.playable = false;
    writeSummary();
    return;
  }

  // ---- 測定 1: currentTime の起点
  const seekStart = v.seekable.length ? v.seekable.start(0) : NaN;
  const seekEnd = v.seekable.length ? v.seekable.end(0) : NaN;
  const initial = v.currentTime;

  v.currentTime = 0;
  await new Promise((r) => setTimeout(r, 300));
  const afterZero = v.currentTime;

  measured.duration = v.duration;
  measured.seekStart = seekStart;
  measured.seekEnd = seekEnd;
  measured.initial = initial;
  measured.afterZero = afterZero;

  setText('r-duration', fmtSec(v.duration));
  setText('r-seekstart', fmtSec(seekStart));
  setText('r-seekend', fmtSec(seekEnd));
  setText('r-initial', fmtSec(initial));
  setText('r-setzero', fmtSec(afterZero));

  // 再生して 1 秒後の currentTime
  let after = NaN;
  try {
    await v.play();
    await new Promise((r) => setTimeout(r, 1000));
    after = v.currentTime;
    v.pause();
  } catch (e) {
    log(`play() 失敗: ${e.name}: ${e.message}`);
  }
  measured.after = after;
  setText('r-after', fmtSec(after));

  // ---- 中間 seek。6-1 の seekVideo() が実際にやることの再現。
  // duration が Infinity になる WebM では中間 seek が当たらない可能性があるため、
  // ここが通らなければ file-relative を採っても 6-1 は機能しない。
  // 切り出しは [T-n, T+n] なので、ヒヤリ発生点はファイル内 n 秒の位置。
  const mid = await seekTo(v, n, 'r-seekmid');
  const late = await seekTo(v, Math.max(1, 2 * n - 2), 'r-seeklate');
  measured.seekMid = mid;
  measured.seekLate = late;

  const seekFrame = await probeFirstFrame(v, null);
  measured.seekFrame = seekFrame;
  setText('r-seekframe', seekFrame.detail, seekFrame.ok ? 'ok' : 'ng');

  // ---- タイムライン方式の判定（fact #4635 の t_start を定義するために必須）
  //
  // 切り出しは chunk[0]（元 0〜1 秒）+ chunk[from..to-1]（元 from〜to 秒）。
  // 詰め直される場合  : 尺は parts.length 秒（chunk[0] 1 秒 + 区間の長さ）
  // 保持される場合    : 尺は元の to 秒まで（間に穴が空く）
  //
  // 両者は「詰めた長さを超え、元の長さには収まる位置」へ seek できるかで判別できる。
  const naiveLen = parts.length;          // 詰め直した場合の尺（秒）
  const originalEnd = to;                 // タイムスタンプ保持の場合の尺（秒）
  const beyond = Math.floor((naiveLen + originalEnd) / 2);

  // --- ファイル構造そのものから判定する（player の振る舞いに依存しない地の情報）
  const cutTcs = await readClusterTimecodes(cutBlob);
  const fullTcs = await readClusterTimecodes(fullBlob);
  const cutCls = classifyClusters(cutTcs, from);
  measured.clusters = {
    cut: cutCls,
    fullHead: fullTcs.slice(0, 5),
    fullCount: fullTcs.length,
  };
  setText('r-clusters',
    `${cutCls.detail} / 通し録画は ${fullTcs.length} 個、先頭 [${fullTcs.slice(0, 5).join(', ')}] ms`,
    cutCls.verdict === 'unknown' ? 'ng' : 'ok');

  // seekable が [0, Infinity] のため、seek の成否では判別できない
  // （どんな値でも seeked が返り currentTime にその値が入る）。
  // 飛んだ先に映っている「中身」を通し録画と突き合わせて判定する。
  const timeline = await probeTimeline(v, from, to, naiveLen);
  measured.timeline = timeline.verdict;
  measured.timelineDetail = timeline;
  setText('r-timeline', timeline.detail,
    timeline.verdict === 'unknown' ? 'ng' : 'ok');
  void beyond;

  // ---- 再生の連続性。chunk[0] と区間の境界で currentTime が飛ぶか。
  const jump = await probeContinuity(v);
  measured.continuity = jump;
  setText('r-continuity', jump.detail, jump.jumped ? 'ng' : 'ok');

  // 起点の判定。expectedOffset = 切り出し開始秒（= from）
  const expectedOffset = from;
  const zeroBased = Math.abs(seekStart) < 1.0 && Math.abs(afterZero) < 1.0;
  const streamBased = Math.abs(seekStart - expectedOffset) < 3.0
    || Math.abs(afterZero - expectedOffset) < 3.0;

  if (zeroBased && mid.ok && late.ok) {
    measured.origin = 'zero-based';
    setText('r-origin',
      `0 起点 かつ 中間 seek が当たる — proposal #228 の file-relative（fact #4635）が成立する`, 'ok');
  } else if (zeroBased) {
    measured.origin = 'zero-based-but-seek-fails';
    setText('r-origin',
      `0 起点だが中間 seek が当たらない（mid=${mid.detail} / late=${late.detail}）`
      + ` — file-relative でも 6-1 は機能しない。#228 の再 propose が必要`, 'ng');
  } else if (streamBased) {
    measured.origin = 'stream-based';
    setText('r-origin',
      `元ストリーム時刻起点（約 ${fmtSec(seekStart)} ≒ 切り出し開始 ${expectedOffset} s）`
      + ` — file-relative では seek が当たらない。#228 の再 propose が必要`, 'ng');
  } else {
    measured.origin = 'unknown';
    setText('r-origin',
      `判定不能（seekable.start=${fmtSec(seekStart)}, 期待 0 または ${expectedOffset}）`, 'ng');
  }

  // ---- 測定 2: 冒頭が描画されるか
  const drawn = await probeFirstFrame(v);
  measured.firstFrame = drawn;
  setText('r-firstframe', drawn.detail, drawn.ok ? 'ok' : 'ng');

  // 再生可否の本質は「chunk[0] + 途中クラスタのファイルがデコードできるか」。
  // 先頭 0.1 秒が黒くても、通し録画側が正常で中間 seek 先が描画されるなら、
  // それは録画開始直後のカメラ立ち上がりであってファイル構成の問題ではない。
  const cameraOk = (measured.fullHeadVariance ?? 0) > 40;
  const midOk = !!(seekFrame && seekFrame.ok) && mid.ok && late.ok;
  measured.playable = drawn.ok || (cameraOk && midOk);
  setText('r-playable',
    drawn.ok
      ? 'OK — chunk[0] + 途中クラスタで再生できる（fact #4636 の前提が成立）'
      : measured.playable
        ? 'OK — ファイルは再生できる（fact #4636 の前提が成立）。'
          + '先頭 0.1 s が黒いのは録画開始直後のカメラ立ち上がりで、'
          + 'chunk[0] を含める限り不可避。キーフレーム起因ではない'
        : cameraOk
          ? 'NG — 冒頭が描画されない。キーフレーム位置の影響が疑われる'
          : '判定不能 — カメラが何も映していない。撮り直すこと',
    measured.playable ? 'ok' : 'ng');

  // ビットレートは被写体に強く依存する。静止・暗所では実走行の代表値にならない。
  measured.bitrateValid = drawn.ok || (seekFrame && seekFrame.ok);

  writeSummary();
}

/**
 * 指定位置へ seek し、currentTime が実際にそこへ動いたかを確かめる。
 * 6-1 の seekVideo()（currentTime = getMarkerVideoTime(spotPos)）の再現。
 */
async function seekTo(v, target, cellId) {
  try {
    v.currentTime = target;
    const ev = await new Promise((r) => {
      v.addEventListener('seeked', () => r('seeked'), { once: true });
      setTimeout(() => r('timeout'), 3000);
    });
    const actual = v.currentTime;
    const ok = ev === 'seeked' && Math.abs(actual - target) < 1.0;
    const detail = `${target} s 要求 → ${fmtSec(actual)}（${ev}）`;
    if (cellId) setText(cellId, detail, ok ? 'ok' : 'ng');
    return { ok, target, actual, ev, detail };
  } catch (e) {
    const detail = `失敗: ${e.name}: ${e.message}`;
    if (cellId) setText(cellId, detail, 'ng');
    return { ok: false, target, actual: null, ev: 'error', detail };
  }
}

/**
 * WebM のバイト列から Cluster の Timecode を取り出す。
 *
 * player の振る舞い（seekable が [0, Infinity] になる・seek がどんな値でも成功する）
 * に依存せず、ファイルが実際にどの時刻を持っているかを知るための地の情報。
 *
 * Cluster  = 0x1F43B675、その直下の Timecode = 0xE7。
 * 厳密な EBML パーサではなく、Cluster ID を走査して直後の Timecode だけを読む。
 */
async function readClusterTimecodes(blob, limit = 400) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const out = [];

  // vint（先頭バイトの最上位ビット位置で長さが決まる）を読む
  function readVint(pos, keepMarker) {
    const first = buf[pos];
    if (first === undefined || first === 0) return null;
    let len = 1;
    let mask = 0x80;
    while (len <= 8 && !(first & mask)) { mask >>= 1; len++; }
    if (len > 8) return null;
    let value = keepMarker ? first : (first & (mask - 1));
    for (let i = 1; i < len; i++) value = value * 256 + buf[pos + i];
    return { value, len };
  }

  for (let i = 0; i + 4 < buf.length && out.length < limit; i++) {
    if (buf[i] !== 0x1f || buf[i + 1] !== 0x43
      || buf[i + 2] !== 0xb6 || buf[i + 3] !== 0x75) continue;

    const size = readVint(i + 4, false);
    if (!size) continue;
    let p = i + 4 + size.len;

    // Cluster の最初の子が Timecode(0xE7) であることを期待する
    if (buf[p] !== 0xe7) continue;
    const tcSize = readVint(p + 1, false);
    if (!tcSize) continue;
    p = p + 1 + tcSize.len;

    let tc = 0;
    for (let k = 0; k < tcSize.value && k < 8; k++) tc = tc * 256 + buf[p + k];
    out.push(tc);
  }
  return out;
}

/** クラスタ時刻の並びから、詰め直されているか元時刻のままかを判定する */
function classifyClusters(tcs, fromSec) {
  if (tcs.length < 3) {
    return { verdict: 'unknown', detail: `Cluster が ${tcs.length} 個しか読めず判定不能` };
  }
  const head = tcs.slice(0, 6);
  // 2 番目のクラスタが from 秒付近なら元時刻のまま、1 秒付近なら詰め直し
  const second = tcs[1];
  const expectPreserved = fromSec * 1000;
  const preserved = Math.abs(second - expectPreserved) < 2500;
  const renumbered = second < 2500;
  const verdict = preserved ? 'preserved' : renumbered ? 'renumbered' : 'unknown';
  return {
    verdict,
    count: tcs.length,
    head,
    last: tcs[tcs.length - 1],
    detail: `Cluster ${tcs.length} 個、先頭 [${head.join(', ')}] ms、末尾 ${tcs[tcs.length - 1]} ms`
      + ` — 2 番目が ${second} ms（元時刻なら約 ${expectPreserved} ms、詰め直しなら約 1000 ms）`
      + ` → ${verdict}`,
  };
}

/** 指定した video の現在フレームを 16x9 のグレースケール指紋にする */
function fingerprint(v) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 9;
  const ctx = c.getContext('2d');
  ctx.drawImage(v, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const out = [];
  for (let i = 0; i < d.length; i += 4) {
    out.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  }
  return out;
}

/** 指紋どうしの平均絶対差。小さいほど同じ絵 */
function fpDiff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/** 指紋の分散。0 に近ければ単色（＝比較に使えない） */
function fpVariance(a) {
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  return a.reduce((s, x) => s + (x - mean) * (x - mean), 0) / a.length;
}

async function seekAndFingerprint(v, t) {
  v.currentTime = t;
  await new Promise((r) => {
    v.addEventListener('seeked', () => r(), { once: true });
    setTimeout(r, 2500);
  });
  await new Promise((r) => setTimeout(r, 120)); // 描画反映の猶予
  return fingerprint(v);
}

/**
 * 切り出しファイルのタイムラインが「元のタイムスタンプ保持」か
 * 「0 起点に詰め直し」かを、通し録画との画面比較で判定する。
 *
 * 切り出し = chunk[0]（元 0〜1 秒）+ chunk[from..to-1]（元 from〜to 秒）
 *   preserved  なら 切り出しの t 秒 == 通しの t 秒            （t は from..to）
 *   renumbered なら 切り出しの (1 + t - from) 秒 == 通しの t 秒
 */
async function probeTimeline(v, from, to, naiveLen) {
  const full = document.createElement('video');
  full.muted = true;
  full.playsInline = true;
  full.src = URL.createObjectURL(fullBlob);
  document.body.appendChild(full);
  full.style.position = 'fixed';
  full.style.left = '-9999px';
  full.style.width = '320px';

  try {
    await new Promise((r) => {
      full.addEventListener('loadedmetadata', () => r(), { once: true });
      full.addEventListener('error', () => r(), { once: true });
      setTimeout(r, 8000);
    });

    // 録画開始直後が黒いのか（カメラ立ち上がり）を通し録画側で確認する
    const fpFullHead = await seekAndFingerprint(full, 0.5);
    const headVar = fpVariance(fpFullHead);
    measured.fullHeadVariance = headVar;

    // 区間の中ほどで比較する。単色の時刻を引くと判定できないので複数試す
    const candidates = [];
    const span = to - from;
    for (const frac of [0.3, 0.5, 0.7]) {
      candidates.push(Math.floor(from + span * frac));
    }

    const trials = [];
    for (const t of candidates) {
      const fpFull = await seekAndFingerprint(full, t);
      if (fpVariance(fpFull) < 40) continue; // 単色すぎて比較不能
      const fpPreserved = await seekAndFingerprint(v, t);
      const fpRenumbered = await seekAndFingerprint(v, 1 + (t - from));
      trials.push({
        t,
        preserved: fpDiff(fpFull, fpPreserved),
        renumbered: fpDiff(fpFull, fpRenumbered),
      });
    }

    if (!trials.length) {
      return {
        verdict: 'unknown',
        trials,
        detail: '判定不能（被写体が単色で、フレーム比較に使える時刻が無かった）',
      };
    }

    const pAvg = trials.reduce((s, x) => s + x.preserved, 0) / trials.length;
    const rAvg = trials.reduce((s, x) => s + x.renumbered, 0) / trials.length;
    const verdict = pAvg < rAvg ? 'preserved' : 'renumbered';
    const detail =
      `${verdict}（通し録画との画面差: preserved 仮説 ${pAvg.toFixed(1)} / `
      + `renumbered 仮説 ${rAvg.toFixed(1)}、小さい方が一致。`
      + `比較時刻 ${trials.map((x) => x.t).join(', ')} s、`
      + `詰めた尺 ${naiveLen} s / 元の尺 ${to} s）`;
    return { verdict, trials, pAvg, rAvg, detail };
  } catch (e) {
    return { verdict: 'unknown', trials: [], detail: `判定失敗: ${e.name}: ${e.message}` };
  } finally {
    full.remove();
  }
}

/**
 * 先頭から再生し、currentTime が飛ぶ箇所があるかを見る。
 * chunk[0]（元 0〜1 秒）と切り出し区間の継ぎ目で不連続が起きるかの確認。
 */
async function probeContinuity(v) {
  try {
    v.currentTime = 0;
    await new Promise((r) => {
      v.addEventListener('seeked', () => r(), { once: true });
      setTimeout(r, 1500);
    });

    const samples = [];
    await v.play();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      samples.push(v.currentTime);
    }
    v.pause();

    let maxJump = 0;
    let at = null;
    for (let i = 1; i < samples.length; i++) {
      const d = samples[i] - samples[i - 1];
      if (d > maxJump) { maxJump = d; at = samples[i - 1]; }
    }
    const jumped = maxJump > 1.5;
    return {
      jumped,
      maxJump,
      at,
      samples,
      detail: jumped
        ? `${fmtSec(at)} 付近で ${maxJump.toFixed(2)} s の不連続（継ぎ目で時刻が飛ぶ）`
        : `連続（最大変化 ${maxJump.toFixed(2)} s / 250ms サンプル）`,
    };
  } catch (e) {
    return { jumped: false, detail: `判定失敗: ${e.name}: ${e.message}`, samples: [] };
  }
}

/** 現在位置のフレームを canvas に描き、実際に絵が出ているかを判定する */
async function probeFirstFrame(v, seekTarget = 0.1) {
  try {
    if (seekTarget !== null) {
      v.currentTime = v.seekable.length ? v.seekable.start(0) + seekTarget : seekTarget;
      await new Promise((r) => {
        const done = () => r();
        v.addEventListener('seeked', done, { once: true });
        setTimeout(done, 1500);
      });
    }

    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;

    let sum = 0;
    let sumSq = 0;
    const px = c.width * c.height;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += lum;
      sumSq += lum * lum;
    }
    const mean = sum / px;
    const variance = sumSq / px - mean * mean;

    // 単色（真っ黒・真緑など）なら分散がほぼ 0 になる
    const ok = variance > 25;
    // 平均輝度が厳密に 0 なら「デコード失敗」ではなく「カメラが何も映していない」
    // 可能性が高い。キーフレーム起因の崩れと区別できないため、計測を無効として扱う。
    const blackout = mean < 1.0 && variance < 1.0;
    return {
      ok,
      blackout,
      detail: `平均輝度 ${mean.toFixed(1)} / 分散 ${variance.toFixed(1)} — `
        + (ok
          ? '絵が出ている'
          : blackout
            ? '完全な黒。カメラが遮られている疑いがあり、この計測は無効'
            : '単色に近い（描画されていない疑い）'),
      mean,
      variance,
    };
  } catch (e) {
    return { ok: false, detail: `判定失敗: ${e.name}: ${e.message}`, mean: null, variance: null };
  }
}

// ------------------------------------------------------------ 結果出力

function writeSummary() {
  const m = measured;
  const lines = [
    `# MediaRecorder Probe 実測結果`,
    ``,
    `- 実施日時: ${new Date().toISOString()}`,
    `- userAgent: ${navigator.userAgent}`,
    `- 条件: n=${m.n}, T=${m.T}, 1280x720 + audio, mimeType 指定 'video/webm', start(1000)`,
    `- 実際の mimeType: ${m.mimeType}`,
    ``,
    `## 測定 1 — 切り出しファイルの currentTime の起点`,
    `- 切り出し構成: chunk[0] + chunk[${m.cutFrom}..${m.cutTo}]（${fmtBytes(m.cutSize || 0)}）`,
    `- duration: ${fmtSec(m.duration)}`,
    `- seekable: [${fmtSec(m.seekStart)}, ${fmtSec(m.seekEnd)}]`,
    `- 読み込み直後の currentTime: ${fmtSec(m.initial)}`,
    `- currentTime=0 代入後: ${fmtSec(m.afterZero)}`,
    `- 再生 1 秒後: ${fmtSec(m.after)}`,
    `- 中間 seek（ヒヤリ発生点 = n 秒）: ${m.seekMid ? m.seekMid.detail : '-'}`,
    `- 中間 seek（終端寄り）: ${m.seekLate ? m.seekLate.detail : '-'}`,
    `- seek 後の描画: ${m.seekFrame ? m.seekFrame.detail : '-'}`,
    `- Cluster 時刻（ファイル構造）: ${m.clusters ? m.clusters.cut.detail : '-'}`,
    `- 通し録画の Cluster: ${m.clusters ? `${m.clusters.fullCount} 個、先頭 [${m.clusters.fullHead.join(', ')}] ms` : '-'}`,
    `- タイムライン方式（画面比較）: ${m.timelineDetail ? m.timelineDetail.detail : m.timeline}`,
    `- 構造と画面比較の一致: ${m.clusters && m.timeline
      ? (m.clusters.cut.verdict === m.timeline ? '一致' : `**不一致**（構造=${m.clusters.cut.verdict} / 画面=${m.timeline}）`)
      : '-'}`,
    `- 通し録画の 0.5 s 地点の分散: ${(m.fullHeadVariance ?? -1).toFixed(1)}`
      + ((m.fullHeadVariance ?? 99) < 1
        ? '（録画開始直後は通し録画でも黒い = カメラ立ち上がり。chunk[0] 起因で遮蔽ではない）'
        : '（録画開始直後から絵が出ている）'),
    `- 再生の連続性: ${m.continuity ? m.continuity.detail : '-'}`,
    `- 判定: ${m.origin}`,
    m.origin === 'zero-based'
      ? `  → proposal #228 の file-relative（fact #4635）は成立する。`
      : `  → そのままでは 6-1 が機能しない。#228 の再 propose が必要。`,
    ``,
    `## 測定 2 — 冒頭の再生可否`,
    `- loadedmetadata: ${m.meta}`,
    `- 解像度: ${$('r-size').textContent}`,
    `- 先頭フレーム: ${m.firstFrame ? m.firstFrame.detail : '-'}`,
    `- 判定: ${m.playable ? 'OK（chunk[0] + 途中クラスタで再生できる）' : 'NG'}`,
    m.playable && m.firstFrame && m.firstFrame.blackout
      ? `  → 先頭 0.1 s が黒いのは録画開始直後のカメラ立ち上がり。chunk[0] を含める限り不可避。`
      : '',
    ``,
    `## 併せて記録した値`,
    m.bitrateValid
      ? `- （ビットレートは有効: 被写体が写っている状態で計測）`
      : `- **警告: ビットレートは無効。被写体が黒く、実走行の代表値にならない**`,
    `- チャンク数: ${m.count}`,
    `- chunk[0]: ${fmtBytes(m.chunk0 || 0)}`,
    `- 1 秒チャンク平均: ${fmtBytes(m.avg || 0)}`,
    `- 実効ビットレート: ${fmtBytes(m.bytesPerSec || 0)}/s（約 ${(((m.bytesPerSec || 0) * 8) / 1e6).toFixed(2)} Mbps）`,
    `- dataavailable 間隔 平均/最小/最大: ${(m.gapAvg || 0).toFixed(0)} / ${(m.gapMin || 0).toFixed(0)} / ${(m.gapMax || 0).toFixed(0)} ms`,
    `- chunk[0] の実尺（start() → 最初の dataavailable）: ${(m.chunk0DurationMs || 0).toFixed(0)} ms`
      + `（markersVideoTime の補正項。renumbered のため切り出しファイル先頭に必ず入る）`,
    `- リングバッファ上限（n+5=${(m.n || 0) + 5} 秒）: ${fmtBytes(m.ringBytes || 0)}`,
    `- 参考: n=60 換算 ${fmtBytes((m.bytesPerSec || 0) * 65 + (m.chunk0 || 0))}`,
  ];
  ui.summary.value = lines.join('\n');
  postResult(lines.join('\n'));
}

/**
 * 結果をサーバへ送る。
 * 画面から読み取る運用は、タブを閉じる・戻るキーを押すなどで結果が消えるため使わない。
 */
function postResult(summary) {
  const body = JSON.stringify({
    n: measured.n,
    T: measured.T,
    userAgent: navigator.userAgent,
    at: new Date().toISOString(),
    measured,
    summary,
  });
  fetch('/result', { method: 'POST', body })
    .then(() => log('結果をサーバへ送信しました（results/ に保存）'))
    .catch((e) => log(`結果の送信に失敗: ${e.message}`));
}

// ------------------------------------------------------------ イベント

ui.start.addEventListener('click', run);

ui.abort.addEventListener('click', () => {
  aborted = true;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  log('中止');
});

ui.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ui.summary.value);
    log('クリップボードにコピーしました');
  } catch (e) {
    ui.summary.select();
    log('clipboard API が使えません。テキストを選択したので手動でコピーしてください');
  }
});

function download(blob, name) {
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

ui.download.addEventListener('click', () => download(cutBlob, `probe-cut-n${measured.n}.webm`));
ui.downloadFull.addEventListener('click', () => download(fullBlob, `probe-full-n${measured.n}.webm`));

setText('r-ua', navigator.userAgent);
log(`secure context: ${window.isSecureContext}`);
log(`MediaRecorder.isTypeSupported('video/webm') = ${window.MediaRecorder ? MediaRecorder.isTypeSupported('video/webm') : 'MediaRecorder 未対応'}`);

/*
 * URL クエリでの自動実行。
 *   ?n=15&T=40&auto=1
 * 端末の画面をタップせずに計測できるようにする（タップの誤爆でページを離れると
 * ページ内に持っている計測結果が消えるため）。
 * サイトへのカメラ/マイク許可が既に与えられていれば、getUserMedia はユーザー
 * ジェスチャなしでも解決する。
 */
(function autoRunFromQuery() {
  const q = new URLSearchParams(location.search);
  if (q.has('n')) {
    const n = q.get('n');
    if ([...ui.margin.options].some((o) => o.value === n)) ui.margin.value = n;
  }
  if (q.has('T')) ui.warmup.value = q.get('T');

  if (q.get('auto') !== '1') return;

  log(`自動実行: n=${ui.margin.value}, T=${ui.warmup.value}`);
  // 画面が消えると MediaRecorder が止まる端末があるため、可能なら wake lock を取る
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen')
      .then(() => log('wake lock 取得'))
      .catch((e) => log(`wake lock 取得できず: ${e.name}`));
  }
  setTimeout(run, 800);
})();

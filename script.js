// ============================================================
// CONFIG
// ============================================================
const VOWELS = ["A", "E", "I", "O", "U"];
const VOWEL_PROFILES = {
  A: [800, 1200],
  E: [500, 1900],
  I: [350, 2200],
  O: [500, 1000],
  U: [350, 900],
};
const NUM_NEURONS = 320;
const NUM_ELECTRODES = 8;
const RECORD_MS = 2000;

// ============================================================
// PROBABILITY ROWS
// ============================================================
const probList = document.getElementById("probList");
const probFills = {};
const probPcts = {};

VOWELS.forEach((v) => {
  const row = document.createElement("div");
  row.className = "prob-row";
  row.innerHTML = `
    <span>${v}</span>
    <div class="prob-track">
      <div class="prob-fill" id="fill-${v}"></div>
    </div>
    <span class="prob-pct" id="pct-${v}">0%</span>
  `;
  probList.appendChild(row);
  probFills[v] = document.getElementById(`fill-${v}`);
  probPcts[v] = document.getElementById(`pct-${v}`);
});

function showProbabilities(scores) {
  VOWELS.forEach((v) => {
    const val = scores[v] || 0;
    probFills[v].style.width = val + "%";
    probPcts[v].textContent = val.toFixed(1) + "%";
  });
}

// ============================================================
// STAGE STRIP
// ============================================================
const STAGE_ORDER = ["voice", "encoder", "electrode", "organoid", "activity", "readout"];

function setStage(name) {
  document.querySelectorAll("#stageStrip span").forEach((el) => {
    const stagePos = STAGE_ORDER.indexOf(el.dataset.stage);
    const activePos = STAGE_ORDER.indexOf(name);
    if (el.dataset.stage === name) {
      el.classList.add("active");
      el.classList.remove("done");
    } else if (stagePos < activePos) {
      el.classList.add("done");
      el.classList.remove("active");
    } else {
      el.classList.remove("active", "done");
    }
  });
}

function clearStages() {
  document.querySelectorAll("#stageStrip span").forEach((el) =>
    el.classList.remove("active", "done")
  );
}

// ============================================================
// ORGANOID – 3D-projected point cloud
// ============================================================
const canvas = document.getElementById("organoid");
const ctx = canvas.getContext("2d");
let W = canvas.width;
let H = canvas.height;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  W = canvas.width;
  H = canvas.height;
}
window.addEventListener("resize", resizeCanvas);

// Build neuron cloud
const neurons = [];
for (let i = 0; i < NUM_NEURONS; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI;
  const r = 0.5 + Math.random() * 0.5;
  neurons.push({
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi),
    activity: Math.random() * 0.15,
  });
}

// Pick electrode neurons
const electrodeIdx = [];
while (electrodeIdx.length < NUM_ELECTRODES) {
  const idx = Math.floor(Math.random() * NUM_NEURONS);
  if (!electrodeIdx.includes(idx)) electrodeIdx.push(idx);
}

let rotation = 0;

function project(n, rot) {
  const cosT = Math.cos(rot);
  const sinT = Math.sin(rot);
  const rx = n.x * cosT - n.z * sinT;
  const rz = n.x * sinT + n.z * cosT;
  const scale = 1 / (2.4 - rz);
  return {
    sx: W / 2 + rx * scale * (W * 0.34),
    sy: H / 2 + n.y * scale * (H * 0.34),
    depth: rz,
    scale,
  };
}

function activityColor(a) {
  // deep blue → teal signal → amber hot
  const c1 = [10, 30, 55];
  const c2 = [41, 224, 201];
  const c3 = [255, 180, 84];
  const t = Math.min(1, a);
  let c;
  if (t < 0.6) {
    const k = t / 0.6;
    c = c1.map((v, i) => v + (c2[i] - v) * k);
  } else {
    const k = (t - 0.6) / 0.4;
    c = c2.map((v, i) => v + (c3[i] - v) * k);
  }
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function drawOrganoid() {
  ctx.clearRect(0, 0, W, H);
  rotation += 0.004;

  const projected = neurons.map((n) => ({ ...project(n, rotation), a: n.activity }));
  projected.sort((a, b) => a.depth - b.depth);

  projected.forEach((p) => {
    ctx.beginPath();
    const size = (2.2 + p.a * 4) * devicePixelRatio * p.scale * 1.6;
    ctx.arc(p.sx, p.sy, Math.max(1, size), 0, Math.PI * 2);
    ctx.fillStyle = activityColor(p.a);
    ctx.globalAlpha = 0.55 + p.a * 0.4;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Draw electrode markers (triangles)
  electrodeIdx.forEach((idx) => {
    const n = neurons[idx];
    const p = project(n, rotation);
    ctx.beginPath();
    const s = 7 * devicePixelRatio * p.scale;
    ctx.moveTo(p.sx, p.sy - s);
    ctx.lineTo(p.sx - s, p.sy + s);
    ctx.lineTo(p.sx + s, p.sy + s);
    ctx.closePath();
    ctx.fillStyle = "#29e0c9";
    ctx.fill();
  });
}

function stimulateOrganoid() {
  electrodeIdx.forEach((idx) => {
    neurons[idx].activity = Math.min(
      1,
      neurons[idx].activity + 0.3 + Math.random() * 0.5
    );
  });
}

function evolveActivity() {
  neurons.forEach((n) => {
    n.activity *= 0.965;
    n.activity += (Math.random() - 0.5) * 0.03;
    n.activity = Math.max(0, Math.min(1, n.activity));
  });
  // Local propagation
  for (let k = 0; k < 3; k++) {
    const src = neurons[Math.floor(Math.random() * NUM_NEURONS)];
    neurons.forEach((n) => {
      const d2 =
        (n.x - src.x) ** 2 + (n.y - src.y) ** 2 + (n.z - src.z) ** 2;
      if (d2 < 0.08) n.activity = Math.min(1, n.activity + src.activity * 0.02);
    });
  }
}

let animRunning = false;

function animate() {
  if (!animRunning) return;
  evolveActivity();
  drawOrganoid();
  requestAnimationFrame(animate);
}

function startAnim() {
  if (!animRunning) {
    animRunning = true;
    animate();
  }
}

function stopAnim() {
  animRunning = false;
}

// Initialise
resizeCanvas();
drawOrganoid();
startAnim(); // idle shimmer always on

// ============================================================
// CLASSIFICATION
// ============================================================
function classifyVowel(f1, f2) {
  const distances = {};
  VOWELS.forEach((v) => {
    const [t1, t2] = VOWEL_PROFILES[v];
    distances[v] = Math.sqrt(((f1 - t1) / 500) ** 2 + ((f2 - t2) / 1000) ** 2);
  });

  const sorted = [...VOWELS].sort((a, b) => distances[a] - distances[b]);
  const prediction = sorted[0];
  let confidence = 95 - distances[prediction] * 20;
  confidence = Math.max(60, Math.min(96, confidence));

  const raw = {};
  let total = 0;
  VOWELS.forEach((v) => {
    raw[v] = Math.exp(-distances[v] * 2);
    total += raw[v];
  });

  const scores = {};
  VOWELS.forEach((v) => {
    scores[v] = (raw[v] / total) * 100;
  });

  return { prediction, confidence, scores };
}

// ============================================================
// AUDIO CAPTURE + ANALYSIS
// ============================================================
async function recordAndAnalyze() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const bins = analyser.frequencyBinCount;
  const freqData = new Uint8Array(bins);
  const accum = new Float64Array(bins);
  let frames = 0;

  const start = performance.now();
  await new Promise((resolve) => {
    function tick() {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < bins; i++) accum[i] += freqData[i];
      frames++;
      if (performance.now() - start < RECORD_MS) requestAnimationFrame(tick);
      else resolve();
    }
    tick();
  });

  stream.getTracks().forEach((t) => t.stop());
  audioCtx.close();

  const nyquist = audioCtx.sampleRate ? audioCtx.sampleRate / 2 : 22050;
  const spectrum = [];
  for (let i = 0; i < bins; i++) {
    const freq = (i / bins) * nyquist;
    if (freq >= 200 && freq <= 3000) {
      spectrum.push({ freq, mag: accum[i] / frames });
    }
  }

  if (spectrum.length === 0) return { f1: 700, f2: 1200 };

  spectrum.sort((a, b) => a.mag - b.mag);
  const topPeaks = spectrum
    .slice(-20)
    .map((p) => p.freq)
    .sort((a, b) => a - b);

  const pct = (arr, p) => {
    const idx = (arr.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };

  const f1 = pct(topPeaks, 0.2);
  const f2 = pct(topPeaks, 0.8);
  return { f1, f2 };
}

// ============================================================
// PIPELINE ORCHESTRATION
// ============================================================
const startBtn = document.getElementById("startBtn");
const demoBtn = document.getElementById("demoBtn");
const resetBtn = document.getElementById("resetBtn");
const micState = document.getElementById("micState");
const resultValue = document.getElementById("resultValue");
const resultConf = document.getElementById("resultConf");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setBusy(busy) {
  startBtn.disabled = busy;
  demoBtn.disabled = busy;
}

async function runPipelineStages() {
  setStage("electrode");
  micState.textContent = "Routing through electrodes";
  for (let i = 0; i < 8; i++) {
    stimulateOrganoid();
    await sleep(70);
  }

  setStage("organoid");
  micState.textContent = "Signal propagating in organoid";
  for (let i = 0; i < 12; i++) {
    stimulateOrganoid();
    await sleep(50);
  }

  setStage("activity");
  micState.textContent = "Reading neural activity";
  await sleep(700);

  setStage("readout");
  micState.textContent = "Running ML readout";
  await sleep(400);
}

// ── Live mic demo ──
startBtn.addEventListener("click", async () => {
  setBusy(true);
  clearStages();
  resultValue.textContent = "–";
  resultConf.textContent = "Confidence: 0%";
  showProbabilities({});
  setStage("voice");
  micState.textContent = "Listening… speak a vowel now";

  try {
    const analysisPromise = recordAndAnalyze();
    await sleep(300);
    setStage("encoder");
    micState.textContent = "Encoding waveform";
    const { f1, f2 } = await analysisPromise;

    await runPipelineStages();

    const { prediction, confidence, scores } = classifyVowel(f1, f2);
    resultValue.textContent = prediction;
    resultConf.textContent = `Confidence: ${confidence.toFixed(1)}%`;
    showProbabilities(scores);
    micState.textContent = "Complete";
  } catch (err) {
    micState.textContent = "Microphone unavailable";
    alert(
      "Could not access the microphone. Try "Run scripted demo" instead, or check your browser mic permissions."
    );
  } finally {
    setBusy(false);
  }
});

// ── Scripted demo ──
demoBtn.addEventListener("click", async () => {
  setBusy(true);
  clearStages();
  resultValue.textContent = "–";
  resultConf.textContent = "Confidence: 0%";
  showProbabilities({});
  setStage("voice");
  micState.textContent = 'Simulated input: vowel "A"';
  await sleep(600);

  setStage("encoder");
  micState.textContent = "Encoding waveform";
  await sleep(500);

  await runPipelineStages();

  const scores = { A: 91, E: 3, I: 2, O: 2, U: 2 };
  resultValue.textContent = "A";
  resultConf.textContent = "Confidence: 91.0%";
  showProbabilities(scores);
  micState.textContent = "Complete";
  setBusy(false);
});

// ── Reset ──
resetBtn.addEventListener("click", () => {
  clearStages();
  micState.textContent = "Ready";
  resultValue.textContent = "–";
  resultConf.textContent = "Confidence: 0%";
  showProbabilities({});
  neurons.forEach((n) => (n.activity = Math.random() * 0.15));
});

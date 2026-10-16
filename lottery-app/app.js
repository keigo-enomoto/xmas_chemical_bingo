// 各等の設定（色は花火・紙吹雪でも使う）
const TIERS = [
  { name: '1等', sym: 'Au', el: '金', color: '#FFD43D', colors: ['#FFD43D', '#FFE98A', '#FFB800', '#FFFFFF'], burst: 260, waves: 3, rain: 4600 },
  { name: '2等', sym: 'Ag', el: '銀', color: '#22D3EE', colors: ['#22D3EE', '#9BEFFF', '#FFFFFF'], burst: 140, waves: 2, rain: 1400 },
  { name: '3等', sym: 'Cu', el: '銅', color: '#FF4DDB', colors: ['#FF4DDB', '#FFA3EE', '#FFFFFF'], burst: 70, waves: 1, rain: 0 },
];
const MAX_COUNT = 999;   // 1等あたりの上限（候補配列が巨大にならないように）
const MAX_BUBBLES = 30;  // 試験管内に描く泡の最大数（数字は正確に表示）
const DURATION = 3000;   // ルーレット全体 (ms)
const HOLD = 0.87;       // この進捗以降は「溜め」

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const flasks = [...document.querySelectorAll('.flask')];
const result = $('result');

let remain = [0, 0, 0]; // 各等の残り
let init = [0, 0, 0];   // 設定時の人数（液面の基準）
let history = [];       // 当選した等の履歴 (0,1,2)
let configured = false;
let busy = false;

// ---------- 抽選ロジック（元アプリと同じ：残り枠1つにつき候補1つ） ----------
function buildCandidates(counts) {
  const candidates = [];
  counts.forEach((n, t) => { for (let i = 0; i < n; i++) candidates.push(t); });
  return candidates;
}
function pickTier(counts) {
  const c = buildCandidates(counts);
  return c.length ? c[Math.floor(Math.random() * c.length)] : -1;
}

// ---------- 表示更新 ----------
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function render() {
  flasks.forEach((f, t) => {
    f.querySelector('.liquid').style.height = remain[t] > 0 ? 10 + 80 * remain[t] / init[t] + '%' : '0%';
    f.querySelector('.cnt').textContent = remain[t];
    const mol = f.querySelector('.mol');
    mol.innerHTML = '';
    for (let i = 0; i < Math.min(remain[t], MAX_BUBBLES); i++) {
      const b = document.createElement('span');
      b.className = 'bubble';
      b.style.animationDelay = (i * 0.37) % 2 + 's';
      mol.appendChild(b);
    }
  });
  const empty = remain.every((n) => n === 0);
  $('drawButton').disabled = busy || !configured || empty;
  $('initButton').disabled = busy;
  $('notice').textContent = configured && empty ? 'すべての当選枠が埋まりました。' : '';

  const ol = $('history');
  ol.innerHTML = '';
  if (!history.length) ol.innerHTML = '<li class="empty">まだ抽選していません</li>';
  history.forEach((t, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="no">#${i + 1}</span><span class="badge t${t}">${TIERS[t].name}</span><span>${TIERS[t].sym} ${TIERS[t].el}</span>`;
    ol.appendChild(li);
  });
  ol.scrollTop = ol.scrollHeight;
}

function setResult(text, t, extra) {
  result.textContent = text;
  result.className = 'result ' + (t >= 0 ? 't' + t : 'idle') + (extra ? ' ' + extra : '');
}

// ---------- 設定 ----------
function applyConfig() {
  const ids = ['firstCount', 'secondCount', 'thirdCount'];
  const vals = [];
  const errs = [];
  ids.forEach((id, i) => {
    const el = $(id);
    const s = el.value.trim();
    const n = Number(s);
    const bad = s === '' || !Number.isInteger(n) || n < 0 || n > MAX_COUNT;
    el.setAttribute('aria-invalid', bad);
    if (bad) errs.push(`${TIERS[i].name}の人数は0〜${MAX_COUNT}の整数で指定してください。`);
    vals.push(n);
  });
  $('configError').textContent = errs.join(' ');
  if (errs.length) return;

  remain = vals;
  init = vals.slice();
  history = [];
  configured = true;
  setResult('抽選できます', -1);
  $('announce').textContent = '設定を反映しました。';
  render();
}

// ---------- 音（Web Audio で合成） ----------
let ac = null;
let muted = false;
try { muted = localStorage.getItem('lottery-muted') === '1'; } catch (e) { /* 無視 */ }

function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 無音で続行 */ } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(freq, at, dur, type, vol) {
  if (muted || !ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol || 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function drumroll() { for (let i = 0; i < 10; i++) tone(90 + i * 14, i * 0.04, 0.07, 'triangle', 0.18); }
function fanfare(t) {
  const notes = [[523, 659, 784], [523, 659, 784, 1047], [523, 659, 784, 1047, 784, 1047, 1319, 1568]][2 - t];
  notes.forEach((f, i) => tone(f, i * 0.12, 0.35, 'square', 0.1));
  const end = notes.length * 0.12;
  [523, 659, 784, 1047].forEach((f) => tone(f, end, t === 0 ? 1.4 : 0.7, 'sawtooth', 0.07));
}

// ---------- パーティクル（全画面 canvas） ----------
const cv = $('fx');
const cx = cv.getContext('2d');
let parts = [];
let rainUntil = 0;
let rainTier = 0;
let raf = 0;
let lastT = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function burst(x, y, tier) {
  const T = TIERS[tier];
  const n = Math.round(T.burst / T.waves);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 150 + Math.random() * 450;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, g: 600, life: 1, decay: 0.5 + Math.random() * 0.5,
      size: 3 + Math.random() * 5, color: T.colors[i % T.colors.length], rect: Math.random() < 0.4, rot: 0, vr: Math.random() * 10 - 5 });
  }
  kick();
}
function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  cx.clearRect(0, 0, innerWidth, innerHeight);
  if (now < rainUntil) { // 紙吹雪の雨
    const T = TIERS[rainTier];
    for (let i = 0; i < 4; i++) {
      parts.push({ x: Math.random() * innerWidth, y: -10, vx: Math.random() * 80 - 40, vy: 150 + Math.random() * 200, g: 40, life: 1, decay: 0.2,
        size: 5 + Math.random() * 6, color: T.colors[Math.floor(Math.random() * T.colors.length)], rect: true, rot: 0, vr: Math.random() * 8 - 4 });
    }
  }
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 20);
  parts.forEach((p) => {
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
    cx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    cx.fillStyle = p.color;
    if (p.rect) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); cx.restore(); }
    else { cx.beginPath(); cx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); cx.fill(); }
  });
  cx.globalAlpha = 1;
  raf = parts.length || now < rainUntil ? requestAnimationFrame(frame) : 0; // 終わったら自動停止
  if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
}

// ---------- 当選演出 ----------
function celebrate(t) {
  const T = TIERS[t];
  const r = result.getBoundingClientRect();
  const cxp = r.left + r.width / 2;
  const cyp = r.top + r.height / 2;
  restart($('flash'), 'go');
  $('shock').style.setProperty('--c', T.color);
  restart($('shock'), 'go');
  for (let i = 0; i < T.waves; i++) {
    setTimeout(() => burst(i ? Math.random() * innerWidth : cxp, i ? Math.random() * innerHeight * 0.6 : cyp, t), i * 400);
  }
  if (T.rain) { rainTier = t; rainUntil = performance.now() + T.rain; kick(); }
  if (t === 0) restart(document.body, 'quake');
  fanfare(t);
}

function reveal(t) {
  const T = TIERS[t];
  remain[t]--;
  history.push(t);
  flasks.forEach((f) => f.classList.remove('active'));
  document.body.classList.remove('drawing');
  const reduce = reduced.matches;
  setResult(`${T.name} 当選！`, t, reduce ? 'fade' : 'pop');
  const done = remain.every((n) => n === 0);
  $('announce').textContent = `${T.name} 当選。${T.sym} ${T.el}。` + (done ? 'すべての当選枠が埋まりました。' : '');
  const b = flasks[t].querySelector('.bubble:last-child');
  if (b && !reduce) b.classList.add('pop');
  if (reduce) fanfare(t); else celebrate(t);
  setTimeout(() => { busy = false; render(); }, reduce ? 0 : 700); // 泡が弾けてから表示更新
}

// ---------- ルーレット ----------
function show(t) {
  setResult(`${TIERS[t].name} ${TIERS[t].sym}`, t);
  flasks.forEach((f, i) => f.classList.toggle('active', i === t));
}

function startDraw() {
  if (busy || $('drawButton').disabled) return;
  audio();
  busy = true;
  $('announce').textContent = '';
  render(); // ボタンを無効化
  if (reduced.matches) { reveal(pickTier(remain)); return; }

  const candidates = buildCandidates(remain);
  const winner = pickTier(remain); // 先に当選を決め、溜めの間はそれを表示
  document.body.classList.add('drawing');
  const start = performance.now();
  let held = false;

  function step() {
    const p = (performance.now() - start) / DURATION;
    if (p >= 1) { reveal(winner); return; }
    if (p < HOLD) {
      show(candidates[Math.floor(Math.random() * candidates.length)]);
      tone(380 + p * 600, 0, 0.06, 'square', 0.08); // だんだん高く
      const q = p / HOLD;
      setTimeout(step, 50 + 400 * q * q); // 徐々に遅く
    } else {
      if (!held) { held = true; show(winner); drumroll(); }
      setTimeout(step, (1 - p) * DURATION); // 溜め：最後まで表示を止める
    }
  }
  step();
}

// ---------- イベント ----------
$('initButton').addEventListener('click', applyConfig);
$('drawButton').addEventListener('click', startDraw);
['firstCount', 'secondCount', 'thirdCount'].forEach((id) => {
  $(id).addEventListener('input', () => { $('configError').textContent = ''; $(id).removeAttribute('aria-invalid'); });
});
document.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('input, button, a, select, textarea')) {
    e.preventDefault();
    startDraw();
  }
});
window.addEventListener('resize', resize);

const muteBtn = $('muteBtn');
function updateMute() {
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', muted);
  muteBtn.setAttribute('aria-label', muted ? '効果音のミュートを解除する' : '効果音をミュートする');
}
muteBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('lottery-muted', muted ? '1' : '0'); } catch (e) { /* 無視 */ }
  audio();
  updateMute();
});

const fsBtn = $('fsBtn');
if (!document.fullscreenEnabled) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  fsBtn.setAttribute('aria-label', document.fullscreenElement ? '全画面表示を終了する' : '全画面表示に切り替える');
});

resize();
updateMute();
setResult('設定を反映してください', -1);
render();

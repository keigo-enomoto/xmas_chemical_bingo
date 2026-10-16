// 元素ビンゴ: 当選番号 = 原子番号
const SYMBOLS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
const NAMES = '水素 ヘリウム リチウム ベリリウム ホウ素 炭素 窒素 酸素 フッ素 ネオン ナトリウム マグネシウム アルミニウム ケイ素 リン 硫黄 塩素 アルゴン カリウム カルシウム スカンジウム チタン バナジウム クロム マンガン 鉄 コバルト ニッケル 銅 亜鉛 ガリウム ゲルマニウム ヒ素 セレン 臭素 クリプトン ルビジウム ストロンチウム イットリウム ジルコニウム ニオブ モリブデン テクネチウム ルテニウム ロジウム パラジウム 銀 カドミウム インジウム スズ アンチモン テルル ヨウ素 キセノン セシウム バリウム ランタン セリウム プラセオジム ネオジム プロメチウム サマリウム ユウロピウム ガドリニウム テルビウム ジスプロシウム ホルミウム エルビウム ツリウム イッテルビウム ルテチウム ハフニウム タンタル タングステン レニウム オスミウム イリジウム 白金 金 水銀 タリウム 鉛 ビスマス ポロニウム アスタチン ラドン フランシウム ラジウム アクチニウム トリウム プロトアクチニウム ウラン ネプツニウム プルトニウム アメリシウム キュリウム バークリウム カリホルニウム アインスタイニウム フェルミウム メンデレビウム ノーベリウム ローレンシウム ラザホージウム ドブニウム シーボーギウム ボーリウム ハッシウム マイトネリウム ダームスタチウム レントゲニウム コペルニシウム ニホニウム フレロビウム モスコビウム リバモリウム テネシン オガネソン'.split(' ');

// 分類: [名前, 色]
const CATS = {
  alkali: ['アルカリ金属', '#FF6B6B'], alkaline: ['アルカリ土類', '#FFC933'], trans: ['遷移金属', '#22D3EE'],
  post: ['貧金属', '#9FB4FF'], metalloid: ['半金属', '#39FF88'], nonmetal: ['非金属', '#7CFFB2'],
  halogen: ['ハロゲン', '#FF4DDB'], noble: ['貴ガス', '#C58BFF'], lan: ['ランタノイド', '#FF9F43'],
  act: ['アクチノイド', '#FF7AA8'], unknown: ['未知元素', '#E8F1FF'],
};
const inSet = (z, s) => s.includes(z);
function category(z) {
  if (z < 1 || z > 118) return CATS.unknown;
  if (inSet(z, [2, 10, 18, 36, 54, 86, 118])) return CATS.noble;
  if (inSet(z, [3, 11, 19, 37, 55, 87])) return CATS.alkali;
  if (inSet(z, [4, 12, 20, 38, 56, 88])) return CATS.alkaline;
  if (inSet(z, [9, 17, 35, 53, 85, 117])) return CATS.halogen;
  if (inSet(z, [1, 6, 7, 8, 15, 16, 34])) return CATS.nonmetal;
  if (inSet(z, [5, 14, 32, 33, 51, 52, 84])) return CATS.metalloid;
  if (z >= 57 && z <= 71) return CATS.lan;
  if (z >= 89 && z <= 103) return CATS.act;
  if ((z >= 21 && z <= 30) || (z >= 39 && z <= 48) || (z >= 72 && z <= 80) || (z >= 104 && z <= 112)) return CATS.trans;
  return CATS.post;
}
function info(z) {
  const known = z >= 1 && z <= 118;
  const [cat, color] = category(z);
  return { sym: known ? SYMBOLS[z - 1] : '?', name: known ? NAMES[z - 1] : '未知元素', cat, color };
}
// BINGO列 (範囲が1〜75のときのみ)
function bingoCol(z) {
  return 'BINGO'[Math.min(4, Math.floor((z - 1) / 15))];
}

const $ = (id) => document.getElementById(id);
const tile = $('currentNumber');
let pastNumbers = [];
let drawing = false;

// ---------- 入力・エラー ----------
function readRange() {
  return { min: parseInt($('minNumber').value), max: parseInt($('maxNumber').value) };
}
function showMsg(id, text, kind = 'error') {
  const el = $(id);
  el.className = 'msg ' + kind;
  el.textContent = text ? (kind === 'error' ? '⚠ エラー: ' : 'ℹ ') + text : '';
}
function clearMsgs() { showMsg('rangeError', ''); showMsg('manualError', ''); }

// ---------- タイル表示 ----------
function showTile(z, final) {
  const i = info(z);
  const { min, max } = readRange();
  tile.style.setProperty('--c', i.color);
  tile.classList.remove('idle');
  $('tileNum').textContent = z;
  $('tileSym').textContent = i.sym;
  $('tileName').textContent = i.name;
  $('tileCat').textContent = final ? i.cat : '';
  $('tileCol').textContent = final && min === 1 && max === 75 && z >= 1 && z <= 75 ? bingoCol(z) : '';
}

function addPast(z) {
  const i = info(z);
  const ul = $('pastNumbers');
  const old = ul.querySelector('.newest');
  if (old) old.classList.remove('newest');
  const li = document.createElement('li');
  li.className = 'newest';
  li.style.setProperty('--c', i.color);
  li.title = i.name;
  li.innerHTML = `<span class="n">${z}</span><span class="s">${i.sym}</span>`;
  ul.appendChild(li);
  updateCounter();
}
function updateCounter() {
  const { min, max } = readRange();
  const total = isNaN(min) || isNaN(max) || max < min ? '-' : max - min + 1;
  $('counter').textContent = `${pastNumbers.length} / ${total} 抽選済み`;
}

// ---------- 当選確定の演出 ----------
function reveal(z) {
  pastNumbers.push(z);
  showTile(z, true);
  addPast(z);
  const i = info(z);
  $('result').textContent = `当選番号は ${z}、${i.name}（${i.sym}）です`;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { tile.classList.add('pop'); return; }
  restart($('flash'), 'go');
  restart($('ring'), 'go');
  restart(tile, 'pop');
  burst(i.color);
  chime();
}
function restart(el, cls) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}

// ---------- 抽選 ----------
function draw() {
  if (drawing) return;
  clearMsgs();
  const { min, max } = readRange();
  if (isNaN(min) || isNaN(max)) { showMsg('rangeError', '最小値と最大値を数字で入力してください。'); return; }
  if (min > max) { showMsg('rangeError', '最小値は最大値より小さくしてください。'); return; }
  // まだ出ていない番号だけが候補
  const pool = [];
  for (let n = min; n <= max; n++) if (!pastNumbers.includes(n)) pool.push(n);
  if (pool.length === 0) { showMsg('rangeError', 'すべての番号が当選しました。', 'info'); $('result').textContent = 'すべての番号が当選しました'; return; }
  const winner = pool[Math.floor(Math.random() * pool.length)];
  const rand = () => pool[Math.floor(Math.random() * pool.length)];

  setDrawing(true);
  initAudio();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { reveal(winner); setDrawing(false); return; }

  const spinEnd = 2600, holdEnd = 3000; // 減速ルーレット2.6秒 + 溜め0.4秒
  const t0 = performance.now();
  tile.classList.add('spin');
  riser();
  (function step() {
    const t = performance.now() - t0;
    if (t >= holdEnd) {
      tile.classList.remove('spin');
      reveal(winner);
      setDrawing(false);
      return;
    }
    if (t < spinEnd) {
      const p = t / spinEnd;
      showTile(rand(), false);
      tick(300 + p * 500);
      setTimeout(step, 50 + 450 * p * p); // 徐々に遅く
    } else {
      showTile(winner, false); // 溜め
      tile.classList.remove('spin');
      setTimeout(step, holdEnd - t);
    }
  })();
}
function setDrawing(on) {
  drawing = on;
  document.body.classList.toggle('drawing', on);
  document.querySelectorAll('button, input').forEach((el) => {
    if (el.id !== 'muteButton' && el.id !== 'fullscreenButton') el.disabled = on;
  });
  if (!on) $('generateButton').focus();
}

// ---------- 手動追加 ----------
function addManual() {
  if (drawing) return;
  clearMsgs();
  const { min, max } = readRange();
  const input = $('manualNumber');
  const n = parseInt(input.value);
  if (isNaN(n)) return showMsg('manualError', '有効な数字を入力してください。');
  if (n < min || n > max) return showMsg('manualError', `指定範囲外です。${min}～${max}の範囲で入力してください。`);
  if (pastNumbers.includes(n)) return showMsg('manualError', 'その番号は既に当選済みです。');
  input.value = '';
  initAudio();
  reveal(n);
}

// ---------- パーティクル (分子風の円と結合) ----------
const cv = $('fx'), ctx = cv.getContext('2d');
let parts = [], fxRunning = false;
function resize() {
  const d = window.devicePixelRatio || 1;
  cv.width = innerWidth * d; cv.height = innerHeight * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
addEventListener('resize', resize); resize();

function burst(color) {
  const r = tile.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cols = [color, '#39FF88', '#22D3EE', '#FF4DDB', '#FFC933'];
  for (let k = 0; k < 70; k++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 9;
    // 数字を隠さないようタイルの外周から外へ飛ばす
    parts.push({ x: cx + Math.cos(a) * r.width / 2, y: cy + Math.sin(a) * r.height / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 7,
      c: cols[k % cols.length], life: 0 });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(frame); }
}
function frame() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.life++; p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.08;
  }
  parts = parts.filter((p) => p.life < 120); // 約2秒で消える
  ctx.lineWidth = 2;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    ctx.globalAlpha = 1 - p.life / 120;
    ctx.fillStyle = ctx.strokeStyle = p.c;
    for (let j = i + 1; j < parts.length; j++) { // 近い粒子同士を結合線でつなぐ
      const q = parts[j];
      if (Math.hypot(p.x - q.x, p.y - q.y) < 60) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(frame);
  else { fxRunning = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

// ---------- サウンド (Web Audio) ----------
let ac = null, muted = false;
try { muted = localStorage.getItem('bingoMuted') === '1'; } catch (e) {}
function initAudio() {
  if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); }
  if (ac && ac.state === 'suspended') ac.resume();
}
function beep(freq, dur, type = 'sine', vol = 0.15, at = 0) {
  if (muted || !ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
const tick = (f) => beep(f, 0.05, 'square', 0.06);
function riser() { // ドラムロール風 (最後の約1秒)
  for (let k = 0; k < 20; k++) beep(200 + k * 25, 0.05, 'triangle', 0.05 + k * 0.004, 2.0 + k * 0.05);
}
function chime() { [523, 659, 784, 1047].forEach((f, k) => beep(f, 0.6, 'sine', 0.18, k * 0.09)); }

$('muteButton').addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('bingoMuted', muted ? '1' : '0'); } catch (e) {}
  syncMute();
});
function syncMute() {
  const b = $('muteButton');
  b.textContent = muted ? '🔇' : '🔊';
  b.setAttribute('aria-pressed', muted);
  b.setAttribute('aria-label', muted ? 'サウンドを出す' : 'サウンドを消す');
}
syncMute();

$('fullscreenButton').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
});

// ---------- イベント ----------
$('generateButton').addEventListener('click', draw);
$('addManualButton').addEventListener('click', addManual);
$('manualNumber').addEventListener('keydown', (e) => { if (e.key === 'Enter') addManual(); });
['minNumber', 'maxNumber'].forEach((id) => $(id).addEventListener('input', () => { updateCounter(); showMsg('rangeError', ''); }));
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if ((e.key === ' ' || e.key === 'Enter') && tag !== 'INPUT' && tag !== 'BUTTON') { e.preventDefault(); draw(); }
});
updateCounter();

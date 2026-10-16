// 元素ビンゴ: 当選番号 = 原子番号
const SYMBOLS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
const NAMES = '水素 ヘリウム リチウム ベリリウム ホウ素 炭素 窒素 酸素 フッ素 ネオン ナトリウム マグネシウム アルミニウム ケイ素 リン 硫黄 塩素 アルゴン カリウム カルシウム スカンジウム チタン バナジウム クロム マンガン 鉄 コバルト ニッケル 銅 亜鉛 ガリウム ゲルマニウム ヒ素 セレン 臭素 クリプトン ルビジウム ストロンチウム イットリウム ジルコニウム ニオブ モリブデン テクネチウム ルテニウム ロジウム パラジウム 銀 カドミウム インジウム スズ アンチモン テルル ヨウ素 キセノン セシウム バリウム ランタン セリウム プラセオジム ネオジム プロメチウム サマリウム ユウロピウム ガドリニウム テルビウム ジスプロシウム ホルミウム エルビウム ツリウム イッテルビウム ルテチウム ハフニウム タンタル タングステン レニウム オスミウム イリジウム 白金 金 水銀 タリウム 鉛 ビスマス ポロニウム アスタチン ラドン フランシウム ラジウム アクチニウム トリウム プロトアクチニウム ウラン ネプツニウム プルトニウム アメリシウム キュリウム バークリウム カリホルニウム アインスタイニウム フェルミウム メンデレビウム ノーベリウム ローレンシウム ラザホージウム ドブニウム シーボーギウム ボーリウム ハッシウム マイトネリウム ダームスタチウム レントゲニウム コペルニシウム ニホニウム フレロビウム モスコビウム リバモリウム テネシン オガネソン'.split(' ');

// 分類: [名前, 色]
const CATS = {
  alkali: ['アルカリ金属', '#FF4D5E'], alkaline: ['アルカリ土類', '#FFD43D'], trans: ['遷移金属', '#9BE7FF'],
  post: ['貧金属', '#B8C4FF'], metalloid: ['半金属', '#2EE59D'], nonmetal: ['非金属', '#9DFFD0'],
  halogen: ['ハロゲン', '#FF8FD0'], noble: ['貴ガス', '#FFFFFF'], lan: ['ランタノイド', '#FF9A3D'],
  act: ['アクチノイド', '#E6B98A'], unknown: ['未知元素', '#B0BEC5'],
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
  el.textContent = text ? (kind === 'error' ? 'エラー: ' : '') + text : '';
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

// ---------- パーティクル (雪の結晶・星・オーナメント) ----------
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
  const cols = [color, '#FF4D5E', '#2EE59D', '#FFD43D', '#FFFFFF'];
  const kinds = ['flake', 'star', 'dot', 'flake', 'dot'];
  for (let k = 0; k < 70; k++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 9;
    // 数字を隠さないようタイルの外周から外へ飛ばす
    parts.push({ x: cx + Math.cos(a) * r.width / 2, y: cy + Math.sin(a) * r.height / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      r: 4 + Math.random() * 7, c: cols[k % cols.length], kind: kinds[k % kinds.length], rot: 0, vr: Math.random() * .2 - .1, life: 0 });
  }
  for (let k = 0; k < 50; k++) { // 雪のバースト: 約2秒、上から速く降る
    parts.push({ x: Math.random() * innerWidth, y: -10 - Math.random() * 100, vx: Math.random() * 2 - 1, vy: 5 + Math.random() * 4,
      r: 3 + Math.random() * 4, c: '#FFFFFF', kind: 'flake', snow: true, rot: 0, vr: Math.random() * .1 - .05, life: 0 });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(frame); }
}
function drawPart(p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.fillStyle = ctx.strokeStyle = p.c;
  ctx.beginPath();
  if (p.kind === 'flake') { // 6本腕の結晶
    ctx.lineWidth = 1.5;
    for (let a = 0; a < 3; a++) {
      const x = Math.cos(a * Math.PI / 3) * p.r * 1.6, y = Math.sin(a * Math.PI / 3) * p.r * 1.6;
      ctx.moveTo(-x, -y); ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (p.kind === 'star') { // 4つ角の星
    const R = p.r * 1.6, q = p.r * .4;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, d = k % 2 ? q : R; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    ctx.fill();
  } else { ctx.arc(0, 0, p.r * .8, 0, Math.PI * 2); ctx.fill(); } // オーナメント玉
  ctx.restore();
}
function frame() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.life++; p.rot += p.vr; p.x += p.vx; p.y += p.vy;
    if (!p.snow) { p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.08; }
  }
  parts = parts.filter((p) => p.life < 120); // 約2秒で消える
  for (const p of parts) { ctx.globalAlpha = (p.snow ? .7 : 1) * (1 - p.life / 120); drawPart(p); }
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
function bells(at, n, gap) { // そりの鈴: 高い音を少しずらして重ねる
  for (let k = 0; k < n; k++) [3520, 4186, 5274].forEach((f, j) => beep(f * (1 + j * .004), 0.18, 'triangle', 0.025, at + k * gap + j * .012));
}
function riser() { // ドラムロール風 + 鈴 (最後の約1秒)
  for (let k = 0; k < 20; k++) beep(200 + k * 25, 0.05, 'triangle', 0.05 + k * 0.004, 2.0 + k * 0.05);
  bells(0, 24, 0.12);
}
function bell(f, at = 0) { beep(f, 1.2, 'sine', 0.16, at); beep(f * 2.76, 1.2, 'sine', 0.04, at); } // ベル音
function chime() {
  [523, 659, 784, 1047].forEach((f, k) => bell(f, k * 0.09));
  // ジングルベル冒頭 (E E E, E E E, E G C D E)、null は休符
  [329.6, 329.6, 329.6, null, 329.6, 329.6, 329.6, null, 329.6, 392, 523.3, 587.3, 659.3]
    .forEach((f, k) => f && beep(f, 0.2, 'triangle', 0.12, 0.5 + k * 0.18));
}

$('muteButton').addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('bingoMuted', muted ? '1' : '0'); } catch (e) {}
  syncMute();
});
function syncMute() {
  const b = $('muteButton');
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

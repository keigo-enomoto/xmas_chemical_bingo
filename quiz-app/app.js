// クイズアプリ：待機 → 問題 → 正解 を繰り返し、最後に終了画面
const CPS = 15;        // タイプ速度（文字/秒）
const DRUM_MS = 1500;  // ドラムロールの長さ
const LETTERS = 'ABCD';
const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

let quiz = null;        // { title, questions }
let q = 0;              // 現在の問題番号 (0始まり)
let ph = 'standby';     // 'standby' | 'question' | 'answer' | 'end'
let typing = false;     // タイプ中か
let busy = false;       // 正解演出中（操作を受け付けない）
let typeTimer = 0;
let revealTimer = 0;

// ---------- 問題データの検証 ----------
// 画像の許可判定：images/ などの相対パス、または data:image のみ（外部URL・絶対パス・.. は不可）
function isSafeImage(s) {
  if (typeof s !== 'string') return false;
  if (/^data:/i.test(s)) return s.length <= 2000000 && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)(;base64)?,/i.test(s);
  return !!s && !/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[/\\]/.test(s) && !s.includes('\\') && !s.split('/').includes('..') && !/%2e/i.test(s); // %2e%2e（エンコードした ..）も拒否
}
// 問題なければ null、あればエラー文を返す
function validate(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.questions) || !d.questions.length) return '「questions」に1問以上の配列が必要です。';
  if (d.questions.length > 200) return '問題数が多すぎます（200問まで）。';
  if (typeof d.title === 'string' && d.title.length > 2000) return '「title」が長すぎます（2000文字まで）。';
  for (let i = 0; i < d.questions.length; i++) {
    const x = d.questions[i], n = `${i + 1}問目：`;
    if (!x || typeof x.question !== 'string' || !x.question.trim()) return n + '「question」（問題文）がありません。';
    if (typeof x.answer !== 'string' || !x.answer.trim()) return n + '「answer」（正解）がありません。';
    if (x.question.length > 2000 || x.answer.length > 2000 || (typeof x.explanation === 'string' && x.explanation.length > 2000)) return n + '「question」「answer」「explanation」は2000文字までにしてください。';
    if (x.image != null && typeof x.image !== 'string') return n + '「image」は文字列で指定してください。';
    if (x.image && !isSafeImage(x.image)) return n + '画像の指定が不正です（外部URLは使えません。images/ 内の画像か data:image を指定してください）。';
    if (x.explanation != null && typeof x.explanation !== 'string') return n + '「explanation」は文字列で指定してください。';
    if (x.choices != null) {
      if (!Array.isArray(x.choices) || x.choices.length < 2 || x.choices.length > 4 || x.choices.some((c) => typeof c !== 'string' || !c.trim())) return n + '「choices」は2〜4個の文字列の配列にしてください。';
      if (x.choices.some((c) => c.length > 2000)) return n + '「choices」の文字列が長すぎます（2000文字まで）。';
      if (correctIndex(x) < 0) return n + '「answer」が「choices」のどれとも一致しません。';
    }
  }
  return null;
}
// 正解の選択肢番号（文字一致、または "A" などの記号）
function correctIndex(x) {
  if (!x.choices) return -1;
  const i = x.choices.indexOf(x.answer);
  if (i >= 0) return i;
  const j = LETTERS.indexOf(x.answer.trim().toUpperCase());
  return x.answer.trim().length === 1 && j >= 0 && j < x.choices.length ? j : -1;
}

// ---------- 音（Web Audio で合成） ----------
let ac = null;
let muted = false;
try { muted = localStorage.getItem('quiz-muted') === '1'; } catch (e) { /* 無視 */ }
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
const tick = () => tone(1500 + Math.random() * 300, 0, 0.03, 'square', 0.035);
// シャンシャン鈴：高い音を少しずらして重ねる
function bells(at, n) { for (let i = 0; i < n; i++) [3520, 4186, 5274].forEach((f, k) => tone(f * (1 + k * 0.003), at + i * 0.09 + k * 0.012, 0.18, 'triangle', 0.025)); }
const jan = () => bells(0, 4);
function drumroll() { for (let i = 0; i < 30; i++) tone(90 + i * 6, i * 0.05, 0.07, 'triangle', 0.08 + i * 0.004); bells(0, 16); }
// ベル音：基音＋2.76倍音
function bell(f, at) { tone(f, at, 1.2, 'sine', 0.12); tone(f * 2.76, at, 0.6, 'sine', 0.03); }
function chime() { bell(1047, 0); bell(1568, 0.1); bell(2093, 0.2); }
// ジングルベルの出だし（ミミミ ミミミ ミソドレミ）
function jingle(at) {
  const E = 659, G = 784, C = 523, D = 587;
  [[E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 3]]
    .reduce((t, [f, b]) => { tone(f, at + t * 0.18, b * 0.17, 'triangle', 0.1); bell(f * 2, at + t * 0.18); return t + b; }, 0);
}

// ---------- パーティクル（全画面 canvas・答え枠の外周から外向きに） ----------
const cv = $('fx');
const cx = cv.getContext('2d');
let parts = [];
let raf = 0;
let lastT = 0;
const COLORS = ['#FFD43D', '#FF4D5E', '#2EE59D', '#FFFFFF', '#9BE7FF', '#FFE98A'];
const KINDS = ['dot', 'rect', 'flake', 'star', 'flake'];

function resize() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function burst(r, n) {
  const per = 2 * (r.width + r.height);
  for (let i = 0; i < n; i++) {
    let d = Math.random() * per, x, y, nx = 0, ny = 0;       // 外周上の点と外向き法線
    if (d < r.width) { x = r.left + d; y = r.top; ny = -1; }
    else if ((d -= r.width) < r.height) { x = r.right; y = r.top + d; nx = 1; }
    else if ((d -= r.height) < r.width) { x = r.right - d; y = r.bottom; ny = 1; }
    else { d -= r.width; x = r.left; y = r.bottom - d; nx = -1; }
    const s = 200 + Math.random() * 500, spread = (Math.random() - 0.5) * 1.2;
    const a = Math.atan2(ny, nx) + spread;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 350, life: 1, decay: 0.45 + Math.random() * 0.4,
      size: 4 + Math.random() * 8, color: COLORS[i % COLORS.length], kind: KINDS[i % 5], rot: 0, vr: Math.random() * 10 - 5 });
  }
  if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
}
// 粒を描く：雪の結晶（6本の腕）・星（4方向のきらめき）・紙吹雪・オーナメントの丸
function drawPart(p) {
  const s = p.size;
  cx.strokeStyle = p.color; cx.lineWidth = 1.5;
  cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
  if (p.kind === 'rect') cx.fillRect(-s, -s / 2, s * 2, s);
  else if (p.kind === 'dot') { cx.beginPath(); cx.arc(0, 0, s / 2, 0, Math.PI * 2); cx.fill(); }
  else {
    const arms = p.kind === 'flake' ? 6 : 4;
    cx.beginPath();
    for (let k = 0; k < arms; k++) { const a = (k * 2 * Math.PI) / arms; cx.moveTo(0, 0); cx.lineTo(Math.cos(a) * s * 1.4, Math.sin(a) * s * 1.4); }
    cx.stroke();
  }
  cx.restore();
}
// 雪のバースト：上から速めの雪を降らせる
function snowBurst() {
  for (let i = 0; i < 70; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: Math.random() * 60 - 30, vy: 250 + Math.random() * 250, g: 0,
    life: 1, decay: 0.2, size: 3 + Math.random() * 6, color: i % 4 ? '#FFFFFF' : '#9BE7FF', kind: 'flake', rot: 0, vr: Math.random() * 4 - 2 });
  if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
}
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 20);
  parts.forEach((p) => {
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
    cx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    cx.fillStyle = p.color;
    drawPart(p);
  });
  cx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(frame) : 0; // 終わったら自動停止
  if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
}

// ---------- 進行レール ----------
function buildRail() {
  $('railList').innerHTML = quiz.questions.map((_, i) => `<li><span class="node">${i + 1}</span></li>`).join('');
}
function updateRail() {
  const n = quiz.questions.length;
  [...$('railList').children].forEach((li, i) => {
    const done = ph === 'end' || i < q || (i === q && ph === 'answer' && !busy);
    li.className = done ? 'done' : i === q ? 'cur' : '';
    li.firstChild.textContent = done ? '✓' : i + 1;
    if (i === q && ph !== 'end') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  const cur = ph === 'end' ? n : q + 1;
  $('railText').textContent = `${cur} / ${n}`;
}

// ---------- 画面切り替え ----------
function showScreen(name) {
  ['standby', 'question', 'answer', 'end'].forEach((s) => { $(s).hidden = s !== name; });
}
function setPrimary(label, disabled) { $('nextBtn').textContent = label; $('nextBtn').disabled = !!disabled; }
function afterShow() {
  updateRail();
  $('backBtn').disabled = busy || (ph === 'standby' && q === 0);
}
function stopTimers() { clearTimeout(typeTimer); clearTimeout(revealTimer); typing = false; busy = false; }

function enterStandby() {
  stopTimers(); ph = 'standby';
  const first = q === 0;
  $('quizTitle').textContent = first ? quiz.title || '' : '';
  $('quizTitle').hidden = !first || !quiz.title;
  $('loader').hidden = !first;
  $('cardEn').textContent = `Q.${q + 1}`;
  $('cardJa').textContent = `第${q + 1}問`;
  showScreen('standby');
  const card = document.querySelector('.card');
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  setPrimary('問題を表示');
  $('announce').textContent = `第${q + 1}問`;
  afterShow();
  if (!reduced.matches) jan();
}

function enterQuestion(instant) {
  stopTimers(); ph = 'question';
  const x = quiz.questions[q];
  showScreen('question');
  const fig = $('qFig');
  fig.className = 'fig' + (x.image && isSafeImage(x.image) ? '' : ' none');
  if (x.image && isSafeImage(x.image)) { $('qImg').hidden = false; $('qImg').src = x.image; void fig.offsetWidth; fig.classList.add('show'); }
  const ul = $('qChoices');
  ul.className = 'choices pre';
  ul.innerHTML = (x.choices || []).map((c, i) => `<li style="--i:${i}"><span class="ltr">${LETTERS[i]}</span><span></span></li>`).join('');
  (x.choices || []).forEach((c, i) => { ul.children[i].lastChild.textContent = c; });
  setPrimary('正解を見る');
  afterShow();
  const band = $('qText');
  if (instant || reduced.matches) { band.textContent = x.question; finishTyping(); return; }
  typing = true;
  band.textContent = '';
  const chars = [...x.question];
  let n = 0;
  (function step() {
    n++;
    band.textContent = chars.slice(0, n).join('');
    const c = document.createElement('span'); c.className = 'caret'; c.setAttribute('aria-hidden', 'true'); band.appendChild(c);
    if (n % 2 === 0) tick();
    if (n >= chars.length) { completeTyping(); return; }
    typeTimer = setTimeout(step, 1000 / CPS);
  })();
}
// タイプ途中なら一気に表示
function completeTyping() {
  clearTimeout(typeTimer);
  $('qText').textContent = quiz.questions[q].question;
  finishTyping();
}
function finishTyping() {
  typing = false;
  $('qChoices').classList.add('go');
  $('announce').textContent = quiz.questions[q].question;
}

// 正解画面。fx=true で演出あり、false は「戻る」時の即時表示
function enterAnswer(fx) {
  stopTimers(); ph = 'answer';
  const x = quiz.questions[q], ci = correctIndex(x);
  showScreen('answer');
  $('aQ').textContent = `Q${q + 1}. ${x.question}`;
  $('aText').textContent = x.answer;
  $('aText').className = 'a-text';
  const ul = $('aChoices');
  ul.className = 'choices';
  ul.innerHTML = (x.choices || []).map((c, i) => `<li><span class="ltr">${LETTERS[i]}</span><span></span></li>`).join('');
  (x.choices || []).forEach((c, i) => { ul.children[i].lastChild.textContent = c; });
  $('aExp').textContent = x.explanation || '';
  $('aExp').className = 'a-exp pre';
  const last = q === quiz.questions.length - 1;
  const fin = () => {
    busy = false;
    $('aBox').classList.add('reveal');
    $('aLead').classList.remove('hold');
    [...ul.children].forEach((li, i) => li.classList.add(i === ci ? 'ok' : 'dim'));
    $('aExp').className = 'a-exp go';
    setPrimary(last ? '終了へ' : '次の問題へ');
    $('announce').textContent = `正解は、${x.answer}。${x.explanation || ''}`;
    afterShow();
  };
  const box = $('aBox');
  box.classList.remove('reveal');
  if (!fx) { fin(); return; }
  busy = true;
  setPrimary('正解を見る', true);
  afterShow();
  if (reduced.matches) { fin(); $('aText').classList.add('fade'); chime(); return; }
  $('aLead').classList.add('hold');
  drumroll();
  revealTimer = setTimeout(() => {
    fin();
    $('aText').classList.add('pop');
    const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    const s = $('shock'); s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
    chime(); jingle(0.35);
    snowBurst();
    const r = box.getBoundingClientRect();
    burst(r, 140);
    setTimeout(() => burst(box.getBoundingClientRect(), 80), 350);
  }, DRUM_MS);
}

function enterEnd() {
  stopTimers(); ph = 'end';
  showScreen('end');
  $('endSub').textContent = `全${quiz.questions.length}問 終了`;
  setPrimary('最初からやり直す');
  $('announce').textContent = `おつかれさまでした。全${quiz.questions.length}問終了。`;
  afterShow();
  if (!reduced.matches) { jingle(0); const r = $('end').getBoundingClientRect(); burst({ left: r.left + r.width / 2 - 150, right: r.left + r.width / 2 + 150, top: r.top + r.height * 0.3, bottom: r.top + r.height * 0.7, width: 300, height: r.height * 0.4 }, 100); }
}

// ---------- 進む / 戻る ----------
function advance() {
  audio();
  if (busy) return;
  if (ph === 'standby') enterQuestion(false);
  else if (ph === 'question') { if (typing) completeTyping(); else enterAnswer(true); }
  else if (ph === 'answer') { if (q === quiz.questions.length - 1) enterEnd(); else { q++; enterStandby(); } }
  else { q = 0; enterStandby(); }
}
function back() {
  if (busy) return;
  if (ph === 'question') enterStandby();
  else if (ph === 'answer') enterQuestion(true);
  else if (ph === 'end') enterAnswer(false);
  else if (q > 0) { q--; enterAnswer(false); }
}

// ---------- 問題ファイル ----------
function setQuiz(d) {
  quiz = { title: typeof d.title === 'string' ? d.title : '', questions: d.questions };
  q = 0;
  buildRail();
  enterStandby();
}
$('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  const err = $('fileError');
  err.textContent = '';
  if (!f) return;
  e.target.value = '';  // 同じファイルを再選択できるように
  if (f.size > 2 * 1024 * 1024) { err.textContent = 'ファイルが大きすぎます（2MBまで）。'; return; }
  if (!/\.json$/i.test(f.name)) { err.textContent = '.json ファイルを選んでください。'; return; }
  const rd = new FileReader();
  rd.onload = () => {
    let d;
    try { d = JSON.parse(rd.result); } catch (ex) { err.textContent = 'JSONとして読み込めませんでした。書式を確認してください。'; return; }
    const m = validate(d);
    if (m) { err.textContent = m; return; }
    setQuiz(d);
    $('announce').textContent = `問題ファイルを読み込みました。全${d.questions.length}問。`;
  };
  rd.onerror = () => { err.textContent = 'ファイルを読み込めませんでした。'; };
  rd.readAsText(f);
});

// ---------- イベント ----------
// ボタンは1回で正解発表まで進む（キー操作は 文字送り完了 → 正解 の2段階）
$('nextBtn').addEventListener('click', () => { if (ph === 'question' && typing && !busy) completeTyping(); advance(); });
$('backBtn').addEventListener('click', back);
$('question').addEventListener('click', () => { if (typing) completeTyping(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, a') || e.ctrlKey || e.metaKey || e.altKey) return;
  const onBtn = e.target.closest('button'); // ボタン上の Space/Enter はクリックとして処理される
  if (busy && ['ArrowRight', 'ArrowLeft', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); return; }
  if (e.key === 'ArrowRight' || ((e.key === ' ' || e.key === 'Enter') && !onBtn)) { e.preventDefault(); advance(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
});
window.addEventListener('resize', resize);

const muteBtn = $('muteBtn');
function updateMute() {
  muteBtn.querySelector('.i-on').hidden = muted;
  muteBtn.querySelector('.i-off').hidden = !muted;
  muteBtn.setAttribute('aria-pressed', muted);
  muteBtn.setAttribute('aria-label', muted ? '効果音のミュートを解除する' : '効果音をミュートする');
}
muteBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('quiz-muted', muted ? '1' : '0'); } catch (e) { /* 無視 */ }
  audio();
  updateMute();
});
const fsBtn = $('fsBtn');
if (!document.fullscreenEnabled) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
  fsBtn.setAttribute('aria-label', document.fullscreenElement ? '全画面表示を終了する' : '全画面表示に切り替える');
});

resize();
updateMute();
const bad = validate(window.QUIZ);
if (bad) {
  quiz = { title: '', questions: [{ question: '', answer: '' }] };
  buildRail(); enterStandby(); $('fileError').textContent = 'questions.js: ' + bad;
} else setQuiz(window.QUIZ);

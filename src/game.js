import { rememberPosition } from './render-motion.js';
export function createGame(view) {

/* ================= BALANCE（調整用の数値はここに集約） ================= */
const B = {
  // 物理（1フレーム=1/60秒、単位はpx）
  gravity: 0.2, fallGravity: 0.26, apexGravity: 0.1, apexSpeed: 1.2, gravityRelease: 0.32, maxFall: 5.8,
  runBase: 1.25, runPerLv: 0.22, dashMul: 1.55,
  accelGround: 0.16, accelAir: 0.08, airPerLv: 0.055, friction: 0.2,
  jumpBase: 4.4, jumpPerLv: 0.36, extraJumpV: 4.2,
  coyote: 6, jumpBuffer: 7, floatFall: 1.1,
  // 射撃
  atkBase: 1.0, atkPerLv: 0.2,
  shotCdBase: 20, shotCdPerLv: 4,
  shotSpeed: 4.6, shotLifeBase: 42, shotLifePerLv: 18,
  twoWayVy: 1.3, pierceByLv: [1, 2, 3, 99],
  // 踏みつけ
  stompBase: 2, stompPerLv: 1, bounceBase: 3.4, bouncePerLv: 0.57, bounceHold: 1.3, shockRadius: 46,
  // ハート（HPは半ハート単位）
  heartsBase: 4, iframeBase: 70, iframePerLv: 30, knockVx: 2.6, knockVy: 3.2,
  dmgContact: 1, dmgSpike: 1, dmgFall: 2,
  // コイン
  magnetRadius: [0, 28, 56, 96], heartDropPerLv: 0.08, luckyPerLv: 0.15,
  keepCoinsOnMiss: false,
  // 敵
  enemies: {
    s: { hp: 2, speed: 0.34, coin: 2 },  // スライム
    b: { hp: 5, speed: 0.25, coin: 3 },  // ブルーブロブ
    f: { hp: 2, speed: 0.45, coin: 2 },  // リーフバグ（飛行）
    k: { hp: 3, speed: 0.3,  coin: 3 },  // トゲスライム（踏めない）
    K: { hp: 30, coin: 25 },             // キングスライム
  },
  enemyHpPerStage: 0.15, bossHpPerBoss: 10,
  // ステージ
  chunksBase: 9, chunksPerStage: 2, chunksMax: 24, bossEvery: 3, toughChancePerStage: 0.12,
};

/* ================= スキル定義 ================= */
const CATS = [
  { id: 'atk', name: '攻撃',   color: 'var(--atk)', lx: 0, ly: -3, icon: '<path d="M19 3l2 2-9.5 9.5-2-2zM8.5 13.5l2 2-2.5 2.5 1 1-1.5 1.5-1-1L4 22l-2-2 2.5-2.5-1-1L5 15l1 1z" fill="currentColor"/>' },
  { id: 'mov', name: '移動',   color: 'var(--mov)', lx: -3, ly: -1, icon: '<path d="M8 2h6v9l6 3c1.5.8 2 2 2 3v3H4c-1 0-2-1-2-2v-3l6-2z" fill="currentColor"/>' },
  { id: 'jmp', name: 'ジャンプ', color: 'var(--jmp)', lx: 3, ly: -1, icon: '<path d="M12 2l9 10h-5v10H8V12H3z" fill="currentColor"/>' },
  { id: 'def', name: '防御',   color: 'var(--def)', lx: 1, ly: 3, icon: '<path d="M12 2l9 3v6c0 6-4 10-9 11-5-1-9-5-9-11V5z" fill="currentColor"/>' },
];
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const SKILLS = [
  { id: 'atk', cat: 'atk', name: '攻撃力アップ', g: '力', max: 5, cost: [5, 10, 16, 24, 34], x: 0, y: -1, req: [],
    desc: '弾の威力が上がり、敵をより早く倒せる', stat: ['攻撃力', l => f1(B.atkBase + B.atkPerLv * l)] },
  { id: 'rate', cat: 'atk', name: '連射', g: '連', max: 3, cost: [8, 14, 24], x: -1, y: -2, req: [['atk', 1]],
    desc: '弾を撃つ間隔が短くなる', stat: ['発射間隔', l => (B.shotCdBase - B.shotCdPerLv * l) + 'f'] },
  { id: 'twoway', cat: 'atk', name: '2WAYショット', g: '2', max: 1, cost: [20], x: 0, y: -2, req: [['atk', 1]],
    desc: '同じ攻撃ボタンで、上下に2発の弾を撃つ', stat: ['同時発射', l => (l ? 2 : 1) + '発'] },
  { id: 'pierce', cat: 'atk', name: '貫通ショット', g: '貫', max: 3, cost: [15, 24, 38], x: 1, y: -2, req: [['atk', 2]],
    desc: '弾が敵を貫通して複数にダメージを与える', stat: ['貫通', l => { const v = B.pierceByLv[l]; return v > 9 ? '無限' : v + '体'; }] },
  { id: 'range', cat: 'atk', name: '射程延長', g: '遠', max: 2, cost: [6, 12], x: -1, y: -3, req: [['rate', 1]],
    desc: '弾が遠くまで届く', stat: ['射程', l => Math.round((B.shotLifeBase + B.shotLifePerLv * l) * B.shotSpeed / 16) + 'マス'] },

  { id: 'spd', cat: 'mov', name: '移動速度', g: '速', max: 3, cost: [6, 12, 20], x: -1, y: 0, req: [],
    desc: '走る速さが上がる', stat: ['速度', l => f1(B.runBase + B.runPerLv * l)] },
  { id: 'air', cat: 'mov', name: '空中制御', g: '翼', max: 2, cost: [5, 10], x: -2, y: 0, req: [['spd', 1]],
    desc: '空中で向きを変えやすくなる', stat: ['空中加速', l => f1((B.accelAir + B.airPerLv * l) * 10)] },
  { id: 'firm', cat: 'mov', name: 'ふんばり', g: '岩', max: 1, cost: [12], x: -2, y: -1, req: [['spd', 1]],
    desc: 'ダメージを受けても吹き飛ばされない', stat: ['ノックバック', l => l ? 'なし' : 'あり'] },

  { id: 'jmp', cat: 'jmp', name: 'ジャンプ力', g: '跳', max: 3, cost: [6, 12, 20], x: 1, y: 0, req: [],
    desc: 'より高く跳べる', stat: ['最高到達', l => f1(Math.pow(B.jumpBase + B.jumpPerLv * l, 2) / (2 * B.gravity) / 16) + 'マス'] },
  { id: 'stomp', cat: 'jmp', name: '踏みつけ強化', g: '踏', max: 3, cost: [8, 14, 24], x: 2, y: 0, req: [['jmp', 1]],
    desc: '踏みつけの威力が上がり、より高く跳ねられる', stat: ['踏みつけ', l => String(B.stompBase + B.stompPerLv * l)] },
  { id: 'dbl', cat: 'jmp', name: '二段ジャンプ', g: '二', max: 2, cost: [20, 45], x: 2, y: 1, req: [['jmp', 1]],
    desc: '空中でもう一度ジャンプできる。Lv2で三段', stat: ['空中ジャンプ', l => l + '回'] },
  { id: 'shock', cat: 'jmp', name: '衝撃波', g: '震', max: 1, cost: [22], x: 3, y: 0, req: [['stomp', 2]],
    desc: '踏みつけた瞬間、周りの敵にもダメージ', stat: ['範囲ダメージ', l => l ? 'あり' : 'なし'] },
  { id: 'float', cat: 'jmp', name: 'ふんわり落下', g: '羽', max: 1, cost: [14], x: 3, y: 1, req: [['dbl', 1]],
    desc: '落下中にジャンプを押し続けるとゆっくり落ちる', stat: ['滑空', l => l ? 'あり' : 'なし'] },

  { id: 'heart', cat: 'def', name: '最大ハート', g: '♥', max: 3, cost: [10, 20, 32], x: 0, y: 1, req: [],
    desc: 'ハートの最大数が1つ増える', stat: ['ハート', l => String(B.heartsBase + l)] },
  { id: 'inv', cat: 'def', name: '無敵時間延長', g: '盾', max: 2, cost: [8, 16], x: 0, y: 2, req: [['heart', 1]],
    desc: 'ダメージ後の無敵時間が伸びる', stat: ['無敵', l => f1((B.iframeBase + B.iframePerLv * l) / 60) + '秒'] },
  { id: 'spike', cat: 'def', name: 'トゲ無効', g: '棘', max: 1, cost: [15], x: 1, y: 2, req: [['heart', 1]],
    desc: '床のトゲでダメージを受けない', stat: ['トゲ', l => l ? '無効' : '有効'] },
  { id: 'hdrop', cat: 'def', name: 'ハートドロップ', g: '癒', max: 2, cost: [10, 18], x: 0, y: 3, req: [['inv', 1]],
    desc: '倒した敵がときどきハートを落とす', stat: ['確率', l => Math.round(B.heartDropPerLv * l * 100) + '%'] },

  { id: 'mag', cat: 'mov', name: 'コイン磁石', g: '磁', max: 3, cost: [5, 10, 18], x: -3, y: 0, req: [['air', 1]],
    desc: '近くのコインを吸い寄せる', stat: ['吸引範囲', l => f1(B.magnetRadius[l] / 16) + 'マス'] },
  { id: 'greed', cat: 'atk', name: '荒稼ぎ', g: '金', max: 3, cost: [8, 15, 25], x: 1, y: -3, req: [['pierce', 1]],
    desc: '敵が落とすコインが増える', stat: ['ドロップ', l => '+' + l] },
  { id: 'lucky', cat: 'mov', name: '幸運', g: '運', max: 2, cost: [12, 22], x: -3, y: 1, req: [['mag', 1]],
    desc: 'ステージのコインがときどき2枚分になる', stat: ['確率', l => Math.round(B.luckyPerLv * l * 100) + '%'] },
];
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));

/* ================= セーブ ================= */
const SAVE_KEY = 'skyruins-v1';
const fresh = () => ({ stage: 1, coins: 0, skills: {} });
let save = fresh();
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.stage) return s; } catch (e) {} return null; }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const lv = id => save.skills[id] || 0;

let ST;
function calcStats() {
  ST = {
    run: B.runBase + B.runPerLv * lv('spd'), airAcc: B.accelAir + B.airPerLv * lv('air'), firm: lv('firm') > 0,
    jump: B.jumpBase + B.jumpPerLv * lv('jmp'), extraJumps: lv('dbl'), float: lv('float') > 0,
    stomp: B.stompBase + B.stompPerLv * lv('stomp'), bounce: B.bounceBase + B.bouncePerLv * lv('stomp'), shock: lv('shock') > 0,
    atk: B.atkBase + B.atkPerLv * lv('atk'), cd: B.shotCdBase - B.shotCdPerLv * lv('rate'),
    life: B.shotLifeBase + B.shotLifePerLv * lv('range'), twoWay: lv('twoway') > 0, pierce: B.pierceByLv[lv('pierce')],
    hearts: B.heartsBase + lv('heart'), iframe: B.iframeBase + B.iframePerLv * lv('inv'), spikeImmune: lv('spike') > 0,
    heartDrop: B.heartDropPerLv * lv('hdrop'), magnet: B.magnetRadius[lv('mag')], greed: lv('greed'), lucky: B.luckyPerLv * lv('lucky'),
  };
}

/* ================= 定数・描画準備 ================= */
const T = 16, VW = 480, VH = 272, ROWS = 17;
const TAU = Math.PI * 2;
const wrap = document.getElementById('wrap');
function fit() {
  wrap.style.setProperty('--u', Math.max(.9, Math.min(innerWidth / VW, innerHeight / VH)) + 'px');
  view.resize(innerWidth, innerHeight);
}
addEventListener('resize', fit); fit();

/* ================= 入力 ================= */
const K = { left: false, right: false, jump: false, shoot: false, dash: false };
let jumpEdge = false;
let padPrevious = {}, padHeld = false, activePad = null;
function rumble(strong, weak, duration) {
  try { activePad?.vibrationActuator?.playEffect?.('dual-rumble', { duration, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) {}
}
function pollGamepad() {
  const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected);
  activePad = pad || null;
  const pressed = n => Boolean(pad?.buttons[n]?.pressed);
  const now = { left: pressed(14) || (pad?.axes[0] ?? 0) < -.35, right: pressed(15) || (pad?.axes[0] ?? 0) > .35,
    up: pressed(12) || (pad?.axes[1] ?? 0) < -.35, down: pressed(13) || (pad?.axes[1] ?? 0) > .35,
    jump: pressed(0), shoot: pressed(1), dash: pressed(2) || pressed(5) || pressed(7), start: pressed(9) };
  if (pad) {
    if (mode === 'title' && ((now.jump && !padPrevious.jump) || (now.start && !padPrevious.start))) {
      $('b-cont').style.display !== 'none' ? $('b-cont').click() : $('b-new').click();
    } else if (mode === 'tree') {
      for (const [key, code] of Object.entries({left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',jump:'KeyZ',shoot:'Enter',start:'Enter'})) {
        if (now[key] && !padPrevious[key]) treeKey({code, preventDefault(){}});
      }
    } else if (msgOpen && now.jump && !padPrevious.jump) msgAction();
    else {
      if (now.start && !padPrevious.start) togglePause();
      for (const k of ['left','right','jump','shoot','dash']) if (now[k] !== padPrevious[k]) setKey(k, now[k]);
    }
    padHeld = true;
  } else if (padHeld) { for (const k in K) setKey(k, false); padHeld = false; }
  padPrevious = now;
}

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyK: 'jump',
  KeyZ: 'shoot', KeyX: 'shoot', KeyJ: 'shoot', ShiftLeft: 'dash', ShiftRight: 'dash',
};
function setKey(k, v) { if (k === 'jump' && v && !K.jump) jumpEdge = true; K[k] = v; }
addEventListener('keydown', e => {
  if (mode === 'tree') { treeKey(e); return; }
  if (e.code === 'KeyM') { muted = !muted; return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (msgOpen && (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); msgAction(); return; }
  const k = KEYMAP[e.code];
  if (k) { e.preventDefault(); if (!e.repeat) setKey(k, true); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) setKey(k, false); });
addEventListener('blur', () => { for (const k in K) K[k] = false; if (mode === 'play') togglePause(); });
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); setKey(k, true); b.classList.add('on'); ensureAudio(); };
  const off = e => { e.preventDefault(); setKey(k, false); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
});

/* ================= 音 ================= */
let actx = null, muted = false;
function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
const SFX = {
  jump: [['square', 330, 660, 0.09, 0.04]], djump: [['square', 500, 900, 0.09, 0.04]],
  shoot: [['square', 1100, 500, 0.05, 0.025]],
  coin: [['square', 988, 988, 0.05, 0.035], ['square', 1319, 1319, 0.14, 0.035, 0.05]],
  hit: [['square', 220, 120, 0.06, 0.04]], stomp: [['square', 260, 720, 0.1, 0.05]],
  kill: [['triangle', 700, 120, 0.18, 0.08]], hurt: [['sawtooth', 320, 80, 0.3, 0.06]],
  heart: [['triangle', 660, 660, 0.08, 0.06], ['triangle', 880, 880, 0.12, 0.06, 0.08]],
  buy: [['square', 523, 523, 0.07, 0.04], ['square', 784, 784, 0.07, 0.04, 0.07], ['square', 1047, 1047, 0.15, 0.04, 0.14]],
  clear: [['square', 523, 523, 0.1, 0.04], ['square', 659, 659, 0.1, 0.04, 0.1], ['square', 784, 784, 0.1, 0.04, 0.2], ['square', 1047, 1047, 0.35, 0.04, 0.3]],
  miss: [['triangle', 500, 120, 0.7, 0.07]], boom: [['sawtooth', 120, 40, 0.3, 0.08]], nope: [['square', 160, 140, 0.12, 0.04]],
  land: [['triangle', 180, 70, 0.09, 0.06]], step: [['triangle', 130, 80, 0.04, 0.02]],
  tick: [['square', 880, 880, 0.03, 0.02]], thud: [['sine', 90, 40, 0.14, 0.09]],
};
function sfx(name, rate = 1) {
  if (muted || !actx) return;
  const t0 = actx.currentTime;
  for (const [type, a, b, dur, vol, delay = 0] of SFX[name]) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(a * rate, t0 + delay); o.frequency.exponentialRampToValueAtTime(b * rate, t0 + delay + dur);
    g.gain.setValueAtTime(vol, t0 + delay); g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
    o.connect(g).connect(actx.destination); o.start(t0 + delay); o.stop(t0 + delay + dur + 0.02);
  }
}

/* ================= ステージ生成 ================= */
const CH = {
  start: { rows: [
    '..............', '..............', '..............', '..............', '..............', '..............',
    '..P...........', '##############', '##############'] },
  arena: { rows: [
    '..............................', '..............................', '..............................',
    '......----..........----......', '..............................', '..............................',
    '.....................K........', '##############################', '##############################'] },
  goal: { rows: [
    '................', '................', '................', '................', '................', '................',
    '........G.......', '################', '################'] },
};
const CHUNKS = [
  { min: 1, w: 3, rows: ['..........', '..........', '...oooo...', '..........', '..........', '..........', '......s...', '##########', '##########'] },
  { min: 1, w: 3, rows: ['..........', '..........', '..........', '....oo....', '..........', '..........', '..........', '####..####', '####..####'] },
  { min: 1, w: 2, rows: ['............', '............', '............', '........oo..', '............', '.......####.', '....#######.', '############', '############'] },
  { min: 1, w: 3, rows: ['..............', '..............', '..............', '......ooo.....', '..............', '.....----.....', '..............', '###........###', '###........###'] },
  { min: 1, w: 3, rows: ['............', '............', '....oooo....', '............', '....BBBB....', '............', '..s......s..', '############', '############'] },
  { min: 1, w: 2, rows: ['............', '............', '............', '......f.....', '............', '..oo....oo..', '............', '############', '############'] },
  { min: 1, w: 2, rows: ['....oooo....', '....----....', '............', '............', '............', '..BB........', '............', '############', '############'] },
  { min: 2, w: 3, rows: ['...........', '...........', '....ooo....', '...........', '...........', '...........', '...........', '####...####', '####...####'] },
  { min: 2, w: 3, rows: ['............', '............', '............', '.....oo.....', '............', '............', '....^^^.....', '############', '############'] },
  { min: 2, w: 2, rows: ['................', '................', '......f.........', '................', '.....oooooo.....', '................', '................', '###----------###', '###..........###'] },
  { min: 2, w: 2, rows: ['..............', '..............', '..............', '....oo..oo....', '..............', '..............', '...b.....k....', '##############', '##############'] },
  { min: 3, w: 2, rows: ['.............', '.............', '.............', '......oo.....', '.............', '......##.....', '......##.....', '###...##..###', '###...##..###'] },
  { min: 3, w: 2, rows: ['..........oo....', '..........--....', '................', '......BB........', '...........k....', '...BB...######..', '........######..', '################', '################'] },
  { min: 3, w: 2, rows: ['..............', '..............', '...f......f...', '..............', '..............', '..............', '....^^..^^....', '##############', '##############'] },
];
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

let L; // 現在のレベル
function buildLevel(n) {
  const rng = rngOf(n * 7919 + 13);
  const pool = CHUNKS.filter(c => c.min <= n);
  const parts = [CH.start];
  const count = Math.min(B.chunksMax, B.chunksBase + B.chunksPerStage * (n - 1));
  let last = null;
  for (let i = 0; i < count; i++) {
    let c, tries = 0;
    do {
      let tot = pool.reduce((a, c) => a + c.w, 0), r = rng() * tot;
      c = pool.find(p => (r -= p.w) < 0) || pool[0];
    } while (c === last && tries++ < 5);
    parts.push(c); last = c;
  }
  const boss = n % B.bossEvery === 0;
  if (boss) parts.push(CH.arena);
  parts.push(CH.goal);

  const grid = Array.from({ length: ROWS }, () => []);
  const spawns = [];
  let ox = 0;
  const tough = Math.min(0.6, (n - 1) * B.toughChancePerStage);
  for (const p of parts) {
    const w = Math.max(...p.rows.map(r => r.length)), h = p.rows.length;
    for (let gr = 0; gr < ROWS; gr++) {
      const r = gr - (ROWS - h);
      for (let c = 0; c < w; c++) {
        let ch = r >= 0 ? (p.rows[r][c] || '.') : '.';
        if ('sbfkKoGP'.includes(ch)) {
          if (ch === 's' && rng() < tough) ch = n >= 2 && rng() < 0.5 ? 'k' : 'b';
          spawns.push({ ch, tx: ox + c, ty: gr });
          ch = '.';
        }
        grid[gr][ox + c] = ch;
      }
    }
    ox += w;
  }
  for (let c = 0; c < 6; c++) for (let gr = 0; gr < ROWS; gr++) grid[gr][ox + c] = '#';
  ox += 6;
  return { n, grid, w: ox, spawns, boss };
}

/* ================= ワールド状態 ================= */
let mode = 'title';
let P, enemies, bullets, coinsArr, pickups, parts, texts, cam, shake, frame, goal, stageGot, stageStartCoins, modeT, bossRef;
let hitstop = 0, coinCombo = 0, comboT = 0;
// 当たった瞬間に数フレーム世界を止めて手応えを出す。長い方を優先する。
const freeze = n => { hitstop = Math.max(hitstop, n); };

function startStage(n) {
  calcStats();
  L = buildLevel(n);
  enemies = []; bullets = []; coinsArr = []; pickups = []; parts = []; texts = [];
  shake = 0; frame = 0; modeT = 0; stageGot = 0; bossRef = null; hitstop = 0; coinCombo = 0; comboT = 0;
  stageStartCoins = save.coins;
  for (const s of L.spawns) {
    const cx = s.tx * T, by = (s.ty + 1) * T;
    if (s.ch === 'P') P = mkPlayer(cx + 3, by - 14);
    else if (s.ch === 'o') coinsArr.push({ x: cx + 4, y: s.ty * T + 4, vx: 0, vy: 0, static: true, ph: s.tx * 0.7 });
    else if (s.ch === 'G') goal = { x: cx + 7, top: by - 8 * T, bottom: by, flagY: by - 8 * T + 4 };
    else enemies.push(mkEnemy(s.ch, cx, by, n));
  }
  cam = Math.max(0, P.x - VW * 0.4);
  document.getElementById('stagelabel').textContent = `STAGE ${n}${L.boss ? ' ・ BOSS' : ''}`;
  hudDirty = true;
  mode = 'play';
}
function mkPlayer(x, y) {
  return { x, y, w: 10, h: 14, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, buffer: 0, jumpsUsed: 0, cd: 0,
    inv: 0, knock: 0, hp: ST.hearts * 2, anim: 0, safe: { x, y }, prevY: y, bouncing: false };
}
const EDEF = {
  s: { w: 12, h: 9, ox: -1, oy: -2 }, b: { w: 12, h: 9, ox: -1, oy: -2 }, k: { w: 12, h: 10, ox: -1, oy: -3 },
  f: { w: 12, h: 8, ox: -1, oy: -1 }, K: { w: 38, h: 28, ox: -2, oy: -5 },
};
function mkEnemy(type, x, bottom, n) {
  const d = EDEF[type], cfg = B.enemies[type];
  let hp = type === 'K' ? cfg.hp + B.bossHpPerBoss * (Math.floor(n / B.bossEvery) - 1)
                        : Math.round(cfg.hp * (1 + B.enemyHpPerStage * (n - 1)) * 10) / 10;
  const e = { type, x: x + (T - d.w) / 2, y: bottom - d.h, w: d.w, h: d.h, vx: 0, vy: 0, dir: -1, hp, maxHp: hp,
    flash: 0, bar: 0, active: false, dead: false, t: Math.floor(Math.random() * 100), onGround: false, homeX: x, homeY: bottom - d.h - 8 };
  if (type === 'f') e.y = e.homeY;
  if (type === 'K') bossRef = e;
  return e;
}

/* ================= 物理 ================= */
const tileAt = (tx, ty) => (ty < 0 || ty >= ROWS) ? '.' : (tx < 0 ? '#' : (L.grid[ty][tx] || '.'));
const solid = (tx, ty) => { const c = tileAt(tx, ty); return c === '#' || c === 'B'; };
const oneway = (tx, ty) => tileAt(tx, ty) === '-';
function moveX(o, dx) {
  o.x += dx;
  const t0 = Math.floor(o.y / T), t1 = Math.floor((o.y + o.h - 0.01) / T);
  if (dx > 0) {
    const tx = Math.floor((o.x + o.w - 0.01) / T);
    for (let ty = t0; ty <= t1; ty++) if (solid(tx, ty)) { o.x = tx * T - o.w; return true; }
  } else if (dx < 0) {
    const tx = Math.floor(o.x / T);
    for (let ty = t0; ty <= t1; ty++) if (solid(tx, ty)) { o.x = (tx + 1) * T; return true; }
  }
  return false;
}
function moveY(o, dy) {
  const prevBottom = o.y + o.h;
  o.y += dy; o.onGround = false;
  const c0 = Math.floor(o.x / T), c1 = Math.floor((o.x + o.w - 0.01) / T);
  if (dy > 0) {
    const ty = Math.floor((o.y + o.h - 0.01) / T);
    for (let tx = c0; tx <= c1; tx++) {
      if (solid(tx, ty) || (oneway(tx, ty) && prevBottom <= ty * T + 0.01)) { o.y = ty * T - o.h; o.vy = 0; o.onGround = true; return 1; }
    }
  } else if (dy < 0) {
    const ty = Math.floor(o.y / T);
    for (let tx = c0; tx <= c1; tx++) if (solid(tx, ty)) { o.y = (ty + 1) * T; o.vy = 0; return -1; }
  }
  return 0;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ================= 演出 ================= */
function burst(x, y, n, colors, spd = 2, grav = 0.12, life = 30) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = Math.random() * spd;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, c: colors[i % colors.length], g: grav, s: Math.random() < 0.5 ? 1 : 2 });
  }
}
function floatText(x, y, txt, c = '#fff') { texts.push({ x, y, txt, c, life: 40 }); }

/* ================= 更新 ================= */
function update() {
  if (hitstop > 0) { hitstop--; return; }
  if (comboT > 0 && --comboT === 0) coinCombo = 0;
  if (P) rememberPosition(P);
  for (const entities of [enemies, bullets, coinsArr, pickups, parts, texts]) for (const entity of entities) rememberPosition(entity);
  frame++;
  if (mode === 'play') updatePlayer();
  else if (mode === 'dying') { modeT++; P.vy = Math.min(P.vy + 0.3, 7); P.y += P.vy; if (modeT > 80) gameOver(); }
  else if (mode === 'clearing') {
    modeT++;
    goal.flagY = Math.min(goal.bottom - 20, goal.flagY + 2.5);
    if (modeT % 12 === 0) burst(goal.x + (Math.random() - 0.5) * 48, goal.bottom-35-Math.random()*20, 12, ['#ffd166', '#7bdcff', '#fff'], 1.2, 0.025, 50);
    if (modeT > 100) openTree(true);
  }
  if (mode === 'play' || mode === 'dying' || mode === 'clearing') {
    updateEnemies(); updateBullets(); updateCoins(); updateFx();
    const target = Math.max(0, Math.min(L.w * T - VW, P.x + P.w / 2 - VW * 0.4 + P.face * 20));
    cam += (target - cam) * 0.12;
  }
  jumpEdge = false;
}

function updatePlayer() {
  const p = P;
  p.prevY = p.y;
  const dir = (K.right ? 1 : 0) - (K.left ? 1 : 0);
  if (p.knock > 0) p.knock--;
  else {
    // 逆方向への切り返しは減速を強めてキビキビさせ、ブレーキ時に砂煙と足音を出す。
    const turning = dir && p.vx * dir < -0.4;
    const acc = (p.onGround ? B.accelGround : ST.airAcc) * (turning && p.onGround ? 2 : 1);
    if (turning && p.onGround && frame % 4 === 0) {
      burst(p.x + p.w / 2 - dir * 3, p.y + p.h, 2, ['#e8dcc0', '#cbb994'], 0.9, 0.01, 12);
      if (!p.skid) sfx('step', 1.4);
    }
    p.skid = Boolean(turning && p.onGround);
    const v0 = p.vx;
    if (dir) { p.vx += dir * acc; p.face = dir; }
    else if (p.onGround) p.vx = Math.abs(p.vx) <= B.friction ? 0 : p.vx - Math.sign(p.vx) * B.friction;
    else p.vx *= 0.97;
    const maxRun = ST.run * (K.dash ? B.dashMul : 1);
    // ダッシュで出した速度は、空中では保ち、地上ではダッシュ解除後に摩擦ぶんずつ通常速度へ戻る。
    const limit = Math.max(maxRun, Math.abs(v0) - (p.onGround ? B.friction : 0));
    p.vx = Math.max(-limit, Math.min(limit, p.vx));
  }
  // 足音と足元の砂煙。歩幅は移動距離に比例させる。
  if (p.onGround && Math.abs(p.vx) > 0.5) {
    p.stepD = (p.stepD || 0) + Math.abs(p.vx);
    if (p.stepD >= 15) {
      p.stepD = 0; sfx('step', 0.9 + Math.random() * 0.25);
      burst(p.x + p.w / 2 - p.face * 3, p.y + p.h, 1, ['#e8dcc0'], 0.5, 0.01, 10);
    }
  } else if (!p.onGround) p.stepD = 8;
  if (p.land > 0) p.land--;
  // ジャンプ
  if (jumpEdge) p.buffer = B.jumpBuffer;
  if (p.buffer > 0) {
    p.buffer--;
    if (p.onGround || p.coyote > 0) {
      p.vy = -ST.jump; p.coyote = 0; p.buffer = 0; p.jumpsUsed = 0; p.onGround = false; p.bouncing = false; sfx('jump');
      burst(p.x + p.w / 2, p.y + p.h, 4, ['#e8dcc0', '#cbb994'], 1, 0.02, 14);
    } else if (p.jumpsUsed < ST.extraJumps) {
      p.vy = -B.extraJumpV; p.jumpsUsed++; p.buffer = 0; p.bouncing = false; sfx('djump');
      burst(p.x + p.w / 2, p.y + p.h, 8, ['#ffffff', '#bfe3ff'], 1.4, 0, 16);
    }
  }
  // 押し続けると頂点でふんわり滞空。離すと小ジャンプになる。
  let g = p.vy < 0 ? B.gravity : B.fallGravity;
  if (!p.onGround && K.jump && !p.bouncing && Math.abs(p.vy) < B.apexSpeed) g = B.apexGravity;
  if (p.vy < 0 && !K.jump && !p.bouncing) g = B.gravity + B.gravityRelease;
  p.vy += g;
  const maxF = (ST.float && K.jump && p.vy > 0) ? B.floatFall : B.maxFall;
  if (p.vy > maxF) p.vy = maxF;
  if (p.vy >= 0) p.bouncing = false;

  if (moveX(p, p.vx)) p.vx = 0;
  // 頭上のブロックの角に数px引っかかった場合は横へずらして通す（コーナーコレクション）。
  if (p.vy < 0) {
    const ty = Math.floor((p.y + p.vy) / T), c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 0.01) / T);
    if (c0 !== c1) {
      if (solid(c0, ty) && !solid(c1, ty) && (c0 + 1) * T - p.x <= 4) moveX(p, (c0 + 1) * T - p.x + 0.01);
      else if (solid(c1, ty) && !solid(c0, ty) && p.x + p.w - c1 * T <= 4) moveX(p, -(p.x + p.w - c1 * T) - 0.01);
    }
  }
  const wasGround = p.onGround, fallV = p.vy;
  const hitY = moveY(p, p.vy);
  if (p.onGround) {
    p.coyote = B.coyote; p.jumpsUsed = 0;
    if (!wasGround) {
      const amp = Math.max(0, Math.min(1, (fallV - 1.2) / 4.2));
      p.land = 8; p.landAmp = 0.25 + amp * 0.75;
      burst(p.x + p.w / 2, p.y + p.h, 3 + Math.round(amp * 9), ['#e8dcc0', '#cbb994'], 0.8 + amp * 1.2, 0.02, 12 + amp * 8);
      if (fallV > 1.2) sfx('land', 1.3 - amp * 0.5);
    }
    const by = Math.floor((p.y + p.h + 1) / T);
    const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w) / T);
    if (solid(l - 1, by) && solid(l, by) && solid(r, by) && solid(r + 1, by)) p.safe = { x: p.x, y: p.y };
  } else if (p.coyote > 0) p.coyote--;
  if (hitY === -1) burst(p.x + p.w / 2, p.y, 3, ['#cfd5de'], 1, 0.1, 10);
  p.x = Math.max(0, p.x);

  // 射撃
  if (p.cd > 0) p.cd--;
  if (K.shoot && p.cd <= 0) {
    p.cd = ST.cd;
    const bx = p.face > 0 ? p.x + p.w + 1 : p.x - 7, by = p.y + 8;
    const mk = vy => bullets.push({ x: bx, y: by, w: 6, h: 4, vx: p.face * B.shotSpeed, vy, life: ST.life, pierce: ST.pierce, hit: new Set() });
    if (ST.twoWay) { mk(-B.twoWayVy); mk(B.twoWayVy); } else mk(0);
    // 発射の閃光。連射でも同じ音にならないよう音程を揺らす。
    burst(bx + (p.face > 0 ? 0 : 6), by + 2, 4, ['#bfe3ff', '#ffffff'], 1.4, 0, 8);
    sfx('shoot', 0.92 + Math.random() * 0.2);
  }

  // トゲ
  if (p.inv <= 0 && !ST.spikeImmune) {
    const hb = { x: p.x + 1, y: p.y, w: p.w - 2, h: p.h };
    for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h) / T); ty++)
      for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w) / T); tx++)
        if (tileAt(tx, ty) === '^' && overlap(hb, { x: tx * T + 1, y: ty * T + 9, w: 14, h: 7 })) { hurt(B.dmgSpike, Math.sign(p.vx) || p.face); p.vy = -4.5; }
  }

  // 落下
  if (p.y > VH + 24) {
    hurt(B.dmgFall, 0, true);
    if (mode === 'play') { p.x = p.safe.x; p.y = p.safe.y; p.vx = p.vy = 0; cam = Math.max(0, p.x - VW * 0.4); }
  }
  if (p.inv > 0) p.inv--;

  // ゴール
  if (goal && p.x + p.w > goal.x - 2 && p.x < goal.x + 4) {
    if (bossRef && !bossRef.dead) { if (frame % 40 === 0) floatText(goal.x, goal.top + 10, 'ボスを倒せ！', '#ffd166'); }
    else clearStage();
  }

  p.anim += Math.abs(p.vx) * 0.12;
}

function hurt(dmg, dir, noKnock) {
  const p = P;
  if (p.inv > 0 && !noKnock) return;
  p.hp -= dmg; p.inv = ST.iframe; shake = 6; sfx('hurt'); hudDirty = true;
  freeze(p.hp <= 0 ? 9 : 5); rumble(0.9, 0.6, 200);
  const h = document.getElementById('hearts'); h.classList.remove('ouch'); void h.offsetWidth; h.classList.add('ouch');
  if (!noKnock && !ST.firm) { p.vx = -dir * B.knockVx || -p.face * B.knockVx; p.vy = -B.knockVy; p.knock = 14; }
  if (p.hp <= 0) { p.hp = 0; mode = 'dying'; modeT = 0; p.vy = -6; sfx('miss'); }
}

function damageEnemy(e, d, fromX) {
  if (e.dead) return;
  e.hp = Math.round((e.hp - d) * 10) / 10; e.flash = 6; e.bar = 150;
  floatText(e.x + e.w / 2, e.y - 4, Number.isInteger(d) ? String(d) : d.toFixed(1), '#fff');
  if (e.hp <= 0) killEnemy(e);
  else {
    sfx('hit', 0.9 + Math.random() * 0.25); freeze(2); shake = Math.max(shake, 1.2);
    if (fromX !== undefined && e.type !== 'K') e.kvx = Math.sign(e.x - fromX) * 2.6;
  }
}
function killEnemy(e) {
  e.dead = true; sfx('kill');
  const big = e.type === 'K';
  freeze(big ? 14 : 5); rumble(big ? 1 : 0.5, big ? 0.8 : 0.3, big ? 400 : 120);
  if (!big) shake = Math.max(shake, 2.5);
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const col = { s: ['#f59a2a', '#ffd99a'], b: ['#4aa8e8', '#cdeeff'], k: ['#8a5ad8', '#eceff8'], f: ['#b8d84a', '#7fcf5a'], K: ['#f59a2a', '#ffd166', '#fff'] }[e.type];
  burst(cx, cy, big ? 60 : 16, col, big ? 4 : 2.2, 0.12, 34);
  if (e.type === 'K') shake = 14;
  const n = B.enemies[e.type].coin + ST.greed;
  for (let i = 0; i < n; i++) coinsArr.push({ x: cx - 4, y: cy - 4, vx: (Math.random() - 0.5) * 3, vy: -2.5 - Math.random() * 2.5, static: false, life: 600, ph: 0, w: 8, h: 8, onGround: false });
  if (ST.heartDrop > 0 && Math.random() < ST.heartDrop) pickups.push({ x: cx - 3, y: cy - 3, w: 7, h: 6, vx: 0, vy: -3, life: 600, onGround: false });
}

function stomp(e) {
  const p = P;
  p.vy = -(ST.bounce + (K.jump ? B.bounceHold : 0)); p.bouncing = true; p.jumpsUsed = 0; p.y = e.y - p.h;
  sfx('stomp'); burst(p.x + p.w / 2, p.y + p.h, 8, ['#fff', '#ffe08a'], 1.8, 0.05, 16);
  freeze(3); shake = Math.max(shake, 3); rumble(0.4, 0.4, 100);
  if (e.type === 'K') e.squash = 12; else e.squash = 8;
  damageEnemy(e, ST.stomp);
  if (ST.shock) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    burst(cx, cy + e.h / 2, 20, ['#bfe3ff', '#ffffff'], 3, 0, 18);
    for (const o of enemies) if (o !== e && !o.dead && o.active && Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < B.shockRadius) damageEnemy(o, ST.stomp / 2, cx);
  }
}

function updateEnemies() {
  const p = P;
  for (const e of enemies) {
    if (e.dead) continue;
    if (!e.active) { if (e.x < cam + VW + 32 && e.x + e.w > cam - 32) { e.active = true; e.dir = p.x < e.x ? -1 : 1; } else continue; }
    e.t++; if (e.flash > 0) e.flash--; if (e.bar > 0) e.bar--; if (e.squash > 0) e.squash--;
    if (e.kvx) { if (moveX(e, e.kvx)) e.kvx = 0; else e.kvx *= 0.78; if (Math.abs(e.kvx) < 0.05) e.kvx = 0; }
    const cfg = B.enemies[e.type];
    if (e.type === 'f') {
      const dx = p.x - e.x, near = Math.abs(dx) < 170 && mode === 'play';
      e.x += near ? Math.sign(dx) * cfg.speed : Math.sin(e.t * 0.015) * 0.38;
      e.dir = near ? Math.sign(dx) || e.dir : (Math.cos(e.t * 0.02) > 0 ? 1 : -1);
      const ty = near ? Math.min(p.y - 6, e.homeY + 20) : e.homeY;
      e.y += ((ty + Math.sin(e.t * 0.045) * 10) - e.y) * 0.03;
    } else if (e.type === 'K') {
      const wasAir = !e.onGround;
      if (e.onGround) {
        e.vx = Math.sign(p.x - e.x) * 0.34; e.dir = Math.sign(e.vx) || e.dir;
        if (e.t % 140 === 0) { e.vy = -5.4; e.vx = Math.sign(p.x - e.x) * 1.3; }
      }
      e.vy = Math.min(e.vy + (e.vy < 0 ? B.gravity : B.fallGravity), B.maxFall);
      if (moveX(e, e.vx)) e.vx = 0;
      moveY(e, e.vy);
      if (wasAir && e.onGround && e.t > 30) {
        shake = 7; sfx('boom'); rumble(0.7, 0.3, 160); e.squash = 10; burst(e.x + e.w / 2, e.y + e.h, 14, ['#e8dcc0', '#cbb994'], 2, 0.05, 20);
        const minions = enemies.filter(o => o.type === 's' && !o.dead && Math.abs(o.x - e.x) < 200).length;
        if (minions < 3 && Math.random() < 0.5) { const m = mkEnemy('s', e.x + e.w / 2 - 8, e.y, L.n); m.active = true; m.vy = -4; m.dir = Math.random() < 0.5 ? -1 : 1; enemies.push(m); }
      }
    } else {
      e.vx = e.dir * cfg.speed;
      if (e.type === 'b' && e.onGround && e.t % 110 === 0) e.vy = -2.8;
      if (moveX(e, e.vx)) e.dir *= -1;
      e.vy = Math.min(e.vy + (e.vy < 0 ? B.gravity : B.fallGravity), B.maxFall);
      moveY(e, e.vy);
      if (e.onGround) {
        const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1, fy = Math.floor((e.y + e.h + 1) / T);
        if (!solid(Math.floor(fx / T), fy) && !oneway(Math.floor(fx / T), fy)) e.dir *= -1;
      }
    }
    if (e.y > VH + 40) { e.dead = true; continue; }
    // プレイヤーとの接触
    if (mode !== 'play') continue;
    if (overlap(p, e)) {
      const fromAbove = p.vy > 0 && p.prevY + p.h <= e.y + 6;
      if (fromAbove && e.type !== 'k') stomp(e);
      else if (fromAbove && e.type === 'k') { hurt(B.dmgContact, 0); p.vy = -5; p.bouncing = true; }
      else hurt(B.dmgContact, Math.sign(e.x + e.w / 2 - (p.x + p.w / 2)) || 1);
    }
  }
  if (frame % 120 === 0) enemies = enemies.filter(e => !e.dead || e === bossRef);
}

function updateBullets() {
  for (const b of bullets) {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (solid(Math.floor((b.x + b.w / 2) / T), Math.floor((b.y + b.h / 2) / T))) { b.life = 0; burst(b.x + b.w / 2, b.y + b.h / 2, 4, ['#bfe3ff', '#fff'], 1.2, 0, 10); continue; }
    for (const e of enemies) {
      if (e.dead || !e.active || b.hit.has(e) || !overlap(b, e)) continue;
      b.hit.add(e); damageEnemy(e, ST.atk, b.x - b.vx * 3);
      burst(b.x + b.w / 2, b.y + b.h / 2, 5, ['#bfe3ff', '#fff'], 1.5, 0, 10);
      if (--b.pierce <= 0) { b.life = 0; break; }
    }
  }
  bullets = bullets.filter(b => b.life > 0 && b.x > cam - 40 && b.x < cam + VW + 40);
}

function collect(x, y) {
  let v = 1;
  if (ST.lucky > 0 && Math.random() < ST.lucky) { v = 2; floatText(x, y - 6, 'x2', '#ffd166'); }
  save.coins += v; stageGot += v; hudDirty = true;
  sfx('coin', Math.pow(2, Math.min(coinCombo, 7) / 12)); coinCombo++; comboT = 24;
  const pill = document.getElementById('coins'); pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop');
  burst(x, y, 5, ['#fff3b0', '#f6c33a'], 1.2, 0, 12);
}
function magnetize(o) {
  if (ST.magnet <= 0 || mode !== 'play') return false;
  const dx = P.x + P.w / 2 - (o.x + 4), dy = P.y + P.h / 2 - (o.y + 4), d = Math.hypot(dx, dy);
  if (d < ST.magnet || o.pulled) { o.pulled = true; const s = Math.min(6, 2 + (o.pullT = (o.pullT || 0) + 0.25)); o.x += dx / d * s; o.y += dy / d * s; return true; }
  return false;
}
function updateCoins() {
  const pb = P && mode === 'play' ? { x: P.x - 1, y: P.y - 1, w: P.w + 2, h: P.h + 2 } : null;
  for (const c of coinsArr) {
    if (!magnetize(c) && !c.static) {
      c.vy = Math.min(c.vy + 0.25, 6); c.vx *= 0.98;
      if (moveX(c, c.vx)) c.vx *= -0.5;
      if (moveY(c, c.vy) === 1) c.vx *= 0.8;
      if (c.onGround && Math.abs(c.vx) < 0.05) c.vx = 0;
    }
    if (!c.static && --c.life <= 0) c.gone = true;
    if (pb && overlap(pb, { x: c.x, y: c.y, w: 8, h: 8 })) { c.gone = true; collect(c.x + 4, c.y + 4); }
  }
  coinsArr = coinsArr.filter(c => !c.gone && c.y < VH + 20);
  for (const h of pickups) {
    if (!magnetize(h)) { h.vy = Math.min(h.vy + 0.2, 4); moveY(h, h.vy); }
    if (--h.life <= 0) h.gone = true;
    if (pb && overlap(pb, h)) {
      h.gone = true;
      if (P.hp < ST.hearts * 2) { P.hp = Math.min(ST.hearts * 2, P.hp + 2); hudDirty = true; }
      sfx('heart'); burst(h.x + 3, h.y + 3, 8, ['#ff8a92', '#fff'], 1.4, 0, 16);
    }
  }
  pickups = pickups.filter(h => !h.gone && h.y < VH + 20);
}
function updateFx() {
  for (const q of parts) { q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= 0.97; q.life--; }
  parts = parts.filter(q => q.life > 0);
  for (const t of texts) { t.y -= 0.5; t.life--; }
  texts = texts.filter(t => t.life > 0);
  if (shake > 0) shake *= 0.85, shake < 0.3 && (shake = 0);
}

/* ================= 描画 ================= */
function draw(alpha = 1) {
  view.render({ L, P, enemies, bullets, coins: coinsArr, pickups, parts, texts, goal, frame, mode, bossRef, shake, alpha });
  document.getElementById('pause').hidden = mode !== 'pause';
  const boss = document.getElementById('boss');
  boss.hidden = !(bossRef && bossRef.active && !bossRef.dead);
  if (!boss.hidden) boss.querySelector('i').style.width = 100 * Math.max(0, bossRef.hp) / bossRef.maxHp + '%';
}

/* ================= HUD ================= */
let hudDirty = true;
// Bootstrap Icons heart-fill (MIT), recolored for full/half/empty HP.
function heartSVG(fill) {
  return `<svg viewBox="-1 -1 18 18" aria-hidden="true"><defs><linearGradient id="health-half"><stop offset="50%" stop-color="#ed6456"/><stop offset="50%" stop-color="#3d3533"/></linearGradient></defs><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314" fill="${fill === 2 ? '#ed6456' : fill === 1 ? 'url(#health-half)' : '#3d3533'}" stroke="#282c27" stroke-width="1.25" stroke-linejoin="round"/>${fill ? '<path d="M3 4Q4 2.7 5.3 3" fill="none" stroke="#ffe0ba" stroke-width=".9" stroke-linecap="round"/>' : ''}</svg>`;
}
function renderHUD() {
  if (!hudDirty || !P) return;
  hudDirty = false;
  let s = '';
  for (let i = 0; i < ST.hearts; i++) { const v = P.hp - i * 2; s += heartSVG(v >= 2 ? 2 : v === 1 ? 1 : 0); }
  document.getElementById('hearts').innerHTML = s;
  document.querySelector('#coins span').textContent = save.coins;
}

/* ================= 進行 ================= */
const $ = id => document.getElementById(id);
let msgOpen = false, msgAction = () => {};
function showMsg(h, p, btn, fn) {
  $('msg-h').textContent = h; $('msg-p').textContent = p; $('msg-b').textContent = btn;
  msgAction = () => { hideMsg(); fn(); };
  $('ov-msg').classList.add('show'); msgOpen = true;
}
function hideMsg() { $('ov-msg').classList.remove('show'); msgOpen = false; }
$('msg-b').onclick = () => msgAction();

function clearStage() {
  mode = 'clearing'; modeT = 0; P.vx = 0; sfx('clear');
  save.stage = L.n + 1; writeSave();
}
function gameOver() {
  mode = 'over';
  if (!B.keepCoinsOnMiss) save.coins = stageStartCoins;
  writeSave(); hudDirty = true; renderHUD();
  showMsg('ミス！', `STAGE ${L.n} をもう一度`, 'リトライ', () => startStage(L.n));
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; sfx('tick', 0.7); }
  else if (mode === 'pause') mode = 'play';
}

/* ================= スキルツリーUI ================= */
// 中央の起点から4方向（上:攻撃 左:移動 右:ジャンプ 下:防御）に伸びる1本のツリー
let selId = 'atk', treeCleared = false;
const reqMet = s => s.req.every(([id, l]) => lv(id) >= l);
function nodeState(s) { const l = lv(s.id); if (l >= s.max) return 'own max'; if (l > 0) return 'own'; return reqMet(s) ? 'avail' : 'locked'; }
const LOCK_SVG = '<svg class="lock" viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z" fill="currentColor"/></svg>';
const catOf = s => CATS.find(c => c.id === s.cat);
const SPAN = 3; // 起点から各方向に何マス伸びるか

function openTree(cleared) {
  mode = 'tree'; treeCleared = cleared;
  $('t-title').textContent = cleared ? `STAGE ${L.n} クリア！` : 'スキルツリー';
  $('t-sub').textContent = cleared ? `獲得コイン +${stageGot}` : '';
  $('ov-tree').classList.add('show');
  renderTree();
}
function closeTree() { document.activeElement?.blur(); for (const k in K) setKey(k, false); $('ov-tree').classList.remove('show'); startStage(save.stage); }
$('t-go').onclick = closeTree;
addEventListener('resize', () => { if (mode === 'tree') renderTree(); });

function renderTree(popId) {
  $('t-bank').textContent = save.coins;
  const avail = Math.min($('t-graph').parentElement.clientWidth || 600, innerHeight - 190);
  const step = Math.max(40, Math.min(80, avail / (SPAN * 2 + 1)));
  const ns = Math.round(Math.min(56, step * 0.72));
  const W = step * (SPAN * 2) + ns;
  const at = (x, y) => ({ x: (x + SPAN) * step, y: (y + SPAN) * step });
  const center = (x, y) => { const p = at(x, y); return [p.x + ns / 2, p.y + ns / 2]; };
  const ROOT = { x: 0, y: 0 };

  let lines = '';
  const line = (from, to, met, color) => {
    const [x1, y1] = center(from.x, from.y), [x2, y2] = center(to.x, to.y);
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${met ? color : '#33496d'}" stroke-width="${met ? 3 : 2}" ${met ? '' : 'stroke-dasharray="4 4"'}/>`;
  };
  for (const s of SKILLS) {
    const c = catOf(s).color;
    if (!s.req.length) line(ROOT, s, true, c);
    for (const [rid, rl] of s.req) line(SK[rid], s, lv(rid) >= rl, c);
  }
  let html = `<svg class="lines" width="${W}" height="${W}">${lines}</svg>`;
  const rp = at(0, 0);
  html += `<div class="root" style="left:${rp.x}px;top:${rp.y}px">★</div>`;
  for (const c of CATS) {
    const p = at(c.lx, c.ly), skills = SKILLS.filter(s => s.cat === c.id);
    const got = skills.reduce((a, s) => a + lv(s.id), 0), tot = skills.reduce((a, s) => a + s.max, 0);
    html += `<div class="branch" style="left:${p.x}px;top:${p.y}px;width:${ns}px;height:${ns}px;--c:${c.color}"><svg viewBox="0 0 24 24">${c.icon}</svg>${c.name}<span class="num">${got}/${tot}</span></div>`;
  }
  for (const s of SKILLS) {
    const p = at(s.x, s.y), st = nodeState(s), l = lv(s.id);
    const pips = Array.from({ length: s.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
    html += `<button class="node ${st} ${s.id === selId ? 'sel' : ''} ${s.id === popId ? 'pop' : ''}" data-id="${s.id}" style="left:${p.x}px;top:${p.y}px;--c:${catOf(s).color}">
      <span class="g">${s.g}</span><span class="pips">${pips}</span>${st === 'locked' ? LOCK_SVG : ''}</button>`;
  }
  const g = $('t-graph'); g.style.width = W + 'px'; g.style.height = W + 'px'; g.style.setProperty('--ns', ns + 'px'); g.innerHTML = html;
  g.querySelectorAll('.node').forEach(b => {
    b.onclick = () => { if (selId === b.dataset.id) buy(); else { selId = b.dataset.id; sfx('tick'); renderTree(); } };
  });
  // 詳細
  const s = SK[selId], cat = catOf(s), l = lv(s.id), isMax = l >= s.max, cost = isMax ? 0 : s.cost[l], ok = reqMet(s);
  const reqTxt = s.req.filter(([id, rl]) => lv(id) < rl).map(([id, rl]) => `${SK[id].name} Lv${rl}`).join('、');
  $('t-detail').style.setProperty('--c', cat.color);
  $('t-detail').innerHTML = `
    <div class="d-icon">${s.g}</div>
    <div><div class="d-name">${s.name}</div><div class="d-lv num"><span style="color:${cat.color}">${cat.name}</span>　Lv. ${l} / ${s.max}</div></div>
    <div class="d-desc">${s.desc}</div>
    <div class="d-stat"><span>${s.stat[0]}</span><span class="num">${s.stat[1](l)}${isMax ? '' : ` → <span class="to">${s.stat[1](l + 1)}</span>`}</span></div>
    ${!ok ? `<div class="d-req">必要: ${reqTxt}</div>` : ''}
    ${isMax ? '<div class="d-cost" style="color:var(--gold)">最大レベル</div>'
      : `<div class="d-cost ${save.coins < cost ? 'short' : ''}"><i class="coin-i"></i>必要コイン <span class="num">${cost}</span></div>
         <button class="btn primary" id="t-buy" ${(!ok || save.coins < cost) ? 'disabled' : ''}>取得する</button>`}`;
  const bb = $('t-buy'); if (bb) bb.onclick = buy;
}
function buy() {
  const s = SK[selId], l = lv(s.id);
  if (l >= s.max || !reqMet(s) || save.coins < s.cost[l]) { sfx('nope'); return; }
  save.coins -= s.cost[l]; save.skills[s.id] = l + 1; writeSave(); sfx('buy');
  renderTree(s.id);
}
function treeKey(e) {
  const cur = SK[selId];
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.code]) {
    e.preventDefault();
    const [dx, dy] = dirs[e.code];
    let best = null, bd = 1e9;
    for (const s of SKILLS) {
      if (s === cur) continue;
      const vx = s.x - cur.x, vy = s.y - cur.y;
      const along = dx ? vx * dx : vy * dy, side = dx ? Math.abs(vy) : Math.abs(vx);
      if (along <= 0) continue;
      const d = along + side * 2.2;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) { selId = best.id; sfx('tick'); renderTree(); }
  } else if (e.code === 'KeyZ' || e.code === 'Space') { e.preventDefault(); buy(); }
  else if (e.code === 'Enter') { e.preventDefault(); closeTree(); }
}

/* ================= タイトル ================= */
function beginFrom(s) {
  ensureAudio();
  document.activeElement?.blur();
  for (const k in K) setKey(k, false);
  save = s; writeSave();
  $('ov-title').classList.remove('show'); document.body.classList.remove('titling');
  startStage(save.stage);
}
$('b-new').onclick = () => beginFrom(fresh());
const existing = loadSave();
if (!existing || (existing.stage === 1 && !Object.keys(existing.skills).length)) $('b-cont').style.display = 'none';
$('b-cont').onclick = () => beginFrom(loadSave() || fresh());
document.body.classList.add('titling');
// タイトル背景用にステージ1を描いておく
calcStats(); L = buildLevel(1); P = null; cam = 0; frame = 0; enemies = []; coinsArr = []; pickups = []; bullets = []; parts = []; texts = []; goal = null;
for (const s of L.spawns) if (s.ch === 'o') coinsArr.push({ x: s.tx * T + 4, y: s.ty * T + 4, static: true, ph: s.tx * 0.7 });
addEventListener('keydown', e => { if (mode === 'title' && (e.code === 'Enter' || e.code === 'KeyZ')) $(existing && $('b-cont').style.display !== 'none' ? 'b-cont' : 'b-new').click(); });

/* ================= ループ ================= */
let acc = 0, lastT = performance.now();
function loop(now) {
  pollGamepad();
  acc += Math.min(100, now - lastT); lastT = now;
  while (acc >= 1000 / 60) {
    if (mode === 'title') { frame++; cam = (cam + 0.3) % (L.w * T - VW); }
    else if (mode !== 'pause' && mode !== 'tree' && mode !== 'over') update();
    acc -= 1000 / 60;
  }
  draw(hitstop > 0 || ['pause', 'tree', 'over'].includes(mode) ? 1 : acc / (1000 / 60)); renderHUD();
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });
requestAnimationFrame(loop);
const debug = { get P() { return P; }, get save() { return save; }, get mode() { return mode; }, get L() { return L; }, openTree, startStage, calcStats, setKey, get enemies() { return enemies; }, step(n) { for (let i = 0; i < n; i++) update(); draw(); renderHUD(); } };
  const snapshot = () => ({ mode, stage: save.stage, coins: save.coins, skills: {...save.skills},
    player: P && {x:P.x,y:P.y,vx:P.vx,vy:P.vy,onGround:P.onGround,hp:P.hp},
    shots: bullets.filter(b => b.life > 0).map(b => ({x:b.x,y:b.y,vy:b.vy,pierce:b.pierce})),
    levelWidth: L.w, activeEnemies: enemies.filter(e => !e.dead).length });
  Object.assign(debug, { snapshot, beginFrom, buy, clearStage, togglePause, gameOver, select(id) { selId = id; } });
  if (import.meta.env?.DEV) window.__skyruins = debug;
  return debug;
}

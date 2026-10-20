import * as THREE from 'three';
import { generateLevel, applyOp, HALF } from './level.js';
import {
  soldierGeometry, enemyGeometry, makeUnitMaterial, stoneTexture, woodTexture, Label, HpBar,
  makeGateFace, drawGateFace, gateText, gateIsGood, makeBoss, makeGun,
} from './models.js';
import { sfx, unlockAudio, setMuted } from './audio.js';

// ---------- tuning
const MAXV = 220;          // max visible player soldiers (count itself is unlimited)
const MAXE = 1000;         // enemy soldier instances
const MAXB = 500;          // bullets
const MAXP = 700;          // particles
const RANGE = 24;          // bullet range
const BULLET_SPEED = 48;
const RUN_SPEED = 9;
const BOSS_RUN = 2.2;
const SPACING = 0.4;
const ENEMY_HP = 2;        // damage to kill one enemy soldier (x base firepower)
const GATE_STEP = 6;       // damage to raise a gate by 1 (x base firepower)
const WALL_HALF = 0.3;
const BOSS_SCALE = 1.5;

// ---------- save data (per browser)
const SAVE_KEY = 'crowdrunner-save-v1';
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.level) {
      return { level: s.level | 0 || 1, coins: s.coins | 0, recruits: s.recruits | 0, power: s.power | 0, muted: !!s.muted, best: s.best | 0 };
    }
  } catch (e) { /* storage blocked */ }
  return { level: 1, coins: 0, recruits: 0, power: 0, muted: false, best: 0 };
}
const save = loadSave();
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
const startTroops = () => 10 + save.recruits * 3;
const startPower = () => 1 + save.power * 0.15;
const upgradeCost = (lv) => Math.round(30 * Math.pow(1.45, lv));
setMuted(save.muted);

// ---------- renderer / scene
const canvasEl = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const SKY = 0xa8d8f2;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 50, 115);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);

scene.add(new THREE.HemisphereLight(0xffffff, 0x7f8c99, 2.0));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
sun.position.set(-6, 14, 8);
scene.add(sun);

const stoneTex = stoneTexture();
const woodTex = woodTexture();

// ---------- instanced crowds, bullets, particles
const BLUE = new THREE.Color(0x2f6df6);
const RED = new THREE.Color(0xe0362c);
const playerMat = makeUnitMaterial();
const enemyMat = makeUnitMaterial();

function makeInst(geo, mat, n, color) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  if (color) { for (let i = 0; i < n; i++) m.setColorAt(i, color); m.instanceColor.needsUpdate = true; }
  m.count = 0;
  scene.add(m);
  return m;
}
const playerMesh = makeInst(soldierGeometry(), playerMat, MAXV, BLUE);
const enemyMesh = makeInst(enemyGeometry(), enemyMat, MAXE, RED);
const ringGeo = new THREE.RingGeometry(0.17, 0.25, 14).rotateX(-Math.PI / 2);
const playerRing = makeInst(ringGeo, new THREE.MeshBasicMaterial({ color: 0x2f6df6 }), MAXV);
const enemyRing = makeInst(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe0362c }), MAXE);
// tracers: a bright yellow core inside a saturated orange shell. Additive glow
// washes out on the light road, so both stay solid colors.
const bulletMesh = makeInst(new THREE.BoxGeometry(0.12, 0.12, 1.1),
  new THREE.MeshBasicMaterial({ color: 0xffea6b, toneMapped: false }), MAXB);
const bulletGlow = makeInst(new THREE.BoxGeometry(0.24, 0.24, 1.3),
  new THREE.MeshBasicMaterial({ color: 0xff4d00, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), MAXB);
bulletMesh.renderOrder = bulletGlow.renderOrder = 5;
const partMesh = makeInst(new THREE.BoxGeometry(0.16, 0.16, 0.16),
  new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP, new THREE.Color(1, 1, 1));
partMesh.count = MAXP;

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
const _e = new THREE.Euler(), _c = new THREE.Color();
const Q_ID = new THREE.Quaternion();
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
function setInst(mesh, i, x, y, z, q, s) {
  _p.set(x, y, z); _s.set(s, s, s);
  _m.compose(_p, q, _s);
  mesh.setMatrixAt(i, _m);
}

// ---------- particles
const P = {
  x: new Float32Array(MAXP), y: new Float32Array(MAXP), z: new Float32Array(MAXP),
  vx: new Float32Array(MAXP), vy: new Float32Array(MAXP), vz: new Float32Array(MAXP),
  life: new Float32Array(MAXP), max: new Float32Array(MAXP), size: new Float32Array(MAXP),
  next: 0,
};
for (let i = 0; i < MAXP; i++) partMesh.setMatrixAt(i, ZERO_M);
function burst(x, y, z, color, n = 6, speed = 4, size = 1) {
  _c.set(color);
  for (let k = 0; k < n; k++) {
    const i = P.next; P.next = (P.next + 1) % MAXP;
    P.x[i] = x; P.y[i] = y; P.z[i] = z;
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    P.vx[i] = Math.cos(a) * s; P.vz[i] = Math.sin(a) * s; P.vy[i] = 2 + Math.random() * speed;
    P.life[i] = P.max[i] = 0.5 + Math.random() * 0.5;
    P.size[i] = size * (0.6 + Math.random() * 0.8);
    partMesh.setColorAt(i, _c);
  }
  partMesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt;
    if (P.life[i] <= 0) { partMesh.setMatrixAt(i, ZERO_M); continue; }
    P.vy[i] -= 14 * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
    if (P.y[i] < 0.05) { P.y[i] = 0.05; P.vy[i] *= -0.3; P.vx[i] *= 0.7; P.vz[i] *= 0.7; }
    _e.set(P.life[i] * 6, P.life[i] * 4, 0); _q.setFromEuler(_e);
    setInst(partMesh, i, P.x[i], P.y[i], P.z[i], _q, P.size[i] * Math.min(1, P.life[i] / P.max[i] * 2));
  }
  partMesh.instanceMatrix.needsUpdate = true;
}

// ---------- DOM
const $ = (id) => document.getElementById(id);
const hud = $('hud'), menu = $('menu'), result = $('result'), popups = $('popups'), banner = $('banner');

function popup(text, x, y, z, cls) {
  _p.set(x, y, z).project(camera);
  if (_p.z > 1) return;
  const el = document.createElement('div');
  el.className = 'pop ' + (cls || '');
  el.textContent = text;
  el.style.left = ((_p.x + 1) / 2 * 100) + '%';
  el.style.top = ((1 - _p.y) / 2 * 100) + '%';
  popups.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function showBanner(text, cls) {
  banner.textContent = text;
  banner.className = 'banner show ' + (cls || '');
  setTimeout(() => { banner.className = 'banner'; }, 1400);
}

// ---------- game state
let L = null;
let levelGroup = null;
let levelDisposables = [];
let mode = 'menu';             // menu | play | over
let time = 0, shake = 0, overTimer = 0, overWin = false;
let fireAcc = 0;
const bullets = [];

const player = {
  x: 0, tx: 0, d: 0, count: 10, vis: 0, fp: 1, fpBase: 1, lane: 0,
  engaged: null, battleAcc: 0, countAtBoss: 0, startCount: 10,
};
const ox = new Float32Array(MAXV), oz = new Float32Array(MAXV), grow = new Float32Array(MAXV);
const crowdLabel = new Label(2.6, 1.3);
scene.add(crowdLabel.sprite);

let boss = null;

const crowdRadius = (n) => SPACING * Math.sqrt(n) + 0.3;

function disposeLevel() {
  if (!levelGroup) return;
  levelGroup.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && !o.isSprite) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (!m.userData.shared) m.dispose(); });
    }
  });
  levelDisposables.forEach((d) => d.dispose());
  levelDisposables = [];
  scene.remove(levelGroup);
  levelGroup = null;
}

// shared level geometry/materials
function shared(o) { o.userData.shared = true; return o; }
const G = {
  post: shared(new THREE.CylinderGeometry(0.09, 0.09, 2.0, 8)),
  merlon: shared(new THREE.BoxGeometry(0.55, 0.55, 0.7)),
  spike: shared(new THREE.ConeGeometry(0.2, 0.6, 4)),
  shadow: shared(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)),
  coin: shared(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12)),
};
const MAT = {
  post: shared(new THREE.MeshLambertMaterial({ color: 0x2d3440 })),
  stone: shared(new THREE.MeshLambertMaterial({ map: stoneTex })),
  stoneSide: shared(new THREE.MeshLambertMaterial({ color: 0xc9b994 })),
  wall: shared(new THREE.MeshLambertMaterial({ color: 0xd8ccae })),
  spike: shared(new THREE.MeshLambertMaterial({ color: 0x9ca3ad })),
  spikeBase: shared(new THREE.MeshLambertMaterial({ color: 0x3b3f46 })),
  wood: shared(new THREE.MeshLambertMaterial({ map: woodTex })),
  woodCap: shared(new THREE.MeshLambertMaterial({ color: 0xa8702f })),
  shadow: shared(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })),
  water: shared(new THREE.MeshLambertMaterial({ color: 0x2f86c4 })),
  gold: shared(new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0x553300 })),
};

function buildLevel() {
  disposeLevel();
  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  L = generateLevel(save.level, startTroops(), startPower());

  const len = L.length + 90;
  const zc = -len / 2 + 30;

  // track surface + body, water, piers
  const topTex = stoneTex.clone(); topTex.needsUpdate = true;
  topTex.repeat.set(2.5, len / 4);
  levelDisposables.push(topTex);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 1.2, len).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: topTex }));
  top.position.set(0, 0, zc); levelGroup.add(top);
  const body = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 1.2, 1.2, len), MAT.stoneSide);
  body.position.set(0, -0.61, zc); levelGroup.add(body);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, len + 300).rotateX(-Math.PI / 2), MAT.water);
  water.position.set(0, -3, zc); levelGroup.add(water);
  for (let d = -20; d < len - 30; d += 36) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - 1, 4, 3), MAT.stoneSide);
    pier.position.set(0, -2.8, -d); levelGroup.add(pier);
  }

  // parapets with crenellations on both sides
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, len), MAT.wall);
    rail.position.set(side * (HALF + 0.35), 0.3, zc); levelGroup.add(rail);
  }
  const nMer = Math.floor(len / 1.4);
  const mer = new THREE.InstancedMesh(G.merlon, MAT.wall, nMer * 2);
  for (let i = 0; i < nMer; i++) {
    for (const [k, side] of [[0, -1], [1, 1]]) {
      setInst(mer, i * 2 + k, side * (HALF + 0.35), 0.85, 30 - i * 1.4, Q_ID, 1);
    }
  }
  levelGroup.add(mer);

  // dividing walls
  for (const w of L.walls) {
    const wl = w.d1 - w.d0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(WALL_HALF * 2, 1.1, wl), MAT.wall);
    m.position.set(0, 0.55, -(w.d0 + wl / 2)); levelGroup.add(m);
  }

  // gates
  for (const g of L.gates) {
    g.done = false; g.acc = 0; g.fade = 1;
    g.cap = g.val + Math.max(10, Math.round(Math.abs(g.val) * 0.6)); // how far shooting can raise it
    const w = g.x1 - g.x0;
    const inset = (g.x0 === 0 || g.x1 === 0) && L.walls.some((wl) => g.d >= wl.d0 && g.d <= wl.d1) ? WALL_HALF : 0;
    const x0 = g.x0 + (g.x0 === 0 ? inset : 0.1), x1 = g.x1 - (g.x1 === 0 ? inset : 0.1);
    const face = makeGateFace(w);
    levelDisposables.push(face.tex);
    g.face = face;
    const panelMat = new THREE.MeshBasicMaterial({ map: face.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1.5), panelMat);
    panel.position.set((x0 + x1) / 2, 0.85, -g.d);
    levelGroup.add(panel);
    g.panel = panel;
    for (const px of [x0, x1]) {
      const post = new THREE.Mesh(G.post, MAT.post);
      post.position.set(px, 1.0, -g.d); levelGroup.add(post);
    }
    g.shownKey = '';
    redrawGate(g);
  }

  // barrels
  for (const b of L.barrels) {
    b.alive = true; b.maxHp = b.hp;
    const grp = new THREE.Group();
    grp.position.set(b.x, 0, -b.d);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, b.w, 22, 1),
      [MAT.wood, MAT.woodCap, MAT.woodCap]);
    cyl.rotation.z = Math.PI / 2; cyl.position.y = 1.0; grp.add(cyl);
    const sh = new THREE.Mesh(G.shadow, MAT.shadow);
    sh.scale.set(b.w / 2 + 0.3, 1, 1.2); sh.position.y = 0.02; grp.add(sh);
    const label = new Label(2.4, 1.2);
    label.sprite.position.set(0, 1.05, 1.1);
    grp.add(label.sprite);
    levelDisposables.push(label);
    b.label = label;
    let icon;
    if (b.reward.kind === 'gun') {
      icon = makeGun();
    } else {
      const lbl = new Label(2.0, 1.0);
      lbl.set('+' + b.reward.amount, '#2f6df6', '#ffffff');
      levelDisposables.push(lbl);
      icon = lbl.sprite;
    }
    icon.position.set(0, 2.7, 0);
    grp.add(icon);
    b.icon = icon; b.grp = grp; b.cyl = cyl;
    levelGroup.add(grp);
    b.label.set(String(Math.ceil(b.hp)), '#fff3d6', '#6b3d12');
  }

  // spikes
  for (const s of L.spikes) {
    s.done = false;
    const w = s.x1 - s.x0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.1, 1.4), MAT.spikeBase);
    base.position.set((s.x0 + s.x1) / 2, 0.05, -s.d); levelGroup.add(base);
    const n = Math.floor((w - 0.4) / 0.45);
    const inst = new THREE.InstancedMesh(G.spike, MAT.spike, n * 2);
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < 2; r++) {
        setInst(inst, i * 2 + r, s.x0 + 0.4 + i * 0.45 + r * 0.22, 0.38, -s.d + (r - 0.5) * 0.6, Q_ID, 1);
      }
    }
    levelGroup.add(inst);
  }

  // enemies
  for (const e of L.enemies) {
    e.alive = true; e.acc = 0; e.shown = e.n; e.max = e.n;
    e.label = new Label(2.2, 1.1);
    levelDisposables.push(e.label);
    levelGroup.add(e.label.sprite);
  }

  // boss + treasure
  const bm = makeBoss();
  bm.group.position.set(0, 0, -L.bossD);
  bm.group.scale.setScalar(BOSS_SCALE);
  levelGroup.add(bm.group);
  const hp = new HpBar();
  levelDisposables.push(hp);
  levelGroup.add(hp.sprite);
  boss = { ...bm, d: L.bossD, x: 0, hp: L.boss.hp, maxHp: L.boss.hp, state: 'idle', t: 0, flash: 0, bar: hp, fall: 0 };
  hp.set(boss.hp, boss.maxHp);
  const pile = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 18), MAT.gold);
  pile.position.set(0, 0.8, -(L.bossD + 12)); levelGroup.add(pile);
  for (let i = 0; i < 30; i++) {
    const c = new THREE.Mesh(G.coin, MAT.gold);
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 1.5;
    c.position.set(Math.cos(a) * r, 0.05, -(L.bossD + 12) + Math.sin(a) * r);
    c.rotation.set(Math.random() * 0.4, 0, Math.random() * 0.4);
    levelGroup.add(c);
  }

  // reset player
  player.x = player.tx = 0; player.d = 0; player.lane = 0;
  player.fp = player.fpBase = startPower();
  player.engaged = null; player.battleAcc = 0;
  player.startCount = startTroops();
  player.vis = 0;
  setCount(player.startCount, true);
  for (let i = 0; i < player.vis; i++) {
    ox[i] = 0; oz[i] = 0; grow[i] = 1;
  }
  bullets.length = 0;
  fireAcc = 0;
  updateHud();
}

function redrawGate(g) {
  const text = gateText(g);
  const good = gateIsGood(g);
  const key = text + good;
  if (key === g.shownKey) return;
  g.shownKey = key;
  drawGateFace(g.face, text, good);
}

// ---------- crowd count
function setCount(n, silent) {
  player.count = Math.max(0, Math.round(n));
  const want = Math.min(MAXV, player.count);
  while (player.vis < want) {
    const i = player.vis++;
    ox[i] = (Math.random() - 0.5) * 0.6; oz[i] = (Math.random() - 0.5) * 0.6; grow[i] = silent ? 1 : 0;
  }
  let bursts = 0;
  while (player.vis > want) {
    const i = --player.vis;
    if (!silent && bursts++ < 10) burst(player.x + ox[i], 0.4, -player.d + oz[i], 0x2f6df6, 3, 3, 0.8);
  }
  crowdLabel.set(String(player.count), '#2f6df6', '#ffffff');
}

function loseTroops(k, cls = 'bad') {
  k = Math.min(player.count, Math.max(0, Math.round(k)));
  if (k <= 0) return;
  setCount(player.count - k);
  popup('−' + k, player.x, 1.5, -player.d, cls);
  if (player.count <= 0) endRun(false);
}

// ---------- input
let dragging = false, dragX = 0, dragTx = 0;
const keys = { left: false, right: false };
canvasEl.addEventListener('pointerdown', (e) => {
  dragging = true; dragX = e.clientX; dragTx = player.tx;
  canvasEl.setPointerCapture?.(e.pointerId);
});
canvasEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const scale = 13 / Math.min(window.innerWidth, 520);
  player.tx = dragTx + (e.clientX - dragX) * scale;
  const [lo, hi] = centerBounds();
  if (player.tx < lo || player.tx > hi) {
    player.tx = Math.max(lo, Math.min(hi, player.tx));
    dragTx = player.tx; dragX = e.clientX;
  }
});
const endDrag = () => { dragging = false; };
canvasEl.addEventListener('pointerup', endDrag);
canvasEl.addEventListener('pointercancel', endDrag);
document.addEventListener('touchmove', (e) => { if (mode === 'play') e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// ---------- lanes
function activeWall(d) {
  for (const w of L.walls) if (d >= w.d0 - 1.5 && d <= w.d1 + 0.5) return w;
  return null;
}
function centerBounds() {
  if (player.lane < 0) return [-HALF + 0.5, -WALL_HALF - 0.4];
  if (player.lane > 0) return [WALL_HALF + 0.4, HALF - 0.5];
  return [-HALF + 0.5, HALF - 0.5];
}
function unitBounds(lane) {
  if (lane < 0) return [-HALF + 0.25, -WALL_HALF - 0.12];
  if (lane > 0) return [WALL_HALF + 0.12, HALF - 0.25];
  return [-HALF + 0.25, HALF - 0.25];
}

// ---------- play update
function updatePlay(dt) {
  if (keys.left) player.tx -= 11 * dt;
  if (keys.right) player.tx += 11 * dt;

  const wall = activeWall(player.d);
  if (wall) { if (player.lane === 0) player.lane = player.x < 0 ? -1 : 1; }
  else player.lane = 0;
  const [lo, hi] = centerBounds();
  player.tx = Math.max(lo, Math.min(hi, player.tx));
  player.x += (player.tx - player.x) * Math.min(1, dt * 12);
  player.x = Math.max(lo, Math.min(hi, player.x));

  let speed = player.d >= L.arenaStart ? BOSS_RUN : RUN_SPEED;
  if (player.engaged || boss.state === 'fight' || boss.state === 'dead') speed = 0;
  const prevD = player.d;
  player.d += speed * dt;
  const r = crowdRadius(player.vis);

  // gates: whichever gate the crowd center passes through applies, the rest of that row closes
  for (const g of L.gates) {
    if (g.done || !(prevD < g.d && player.d >= g.d)) continue;
    g.done = true;
    if (player.x >= g.x0 && player.x < g.x1) {
      const before = player.count;
      const after = applyOp(g.op, g.val, before);
      const diff = after - before;
      if (diff >= 0) { sfx.good(); popup('+' + diff, player.x, 1.8, -player.d, 'good'); }
      else { sfx.bad(); popup('−' + (-diff), player.x, 1.8, -player.d, 'bad'); }
      setCount(after);
      g.applied = true;
      if (player.count <= 0) { endRun(false); return; }
    }
  }

  // spikes: each soldier over the spikes has a chance to fall
  for (const s of L.spikes) {
    if (s.done || !(prevD < s.d && player.d >= s.d)) continue;
    s.done = true;
    let over = 0;
    for (let i = 0; i < player.vis; i++) {
      const ux = player.x + ox[i];
      if (ux >= s.x0 && ux <= s.x1) over++;
    }
    if (over > 0 && player.vis > 0) {
      sfx.crash();
      loseTroops(Math.ceil(player.count * (over / player.vis) * 0.4));
      if (mode !== 'play') return;
    }
  }

  // barrels: crashing into an unbroken barrel costs its remaining number
  for (const b of L.barrels) {
    if (!b.alive) continue;
    if (player.d + r * 0.6 >= b.d - 1.0 && player.d < b.d + 1.5 && Math.abs(player.x - b.x) < b.w / 2 + r * 0.4) {
      b.alive = false;
      sfx.crash(); shake = 0.4;
      burst(b.x, 1, -b.d, 0xb07a3a, 18, 6, 1.4);
      b.grp.visible = false;
      loseTroops(Math.ceil(b.hp));
      if (mode !== 'play') return;
    }
  }

  // enemies: charge when close, then melee
  for (const e of L.enemies) {
    if (!e.alive) continue;
    const dist = e.d - player.d;
    const er = crowdRadius(Math.min(e.n, 150));
    if (player.engaged !== e && dist < 20 && dist > -5) {
      e.d -= 3.5 * dt;
      const inWall = L.walls.some((w) => e.d >= w.d0 && e.d <= w.d1);
      let nx = e.x + Math.sign(player.x - e.x) * Math.min(Math.abs(player.x - e.x), 1.2 * dt);
      if (inWall) nx = e.x < 0 ? Math.min(nx, -WALL_HALF - er * 0.5) : Math.max(nx, WALL_HALF + er * 0.5);
      e.x = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, nx));
    }
    if (!player.engaged && dist < (r + er) * 0.55 + 0.5 && dist > -2 && Math.abs(e.x - player.x) < (r + er) * 0.8) {
      player.engaged = e; player.battleAcc = 0;
    }
  }
  if (player.engaged) {
    const e = player.engaged;
    const rate = Math.max(25, Math.min(e.n, player.count) * 2.4);
    player.battleAcc += rate * dt;
    let k = Math.floor(player.battleAcc);
    player.battleAcc -= k;
    k = Math.min(k, e.n, player.count);
    if (k > 0) {
      sfx.clash();
      killEnemies(e, k);
      setCount(player.count - k);
      if (Math.random() < 0.5) burst(player.x + (e.x - player.x) * 0.5, 0.5, -(player.d + (e.d - player.d) * 0.5), 0xffffff, 3, 4, 0.7);
    }
    if (player.count <= 0) { endRun(false); return; }
    if (!e.alive) player.engaged = null;
  }

  updateBoss(dt, r);
  spawnBullets(dt);
}

function killEnemies(e, k) {
  if (k <= 0 || !e.alive) return;
  const before = Math.min(e.n, 150);
  e.n = Math.max(0, e.n - k);
  const after = Math.min(e.n, 150);
  for (let i = after; i < before && i < after + 6; i++) {
    const [dx, dz] = slot(i);
    burst(e.x + dx, 0.4, -e.d - dz, 0xe0362c, 3, 3, 0.8);
  }
  if (e.n <= 0) {
    e.alive = false;
    e.label.sprite.visible = false;
    burst(e.x, 0.5, -e.d, 0xe0362c, 10, 5, 1);
  }
}

function breakBarrel(b) {
  b.alive = false;
  b.grp.visible = false;
  sfx.breakBarrel();
  burst(b.x, 1, -b.d, 0xc98f45, 22, 7, 1.5);
  burst(b.x, 1, -b.d, 0x8a8f96, 6, 6, 1);
  if (b.reward.kind === 'gun') {
    player.fp += b.reward.amount;
    sfx.power();
    popup('Firepower ×' + player.fp.toFixed(1), player.x, 2.2, -player.d, 'power');
  } else {
    setCount(player.count + b.reward.amount);
    sfx.good();
    popup('+' + b.reward.amount, player.x, 2.2, -player.d, 'good');
  }
  updateHud();
}

// ---------- boss
function updateBoss(dt, r) {
  const B = boss;
  if (B.state === 'idle' && player.d >= L.arenaStart - 8) {
    B.state = 'walk';
    player.countAtBoss = Math.max(player.count, 1);
    sfx.boss();
    showBanner('BOSS', 'boss');
  }
  if (B.state === 'walk') {
    B.d -= 2.6 * dt;
    B.x += Math.sign(player.x - B.x) * Math.min(Math.abs(player.x - B.x), 0.8 * dt);
    if (B.d - player.d < r * 0.55 + 1.2 * BOSS_SCALE) { B.state = 'fight'; B.t = 0; }
  }
  if (B.state === 'fight') {
    B.x += Math.sign(player.x - B.x) * Math.min(Math.abs(player.x - B.x), 1.5 * dt);
    const cycle = 1.5, impact = 1.05;
    const prev = B.t % cycle;
    B.t += dt;
    const ph = B.t % cycle;
    if (prev < impact && ph >= impact) {
      sfx.smash(); shake = 0.5;
      const hx = B.x, hz = -(B.d - 2.2 * BOSS_SCALE);
      burst(hx, 0.3, hz, 0xd9cbb0, 16, 7, 1.2);
      loseTroops(Math.max(2, Math.ceil(player.countAtBoss * 0.1)));
    }
  }
}

function animateBoss(dt) {
  const B = boss;
  if (!B) return;
  B.group.position.set(B.x, 0, -B.d);
  const t = time;
  let lean = 0.08;
  if (B.state === 'walk') {
    B.legL.rotation.x = Math.sin(t * 6) * 0.5;
    B.legR.rotation.x = -Math.sin(t * 6) * 0.5;
    B.armR.rotation.x = -0.5 + Math.sin(t * 6) * 0.2;
    B.armL.rotation.x = -Math.sin(t * 6) * 0.3;
    B.group.position.y = Math.abs(Math.sin(t * 6)) * 0.12;
  } else if (B.state === 'fight') {
    B.legL.rotation.x = B.legR.rotation.x = 0;
    const ph = B.t % 1.5;
    let a;
    if (ph < 0.85) a = -0.6 - (ph / 0.85) * 2.3;          // wind up overhead
    else if (ph < 1.05) a = -2.9 + ((ph - 0.85) / 0.2) * 1.7; // slam down
    else a = -1.2 + ((ph - 1.05) / 0.45) * 0.6;          // recover
    B.armR.rotation.x = a;
    lean = ph < 0.85 ? -0.12 * (ph / 0.85) : ph < 1.05 ? -0.12 + ((ph - 0.85) / 0.2) * 0.42 : 0.3 - ((ph - 1.05) / 0.45) * 0.22;
  } else if (B.state === 'idle') {
    B.armR.rotation.x = -0.5 + Math.sin(t * 2) * 0.1;
    B.group.position.y = Math.sin(t * 2) * 0.05;
  } else if (B.state === 'dead') {
    B.fall = Math.min(1, B.fall + dt * 1.6);
    B.group.rotation.x = -B.fall * Math.PI / 2;
    B.group.position.y = -B.fall * 0.5;
  }
  if (B.state !== 'dead') {
    B.upper.rotation.x += (lean - B.upper.rotation.x) * Math.min(1, dt * 12);
    B.head.rotation.y = Math.sin(t * 1.3) * 0.25;
    B.upper.scale.set(1, 1 + Math.sin(t * 2.4) * 0.015, 1);
  }
  B.flash = Math.max(0, B.flash - dt * 6);
  const f = B.flash;
  B.mats.forEach((m) => m.emissive.setRGB(f * 0.35, f * 0.25, f * 0.2));
  B.bar.sprite.position.set(B.x, 4.6 * BOSS_SCALE, -B.d);
  B.bar.sprite.visible = B.state !== 'dead';
  B.bar.set(B.hp, B.maxHp);
}

// ---------- shooting
const formationCache = [];
function slot(i) {
  let s = formationCache[i];
  if (!s) {
    const rr = SPACING * Math.sqrt(i), th = i * 2.39996;
    s = formationCache[i] = [rr * Math.cos(th), rr * Math.sin(th) * 0.85];
  }
  return s;
}

function spawnBullets(dt) {
  if (player.vis === 0) return;
  const rate = Math.min(55, 3 + player.vis * 1.6);
  const dmg = (player.count * player.fp) / rate;
  fireAcc += rate * dt;
  while (fireAcc >= 1) {
    fireAcc -= 1;
    if (bullets.length >= MAXB) { fireAcc = 0; break; }
    const i = (Math.random() * player.vis) | 0;
    // leave from the rifle muzzle (right side, ahead of the soldier)
    bullets.push({ x: player.x + ox[i] + 0.17, d: player.d - oz[i] + 0.45, life: RANGE / BULLET_SPEED, dmg });
  }
}

const targets = [];
function collectTargets() {
  targets.length = 0;
  const near = player.d - 3, far = player.d + RANGE + 4;
  for (const g of L.gates) {
    if (g.done || g.op !== '+' || g.d < near || g.d > far) continue;
    targets.push({ kind: 'gate', o: g, x0: g.x0, x1: g.x1, front: g.d - 0.15, back: g.d + 0.15 });
  }
  for (const b of L.barrels) {
    if (!b.alive || b.d < near || b.d > far) continue;
    targets.push({ kind: 'barrel', o: b, x0: b.x - b.w / 2, x1: b.x + b.w / 2, front: b.d - 1, back: b.d + 1 });
  }
  for (const e of L.enemies) {
    if (!e.alive || e.d < near - 2 || e.d > far + 2) continue;
    const er = crowdRadius(Math.min(e.n, 150));
    targets.push({ kind: 'enemy', o: e, x0: e.x - er, x1: e.x + er, front: e.d - er * 0.85, back: e.d + er * 0.85 });
  }
  if (boss && boss.state !== 'dead' && boss.d < far) {
    targets.push({ kind: 'boss', o: boss, x0: boss.x - 1.6 * BOSS_SCALE, x1: boss.x + 1.6 * BOSS_SCALE, front: boss.d - BOSS_SCALE, back: boss.d + BOSS_SCALE });
  }
}

function applyHit(t, dmg, x) {
  if (t.kind === 'gate') {
    const g = t.o;
    g.acc += dmg;
    const step = GATE_STEP * player.fpBase;
    while (g.acc >= step && g.val < g.cap) { g.acc -= step; g.val += 1; }
    redrawGate(g);
    if (Math.random() < 0.3) burst(x, 0.9, -g.d + 0.1, 0x9fdcff, 1, 2, 0.6);
  } else if (t.kind === 'barrel') {
    const b = t.o;
    b.hp -= dmg;
    b.wobble = 0.15;
    if (b.hp <= 0) breakBarrel(b);
    else b.label.set(String(Math.ceil(b.hp)), '#fff3d6', '#6b3d12');
    if (Math.random() < 0.3) burst(x, 1.0, -b.d + 1, 0xd9a35a, 1, 3, 0.6);
  } else if (t.kind === 'enemy') {
    const e = t.o;
    e.acc += dmg;
    const hp = ENEMY_HP * player.fpBase;
    const k = Math.floor(e.acc / hp);
    if (k > 0) { e.acc -= k * hp; killEnemies(e, k); }
  } else if (t.kind === 'boss') {
    const B = t.o;
    B.hp -= dmg;
    B.flash = 1;
    if (Math.random() < 0.3) burst(x, 2 + Math.random() * 3, -B.d + BOSS_SCALE, 0xffd27a, 1, 3, 0.6);
    if (B.hp <= 0 && B.state !== 'dead') {
      B.hp = 0; B.state = 'dead';
      burst(B.x, 2, -B.d, 0xe0362c, 40, 8, 1.6);
      shake = 0.6;
      endRun(true);
    }
  }
  sfx.hit();
}

function updateBullets(dt) {
  if (mode === 'play') collectTargets(); else targets.length = 0;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const d0 = b.d;
    b.d += BULLET_SPEED * dt;
    b.life -= dt;
    let hit = null, hd = Infinity;
    for (const t of targets) {
      if (b.x < t.x0 || b.x > t.x1) continue;
      if (b.d < t.front || d0 > t.back) continue;
      const at = Math.max(t.front, d0);
      if (at < hd) { hd = at; hit = t; }
    }
    if (hit && mode === 'play') applyHit(hit, b.dmg, b.x);
    if (hit || b.life <= 0) { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); }
  }
  const n = Math.min(bullets.length, MAXB);
  for (let i = 0; i < n; i++) {
    setInst(bulletMesh, i, bullets[i].x, 0.6, -bullets[i].d, Q_ID, 1);
    setInst(bulletGlow, i, bullets[i].x, 0.6, -bullets[i].d, Q_ID, 1);
  }
  bulletMesh.count = bulletGlow.count = n;
  bulletMesh.instanceMatrix.needsUpdate = bulletGlow.instanceMatrix.needsUpdate = true;
}

// ---------- crowd visuals
function updateCrowdVisual(dt) {
  const lane = player.lane;
  const [lo, hi] = unitBounds(lane);
  const vis = player.vis;
  // squeeze the formation sideways when it is wider than the space available
  const radius = SPACING * Math.sqrt(vis);
  const room = (hi - lo) / 2;
  const sx = radius > room ? room / radius : 1;
  const sz = 1 / Math.sqrt(sx);
  const running = mode === 'play' && !player.engaged && boss.state !== 'fight';
  const k = Math.min(1, dt * 8);
  for (let i = 0; i < vis; i++) {
    const [dx, dz] = slot(i);
    const tx = Math.max(lo, Math.min(hi, player.x + dx * sx)) - player.x;
    ox[i] += (tx - ox[i]) * k;
    oz[i] += (dz * sz - oz[i]) * k;
    grow[i] = Math.min(1, grow[i] + dt * 4);
    _e.set(running ? -0.12 : 0, 0, 0);
    _q.setFromEuler(_e);
    const x = player.x + ox[i], z = -player.d + oz[i];
    setInst(playerMesh, i, x, 0, z, _q, grow[i]);
    setInst(playerRing, i, x, 0.03, z, Q_ID, grow[i]);
  }
  const pu = playerMat.userData.uniforms;
  pu.uTime.value = time;
  pu.uRun.value += ((running ? 1 : 0) - pu.uRun.value) * k;
  playerMesh.count = playerRing.count = vis;
  playerMesh.instanceMatrix.needsUpdate = playerRing.instanceMatrix.needsUpdate = true;
  crowdLabel.sprite.visible = player.count > 0 && mode !== 'menu' || (mode === 'menu' && player.count > 0);
  crowdLabel.sprite.position.set(player.x, 1.5 + radius * 0.2, -player.d + 0.3);
  const ls = 1 + Math.min(0.6, radius * 0.08);
  crowdLabel.sprite.scale.set(2.6 * ls, 1.3 * ls, 1);
}

const Q_BACK = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
function updateEnemyVisual(dt) {
  let idx = 0, anyCharging = false;
  if (!L) return;
  for (const e of L.enemies) {
    if (!e.alive) continue;
    const rel = e.d - player.d;
    const show = rel > -8 && rel < 95;
    e.label.sprite.visible = show;
    if (!show) continue;
    const vis = Math.min(e.n, 150);
    const charging = mode === 'play' && rel < 20 && player.engaged !== e;
    anyCharging = anyCharging || charging;
    for (let i = 0; i < vis && idx < MAXE; i++, idx++) {
      const [dx, dz] = slot(i);
      const bob = charging ? 0 : Math.abs(Math.sin(time * 3 + i)) * 0.03;
      const x = Math.max(-HALF + 0.25, Math.min(HALF - 0.25, e.x + dx));
      const z = -e.d - dz;
      setInst(enemyMesh, idx, x, bob, z, Q_BACK, 1);
      setInst(enemyRing, idx, x, 0.03, z, Q_ID, 1);
    }
    const er = crowdRadius(vis);
    e.label.set(String(e.n), '#e0362c', '#ffffff');
    e.label.sprite.position.set(e.x, 1.4 + er * 0.2, -e.d);
  }
  const eu = enemyMat.userData.uniforms;
  eu.uTime.value = time;
  eu.uRun.value += ((anyCharging ? 1 : 0) - eu.uRun.value) * Math.min(1, dt * 8);
  enemyMesh.count = enemyRing.count = idx;
  enemyMesh.instanceMatrix.needsUpdate = enemyRing.instanceMatrix.needsUpdate = true;
}

function updateProps(dt) {
  if (!L) return;
  for (const b of L.barrels) {
    if (!b.alive) continue;
    b.icon.rotation.y += dt * 1.5;
    b.icon.position.y = 2.7 + Math.sin(time * 3) * 0.12;
    if (b.wobble > 0) { b.wobble -= dt; b.cyl.position.y = 1.0 + Math.sin(time * 60) * 0.03; }
  }
  for (const g of L.gates) {
    if (g.done && g.fade > 0) {
      g.fade = Math.max(0, g.fade - dt * (g.applied ? 2.5 : 1.2));
      g.panel.material.opacity = g.fade;
      if (g.applied) g.panel.scale.y = 1 + (1 - g.fade) * 0.4;
    }
  }
}

// ---------- camera
const camPos = new THREE.Vector3(0, 9.5, 8.5);
const camLook = new THREE.Vector3();
function updateCamera(dt, snap) {
  const cx = player.x * 0.35;
  const fight = boss && (boss.state === 'fight' || boss.state === 'walk');
  const lift = Math.min(3.5, SPACING * Math.sqrt(player.vis) * 0.45);
  const tx = cx, ty = (fight ? 11.5 : 9.5) + lift, tz = -player.d + (fight ? 11 : 8.5) + lift * 0.6;
  const k = snap ? 1 : Math.min(1, dt * 4);
  camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
  camLook.set(cx * 0.8, 0, -player.d - (fight ? 7 : 8));
  shake = Math.max(0, shake - dt);
  const s = shake * 0.5;
  camera.position.set(camPos.x + (Math.random() - 0.5) * s, camPos.y + (Math.random() - 0.5) * s, camPos.z);
  camera.lookAt(camLook);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.aspect = aspect;
  // keep roughly the same horizontal view so the track fills a portrait phone
  const hfov = 40 * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI;
  camera.fov = Math.max(45, Math.min(74, vfov));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- HUD + menus
const hudLevel = $('hud-level'), hudCoins = $('hud-coins'), hudFp = $('hud-fp'), hudProg = $('hud-progress-fill');
function updateHud() {
  hudLevel.textContent = 'Level ' + save.level;
  hudCoins.textContent = save.coins;
  hudFp.textContent = '×' + player.fp.toFixed(2).replace(/0$/, '');
  if (L) hudProg.style.width = Math.min(100, (player.d / L.bossD) * 100) + '%';
}

function renderMenu() {
  $('menu-level').textContent = 'Level ' + save.level;
  $('menu-coins').textContent = save.coins;
  const rc = upgradeCost(save.recruits), pc = upgradeCost(save.power);
  $('up-recruits-val').textContent = startTroops() + ' troops';
  $('up-recruits-cost').textContent = rc;
  $('up-recruits').disabled = save.coins < rc;
  $('up-power-val').textContent = '×' + startPower().toFixed(2) + ' damage';
  $('up-power-cost').textContent = pc;
  $('up-power').disabled = save.coins < pc;
  $('mute').textContent = save.muted ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(!save.muted));
}

$('up-recruits').addEventListener('click', () => {
  const c = upgradeCost(save.recruits);
  if (save.coins < c) return;
  save.coins -= c; save.recruits++; writeSave();
  unlockAudio(); sfx.power();
  player.startCount = startTroops(); setCount(player.startCount);
  renderMenu(); updateHud();
});
$('up-power').addEventListener('click', () => {
  const c = upgradeCost(save.power);
  if (save.coins < c) return;
  save.coins -= c; save.power++; writeSave();
  unlockAudio(); sfx.power();
  player.fp = player.fpBase = startPower();
  renderMenu(); updateHud();
});
$('mute').addEventListener('click', () => {
  save.muted = !save.muted; writeSave();
  setMuted(save.muted); unlockAudio();
  renderMenu();
});
$('play').addEventListener('click', () => {
  unlockAudio();
  menu.hidden = true;
  hud.hidden = false;
  mode = 'play';
});
$('quit').addEventListener('click', () => {
  goToMenu();
});
$('continue').addEventListener('click', () => {
  result.hidden = true;
  goToMenu();
});

function goToMenu() {
  mode = 'menu';
  buildLevel();
  updateCamera(0, true);
  renderMenu();
  menu.hidden = false;
  hud.hidden = true;
  result.hidden = true;
}

function endRun(win) {
  if (mode !== 'play') return;
  mode = 'over';
  overWin = win;
  overTimer = win ? 1.6 : 1.0;
  player.engaged = null;
  if (win) {
    sfx.win();
    const earned = 20 + save.level * 5 + Math.min(200, Math.floor(player.count / 2));
    save.coins += earned;
    save.best = Math.max(save.best, save.level);
    $('result-title').textContent = 'Victory';
    $('result-title').className = 'result-title win';
    $('result-sub').textContent = `Level ${save.level} cleared with ${player.count} troops left.`;
    $('result-coins').textContent = '+' + earned;
    $('continue').textContent = 'Next level';
    save.level++;
  } else {
    sfx.lose();
    shake = 0.3;
    $('result-title').textContent = 'Defeated';
    $('result-title').className = 'result-title lose';
    const pct = Math.min(99, Math.floor((player.d / L.bossD) * 100));
    $('result-sub').textContent = boss.state === 'fight'
      ? `The boss had ${Math.ceil(boss.hp)} health left. Pick bigger gates and break more barrels.`
      : `You made it ${pct}% of the way. Watch the numbers before you commit to a lane.`;
    $('result-coins').textContent = '+5';
    save.coins += 5;
    $('continue').textContent = 'Try again';
  }
  writeSave();
  updateHud();
}

// ---------- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (mode === 'play') updatePlay(dt);
  if (mode === 'over') {
    overTimer -= dt;
    if (overTimer <= 0 && result.hidden) { result.hidden = false; hud.hidden = true; }
  }
  updateBullets(dt);
  updateCrowdVisual(dt);
  updateEnemyVisual(dt);
  updateProps(dt);
  animateBoss(dt);
  updateParticles(dt);
  if (!window.__cr?.freeCam) updateCamera(dt);
  if (mode === 'play') updateHud();
  renderer.render(scene, camera);
}

document.addEventListener('visibilitychange', () => { last = performance.now(); });

async function boot() {
  try { await document.fonts.load('64px "Lilita One"'); } catch (e) { /* fallback font */ }
  resize();
  goToMenu();
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}
boot();

// test hook: open the page with ?debug to inspect state from the console
if (location.search.includes('debug')) {
  window.__cr = { camera, player, get L() { return L; }, get boss() { return boss; }, get mode() { return mode; } };
}

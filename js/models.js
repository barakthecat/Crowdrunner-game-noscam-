// Procedural models and canvas textures. No external assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';

function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// A little helmeted soldier, facing -z. Vertex colors get tinted per instance.
export function soldierGeometry() {
  const W = 0xffffff, S = 0xd8dde6, D = 0x4a4a50;
  const parts = [
    colored(new THREE.CylinderGeometry(0.14, 0.19, 0.4, 8).translate(0, 0.4, 0), W),
    colored(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 0.72, 0), W),
    colored(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10).translate(0, 0.78, 0), S),
    colored(new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.78, 0), S),
    colored(new THREE.BoxGeometry(0.09, 0.22, 0.1).translate(-0.07, 0.11, 0), W),
    colored(new THREE.BoxGeometry(0.09, 0.22, 0.1).translate(0.07, 0.11, 0), W),
    colored(new THREE.BoxGeometry(0.06, 0.07, 0.4).translate(0.15, 0.46, -0.15), D),
  ];
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return geo;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

export function stoneTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#e6dbc2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const v = 200 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v - 12},${v - 35},0.35)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(150,130,95,0.55)'; g.lineWidth = 3;
  for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 64 : 0;
    for (let x = off; x <= 256; x += 128) { g.beginPath(); g.moveTo(x, row * 64); g.lineTo(x, row * 64 + 64); g.stroke(); }
  }
  return tex(c, true);
}

export function woodTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#c98f45'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = x % 64 ? '#d39b52' : '#bf8540';
    g.fillRect(x, 0, 32, 256);
    g.fillStyle = 'rgba(90,50,20,0.55)'; g.fillRect(x, 0, 3, 256);
  }
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = 'rgba(120,70,30,0.25)'; g.lineWidth = 1;
    const x = Math.random() * 256;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 80, x - 6, 170, x + 3, 256); g.stroke();
  }
  // iron bands (across the length of the barrel)
  for (const y of [28, 212]) {
    g.fillStyle = '#6f747c'; g.fillRect(0, y, 256, 18);
    g.fillStyle = '#9aa0a8'; g.fillRect(0, y + 2, 256, 4);
  }
  return tex(c, false);
}

// ---------- number labels (sprites)
export class Label {
  constructor(w = 2.4, h = 1.2) {
    this.canvas = canvas(256, 128);
    this.ctx = this.canvas.getContext('2d');
    this.tex = tex(this.canvas, false);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
    this.sprite.scale.set(w, h, 1);
    this.sprite.renderOrder = 10;
    this.key = '';
  }
  set(text, fill = '#2f6df6', stroke = '#ffffff') {
    const key = text + fill + stroke;
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    g.clearRect(0, 0, 256, 128);
    let size = 96;
    g.font = `${size}px ${FONT}`;
    const w = g.measureText(text).width;
    if (w > 230) { size = Math.floor(size * 230 / w); g.font = `${size}px ${FONT}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = stroke;
    g.strokeText(text, 128, 68);
    g.fillStyle = fill; g.fillText(text, 128, 68);
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.sprite.material.dispose(); }
}

export class HpBar {
  constructor() {
    this.canvas = canvas(256, 64);
    this.ctx = this.canvas.getContext('2d');
    this.tex = tex(this.canvas, false);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
    this.sprite.scale.set(3.6, 0.9, 1);
    this.sprite.renderOrder = 10;
    this.key = '';
  }
  set(hp, max) {
    const v = Math.max(0, Math.ceil(hp));
    const key = v + '/' + max;
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(20,10,10,0.85)';
    g.beginPath(); g.roundRect(4, 26, 248, 30, 10); g.fill();
    g.fillStyle = '#e0362c';
    g.beginPath(); g.roundRect(8, 30, Math.max(0, 240 * hp / max), 22, 7); g.fill();
    g.font = `34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = '#3a0c08'; g.lineJoin = 'round';
    g.strokeText(String(v), 128, 22); g.fillStyle = '#fff'; g.fillText(String(v), 128, 22);
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.sprite.material.dispose(); }
}

// ---------- gate face
export function gateText(gate) {
  if (gate.op === 'x') return '×' + gate.val;
  if (gate.op === '/') return '÷' + gate.val;
  return (gate.val >= 0 ? '+' : '−') + Math.abs(gate.val);
}
export function gateIsGood(gate) {
  return gate.op === 'x' || (gate.op === '+' && gate.val >= 0);
}

export function makeGateFace(width) {
  const c = canvas(512, 192);
  const t = tex(c, false);
  return { canvas: c, ctx: c.getContext('2d'), tex: t, width };
}

export function drawGateFace(face, text, good) {
  const g = face.ctx, W = 512, H = 192;
  g.clearRect(0, 0, W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  if (good) { grad.addColorStop(0, 'rgba(140,215,255,0.92)'); grad.addColorStop(1, 'rgba(40,140,255,0.55)'); }
  else { grad.addColorStop(0, 'rgba(255,140,125,0.92)'); grad.addColorStop(1, 'rgba(225,40,40,0.55)'); }
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = good ? 'rgba(255,255,255,0.7)' : 'rgba(255,230,225,0.7)';
  g.fillRect(0, 0, W, 8);
  let size = 132;
  g.font = `${size}px ${FONT}`;
  const tw = g.measureText(text).width;
  if (tw > 460) { size = Math.floor(size * 460 / tw); g.font = `${size}px ${FONT}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 16; g.strokeStyle = good ? 'rgba(12,45,110,0.9)' : 'rgba(110,15,10,0.9)';
  g.strokeText(text, W / 2, H / 2 + 8);
  g.fillStyle = '#ffffff'; g.fillText(text, W / 2, H / 2 + 8);
  face.tex.needsUpdate = true;
}

// ---------- boss: a big red brute with a spiked club, facing +z (toward the player)
export function makeBoss() {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xd23a2f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x8e1f19 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x7a7f88 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a4a22 });
  const eye = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  const mats = [red, dark];

  const leg = (x) => {
    const p = new THREE.Group(); p.position.set(x, 1.25, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.25, 0.62), dark); m.position.y = -0.62; p.add(m);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.85), metal); boot.position.set(0, -1.15, 0.08); p.add(boot);
    g.add(p); return p;
  };
  const legL = leg(-0.5), legR = leg(0.5);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), red);
  belly.scale.set(1.25, 1.05, 1.0); belly.position.y = 2.15; g.add(belly);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16), wood);
  belt.position.y = 1.6; g.add(belt);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 1.15), red);
  chest.position.y = 2.95; g.add(chest);
  const pads = [-1.2, 1.2].map((x) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal);
    p.position.set(x, 3.2, 0); g.add(p); return p;
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), red);
  head.position.y = 3.7; g.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal);
  helm.position.y = 3.78; g.add(helm);
  const horn = (x) => {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), metal);
    h.position.set(x, 4.2, 0); h.rotation.z = -x * 0.8; g.add(h);
  };
  horn(-0.38); horn(0.38);
  for (const x of [-0.17, 0.17]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eye);
    e.position.set(x, 3.72, 0.43); g.add(e);
  }

  const arm = (x) => {
    const p = new THREE.Group(); p.position.set(x, 3.0, 0);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 1.4, 10), red); a.position.y = -0.7; p.add(a);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), dark); f.position.y = -1.45; p.add(f);
    g.add(p); return p;
  };
  const armL = arm(-1.4), armR = arm(1.4);
  armL.rotation.z = -0.15;
  // club held in the right fist, pointing forward relative to the arm
  const club = new THREE.Group(); club.position.y = -1.45; armR.add(club);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.4, 8), wood);
  handle.rotation.x = Math.PI / 2; handle.position.z = 0.6; club.add(handle);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 1.0, 10), wood);
  knob.rotation.x = Math.PI / 2; knob.position.z = 1.6; club.add(knob);
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), metal);
    const a = (i / 8) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 1.5 + (i % 2) * 0.3);
    s.rotation.z = a - Math.PI / 2;
    club.add(s);
  }

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.position.y = 0.03; g.add(shadow);

  return { group: g, armR, armL, legL, legR, mats, pads };
}

export function makeGun() {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x5b6068 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 1.1), metal); g.add(body);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), dark);
    const a = (i / 6) * Math.PI * 2;
    b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12 + 0.02, -0.9);
    g.add(b);
  }
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.2), dark);
  grip.position.set(0, -0.3, 0.3); g.add(grip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.45; g.add(ring);
  g.rotation.y = 0.6;
  return g;
}

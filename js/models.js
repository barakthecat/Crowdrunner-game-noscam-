// Procedural models and canvas textures. No external assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';

// ---------- soldiers
// Each part carries: color (fixed or a shade of the team color), team (1 = tinted by
// the instance color, 0 = fixed accent), and rig (x = swing sign, y = pivot height)
// so legs and the free arm can swing in the vertex shader.
function part(geo, hex, team = 0, swing = 0, pivot = 0) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3), tm = new Float32Array(n), rig = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    tm[i] = team;
    rig[i * 2] = swing; rig[i * 2 + 1] = pivot;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('team', new THREE.BufferAttribute(tm, 1));
  geo.setAttribute('rig', new THREE.BufferAttribute(rig, 2));
  return geo;
}
function merge(parts) {
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return geo;
}
const TEAM = 0xffffff, TEAM_DARK = 0x8c8c8c, TEAM_MID = 0xc4c4c4;
const BOOT = 0x26262c, IRON = 0x3b3f47, BONE = 0xf1ead8, SKIN = 0xf2c7a0, SILVER = 0xdfe5ec;
const HIP = 0.25, SHOULDER = 0.53;

function legs(parts) {
  for (const side of [-1, 1]) {
    const x = side * 0.075, sw = side;
    parts.push(part(new THREE.BoxGeometry(0.1, 0.2, 0.11).translate(x, 0.15, 0), TEAM_DARK, 1, sw, HIP));
    parts.push(part(new THREE.BoxGeometry(0.12, 0.07, 0.16).translate(x, 0.035, -0.02), BOOT, 0, sw, HIP));
  }
}

// Blue squad: rounded, sturdy hero shapes. Landmark from behind/above is the
// white crest on an oversized helmet, plus the backpack and side-held rifle.
export function soldierGeometry() {
  const p = [];
  legs(p);
  p.push(part(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 10).translate(0, 0.39, 0), TEAM, 1));
  p.push(part(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 10).translate(0, 0.27, 0), BOOT, 0));
  p.push(part(new THREE.BoxGeometry(0.2, 0.22, 0.1).translate(0, 0.42, 0.14), TEAM_DARK, 1));
  for (const x of [-0.17, 0.17]) {
    p.push(part(new THREE.SphereGeometry(0.075, 8, 6).translate(x, 0.52, 0), SILVER, 0));
  }
  p.push(part(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 0.66, 0), SKIN, 0));
  p.push(part(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.68, 0), TEAM, 1));
  p.push(part(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 12).translate(0, 0.67, 0), TEAM_MID, 1));
  p.push(part(new THREE.BoxGeometry(0.05, 0.11, 0.3).translate(0, 0.87, 0.02), BONE, 0));
  // rifle arm (fixed) and free arm (swings)
  p.push(part(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 6).translate(0.19, 0.42, -0.04), TEAM, 1));
  p.push(part(new THREE.BoxGeometry(0.06, 0.08, 0.46).translate(0.17, 0.44, -0.16), BOOT, 0));
  p.push(part(new THREE.BoxGeometry(0.03, 0.03, 0.06).translate(0.17, 0.45, -0.42), SILVER, 0));
  p.push(part(new THREE.CylinderGeometry(0.045, 0.04, 0.26, 6).translate(-0.19, 0.41, 0), TEAM, 1, -1, SHOULDER));
  return merge(p);
}

// Red enemies: angular, threatening shapes. Landmarks are bone horns on a dark
// iron helmet, shoulder spikes, glowing eyes and a raised sword.
export function enemyGeometry() {
  const p = [];
  legs(p);
  p.push(part(new THREE.CylinderGeometry(0.2, 0.12, 0.32, 6).translate(0, 0.4, 0), TEAM, 1));
  p.push(part(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 6).translate(0, 0.26, 0), BOOT, 0));
  for (const side of [-1, 1]) {
    const spike = new THREE.ConeGeometry(0.05, 0.16, 4).rotateZ(-side * 0.6).translate(side * 0.2, 0.6, 0);
    p.push(part(spike, BONE, 0));
  }
  p.push(part(new THREE.SphereGeometry(0.12, 8, 6).translate(0, 0.66, 0), TEAM_DARK, 1));
  p.push(part(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 6).translate(0, 0.72, 0), IRON, 0));
  for (const side of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.05, 0.27, 5).rotateZ(-side * 0.85).translate(side * 0.19, 0.85, 0);
    p.push(part(horn, BONE, 0));
  }
  for (const x of [-0.05, 0.05]) {
    p.push(part(new THREE.BoxGeometry(0.045, 0.025, 0.02).translate(x, 0.68, -0.155), 0xffd23a, 0));
  }
  // sword arm (raised blade) and shield arm (swings)
  p.push(part(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 5).translate(0.21, 0.44, 0), TEAM, 1));
  p.push(part(new THREE.BoxGeometry(0.12, 0.03, 0.04).translate(0.22, 0.56, -0.02), IRON, 0));
  p.push(part(new THREE.BoxGeometry(0.045, 0.36, 0.02).translate(0.22, 0.76, -0.02), SILVER, 0));
  p.push(part(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 5).translate(-0.21, 0.43, 0), TEAM, 1, -1, SHOULDER));
  p.push(part(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 8).rotateX(Math.PI / 2).translate(-0.24, 0.42, -0.06), IRON, 0, -1, SHOULDER));
  return merge(p);
}

// Lambert material that tints only the team parts and swings rigged limbs.
// Running amount and time are uniforms; each instance gets its own stride phase.
export function makeUnitMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uniforms = { uTime: { value: 0 }, uRun: { value: 0 } };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float team;
attribute vec2 rig;
uniform float uTime;
uniform float uRun;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float stridePh = uTime * 13.0 + float(gl_InstanceID) * 1.7;
float swingA = sin(stridePh) * rig.x * 0.75 * uRun;
float swingC = cos(swingA), swingS = sin(swingA);
objectNormal = vec3(objectNormal.x, objectNormal.y * swingC - objectNormal.z * swingS, objectNormal.y * swingS + objectNormal.z * swingC);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.y -= rig.y;
transformed = vec3(transformed.x, transformed.y * swingC - transformed.z * swingS, transformed.y * swingS + transformed.z * swingC);
transformed.y += rig.y + abs(sin(stridePh)) * 0.07 * uRun;`)
      .replace('#include <color_vertex>', `vColor = vec3(1.0);
vColor *= color;
#ifdef USE_INSTANCING_COLOR
vColor *= mix(vec3(1.0), instanceColor.rgb, team);
#endif`);
  };
  return mat;
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

// ---------- boss: inverted-triangle brute (huge shoulders, low head) with one
// oversized spiked pauldron on the club side. Faces +z, toward the player.
export function makeBoss() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc8322a });
  const leather = new THREE.MeshLambertMaterial({ color: 0x4a2f22 });
  const iron = new THREE.MeshLambertMaterial({ color: 0x4a4f58 });
  const bone = new THREE.MeshLambertMaterial({ color: 0xf1ead8 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6e4220 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const mats = [skin, leather, iron];
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
  };

  // short, thick legs
  const leg = (side) => {
    const p = new THREE.Group(); p.position.set(side * 0.55, 1.15, 0); g.add(p);
    add(p, new THREE.BoxGeometry(0.72, 0.85, 0.72), leather, 0, -0.42, 0);
    add(p, new THREE.BoxGeometry(0.85, 0.35, 1.0), iron, 0, -0.98, 0.1);
    const toe = add(p, new THREE.ConeGeometry(0.12, 0.3, 4), bone, 0, -0.98, 0.7);
    toe.rotation.x = Math.PI / 2;
    return p;
  };
  const legL = leg(-1), legR = leg(1);

  // upper body pivots at the hips so he can lean into a slam
  const upper = new THREE.Group(); upper.position.y = 1.15; g.add(upper);
  add(upper, new THREE.BoxGeometry(1.7, 0.45, 1.05), leather, 0, 0.1, 0);
  const plate = add(upper, new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), bone, 0, 0.12, 0.55);
  plate.rotation.x = Math.PI / 2;
  for (const x of [-0.1, 0.1]) add(upper, new THREE.SphereGeometry(0.06, 6, 4), iron, x, 0.16, 0.6);
  const torso = add(upper, new THREE.CylinderGeometry(1.3, 0.75, 1.65, 6), skin, 0, 1.1, 0);
  torso.scale.z = 0.62;
  add(upper, new THREE.BoxGeometry(1.5, 0.6, 0.18), iron, 0, 1.45, 0.62);
  add(upper, new THREE.BoxGeometry(0.15, 1.6, 0.12), leather, 0.3, 1.15, 0.66).rotation.z = 0.55;

  // small head sunk between the shoulders
  const headG = new THREE.Group(); headG.position.y = 2.05; upper.add(headG);
  add(headG, new THREE.SphereGeometry(0.4, 14, 10), skin, 0, 0.1, 0.05);
  add(headG, new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 0.2, 0);
  for (const side of [-1, 1]) {
    const horn = add(headG, new THREE.ConeGeometry(0.13, 0.85, 8), bone, side * 0.55, 0.55, 0);
    horn.rotation.z = -side * 1.0;
  }
  add(headG, new THREE.BoxGeometry(0.55, 0.22, 0.32), skin, 0, -0.18, 0.25);
  for (const side of [-1, 1]) {
    add(headG, new THREE.ConeGeometry(0.06, 0.24, 6), bone, side * 0.19, -0.02, 0.38);
    add(headG, new THREE.SphereGeometry(0.075, 8, 6), glow, side * 0.15, 0.13, 0.38);
  }

  // arms: pivots at the shoulders (rotation.x drives the club swing)
  const arm = (side) => {
    const p = new THREE.Group(); p.position.set(side * 1.45, 1.8, 0); upper.add(p);
    add(p, new THREE.CylinderGeometry(0.34, 0.28, 1.45, 10), skin, 0, -0.72, 0);
    add(p, new THREE.CylinderGeometry(0.32, 0.32, 0.4, 10), iron, 0, -1.15, 0);
    add(p, new THREE.SphereGeometry(0.38, 12, 8), skin, 0, -1.5, 0);
    return p;
  };
  const armL = arm(-1), armR = arm(1);
  armL.rotation.z = -0.18;
  // asymmetric armor: spiked pauldron on the club arm, plain strap on the other
  const pad = add(upper, new THREE.SphereGeometry(0.72, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron, 1.45, 1.85, 0);
  for (let i = 0; i < 3; i++) {
    const sp = add(upper, new THREE.ConeGeometry(0.12, 0.55, 6), bone, 1.2 + i * 0.28, 2.45 - Math.abs(i - 1) * 0.12, 0);
    sp.rotation.z = -0.25 - i * 0.2;
  }
  add(upper, new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), leather, -1.45, 1.85, 0);
  const pads = [pad];

  // spiked club in the right fist, pointing forward relative to the arm
  const club = new THREE.Group(); club.position.y = -1.5; armR.add(club);
  const handle = add(club, new THREE.CylinderGeometry(0.1, 0.12, 1.5, 8), wood, 0, 0, 0.65);
  handle.rotation.x = Math.PI / 2;
  const head = add(club, new THREE.CylinderGeometry(0.5, 0.32, 1.25, 10), wood, 0, 0, 1.85);
  head.rotation.x = Math.PI / 2;
  const band = add(club, new THREE.CylinderGeometry(0.47, 0.47, 0.14, 10), iron, 0, 0, 1.5);
  band.rotation.x = Math.PI / 2;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 0.46 - (i % 2) * 0.06;
    const s = add(club, new THREE.ConeGeometry(0.08, 0.34, 6), iron, Math.cos(a) * r, Math.sin(a) * r, 1.75 + (i % 2) * 0.4);
    s.rotation.z = a - Math.PI / 2;
  }

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.position.y = 0.03; g.add(shadow);

  return { group: g, upper, head: headG, armR, armL, legL, legR, mats, pads };
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

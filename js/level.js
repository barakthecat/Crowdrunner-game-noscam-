// Procedural level generation. Distances are measured along the track ("d"),
// world z = -d. The generator tracks an estimate of the player's crowd size
// (assuming mostly-good choices) so enemies, barrels and the boss scale fairly.

export const HALF = 5; // half width of the track

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nice(v) {
  v = Math.max(1, v);
  if (v < 10) return Math.round(v);
  if (v < 60) return Math.round(v / 5) * 5;
  if (v < 300) return Math.round(v / 10) * 10;
  return Math.round(v / 50) * 50;
}

export function applyOp(op, val, n) {
  switch (op) {
    case '+': return n + val;
    case 'x': return n * val;
    case '/': return Math.floor(n / val);
  }
  return n;
}

export function generateLevel(level, startCount, fp) {
  const rng = mulberry32(level * 7919 + 101);
  const R = (a, b) => a + rng() * (b - a);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const hard = Math.min(1, (level - 1) / 12);

  const L = { gates: [], barrels: [], enemies: [], walls: [], spikes: [] };
  let est = startCount;
  let estFp = fp;
  let d = 30;

  // Gates use a signed value for + / - so shooting can push a red gate positive.
  const goodOp = () => {
    if (est < 60 && rng() < 0.4) return { op: 'x', val: est < 20 && rng() < 0.4 ? 3 : 2 };
    return { op: '+', val: nice(est * R(0.25, 0.55) + 5 + level) };
  };
  const badOp = () => {
    const r = rng();
    if (r < 0.25 && est > 20) return { op: '/', val: 2 };
    if (r < 0.65) return { op: '+', val: -nice(est * R(0.2, 0.4 + 0.15 * hard) + 3) };
    return { op: '+', val: nice(est * R(0.08, 0.2) + 2) };
  };
  // shooting a + gate on the way in usually adds ~20%
  const after = (g) => Math.max(0, applyOp(g.op, g.val, est) * (g.op === '+' ? 1.2 : 1));
  const blend = (a, b) => {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return Math.max(5, Math.round(lo + (hi - lo) * 0.8));
  };
  const addGate = (x0, x1, gd, g) => L.gates.push({ x0, x1, d: gd, op: g.op, val: g.val });
  const makeReward = () =>
    rng() < 0.5 ? { kind: 'gun', amount: 0.5 } : { kind: 'troops', amount: nice(est * R(0.25, 0.45) + 4) };
  const rewardEst = (rw, base) => {
    if (rw.kind === 'gun') { estFp += rw.amount * 0.6; return base; }
    return base + rw.amount;
  };
  const barrelHp = (mult) => nice(est * Math.min(estFp, 2) * mult);

  const types = ['gates', 'gates', 'enemy', 'barrel', 'lanes', 'lanes'];
  if (level >= 3) types.push('spikes');
  const rows = 9 + Math.min(7, Math.floor(level / 2));

  for (let r = 0; r < rows; r++) {
    const t = r === 0 ? 'gates' : pick(types);

    if (t === 'gates') {
      const g1 = goodOp(), g2 = badOp();
      const left = rng() < 0.5;
      addGate(-HALF, 0, d, left ? g1 : g2);
      addGate(0, HALF, d, left ? g2 : g1);
      est = blend(after(g1), after(g2));
      d += 26;
    } else if (t === 'enemy') {
      const n = Math.max(3, Math.round(est * R(0.35, 0.6 + 0.3 * hard)));
      L.enemies.push({ x: R(-2.5, 2.5), d: d + 6, n });
      est = Math.max(5, Math.round(est - n * 0.6));
      d += 30;
    } else if (t === 'barrel') {
      const w = 3.4;
      const x = pick([-HALF + w / 2 + 0.2, 0, HALF - w / 2 - 0.2]);
      const reward = makeReward();
      L.barrels.push({ x, w, d, hp: barrelHp(R(0.5, 0.9)), reward });
      est = Math.round(est * 0.3 + rewardEst(reward, est) * 0.7);
      d += 26;
    } else if (t === 'lanes') {
      // A stone divider forces a commitment: each lane has its own content.
      L.walls.push({ d0: d - 6, d1: d + 18 });
      const lane = (side) => (side < 0 ? [-HALF, 0] : [0, HALF]);
      const cx = (side) => (side < 0 ? -HALF / 2 : HALF / 2);
      const variants = {
        gateEnemy(side) {
          const g = goodOp();
          const [x0, x1] = lane(side);
          addGate(x0, x1, d, g);
          const n = Math.max(4, Math.round(after(g) * R(0.3, 0.45)));
          L.enemies.push({ x: cx(side), d: d + 12, n });
          return after(g) - n * 0.6;
        },
        barrel(side) {
          const reward = makeReward();
          L.barrels.push({ x: cx(side), w: 4.2, d: d + 5, hp: barrelHp(R(0.55, 0.8)), reward });
          return rewardEst(reward, est);
        },
        enemy(side) {
          const n = Math.max(4, Math.round(est * R(0.3, 0.5)));
          L.enemies.push({ x: cx(side), d: d + 8, n });
          return est - n * 0.6;
        },
        badGate(side) {
          const g = badOp();
          const [x0, x1] = lane(side);
          addGate(x0, x1, d, g);
          return after(g);
        },
        goodGate(side) {
          const g = goodOp();
          const [x0, x1] = lane(side);
          addGate(x0, x1, d, g);
          return after(g);
        },
      };
      const combo = pick([
        ['gateEnemy', 'barrel'],
        ['gateEnemy', 'badGate'],
        ['barrel', 'enemy'],
        ['goodGate', 'enemy'],
        ['gateEnemy', 'goodGate'],
      ]);
      const side = rng() < 0.5 ? -1 : 1;
      const a = variants[combo[0]](side);
      const b = variants[combo[1]](-side);
      est = blend(Math.max(0, a), Math.max(0, b));
      d += 34;
    } else if (t === 'spikes') {
      const side = rng() < 0.5 ? -1 : 1;
      const [x0, x1] = side < 0 ? [-HALF, 0] : [0, HALF];
      L.spikes.push({ x0, x1, d });
      const good = goodOp();
      const weak = { op: '+', val: nice(est * R(0.08, 0.2) + 2) };
      addGate(x0, x1, d + 8, good);
      addGate(side < 0 ? 0 : -HALF, side < 0 ? HALF : 0, d + 8, weak);
      est = blend(after(good) * 0.65, after(weak));
      d += 28;
    }
  }

  d += 15;
  L.arenaStart = d;
  L.bossD = d + 45;
  L.boss = { hp: Math.round(est * estFp * (4.5 + 7 * hard)) };
  L.length = L.bossD + 30;
  L.est = est;
  return L;
}

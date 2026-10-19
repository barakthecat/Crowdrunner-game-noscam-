// Tiny WebAudio synth for sound effects. Starts on the first tap (iOS rule).
let ctx = null, master = null, muted = false;
let lastHit = 0;

export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}

function tone(freq, dur, type = 'sine', vol = 0.4, slide = 0, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.4, freq = 1000) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  good() { tone(520, 0.12, 'square', 0.2, 260); tone(780, 0.14, 'square', 0.16, 300, 0.07); },
  bad() { tone(220, 0.3, 'sawtooth', 0.2, -110); },
  power() { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.1, 'square', 0.15, 0, i * 0.05)); },
  crash() { noise(0.3, 0.5, 700); tone(110, 0.25, 'sine', 0.4, -50); },
  breakBarrel() { noise(0.25, 0.45, 1600); tone(300, 0.12, 'triangle', 0.25, 200); },
  clash() { noise(0.12, 0.25, 2500); },
  hit() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastHit < 0.07) return;
    lastHit = now;
    tone(900 + Math.random() * 300, 0.03, 'square', 0.04);
  },
  smash() { noise(0.45, 0.7, 350); tone(70, 0.45, 'sine', 0.7, -30); },
  boss() { tone(110, 0.5, 'sawtooth', 0.25, -40); tone(82, 0.7, 'sawtooth', 0.25, -20, 0.25); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.2, 0, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, 0, i * 0.18)); },
};

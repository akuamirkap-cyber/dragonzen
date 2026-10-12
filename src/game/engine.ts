import { ZenAudio } from './audio';

export const W = 450;
export const H = 800;

type RGB = [number, number, number];
interface Vec { x: number; y: number }

interface Palette {
  skyTop: RGB; skyBot: RGB; sun: RGB; far: RGB; mid: RGB; near: RGB;
  ground: RGB; groundTop: RGB; fog: RGB; rock: RGB; star: number; ring: RGB;
}

const PALETTES: Palette[] = [
  // fajar
  { skyTop: [250, 172, 170], skyBot: [255, 226, 196], sun: [255, 246, 228], far: [238, 172, 168], mid: [212, 132, 142], near: [158, 90, 116], ground: [104, 56, 86], groundTop: [134, 76, 102], fog: [255, 214, 198], rock: [92, 50, 76], star: 0, ring: [255, 236, 170] },
  // siang
  { skyTop: [112, 184, 216], skyBot: [226, 240, 232], sun: [255, 255, 240], far: [164, 204, 212], mid: [112, 162, 178], near: [66, 116, 136], ground: [40, 80, 100], groundTop: [56, 100, 116], fog: [222, 238, 236], rock: [34, 66, 86], star: 0, ring: [255, 226, 130] },
  // senja
  { skyTop: [104, 66, 138], skyBot: [255, 152, 92], sun: [255, 222, 156], far: [222, 122, 110], mid: [160, 76, 96], near: [98, 44, 78], ground: [58, 26, 58], groundTop: [78, 36, 68], fog: [255, 168, 120], rock: [48, 20, 46], star: 0.15, ring: [255, 236, 170] },
  // malam
  { skyTop: [10, 14, 42], skyBot: [48, 58, 108], sun: [236, 240, 255], far: [44, 54, 98], mid: [31, 39, 78], near: [21, 27, 58], ground: [13, 17, 38], groundTop: [22, 28, 54], fog: [62, 72, 122], rock: [9, 11, 28], star: 1, ring: [255, 214, 120] },
];
const SUN_Y = [560, 170, 480, 720];
const SUN_A = [1, 1, 1, 0];
const MOON_A = [0, 0, 0, 1];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function groundY(x: number) {
  return 708 + 24 * Math.sin(x * 0.0042) + 15 * Math.sin(x * 0.0113 + 1.3) + 7 * Math.sin(x * 0.029 + 0.5);
}

function ridge(x: number, seed: number) {
  const a = 1 - Math.abs(Math.sin(x * 0.0021 + seed));
  const b = 1 - Math.abs(Math.sin(x * 0.0057 + seed * 2.1));
  const c = Math.sin(x * 0.017 + seed * 3.7);
  return a * a * 0.62 + b * b * 0.3 + c * 0.04 + 0.04;
}

function pointInTri(p: Vec, a: Vec, b: Vec, c: Vec) {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function distSeg(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
function hitTri(p: Vec, r: number, a: Vec, b: Vec, c: Vec) {
  return pointInTri(p, a, b, c) || distSeg(p, a, b) < r || distSeg(p, b, c) < r || distSeg(p, c, a) < r;
}

interface Rock { dir: number; x: number; base: number; w: number; len: number; tip: number; left: Vec[]; right: Vec[]; tree: boolean }
interface Island { x: number; y: number; r: number; cone: Vec[]; deco: number }
interface Ring { x: number; y: number; r: number; state: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: number; ph: number }
interface FText { x: number; y: number; text: string; life: number; big: boolean }

export interface GameStats { distance: number; rings: number; score: number; bestCombo: number }
export interface GameCallbacks { onGameOver: (s: GameStats) => void }

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  audio = new ZenAudio();
  cb: GameCallbacks;
  mode: 'menu' | 'playing' | 'dead' = 'menu';
  scale = 1;
  dpr = 1;
  raf = 0;
  last = 0;
  time = 0;
  holding = false;
  ro: ResizeObserver | null = null;

  dx = 0; dy = 320; ang = 0; spd = 280;
  targetY = 320;
  vy = 0;
  punchScale = 1;
  whooshCd = 0;
  hist: Vec[] = [];
  body: Vec[] = [];
  camX = 0;
  rocks: Rock[] = [];
  islands: Island[] = [];
  rings: Ring[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  nextSpawn = 0;
  startX = 0;
  ringScore = 0; ringCount = 0; combo = 0; bestCombo = 0;
  boost = 0; skimT = 0; skimShown = false;
  deadT = 0; shake = 0; slowmo = 1; reported = false;
  autoDive = false;
  playT = 0;
  bumpCd = 0;
  stars: { x: number; y: number; s: number; p: number }[] = [];
  clouds: { x: number; y: number; w: number; h: number }[] = [];
  phaseOffset = 0;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * 520, s: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28 });
    for (let i = 0; i < 7; i++) this.clouds.push({ x: Math.random() * (W + 400), y: rand(60, 420), w: rand(90, 220), h: rand(10, 22) });
    this.resize();
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
    }
    for (let i = 0; i < 80; i++) this.hist.push({ x: -i * 3, y: 320 });
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.scale = rect.width / W;
  }

  run() {
    this.last = performance.now();
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    if (this.audio.ctx) this.audio.ctx.close();
  }

  setHolding(h: boolean) { this.holding = h; }
  setTargetY(y: number) { this.targetY = clamp(y, 35, 740); }
  adjustTargetY(delta: number) { this.targetY = clamp(this.targetY + delta, 35, 740); }
  setMuted(m: boolean) { this.audio.setMuted(m); }

  start() {
    this.audio.init();
    this.mode = 'playing';
    this.rocks = []; this.islands = []; this.rings = []; this.texts = [];
    this.parts = this.parts.filter((p) => p.kind === 2 || p.kind === 3);
    this.dy = 300; this.targetY = 300; this.vy = 0; this.punchScale = 1; this.whooshCd = 0; this.ang = 0.05; this.spd = 300;
    this.hist = [];
    for (let i = 0; i < 80; i++) this.hist.push({ x: this.dx - i * 3, y: this.dy });
    this.startX = this.dx;
    this.nextSpawn = this.dx + 650;
    this.ringScore = 0; this.ringCount = 0; this.combo = 0; this.bestCombo = 0;
    this.boost = 0; this.skimT = 0; this.deadT = 0; this.shake = 0; this.slowmo = 1; this.reported = false;
    this.playT = 0; this.holding = false;
  }

  difficulty() { return clamp((this.dx - this.startX) / 40000, 0, 1); }
  distanceM() { return Math.max(0, Math.floor((this.dx - this.startX) / 10)); }
  totalScore() { return Math.floor(this.ringScore + this.distanceM()); }

  palette(): { p: Palette; i: number; t: number } {
    const cyc = (this.time / 42 + this.phaseOffset) % 4;
    const i = Math.floor(cyc);
    const f = cyc - i;
    const t = smooth(clamp((f - 0.55) / 0.45, 0, 1));
    const a = PALETTES[i], b = PALETTES[(i + 1) % 4];
    const p: Palette = {
      skyTop: mix(a.skyTop, b.skyTop, t), skyBot: mix(a.skyBot, b.skyBot, t), sun: mix(a.sun, b.sun, t),
      far: mix(a.far, b.far, t), mid: mix(a.mid, b.mid, t), near: mix(a.near, b.near, t),
      ground: mix(a.ground, b.ground, t), groundTop: mix(a.groundTop, b.groundTop, t), fog: mix(a.fog, b.fog, t),
      rock: mix(a.rock, b.rock, t), star: lerp(a.star, b.star, t), ring: mix(a.ring, b.ring, t),
    };
    return { p, i, t };
  }

  // ---------------- SPAWNING ----------------
  makeRock(dir: number, x: number, len: number, w: number): Rock {
    const base = dir < 0 ? groundY(x) + 34 : -24;
    const L = len + (dir < 0 ? 34 : 24);
    const tip = rand(-w * 0.12, w * 0.12);
    const left: Vec[] = [], right: Vec[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i > 0 && i < n ? rand(-5, 5) * (1 - t) : 0;
      const shape = Math.pow(1 - t, 0.85);
      left.push({ x: -w / 2 * shape + tip * t + j, y: dir * L * t });
      right.push({ x: w / 2 * shape + tip * t + rand(-4, 4) * (i > 0 && i < n ? 1 - t : 0), y: dir * L * t });
    }
    return { dir, x, base, w, len: L, tip, left, right, tree: dir < 0 && Math.random() < 0.55 };
  }

  makeIsland(x: number, y: number, r: number): Island {
    const cone: Vec[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const xx = lerp(r, -r, t);
      const depth = Math.sin(t * Math.PI);
      cone.push({ x: xx, y: 4 + depth * r * rand(1.1, 1.6) });
    }
    return { x, y, r, cone, deco: Math.floor(Math.random() * 3) };
  }

  addRing(x: number, y: number) {
    const g = groundY(x);
    this.rings.push({ x, y: clamp(y, 70, g - 70), r: 36, state: 0, t: 0 });
  }

  spawnPattern(x: number) {
    const d = this.difficulty();
    const g = groundY(x);
    const roll = Math.random();
    let width = 120;
    if (roll < 0.28) {
      // gerbang batu
      const gap = lerp(330, 230, d);
      const c = rand(200, g - 210);
      const w = rand(64, 92);
      const top = c - gap / 2;
      const bot = g - (c + gap / 2);
      if (top > 30) this.rocks.push(this.makeRock(1, x, top, w));
      if (bot > 30) this.rocks.push(this.makeRock(-1, x, bot, w));
      this.addRing(x, c);
      if (Math.random() < 0.5) { this.addRing(x - 90, c + rand(-40, 40)); }
      width = 100;
    } else if (roll < 0.5) {
      // busur cincin (ajakan menukik / naik)
      const n = 5;
      const dive = Math.random() < 0.6;
      const yc = dive ? rand(180, 300) : rand(380, 520);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const y = yc + Math.sin(t * Math.PI) * (dive ? 150 : -150);
        this.addRing(x + i * 80, y);
      }
      if (d > 0.25 && Math.random() < 0.6) {
        const sx = x + 160;
        const h = dive ? rand(60, 120) : rand(80, 150);
        if (dive) this.rocks.push(this.makeRock(1, sx, h, 70));
        else this.rocks.push(this.makeRock(-1, sx, h, 70));
      }
      width = 4 * 80;
    } else if (roll < 0.7) {
      // pulau melayang
      const r = rand(36, 56);
      const iy = rand(240, g - 260);
      this.islands.push(this.makeIsland(x, iy, r));
      const above = iy > 330 ? Math.random() < 0.7 : Math.random() < 0.3;
      const ry = above ? iy - r - 80 : iy + r * 1.6 + 70;
      this.addRing(x - 70, ry);
      this.addRing(x, ry + (above ? -10 : 10));
      this.addRing(x + 70, ry);
      width = 120;
    } else if (roll < 0.86) {
      // hutan menara batu
      const h1 = rand(140, lerp(280, 380, d));
      const h2 = rand(120, lerp(260, 360, d));
      this.rocks.push(this.makeRock(-1, x, h1, rand(60, 85)));
      this.rocks.push(this.makeRock(-1, x + 150, h2, rand(60, 85)));
      const top = Math.min(g - h1, groundY(x + 150) - h2);
      this.addRing(x + 75, top - 50);
      if (Math.random() < 0.5) this.addRing(x + 75, top - 50 - 90);
      width = 150;
    } else {
      // stalaktit menggantung
      const h1 = rand(160, lerp(300, 400, d));
      const h2 = rand(140, lerp(260, 380, d));
      this.rocks.push(this.makeRock(1, x, h1, rand(60, 90)));
      this.rocks.push(this.makeRock(1, x + 160, h2, rand(60, 90)));
      const low = Math.max(h1, h2);
      this.addRing(x + 80, low + 70);
      this.addRing(x + 160, h2 + 80);
      width = 160;
    }
    // Adaptive obstacle spacing: scales with dragon speed so reaction time stays fair and zen
    const speedRatio = clamp(this.spd / 310, 1, 2.4);
    this.nextSpawn = x + width + rand(280, 420) * speedRatio;
  }

  // ---------------- UPDATE ----------------
  update(dt: number) {
    this.time += dt;
    if (this.mode === 'dead') {
      this.deadT += dt;
      this.slowmo = lerp(this.slowmo, 1, dt * 0.8);
      if (this.deadT > 1.6 && !this.reported) {
        this.reported = true;
        this.cb.onGameOver({ distance: this.distanceM(), rings: this.ringCount, score: this.totalScore(), bestCombo: this.bestCombo });
      }
    }
    const sdt = dt * this.slowmo;
    this.punchScale = lerp(this.punchScale, 1.0, 1 - Math.exp(-14 * sdt));
    this.whooshCd = Math.max(0, this.whooshCd - sdt);

    if (this.mode !== 'dead') this.updateDragon(sdt);
    else this.dx += 60 * sdt;

    // Dynamic camera lead: reveals more terrain ahead at high flight speeds
    const lead = clamp((this.spd - 300) / 500, 0, 0.14);
    this.camX = this.dx - W * (0.32 - lead);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.bumpCd = Math.max(0, this.bumpCd - dt);

    if (this.mode === 'playing') {
      this.playT += dt;
      while (this.nextSpawn < this.camX + W + 450) this.spawnPattern(this.nextSpawn);
    }

    // rings anim & magnetic drift
    for (const r of this.rings) r.t += sdt;

    // cleanup
    const cut = this.camX - 260;
    this.rocks = this.rocks.filter((r) => r.x + r.w > cut);
    this.islands = this.islands.filter((r) => r.x + r.r > cut);
    this.rings = this.rings.filter((r) => r.x > cut && !(r.state === 1 && r.t > 1.2));

    this.updateParticles(sdt);
    this.audio.setWind(clamp((this.spd - 150) / 600, 0, 1) * (this.mode === 'dead' ? 0.2 : 1));
  }

  updateDragon(dt: number) {
    let destY = this.targetY;
    if (this.mode === 'menu') {
      destY = 320 + Math.sin(this.time * 2.2) * 120;
    }

    const gCurrent = groundY(this.dx);
    destY = clamp(destY, 35, gCurrent - 20);

    // Critically damped spring physics for ultra-smooth, organic dragon flight
    const diff = destY - this.dy;
    const springK = 62;
    const damping = 15.5;
    const accel = diff * springK - this.vy * damping;
    this.vy += accel * dt;
    this.dy += this.vy * dt;

    if (this.dy < 30) {
      this.dy = 30;
      this.vy = Math.max(0, this.vy);
    }

    // Play whoosh when swooping vertically fast
    if (Math.abs(this.vy) > 340 && this.whooshCd <= 0 && this.mode === 'playing') {
      this.whooshCd = 0.45;
      this.audio.whoosh(clamp(Math.abs(this.vy) / 600, 0.4, 1));
    }

    // Dynamic pitch orientation based on velocity & motion
    const targetAng = clamp(Math.atan2(this.vy, this.spd), -0.75, 0.75);
    this.ang += (targetAng - this.ang) * (1 - Math.exp(-12 * dt));

    const d = this.difficulty();
    const baseSpeed = 320;
    const comboBonus = Math.min(this.combo * 16, 280);
    const distBonus = Math.min(this.distanceM() * 0.12, 180);
    if (this.boost > 0) {
      this.boost -= dt;
      const targetSpd = baseSpeed + comboBonus + distBonus + 160 + d * 50;
      this.spd = lerp(this.spd, targetSpd, 1 - Math.exp(-4 * dt));
      if (Math.random() < 0.95 && this.body.length > 8) {
        const b = this.body[Math.floor(Math.random() * this.body.length)];
        this.parts.push({ x: b.x, y: b.y, vx: rand(-70, -10), vy: rand(-20, 20), life: 0.8, max: 0.8, size: rand(1.4, 3.0), color: 'gold', kind: 0, ph: 0 });
      }
    } else {
      const targetSpd = baseSpeed + comboBonus + distBonus + d * 40;
      this.spd = lerp(this.spd, targetSpd, 1 - Math.exp(-3 * dt));
    }
    this.spd = clamp(this.spd, 220, 880);

    // Tail stardust trail
    if (this.body.length > 10 && Math.random() < (this.boost > 0 ? 0.9 : 0.4)) {
      const tail = this.body[this.body.length - 1];
      this.parts.push({
        x: tail.x + rand(-3, 3),
        y: tail.y + rand(-3, 3),
        vx: rand(-60, -20),
        vy: rand(-12, 12),
        life: 0.65,
        max: 0.65,
        size: rand(1.2, 2.6),
        color: this.boost > 0 ? 'gold' : 'petal',
        kind: 0,
        ph: Math.random() * 6
      });
    }

    const px = this.dx;
    this.dx += Math.cos(this.ang) * this.spd * dt;

    // selancar angin dekat tanah
    const alt = groundY(this.dx) - this.dy;
    if (alt < 70 && alt > 0) {
      const f = 1 - alt / 70;
      this.skimT += dt;
      if (this.mode === 'playing') this.ringScore += f * dt * 12;
      if (Math.random() < 0.65) {
        this.parts.push({ x: this.dx - 10, y: groundY(this.dx) - 2, vx: rand(-120, -40), vy: rand(-60, -10), life: 0.7, max: 0.7, size: rand(1.5, 3), color: 'dust', kind: 1, ph: 0 });
      }
      if (this.skimT > 0.3 && !this.skimShown && this.mode === 'playing') {
        this.skimShown = true;
        this.texts.push({ x: this.dx, y: this.dy - 35, text: 'Selancar Angin ✦', life: 1.3, big: false });
        this.ringScore += 5;
      }
    } else {
      this.skimT = 0;
      this.skimShown = false;
    }

    // tanah
    const g2 = groundY(this.dx);
    if (this.dy > g2 - 12) {
      this.dy = g2 - 12;
      this.vy = Math.min(0, this.vy);
      if (this.mode === 'playing' && this.bumpCd <= 0) {
        this.bumpCd = 0.4;
        this.audio.bump();
        this.shake = 3;
        for (let i = 0; i < 8; i++) {
          this.parts.push({ x: this.dx, y: g2 - 4, vx: rand(-140, 20), vy: rand(-100, -20), life: 0.6, max: 0.6, size: rand(1.5, 3), color: 'dust', kind: 1, ph: 0 });
        }
      }
    }

    // history / body
    const h0 = this.hist[0];
    if (!h0 || Math.hypot(this.dx - h0.x, this.dy - h0.y) > 2) {
      this.hist.unshift({ x: this.dx, y: this.dy });
      if (this.hist.length > 500) this.hist.length = 500;
    }
    this.computeBody();

    if (this.mode !== 'playing') return;

    // Dynamic ring magnetic attraction (scales with speed for effortless collection)
    const speedBonus = Math.max(0, this.spd - 310);
    const magnetRadius = 110 + speedBonus * 0.14;
    const magnetForce = 110 + speedBonus * 0.35;
    for (const r of this.rings) {
      if (r.state === 0) {
        const dist = Math.hypot(r.x - this.dx, r.y - this.dy);
        if (dist < magnetRadius) {
          const pull = (1 - dist / magnetRadius) * magnetForce * dt;
          r.y += (this.dy - r.y) * pull;
        }
      }
    }

    // cincin collection
    for (const r of this.rings) {
      if (r.state !== 0) continue;
      if (px < r.x && this.dx >= r.x) {
        const dy = Math.abs(this.dy - r.y);
        if (dy < r.r * 0.95) this.collect(r, dy);
        else { r.state = 2; r.t = 0; this.combo = 0; }
      }
    }

    // tabrakan dengan sistem near-miss grace
    const head = { x: this.dx, y: this.dy };
    const HR_LETHAL = 5.5;
    const HR_GRAZE = 12.5;
    for (const rk of this.rocks) {
      if (Math.abs(rk.x - head.x) > rk.w + 12) continue;
      const a = { x: rk.x - rk.w * 0.4, y: rk.base };
      const b = { x: rk.x + rk.w * 0.4, y: rk.base };
      const c = { x: rk.x + rk.tip, y: rk.base + rk.dir * rk.len };
      if (hitTri(head, HR_LETHAL, a, b, c)) { this.crash(); return; }
      if (this.bumpCd <= 0 && hitTri(head, HR_GRAZE, a, b, c)) {
        this.graze(head, rk.dir < 0 ? -1 : 1);
        return;
      }
    }
    for (const is of this.islands) {
      if (Math.abs(is.x - head.x) > is.r + 26) continue;
      const a = { x: is.x - is.r * 0.95, y: is.y - 6 };
      const b = { x: is.x + is.r * 0.95, y: is.y - 6 };
      const c = { x: is.x, y: is.y + is.r * 1.3 };
      if (hitTri(head, HR_LETHAL, a, b, c)) { this.crash(); return; }
      if (this.bumpCd <= 0 && hitTri(head, HR_GRAZE, a, b, c)) {
        this.graze(head, head.y < is.y ? -1 : 1);
        return;
      }
    }
  }

  collect(r: Ring, dy: number) {
    r.state = 1;
    r.t = 0;
    this.combo++;
    this.ringCount++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const perfect = dy < r.r * 0.35;
    this.spd += perfect ? 165 : 120;
    this.boost = perfect ? 1.85 : 1.35;
    this.punchScale = perfect ? 1.045 : 1.026;
    const pts = 10 * this.combo + (perfect ? 20 : 0);
    this.ringScore += pts;
    this.audio.chime(this.combo - 1, perfect);

    const count = perfect ? 34 : 24;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(70, 260);
      this.parts.push({
        x: r.x,
        y: r.y + rand(-r.r, r.r) * 0.7,
        vx: Math.cos(a) * s + 50,
        vy: Math.sin(a) * s,
        life: rand(0.6, 1.2),
        max: 1.2,
        size: rand(1.6, 3.6),
        color: 'gold',
        kind: 0,
        ph: Math.random() * 6
      });
    }
    this.texts.push({ x: r.x, y: r.y - r.r - 12, text: `+${pts}`, life: 1.2, big: false });
    if (perfect) this.texts.push({ x: r.x + 8, y: r.y - r.r - 38, text: 'Sempurna! ✦', life: 1.4, big: true });
    else if (this.combo >= 2) this.texts.push({ x: r.x + 8, y: r.y - r.r - 38, text: `Kombo ×${this.combo}`, life: 1.25, big: true });
  }

  graze(p: Vec, pushYDir: number) {
    this.bumpCd = 0.55;
    this.shake = 5;
    this.audio.bump();
    this.combo = Math.max(1, Math.floor(this.combo * 0.7));
    this.dy += pushYDir * 20;
    this.vy = pushYDir * 160;
    this.spd = Math.max(260, this.spd - 70);
    this.texts.push({ x: p.x, y: p.y - 28, text: 'Terelak! ✦', life: 1.1, big: false });
    for (let i = 0; i < 16; i++) {
      this.parts.push({
        x: p.x,
        y: p.y,
        vx: rand(-140, 20),
        vy: rand(-80, 80),
        life: 0.65,
        max: 0.65,
        size: rand(1.6, 3.5),
        color: 'gold',
        kind: 0,
        ph: Math.random() * 6
      });
    }
  }

  crash() {
    if (this.mode !== 'playing') return;
    this.mode = 'dead';
    this.slowmo = 0.25;
    this.shake = 16;
    this.holding = false;
    this.audio.crash();
    for (let i = 0; i < this.body.length; i += 1) {
      const b = this.body[i];
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(40, 260);
        this.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(1, 2.2), max: 2.2, size: rand(2, 4.5), color: Math.random() < 0.65 ? 'red' : 'gold', kind: 4, ph: Math.random() * 6 });
      }
    }
  }

  computeBody() {
    const N = 30, SP = 6.6;
    const body: Vec[] = [{ x: this.dx, y: this.dy }];
    let prev = body[0];
    let remain = SP;
    for (const p of this.hist) {
      let sx = prev.x, sy = prev.y;
      let segLen = Math.hypot(p.x - sx, p.y - sy);
      while (segLen >= remain && body.length < N) {
        const t = remain / segLen;
        sx = sx + (p.x - sx) * t;
        sy = sy + (p.y - sy) * t;
        body.push({ x: sx, y: sy });
        segLen -= remain;
        remain = SP;
      }
      remain -= segLen;
      prev = p;
      if (body.length >= N) break;
    }
    while (body.length < N) {
      const l = body[body.length - 1];
      body.push({ x: l.x - SP, y: l.y });
    }
    this.body = body;
  }

  updateParticles(dt: number) {
    const { p: pal } = this.palette();
    // ambient
    const night = pal.star;
    if (Math.random() < dt * 7) {
      if (night > 0.5 && Math.random() < 0.6) {
        this.parts.push({ x: this.camX + rand(0, W + 200), y: rand(80, 650), vx: rand(-15, 15), vy: rand(-15, 5), life: 6, max: 6, size: rand(1.2, 2.4), color: 'fly', kind: 2, ph: Math.random() * 6 });
      } else {
        this.parts.push({ x: this.camX + W + rand(0, 100), y: rand(-20, 600), vx: rand(-60, -20), vy: rand(15, 40), life: 9, max: 9, size: rand(2, 3.6), color: 'petal', kind: 3, ph: Math.random() * 6 });
      }
    }
    if (night > 0.6 && Math.random() < dt * 0.5) {
      this.parts.push({ x: this.camX + rand(W * 0.3, W + 150), y: rand(560, 680), vx: rand(-8, 8), vy: rand(-18, -10), life: 30, max: 30, size: rand(3, 5), color: 'lantern', kind: 5, ph: Math.random() * 6 });
    }
    // garis angin
    if (this.spd > 380 && Math.random() < dt * (this.spd - 380) / 30) {
      this.parts.push({ x: this.camX + W + 20, y: rand(30, 700), vx: -this.spd * rand(1.2, 1.8), vy: 0, life: 0.8, max: 0.8, size: rand(30, 80), color: 'wind', kind: 6, ph: 0 });
    }
    for (const p of this.parts) {
      p.life -= dt;
      p.ph += dt;
      if (p.kind === 0) { p.vx *= 1 - dt * 2.5; p.vy *= 1 - dt * 2.5; }
      else if (p.kind === 1) { p.vy += 200 * dt; p.vx *= 1 - dt; }
      else if (p.kind === 2) { p.vx += Math.sin(p.ph * 1.3) * 10 * dt; p.vy += Math.cos(p.ph) * 10 * dt; }
      else if (p.kind === 3) { p.vx += Math.sin(p.ph * 1.7) * 30 * dt; }
      else if (p.kind === 4) { p.vy += 90 * dt; p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 0.6; }
      else if (p.kind === 5) { p.vx = Math.sin(p.ph * 0.4) * 8; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0 && p.x > this.camX - 300 && p.x < this.camX + W + 400);
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    for (const t of this.texts) { t.life -= dt; t.y -= 26 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  // ---------------- RENDER ----------------
  render() {
    const ctx = this.ctx;
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (this.punchScale > 1.002) {
      ctx.translate(W * 0.35, H * 0.45);
      ctx.scale(this.punchScale, this.punchScale);
      ctx.translate(-W * 0.35, -H * 0.45);
    }
    const { p: pal, i: pi, t: pt } = this.palette();
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    // langit
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgba(pal.skyTop));
    sky.addColorStop(0.75, rgba(pal.skyBot));
    sky.addColorStop(1, rgba(pal.fog));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // bintang
    if (pal.star > 0.01) {
      for (const st of this.stars) {
        const a = pal.star * (0.5 + 0.5 * Math.sin(this.time * 1.6 + st.p));
        ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
        const x = ((st.x - this.camX * 0.01) % W + W) % W;
        ctx.fillRect(x, st.y, st.s, st.s);
      }
    }

    // matahari & bulan
    const ni = (pi + 1) % 4;
    const sunY = lerp(SUN_Y[pi], SUN_Y[ni], pt);
    const sunA = lerp(SUN_A[pi], SUN_A[ni], pt);
    const moonA = lerp(MOON_A[pi], MOON_A[ni], pt);
    const sunX = W * 0.68;
    if (sunA > 0.01) {
      const gl = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 220);
      gl.addColorStop(0, rgba(pal.sun, 0.55 * sunA));
      gl.addColorStop(1, rgba(pal.sun, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rgba(pal.sun, 0.95 * sunA);
      ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, Math.PI * 2); ctx.fill();
    }
    if (moonA > 0.01) {
      const mx = W * 0.28, my = 150;
      const gl = ctx.createRadialGradient(mx, my, 5, mx, my, 160);
      gl.addColorStop(0, `rgba(210,220,255,${0.35 * moonA})`);
      gl.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, W, 400);
      ctx.fillStyle = `rgba(240,244,255,${moonA})`;
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(pal.skyTop, moonA);
      ctx.beginPath(); ctx.arc(mx + 10, my - 6, 23, 0, Math.PI * 2); ctx.fill();
    }

    // awan
    for (const c of this.clouds) {
      const span = W + 500;
      const x = ((c.x - this.camX * 0.08) % span + span) % span - 250;
      ctx.fillStyle = rgba(mix(pal.fog, pal.skyBot, 0.3), 0.5);
      this.pill(x, c.y, c.w, c.h);
      this.pill(x + c.w * 0.2, c.y - c.h * 0.7, c.w * 0.5, c.h);
    }

    ctx.save();
    ctx.translate(sx, sy);

    // pegunungan
    this.layer(0.06, 470, 200, 0.3, pal.far, pal.fog, 0.45, false);
    this.layer(0.16, 560, 170, 1.7, pal.mid, pal.fog, 0.4, false);
    this.layer(0.38, 640, 120, 4.2, pal.near, pal.fog, 0.3, true);

    // kabut bawah
    const fogG = ctx.createLinearGradient(0, 520, 0, 720);
    fogG.addColorStop(0, rgba(pal.fog, 0));
    fogG.addColorStop(1, rgba(pal.fog, 0.35));
    ctx.fillStyle = fogG;
    ctx.fillRect(0, 520, W, 200);

    // ---- dunia ----
    ctx.save();
    ctx.translate(-this.camX, 0);

    // lentera (latar)
    for (const p of this.parts) if (p.kind === 5) this.drawParticle(p, pal);

    for (const is of this.islands) this.drawIsland(is, pal);
    for (const rk of this.rocks) this.drawRock(rk, pal);
    this.drawGround(pal);

    for (const r of this.rings) this.drawRing(r, pal, true);
    for (const p of this.parts) if (p.kind === 1 || p.kind === 0) this.drawParticle(p, pal);
    if (this.mode === 'playing') this.drawGuideReticle(pal);
    if (this.mode !== 'dead') this.drawDragon(pal);
    for (const r of this.rings) this.drawRing(r, pal, false);
    for (const p of this.parts) if (p.kind === 2 || p.kind === 3 || p.kind === 4 || p.kind === 6) this.drawParticle(p, pal);

    // teks
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = clamp(t.life / 0.5, 0, 1);
      ctx.font = t.big ? '700 22px "Cormorant Garamond", serif' : '700 16px Quicksand, sans-serif';
      ctx.fillStyle = `rgba(0,0,0,${0.18 * a})`;
      ctx.fillText(t.text, t.x + 1, t.y + 2);
      ctx.fillStyle = `rgba(255,248,225,${a})`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(10,5,25,${0.28 + pal.star * 0.15})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (this.boost > 0) {
      const a = clamp(this.boost, 0, 1) * 0.18;
      const bg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      bg.addColorStop(0, 'rgba(255,220,140,0)');
      bg.addColorStop(1, `rgba(255,210,120,${a})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.mode !== 'menu') this.drawHUD();
  }

  pill(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + h, y);
    ctx.lineTo(x + w - h, y);
    ctx.arc(x + w - h, y + h, h, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + h, y + 2 * h);
    ctx.arc(x + h, y + h, h, Math.PI / 2, Math.PI * 1.5);
    ctx.fill();
  }

  layer(par: number, base: number, amp: number, seed: number, col: RGB, fog: RGB, fogAmt: number, trees: boolean) {
    const ctx = this.ctx;
    const off = this.camX * par;
    const g = ctx.createLinearGradient(0, base - amp, 0, base + 120);
    g.addColorStop(0, rgba(col));
    g.addColorStop(1, rgba(mix(col, fog, fogAmt)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 6) {
      ctx.lineTo(x, base - ridge(x + off, seed) * amp);
    }
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fill();
    if (trees) {
      ctx.fillStyle = rgba(mix(col, [0, 0, 0], 0.15));
      const step = 26;
      const start = Math.floor(off / step) * step;
      for (let wx = start - step; wx < off + W + step; wx += step) {
        const hsh = hash(wx * 0.37 + seed);
        if (hsh < 0.45) continue;
        const x = wx - off + (hash(wx) - 0.5) * 14;
        const y = base - ridge(x + off, seed) * amp + 2;
        const th = 14 + hsh * 22;
        ctx.beginPath();
        ctx.moveTo(x, y - th);
        ctx.lineTo(x + th * 0.28, y);
        ctx.lineTo(x - th * 0.28, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawGround(pal: Palette) {
    const ctx = this.ctx;
    const x0 = this.camX - 20, x1 = this.camX + W + 20;
    const g = ctx.createLinearGradient(0, 660, 0, H);
    g.addColorStop(0, rgba(pal.groundTop));
    g.addColorStop(1, rgba(pal.ground));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, H + 20);
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, groundY(x));
    ctx.lineTo(x1, H + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(mix(pal.groundTop, pal.fog, 0.45), 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      if (x === x0) ctx.moveTo(x, groundY(x)); else ctx.lineTo(x, groundY(x));
    }
    ctx.stroke();
    // rumput kecil
    ctx.fillStyle = rgba(mix(pal.groundTop, [0, 0, 0], 0.2));
    const step = 22;
    for (let wx = Math.floor(x0 / step) * step; wx < x1; wx += step) {
      const h = hash(wx * 0.13);
      if (h < 0.55) continue;
      const y = groundY(wx);
      const th = 6 + h * 10;
      ctx.beginPath();
      ctx.moveTo(wx - 3, y + 2);
      ctx.lineTo(wx, y - th);
      ctx.lineTo(wx + 3, y + 2);
      ctx.fill();
    }
  }

  drawRock(rk: Rock, pal: Palette) {
    const ctx = this.ctx;
    const dark = pal.rock;
    const light = mix(pal.rock, pal.fog, 0.22);
    ctx.save();
    ctx.translate(rk.x, rk.base);
    ctx.fillStyle = rgba(dark);
    ctx.beginPath();
    rk.left.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    for (let i = rk.right.length - 1; i >= 0; i--) ctx.lineTo(rk.right[i].x, rk.right[i].y);
    ctx.closePath();
    ctx.fill();
    // sisi terang (faset)
    ctx.fillStyle = rgba(light);
    ctx.beginPath();
    const n = rk.right.length;
    ctx.moveTo(rk.right[n - 1].x, rk.right[n - 1].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(rk.right[i].x, rk.right[i].y);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      ctx.lineTo(lerp(rk.w * 0.08, rk.tip, t), rk.right[i].y);
    }
    ctx.closePath();
    ctx.fill();
    // pohon pinus kecil di puncak
    if (rk.tree) {
      const tx = rk.tip, ty = rk.dir * rk.len;
      ctx.fillStyle = rgba(mix(dark, [0, 0, 0], 0.2));
      for (let k = 0; k < 3; k++) {
        const w = 12 - k * 3;
        const yy = ty - 4 - k * 7;
        ctx.beginPath();
        ctx.moveTo(tx - w, yy + 4);
        ctx.lineTo(tx, yy - 8);
        ctx.lineTo(tx + w, yy + 4);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawIsland(is: Island, pal: Palette) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(is.x, is.y + Math.sin(this.time * 0.8 + is.x) * 0);
    ctx.fillStyle = rgba(pal.rock);
    ctx.beginPath();
    ctx.moveTo(is.r, 0);
    for (const p of is.cone) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(mix(pal.rock, pal.fog, 0.2));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(is.r, 0);
    for (const p of is.cone) if (p.x >= 0) ctx.lineTo(p.x, p.y);
    ctx.lineTo(0, is.r * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(mix(pal.near, pal.groundTop, 0.5));
    ctx.beginPath();
    ctx.ellipse(0, 0, is.r * 1.04, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const dc = rgba(mix(pal.rock, [0, 0, 0], 0.2));
    if (is.deco === 0) {
      // torii
      ctx.fillStyle = 'rgba(200,60,50,0.95)';
      ctx.fillRect(-12, -26, 3, 26);
      ctx.fillRect(9, -26, 3, 26);
      ctx.fillRect(-16, -29, 32, 4);
      ctx.fillRect(-13, -21, 26, 2.5);
    } else if (is.deco === 1) {
      ctx.fillStyle = dc;
      for (let k = 0; k < 4; k++) {
        const w = 14 - k * 3;
        const yy = -6 - k * 8;
        ctx.beginPath(); ctx.moveTo(-w, yy + 4); ctx.lineTo(0, yy - 9); ctx.lineTo(w, yy + 4); ctx.fill();
      }
    } else {
      // pagoda kecil
      ctx.fillStyle = dc;
      for (let k = 0; k < 3; k++) {
        const w = 16 - k * 4;
        const yy = -4 - k * 10;
        ctx.fillRect(-w * 0.55, yy - 7, w * 1.1, 7);
        ctx.beginPath(); ctx.moveTo(-w - 3, yy - 6); ctx.lineTo(0, yy - 12); ctx.lineTo(w + 3, yy - 6); ctx.fill();
      }
      ctx.fillRect(-0.7, -46, 1.4, 10);
    }
    ctx.restore();
  }

  drawRing(r: Ring, pal: Palette, back: boolean) {
    const ctx = this.ctx;
    let scale = 1, alpha = 1;
    if (r.state === 1) { scale = 1 + r.t * 1.3; alpha = Math.max(0, 1 - r.t / 0.9); }
    if (r.state === 2) alpha = 0.3;
    if (alpha <= 0) return;
    const pulse = r.state === 0 ? 1 + Math.sin(this.time * 3 + r.x) * 0.04 : 1;
    const ry = r.r * scale * pulse;
    const rx = ry * 0.34;
    const a0 = back ? Math.PI / 2 : -Math.PI / 2;
    const a1 = back ? Math.PI * 1.5 : Math.PI / 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(pal.ring, 0.22 * alpha);
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, ry, 0, a0, a1); ctx.stroke();
    ctx.strokeStyle = rgba(back ? mix(pal.ring, [120, 70, 30], 0.35) : pal.ring, alpha);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, ry, 0, a0, a1); ctx.stroke();
    if (!back) {
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(r.x + 1, r.y, rx, ry, 0, -Math.PI / 2.4, Math.PI / 6); ctx.stroke();
      if (r.state === 0) {
        ctx.fillStyle = rgba(pal.ring, 0.9);
        ctx.beginPath(); ctx.arc(r.x, r.y - ry - 7, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawParticle(p: Particle, pal: Palette) {
    const ctx = this.ctx;
    const a = clamp(p.life / p.max, 0, 1);
    switch (p.color) {
      case 'gold':
        ctx.fillStyle = `rgba(255,224,140,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
        break;
      case 'dust':
        ctx.fillStyle = rgba(mix(pal.groundTop, pal.fog, 0.6), a * 0.8);
        ctx.fillRect(p.x, p.y, p.size, p.size);
        break;
      case 'fly': {
        const tw = 0.5 + 0.5 * Math.sin(p.ph * 4);
        const fa = Math.min(1, p.life, (p.max - p.life)) * tw;
        ctx.fillStyle = `rgba(255,240,150,${fa * 0.25})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,250,200,${fa})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'petal': {
        const pa = Math.min(1, p.life * 0.5) * (1 - pal.star * 0.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ph * 2);
        ctx.fillStyle = `rgba(255,214,222,${pa * 0.85})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5 * Math.abs(Math.sin(p.ph * 3)) + 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'red':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ph * 3);
        ctx.fillStyle = `rgba(226,74,58,${a})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      case 'lantern': {
        const la = Math.min(1, p.life / 3, (p.max - p.life) / 2) * pal.star;
        if (la <= 0) break;
        ctx.fillStyle = `rgba(255,170,80,${la * 0.25})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,190,110,${la})`;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.7, p.size, p.size * 1.4);
        break;
      }
      case 'wind': {
        const { x, y, size } = p;
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.25})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size, y); ctx.stroke();
        break;
      }
    }
  }

  drawDragon(pal: Palette) {
    const ctx = this.ctx;
    const b = this.body;
    const N = b.length;
    if (N < 3) return;
    const t = this.time;
    // undulasi
    const pts: Vec[] = [];
    const ups: Vec[] = [];
    for (let i = 0; i < N; i++) {
      const p0 = b[Math.max(0, i - 1)], p1 = b[Math.min(N - 1, i + 1)];
      let tx = p0.x - p1.x, ty = p0.y - p1.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const ux = ty, uy = -tx;
      const amp = (i / N) * 7 * (1 - clamp((this.spd - 300) / 600, 0, 0.6));
      const o = Math.sin(t * 5.5 - i * 0.42) * amp;
      pts.push({ x: b[i].x + ux * o, y: b[i].y + uy * o });
      ups.push({ x: ux, y: uy });
    }
    const width = (i: number) => {
      const u = i / (N - 1);
      const w = 10.5 * Math.pow(1 - u, 0.7) * (u < 0.1 ? 0.8 + u * 2 : 1);
      return Math.max(1.2, w);
    };

    // Luminous silk ribbon trail
    ctx.save();
    const ribbonGrad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[N - 1].x, pts[N - 1].y);
    ribbonGrad.addColorStop(0, 'rgba(255, 235, 170, 0.45)');
    ribbonGrad.addColorStop(0.4, 'rgba(226, 74, 58, 0.28)');
    ribbonGrad.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.strokeStyle = ribbonGrad;
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();

    // aura boost
    if (this.boost > 0) {
      const a = clamp(this.boost, 0, 1);
      ctx.strokeStyle = `rgba(255,220,140,${0.24 * a})`;
      ctx.lineWidth = 32;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    if (pal.star > 0.3) {
      ctx.fillStyle = `rgba(255,140,100,${0.12 * pal.star})`;
      ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 40, 0, Math.PI * 2); ctx.fill();
    }

    const red = '#e2483a', dark = '#9c2234', gold = '#ffcf6e';

    // kaki
    const legAt = [5, 16];
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    legAt.forEach((li, k) => {
      const p = pts[li], u = ups[li];
      const sw = Math.sin(t * 6 + k * 2) * 4;
      const fx = p.x - u.x * 12 - 4 + sw, fy = p.y - u.y * 12 + 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x - u.x * 8 + 4, p.y - u.y * 8, fx, fy); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = gold;
      for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 4 + c, fy + 3 + c * 2); ctx.stroke(); }
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.6;
    });

    // sirip punggung
    ctx.fillStyle = gold;
    for (let i = 3; i < N - 4; i += 2) {
      const p = pts[i], u = ups[i], w = width(i);
      const q = pts[i + 1];
      const fh = w * 0.7 + 2;
      ctx.beginPath();
      ctx.moveTo(p.x + u.x * w * 0.8, p.y + u.y * w * 0.8);
      ctx.lineTo(p.x + u.x * (w + fh) + (q.x - p.x) * 1.2, p.y + u.y * (w + fh) + (q.y - p.y) * 1.2);
      ctx.lineTo(q.x + u.x * w * 0.8, q.y + u.y * w * 0.8);
      ctx.fill();
    }

    // ekor jumbai
    const tl = pts[N - 1], tu = ups[N - 1], tp = pts[N - 3];
    const dirx = tl.x - tp.x, diry = tl.y - tp.y;
    const dl = Math.hypot(dirx, diry) || 1;
    ctx.fillStyle = gold;
    for (let k = -1; k <= 1; k++) {
      const wav = Math.sin(t * 7 + k) * 4;
      ctx.beginPath();
      ctx.moveTo(tl.x + tu.x * 3, tl.y + tu.y * 3);
      ctx.quadraticCurveTo(tl.x + dirx / dl * 10 + tu.x * (k * 7 + wav), tl.y + diry / dl * 10 + tu.y * (k * 7 + wav), tl.x + dirx / dl * 22 + tu.x * (k * 10 + wav), tl.y + diry / dl * 22 + tu.y * (k * 10 + wav));
      ctx.quadraticCurveTo(tl.x + dirx / dl * 8, tl.y + diry / dl * 8, tl.x - tu.x * 3, tl.y - tu.y * 3);
      ctx.fill();
    }

    // badan
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[N - 1].x, pts[N - 1].y);
    grad.addColorStop(0, red);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const w = width(i);
      const x = pts[i].x + ups[i].x * w, y = pts[i].y + ups[i].y * w;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = N - 1; i >= 0; i--) {
      const w = width(i);
      ctx.lineTo(pts[i].x - ups[i].x * w, pts[i].y - ups[i].y * w);
    }
    ctx.closePath();
    ctx.fill();

    // perut emas
    ctx.strokeStyle = 'rgba(255,214,130,0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 1; i < N - 3; i++) {
      const w = width(i) * 0.55;
      const x = pts[i].x - ups[i].x * w, y = pts[i].y - ups[i].y * w;
      if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // sisik
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    for (let i = 2; i < N - 4; i += 2) {
      const w = width(i) * 0.25;
      ctx.beginPath(); ctx.arc(pts[i].x + ups[i].x * w, pts[i].y + ups[i].y * w, 1.3, 0, Math.PI * 2); ctx.fill();
    }

    // kepala
    const h = pts[0];
    const ha = Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ha);
    // surai
    ctx.fillStyle = gold;
    for (let k = 0; k < 4; k++) {
      const wv = Math.sin(t * 6 + k) * 3;
      ctx.beginPath();
      ctx.moveTo(-2, -6 + k * 2);
      ctx.quadraticCurveTo(-14, -12 + k * 4 + wv, -24 - k * 2, -8 + k * 5 + wv);
      ctx.quadraticCurveTo(-12, -4 + k * 3, -2, -2 + k * 2);
      ctx.fill();
    }
    // tanduk
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(2, -7); ctx.quadraticCurveTo(-8, -14, -18, -18); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-8, -20); ctx.stroke();
    // kepala
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.quadraticCurveTo(6, -11, 12, -6);
    ctx.lineTo(22, -3);
    ctx.quadraticCurveTo(25, 0, 22, 2);
    ctx.lineTo(10, 6);
    ctx.quadraticCurveTo(2, 10, -6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath(); ctx.moveTo(10, 3); ctx.lineTo(22, 1.5); ctx.lineTo(10, 6.5); ctx.closePath(); ctx.fill();
    // mata
    ctx.fillStyle = '#fff6dc';
    ctx.beginPath(); ctx.ellipse(8, -4.5, 2.6, 1.8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0f18';
    ctx.beginPath(); ctx.arc(8.7, -4.5, 1.1, 0, Math.PI * 2); ctx.fill();
    // kumis
    ctx.strokeStyle = 'rgba(255,214,130,0.95)';
    ctx.lineWidth = 1.2;
    const w1 = Math.sin(t * 4) * 6, w2 = Math.cos(t * 3.4) * 6;
    ctx.beginPath(); ctx.moveTo(20, -1); ctx.bezierCurveTo(12, 10, -6, 4 + w1, -28, 14 + w1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(19, 2); ctx.bezierCurveTo(10, 16, -4, 12 + w2, -22, 24 + w2); ctx.stroke();
    ctx.restore();
  }

  drawHUD() {
    const ctx = this.ctx;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,250,240,0.95)';
    ctx.textAlign = 'left';
    ctx.font = '700 26px Quicksand, sans-serif';
    ctx.fillText(`${this.distanceM()}`, 22, 26);
    const dw = ctx.measureText(`${this.distanceM()}`).width;
    ctx.font = '600 14px Quicksand, sans-serif';
    ctx.fillStyle = 'rgba(255,250,240,0.7)';
    ctx.fillText('m', 26 + dw, 36);

    ctx.textAlign = 'right';
    ctx.font = '700 22px Quicksand, sans-serif';
    ctx.fillStyle = 'rgba(255,250,240,0.95)';
    ctx.fillText(`${this.totalScore()}`, W - 22, 26);
    ctx.font = '600 13px Quicksand, sans-serif';
    ctx.fillStyle = 'rgba(255,250,240,0.75)';
    ctx.fillText(`◯ ${this.ringCount}`, W - 22, 54);
    ctx.shadowBlur = 0;

    if (this.combo >= 2) {
      ctx.textAlign = 'center';
      ctx.font = '700 italic 30px "Cormorant Garamond", serif';
      ctx.fillStyle = `rgba(255,224,150,${0.75 + Math.sin(this.time * 6) * 0.2})`;
      ctx.fillText(`×${this.combo}`, W / 2, 24);
    }

    // meter momentum / boost
    const bw = 170, bx = W / 2 - bw / 2, by = H - 46;
    const m = clamp((this.spd - 280) / 540, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    this.round(bx, by, bw, 5, 2.5);
    const col = this.boost > 0 || this.spd > 600 ? 'rgba(255,226,140,1)' : 'rgba(255,250,240,0.9)';
    ctx.fillStyle = col;
    this.round(bx, by, Math.max(5, bw * m), 5, 2.5);
    ctx.textAlign = 'center';
    ctx.font = '600 10px Quicksand, sans-serif';
    ctx.fillStyle = 'rgba(255,250,240,0.65)';
    ctx.fillText(this.spd > 650 ? '✦ SANGAT CEPAT ✦' : this.boost > 0 ? '✦ DORONGAN ANGIN ✦' : 'KECEPATAN NAGA', W / 2, by + 12);

    if (this.playT < 6.5 && this.mode === 'playing') {
      const a = Math.min(1, this.playT, 6.5 - this.playT);
      ctx.font = '600 15px Quicksand, sans-serif';
      ctx.fillStyle = `rgba(255,250,240,${a * 0.92})`;
      ctx.fillText('Gerakkan mouse ke atas & bawah', W / 2, H * 0.2);
      ctx.fillText('untuk mengendalikan naga', W / 2, H * 0.2 + 22);
      ctx.font = '500 13px Quicksand, sans-serif';
      ctx.fillStyle = `rgba(255,226,150,${a * 0.92})`;
      ctx.fillText('Lewati cincin emas untuk dorongan ✦', W / 2, H * 0.2 + 50);
    }
    ctx.restore();
  }

  drawGuideReticle(pal: Palette) {
    const ctx = this.ctx;
    const gx = this.dx + 125;
    const gy = this.targetY;
    const t = this.time;
    ctx.save();
    // Flowing connecting wind filament between dragon snout and mouse target
    ctx.strokeStyle = `rgba(255, 230, 160, 0.22)`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 26;
    ctx.beginPath();
    ctx.moveTo(this.dx + 18, this.dy);
    ctx.quadraticCurveTo(this.dx + 65, (this.dy + gy) / 2, gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing zen target ring
    const r = 12 + Math.sin(t * 4.5) * 2;
    const gl = ctx.createRadialGradient(gx, gy, 2, gx, gy, 28);
    gl.addColorStop(0, `rgba(255, 225, 140, 0.4)`);
    gl.addColorStop(1, `rgba(255, 225, 140, 0)`);
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(gx, gy, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 242, 195, 0.7)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 248, 220, 0.95)`;
    ctx.beginPath();
    ctx.arc(gx, gy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  round(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }
}

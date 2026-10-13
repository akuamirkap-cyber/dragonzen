import { ZenAudio } from './audio';
import { groundY, groundLowest, groundSlope, ridge, TERRAIN_BASE } from './terrain';

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

export interface GameStats { distance: number; rings: number; score: number; bestCombo: number; maxSpeed: string }
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
  flowTimer = 0; flowBank = 0; maxSpeedReached = 300;
  boost = 0; boostEnergy = 0; skimT = 0; skimShown = false;
  deadT = 0; shake = 0; slowmo = 1; reported = false;
  autoDive = false;
  playT = 0;
  bumpCd = 0;
  zoom = 0.62;
  terrainBuf: Float32Array = new Float32Array(0);
  stars: { x: number; y: number; s: number; p: number }[] = [];
  clouds: { x: number; y: number; w: number; h: number }[] = [];
  balloons: { x: number; y: number; r: number; color1: string; color2: string; spd: number; bob: number }[] = [];
  birds: { x: number; y: number; vx: number; vy: number; flap: number; size: number; near: boolean }[] = [];
  shootingStars: { x: number; y: number; len: number; vx: number; vy: number; life: number }[] = [];
  phaseOffset = 0;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    for (let i = 0; i < 120; i++) this.stars.push({ x: rand(-100, W + 100), y: rand(-150, 560), s: rand(0.3, 1.8), p: rand(0, 6.28) });
    for (let i = 0; i < 9; i++) this.clouds.push({ x: rand(-150, W + 450), y: rand(40, 440), w: rand(110, 260), h: rand(12, 26) });
    const balloonColors = [
      ['#df654a', '#fae1b8'],
      ['#3b6885', '#fae7aa'],
      ['#ad476e', '#fde2d4'],
      ['#528574', '#fff1d0'],
      ['#e07a5f', '#f4f1de'],
      ['#3d405b', '#e07a5f'],
      ['#81b29a', '#f2cc8f'],
    ];
    for (let i = 0; i < 8; i++) {
      const bc = balloonColors[i % balloonColors.length];
      this.balloons.push({
        x: i * 360 + rand(40, 260),
        y: rand(80, 360),
        r: rand(24, 46),
        color1: bc[0],
        color2: bc[1],
        spd: rand(0.035, 0.08),
        bob: Math.random() * 6.28,
      });
    }
    // Sekawanan burung bangau putih (White cranes flying across sky & near dragon)
    for (let i = 0; i < 14; i++) {
      const near = i < 5;
      this.birds.push({
        x: rand(0, W + 700),
        y: near ? rand(100, 480) : rand(70, 320),
        vx: near ? rand(70, 115) : rand(45, 75),
        vy: rand(-4, 4),
        flap: Math.random() * 6.28,
        size: near ? rand(9, 14) : rand(5, 7.5),
        near,
      });
    }
    this.resize();
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
    }
    for (let i = 0; i < 150; i++) this.hist.push({ x: -i * 3, y: 320 });
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
  setPointerRatio(ratio: number) {
    const zy = H * 0.5;
    const screenY = ratio * H;
    const worldY = zy + (screenY - zy) / Math.max(0.5, this.zoom);
    const g = groundY(this.dx);
    this.targetY = clamp(worldY, 35, g - 25);
  }
  setTargetY(y: number) { this.setPointerRatio(y / H); }
  adjustTargetY(delta: number) { this.targetY = clamp(this.targetY + delta, 35, groundY(this.dx) - 25); }
  setMuted(m: boolean) { this.audio.setMuted(m); }

  start() {
    this.audio.init();
    this.mode = 'playing';
    this.rocks = []; this.islands = []; this.rings = []; this.texts = [];
    this.parts = this.parts.filter((p) => p.kind === 2 || p.kind === 3);
    this.dy = 300; this.targetY = 300; this.vy = 0; this.punchScale = 1; this.whooshCd = 0; this.ang = 0.05; this.spd = 300;
    this.boostEnergy = 0;
    this.zoom = 0.62;
    this.hist = [];
    for (let i = 0; i < 80; i++) this.hist.push({ x: this.dx - i * 3, y: this.dy });
    this.startX = this.dx;
    this.nextSpawn = this.dx + 650;
    this.ringScore = 0; this.ringCount = 0; this.combo = 0; this.bestCombo = 0;
    this.flowTimer = 0; this.flowBank = 0; this.maxSpeedReached = 300;
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
  /** Alas menara batu yang tumbuh dari tanah: titik TERENDAH pada tapaknya, supaya
   *  lereng yang miring tidak membuat batunya tampak melayang atau menganga. */
  groundBase(x: number, w: number): number {
    return groundLowest(x - w * 0.6, x + w * 0.6) + 34;
  }

  makeRock(dir: number, x: number, len: number, w: number, base?: number): Rock {
    const b = base ?? (dir < 0 ? this.groundBase(x, w) : -24);
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
    return { dir, x, base: b, w, len: L, tip, left, right, tree: dir < 0 && Math.random() < 0.55 };
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
    // Tanah terendah pada bentang cincin: dengan lereng yang miring, memakai satu titik
    // saja bisa membuat cincin terbenam ke dalam bukit beberapa puluh piksel kemudian.
    const g = groundLowest(x - 46, x + 46);
    this.rings.push({ x, y: clamp(y, 70, g - 76), r: 36, state: 0, t: 0 });
  }

  spawnPattern(x: number) {
    const d = this.difficulty();
    const roll = Math.random();
    let width = 120;
    if (roll < 0.28) {
      // gerbang batu
      const gap = lerp(330, 230, d);
      const w = rand(64, 92);
      const b = this.groundBase(x, w);
      const c = rand(200, Math.max(240, b - 210));
      const top = c - gap / 2;
      const bot = b - (c + gap / 2);
      if (top > 30) this.rocks.push(this.makeRock(1, x, top, w));
      if (bot > 30) this.rocks.push(this.makeRock(-1, x, bot, w, b));
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
        else this.rocks.push(this.makeRock(-1, sx, h, 70, this.groundBase(sx, 70)));
      }
      width = 4 * 80;
    } else if (roll < 0.7) {
      // pulau melayang
      const r = rand(36, 56);
      const iy = rand(240, groundLowest(x - r * 1.2, x + r * 1.2) - 260);
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
      const w1 = rand(60, 85), w2 = rand(60, 85);
      const b1 = this.groundBase(x, w1), b2 = this.groundBase(x + 150, w2);
      this.rocks.push(this.makeRock(-1, x, h1, w1, b1));
      this.rocks.push(this.makeRock(-1, x + 150, h2, w2, b2));
      const top = Math.min(b1 - h1, b2 - h2);
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
    const speedRatio = clamp(this.spd / 300, 1, 5.0);
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
        this.cb.onGameOver({
          distance: this.distanceM(),
          rings: Math.floor(this.ringCount),
          score: this.totalScore(),
          bestCombo: this.bestCombo,
          maxSpeed: `${(this.maxSpeedReached / 300).toFixed(1)}x`,
        });
      }
    }
    const sdt = dt * this.slowmo;
    this.punchScale = lerp(this.punchScale, 1.0, 1 - Math.exp(-14 * sdt));
    this.whooshCd = Math.max(0, this.whooshCd - sdt);

    if (this.mode !== 'dead') this.updateDragon(sdt);
    else this.dx += 60 * sdt;

    if (this.spd > this.maxSpeedReached) {
      this.maxSpeedReached = this.spd;
    }

    // Graceful combo flow timer & banking
    if (this.flowTimer > 0) {
      this.flowTimer -= sdt;
      if (this.flowTimer <= 0) {
        if (this.combo > 1 && this.flowBank > 0) {
          const bankedPoints = Math.floor(this.flowBank * this.combo);
          this.ringScore += bankedPoints;
          this.texts.push({ x: this.dx, y: this.dy - 40, text: `Aliran +${bankedPoints} ✦`, life: 1.5, big: true });
          this.audio.chime(Math.min(this.combo - 1, 8), true);
        }
        this.combo = 0;
        this.flowBank = 0;
        this.flowTimer = 0;
      }
    }

    // Dynamic camera zoom: zoomed out wide (0.62), pulling back even further (0.45) at high speed
    const speedNorm = clamp((this.spd - 320) / 1680, 0, 1);
    const targetZoom = lerp(0.62, 0.45, speedNorm);
    this.zoom = lerp(this.zoom, targetZoom, 1 - Math.exp(-2.5 * dt));

    // Dynamic camera lead: reveals more terrain ahead at high flight speeds
    const lead = clamp((this.spd - 320) / 1680, 0, 0.24);
    this.camX = this.dx - W * (0.28 - lead);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.bumpCd = Math.max(0, this.bumpCd - dt);

    // Update birds across sky
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x > this.camX + W + 650) {
        b.x = this.camX - 350;
        b.y = rand(80, 420);
      }
    }

    // Occasional shooting star across night/dusk sky
    const { p: curPal } = this.palette();
    if (curPal.star > 0.08 && Math.random() < dt * 0.45) {
      this.shootingStars.push({
        x: this.camX + rand(100, W + 400),
        y: rand(-80, 220),
        len: rand(70, 140),
        vx: rand(-650, -450),
        vy: rand(200, 320),
        life: 0.55,
      });
    }
    for (const s of this.shootingStars) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.shootingStars = this.shootingStars.filter((s) => s.life > 0);

    if (this.mode === 'playing') {
      this.playT += dt;
      while (this.nextSpawn < this.camX + W + 1400) this.spawnPattern(this.nextSpawn);
    }

    // rings anim
    for (const r of this.rings) r.t += sdt;

    // cleanup with generous offscreen margins
    const cut = this.camX - 600;
    this.rocks = this.rocks.filter((r) => r.x + r.w > cut);
    this.islands = this.islands.filter((r) => r.x + r.r > cut);
    this.rings = this.rings.filter((r) => r.x > cut && !(r.state === 1 && r.t > 1.2));

    this.updateParticles(sdt);
    this.audio.setWind(clamp((this.spd - 150) / 1600, 0, 1) * (this.mode === 'dead' ? 0.2 : 1));
  }

  updateDragon(dt: number) {
    const prevX = this.dx;
    const prevY = this.dy;

    let destY = this.targetY;
    if (this.mode === 'menu') {
      destY = 320 + Math.sin(this.time * 2.2) * 120;
    }

    const gCurrent = groundY(this.dx);
    destY = clamp(destY, 35, gCurrent - 20);

    // Responsive spring physics that stays nimble at higher speeds up to 6x
    const speedRatio = clamp(this.spd / 300, 1, 6.0);
    const diff = destY - this.dy;
    const springK = 62 * Math.min(1.85, Math.sqrt(speedRatio));
    const damping = 15.5 * Math.min(1.4, Math.sqrt(speedRatio));
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

    const BASE_SPEED = 320;
    const MAX_SPEED = 2000; // 6.0x+ base speed
    // Each ring collected adds speed substantially faster (+160 spd per ring!)
    const ringSpeedBonus = Math.floor(this.ringCount) * 160;
    // Flow chain actively propels cruising speed up towards max speed!
    const flowSpeedBonus = Math.min(600, Math.max(0, this.combo - 1) * 75);
    const cruisingSpeed = Math.min(MAX_SPEED, BASE_SPEED + ringSpeedBonus + flowSpeedBonus);

    // Smooth boost energy decay
    this.boostEnergy = lerp(this.boostEnergy, 0, 1 - Math.exp(-2.0 * dt));
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt);

    const desiredSpd = Math.min(MAX_SPEED, cruisingSpeed + this.boostEnergy);
    // Punchy, exhilarating acceleration curve
    this.spd = lerp(this.spd, desiredSpd, 1 - Math.exp(-4.2 * dt));
    this.spd = clamp(this.spd, BASE_SPEED, MAX_SPEED);

    if (this.boost > 0 || this.spd > 520) {
      if (Math.random() < 0.88 && this.body.length > 8) {
        const b = this.body[Math.floor(Math.random() * this.body.length)];
        this.parts.push({ x: b.x, y: b.y, vx: rand(-80, -15), vy: rand(-20, 20), life: 0.8, max: 0.8, size: rand(1.4, 3.2), color: 'gold', kind: 0, ph: 0 });
      }
    }

    // Ekor naga: jejak cahaya stardust lembut
    if (this.body.length > 10 && Math.random() < 0.8) {
      const tail = this.body[this.body.length - 1];
      this.parts.push({
        x: tail.x + rand(-4, 4),
        y: tail.y + rand(-4, 4),
        vx: rand(-65, -15),
        vy: rand(-12, 12),
        life: rand(0.65, 1.15),
        max: 1.15,
        size: rand(1.5, 3.4),
        color: 'stardust',
        kind: 0,
        ph: Math.random() * 6,
      });
    }

    this.dx += Math.cos(this.ang) * this.spd * dt;

    // selancar angin dekat tanah (feeds flow & speed!)
    const alt = groundY(this.dx) - this.dy;
    if (alt < 70 && alt > 0) {
      const f = 1 - alt / 70;
      this.skimT += dt;
      if (this.mode === 'playing') this.ringScore += f * dt * 15;
      if (Math.random() < 0.7) {
        this.parts.push({
          x: this.dx - 10,
          y: groundY(this.dx) - 2,
          vx: rand(-130, -40),
          vy: rand(-60, -10),
          life: 0.7,
          max: 0.7,
          size: rand(1.6, 3.4),
          color: 'gold',
          kind: 1,
          ph: 0
        });
      }
      // Every 0.55s of surfing continuously feeds into flow combo!
      if (this.skimT >= 0.55 && this.mode === 'playing') {
        this.skimT = 0;
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.flowTimer = 3.0;
        this.flowBank += 25;
        this.boostEnergy = Math.min(320, this.boostEnergy + 70);
        this.texts.push({ x: this.dx, y: this.dy - 35, text: `Selancar Angin ✦ ×${this.combo}`, life: 1.25, big: false });
        this.audio.whoosh(0.7);
      }
    } else {
      this.skimT = Math.max(0, this.skimT - dt * 1.5);
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

    // Stable golden rings: anchored in place without jumping or jittering
    for (const r of this.rings) {
      if (r.state !== 0) continue;

      // Proximity check in case dragon head intersects ring
      const headDist = Math.hypot(this.dx - r.x, this.dy - r.y);
      if (headDist <= r.r * 1.05) {
        this.collect(r, Math.abs(this.dy - r.y));
        continue;
      }

      // Continuous collision check as dragon crosses the ring plane
      if (prevX <= r.x && this.dx >= r.x) {
        const t = clamp((r.x - prevX) / Math.max(0.001, this.dx - prevX), 0, 1);
        const crossY = prevY + (this.dy - prevY) * t;
        const dy = Math.abs(crossY - r.y);
        if (dy <= r.r * 1.15) {
          this.collect(r, dy);
        } else {
          r.state = 2; // missed
          r.t = 0;
          // Shorten flow timer on missed ring to give a brief window to save flow with wind surfing
          this.flowTimer = Math.min(this.flowTimer, 1.2);
        }
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
    this.flowTimer = 3.2; // 3.2s grace to link next action
    const perfect = dy < r.r * 0.35;
    this.flowBank += perfect ? 40 : 25;
    
    // Smooth, potent boost energy impulse (+160 for perfect, +100 normal)
    this.boostEnergy = Math.min(350, this.boostEnergy + (perfect ? 160 : 100));
    this.boost = perfect ? 1.6 : 1.1;
    this.punchScale = perfect ? 1.05 : 1.028;
    const pts = 10 * this.combo + (perfect ? 20 : 0);
    this.ringScore += pts;
    this.audio.chime(Math.min(this.combo - 1, 9), perfect);

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

    this.texts.push({ x: r.x, y: r.y - r.r - 12, text: `+${pts} (Aliran ×${this.combo})`, life: 1.25, big: false });
    if (perfect) this.texts.push({ x: r.x + 8, y: r.y - r.r - 38, text: 'Sempurna! ✦', life: 1.4, big: true });
    else if (this.combo >= 2) this.texts.push({ x: r.x + 8, y: r.y - r.r - 38, text: `Aliran ×${this.combo}`, life: 1.25, big: true });
  }

  graze(p: Vec, pushYDir: number) {
    this.bumpCd = 0.55;
    this.shake = 3;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.flowTimer = 3.2;
    this.flowBank += 30;
    this.boostEnergy = Math.min(350, this.boostEnergy + 110);
    this.dy += pushYDir * 18;
    this.vy = pushYDir * 140;
    this.audio.bump();
    this.audio.chime(Math.min(this.combo, 8), true);
    this.texts.push({ x: p.x, y: p.y - 28, text: `Terelak Berani! ✦ ×${this.combo}`, life: 1.3, big: true });
    for (let i = 0; i < 18; i++) {
      this.parts.push({
        x: p.x,
        y: p.y,
        vx: rand(-140, 30),
        vy: rand(-80, 80),
        life: rand(0.5, 0.9),
        max: 0.9,
        size: rand(1.6, 3.2),
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
    const N = 46, SP = 6.2;
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
    // Ambient poetic particles: kelopak bunga sakura, debu gurun keemasan, lentera malam
    const night = pal.star;
    if (Math.random() < dt * 8) {
      if (night > 0.55 && Math.random() < 0.6) {
        // Kunang-kunang malam
        this.parts.push({ x: this.camX + rand(0, W + 300), y: rand(80, 650), vx: rand(-15, 15), vy: rand(-15, 5), life: 6, max: 6, size: rand(1.2, 2.4), color: 'fly', kind: 2, ph: Math.random() * 6 });
      } else {
        // Kelopak bunga sakura berguguran ditiup angin
        this.parts.push({ x: this.camX + W + rand(20, 140), y: rand(-40, 580), vx: rand(-85, -35), vy: rand(18, 45), life: 10, max: 10, size: rand(2.2, 4.2), color: 'petal', kind: 3, ph: Math.random() * 6 });
      }
    }
    // Debu gurun keemasan / stardust atmosferik yang terhempas angin
    if (Math.random() < dt * 9) {
      this.parts.push({
        x: this.camX + W + rand(10, 120),
        y: rand(120, 680),
        vx: rand(-110, -50),
        vy: rand(-10, 15),
        life: rand(4, 7),
        max: 7,
        size: rand(1.2, 2.5),
        color: 'gold-dust',
        kind: 2,
        ph: Math.random() * 6,
      });
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

    const { p: pal, i: pi, t: pt } = this.palette();
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    // Apply camera zoom transform to game world
    ctx.save();
    const zx = W * 0.35;
    const zy = H * 0.5;
    ctx.translate(zx, zy);
    ctx.scale(this.zoom * this.punchScale, this.zoom * this.punchScale);
    ctx.translate(-zx, -zy);

    // langit (full bleed with wide margins for zoom out)
    const sky = ctx.createLinearGradient(0, -350, 0, H + 350);
    sky.addColorStop(0, rgba(pal.skyTop));
    sky.addColorStop(0.75, rgba(pal.skyBot));
    sky.addColorStop(1, rgba(pal.fog));
    ctx.fillStyle = sky;
    ctx.fillRect(-350, -450, W + 700, H + 900);

    // bintang
    if (pal.star > 0.01) {
      for (const st of this.stars) {
        const a = pal.star * (0.5 + 0.5 * Math.sin(this.time * 1.6 + st.p));
        ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
        const span = W + 450;
        const x = ((st.x - this.camX * 0.01 + 225) % span + span) % span - 225;
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
      const gl = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 260);
      gl.addColorStop(0, rgba(pal.sun, 0.55 * sunA));
      gl.addColorStop(1, rgba(pal.sun, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(-350, -450, W + 700, H + 900);
      ctx.fillStyle = rgba(pal.sun, 0.95 * sunA);
      ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, Math.PI * 2); ctx.fill();
    }
    if (moonA > 0.01) {
      const mx = W * 0.28, my = 150;
      const gl = ctx.createRadialGradient(mx, my, 5, mx, my, 180);
      gl.addColorStop(0, `rgba(210,220,255,${0.35 * moonA})`);
      gl.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(-350, -450, W + 700, 650);
      ctx.fillStyle = `rgba(240,244,255,${moonA})`;
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(pal.skyTop, moonA);
      ctx.beginPath(); ctx.arc(mx + 10, my - 6, 23, 0, Math.PI * 2); ctx.fill();
    }

    // awan
    for (const c of this.clouds) {
      const span = W + 700;
      const x = ((c.x - this.camX * 0.08 + 350) % span + span) % span - 350;
      ctx.fillStyle = rgba(mix(pal.fog, pal.skyBot, 0.3), 0.5);
      this.pill(x, c.y, c.w, c.h);
      this.pill(x + c.w * 0.2, c.y - c.h * 0.7, c.w * 0.5, c.h);
    }

    // Bintang jatuh (shooting stars) melintasi langit malam & senja
    this.drawShootingStars();

    ctx.save();
    ctx.translate(sx, sy);

    // Pegunungan jauh dengan siluet pagoda kuno di cakrawala
    this.layer(0.06, 455, 210, 0.3, pal.far, pal.fog, 0.45, false, true, sunA);

    // Balon udara panas berukuran besar melayang perlahan di cakrawala (Alto's Odyssey hot air balloons)
    this.drawBalloons(pal, sunA);

    // Pegunungan tengah dengan puing kuil/pagoda kuno di puncak bukit batu yang diterpa cahaya matahari
    this.layer(0.16, 535, 180, 1.7, pal.mid, pal.fog, 0.4, false, true, sunA);

    // Sekawanan burung bangau putih terbang di cakrawala (distant cranes)
    this.drawBirds(pal, false);

    // Pegunungan dekat dengan pepohonan pinus
    this.layer(0.38, 620, 135, 4.2, pal.near, pal.fog, 0.3, true, false, sunA);

    // Kabut lembut yang bergulung di lembah bawah (rolling valley fog)
    this.drawValleyFog(pal);

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
    if (this.mode === 'playing') this.drawGuideReticle();
    if (this.mode !== 'dead') this.drawDragon(pal);
    // Sekawanan burung bangau putih terbang bersama naga (near cranes)
    this.drawBirds(pal, true);
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
    ctx.restore(); // ends camera zoom transform

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

  layer(par: number, base: number, amp: number, seed: number, col: RGB, fog: RGB, fogAmt: number, trees: boolean, ruins = false, sunA = 0) {
    const ctx = this.ctx;
    const off = this.camX * par;
    const g = ctx.createLinearGradient(0, base - amp, 0, base + 180);
    g.addColorStop(0, rgba(col));
    g.addColorStop(1, rgba(mix(col, fog, fogAmt)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-350, H + 400);
    for (let x = -350; x <= W + 350; x += 6) {
      ctx.lineTo(x, base - ridge(x + off, seed) * amp);
    }
    ctx.lineTo(W + 350, H + 400);
    ctx.closePath();
    ctx.fill();

    // Puing kuil & pagoda kuno di puncak bukit batu yang diterpa cahaya matahari
    if (ruins) {
      const ruinStep = 440;
      const rStart = Math.floor((off - 350) / ruinStep) * ruinStep;
      for (let wx = rStart; wx < off + W + 350; wx += ruinStep) {
        const hsh = hash(wx * 0.73 + seed * 2.1);
        if (hsh < 0.32) continue;
        const x = wx - off;
        const y = base - ridge(x + off, seed) * amp;
        const scale = 0.85 + hsh * 0.55;
        const ruinType = Math.floor(hsh * 3); // 0: Pagoda kuno bertingkat, 1: Gapura kuil kuno runtuh, 2: Stupa batu

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        ctx.fillStyle = rgba(mix(col, [15, 10, 25], 0.22));

        if (ruinType === 0) {
          // Pagoda kuno bertingkat 3 (Ancient multi-tier pagoda)
          ctx.fillRect(-18, -4, 36, 4);
          ctx.fillRect(-13, -8, 26, 4);
          // Tingkat 1
          ctx.fillRect(-8, -20, 16, 12);
          ctx.beginPath();
          ctx.moveTo(-18, -19); ctx.quadraticCurveTo(0, -23, 18, -19);
          ctx.lineTo(13, -24); ctx.lineTo(-13, -24); ctx.closePath(); ctx.fill();
          // Tingkat 2
          ctx.fillRect(-6, -34, 12, 10);
          ctx.beginPath();
          ctx.moveTo(-15, -33); ctx.quadraticCurveTo(0, -37, 15, -33);
          ctx.lineTo(10, -38); ctx.lineTo(-10, -38); ctx.closePath(); ctx.fill();
          // Tingkat 3
          ctx.fillRect(-4, -46, 8, 8);
          ctx.beginPath();
          ctx.moveTo(-11, -45); ctx.quadraticCurveTo(0, -49, 11, -45);
          ctx.lineTo(7, -50); ctx.lineTo(-7, -50); ctx.closePath(); ctx.fill();
          // Tiang sorin puncak
          ctx.fillRect(-1, -62, 2, 12);
          ctx.beginPath(); ctx.arc(0, -62, 2.5, 0, Math.PI * 2); ctx.fill();

          // Diterpa cahaya matahari (Sunlight rim-lighting)
          if (sunA > 0.05) {
            ctx.strokeStyle = `rgba(255, 230, 150, ${0.45 * sunA})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(18, -19); ctx.lineTo(13, -24);
            ctx.moveTo(15, -33); ctx.lineTo(10, -38);
            ctx.moveTo(11, -45); ctx.lineTo(7, -50);
            ctx.moveTo(1, -50); ctx.lineTo(1, -62);
            ctx.stroke();
          }
        } else if (ruinType === 1) {
          // Gapura kuil / Torii kuno lapuk
          ctx.fillRect(-16, -28, 3.5, 28);
          ctx.fillRect(12.5, -28, 3.5, 28);
          ctx.beginPath();
          ctx.moveTo(-22, -32); ctx.quadraticCurveTo(0, -36, 22, -32);
          ctx.lineTo(18, -27); ctx.quadraticCurveTo(0, -30, -18, -27);
          ctx.closePath(); ctx.fill();
          ctx.fillRect(-26, -10, 4, 10);
          ctx.fillRect(23, -7, 4, 7);

          if (sunA > 0.05) {
            ctx.strokeStyle = `rgba(255, 230, 150, ${0.45 * sunA})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(22, -32); ctx.lineTo(18, -27); ctx.lineTo(16, 0);
            ctx.stroke();
          }
        } else {
          // Stupa batu keramat di puncak tebing
          ctx.fillRect(-12, -4, 24, 4);
          ctx.beginPath(); ctx.arc(0, -14, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(-4, -28, 8, 14);
          ctx.fillRect(-1.5, -38, 3, 10);
          ctx.beginPath(); ctx.arc(0, -38, 2.5, 0, Math.PI * 2); ctx.fill();

          if (sunA > 0.05) {
            ctx.strokeStyle = `rgba(255, 230, 150, ${0.45 * sunA})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(0, -14, 10, -Math.PI * 0.4, Math.PI * 0.2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    if (trees) {
      ctx.fillStyle = rgba(mix(col, [0, 0, 0], 0.15));
      const step = 26;
      const start = Math.floor((off - 350) / step) * step;
      for (let wx = start; wx < off + W + 350; wx += step) {
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

  drawShootingStars() {
    const ctx = this.ctx;
    for (const s of this.shootingStars) {
      const a = clamp(s.life / 0.55, 0, 1);
      const angle = Math.atan2(s.vy, s.vx);
      const tailX = s.x - Math.cos(angle) * s.len;
      const tailY = s.y - Math.sin(angle) * s.len;
      const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255, 255, 255, ${a * 0.95})`);
      grad.addColorStop(0.35, `rgba(255, 235, 180, ${a * 0.7})`);
      grad.addColorStop(1, 'rgba(255, 210, 120, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBalloons(pal: Palette, sunA: number) {
    const ctx = this.ctx;
    const span = W + 700;
    for (const b of this.balloons) {
      const bx = ((b.x - this.camX * b.spd + 350) % span + span) % span - 350;
      const by = b.y + Math.sin(this.time * 0.7 + b.bob) * 14;
      const r = b.r;
      const atmosphericFade = 0.88;

      ctx.save();
      ctx.translate(bx, by);

      // Balon udara siluet Alto's Odyssey
      const grad = ctx.createLinearGradient(0, -r, 0, r * 1.15);
      grad.addColorStop(0, rgba(mix(b.color1 as any, pal.fog, 0.28), atmosphericFade));
      grad.addColorStop(1, rgba(mix(b.color2 as any, pal.fog, 0.45), atmosphericFade));
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 1.15, -r, r * 1.1, r * 0.4, r * 0.42, r * 1.15);
      ctx.lineTo(-r * 0.42, r * 1.15);
      ctx.bezierCurveTo(-r * 1.1, r * 0.4, -r * 1.15, -r, 0, -r);
      ctx.closePath();
      ctx.fill();

      // Garis belang vertikal kanopi balon (Alto signature stripes)
      ctx.fillStyle = rgba(mix(b.color2 as any, pal.fog, 0.35), 0.75);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.55, -r * 0.9, r * 0.45, r * 0.3, r * 0.18, r * 1.15);
      ctx.lineTo(-r * 0.18, r * 1.15);
      ctx.bezierCurveTo(-r * 0.45, r * 0.3, -r * 0.55, -r * 0.9, 0, -r);
      ctx.closePath();
      ctx.fill();

      // Garis terang tengah
      ctx.fillStyle = rgba(mix(b.color1 as any, pal.fog, 0.2), 0.85);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.2, -r * 0.9, r * 0.15, r * 0.3, r * 0.06, r * 1.15);
      ctx.lineTo(-r * 0.06, r * 1.15);
      ctx.bezierCurveTo(-r * 0.15, r * 0.3, -r * 0.2, -r * 0.9, 0, -r);
      ctx.closePath();
      ctx.fill();

      // Tutup atas balon
      ctx.fillStyle = rgba(mix(pal.rock, pal.fog, 0.4), 0.8);
      ctx.beginPath();
      ctx.arc(0, -r, r * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Pendar nyala api burner balon
      const flameA = 0.5 + 0.4 * Math.sin(this.time * 12 + b.bob);
      const fg = ctx.createRadialGradient(0, r * 1.25, 1, 0, r * 1.25, r * 0.6);
      fg.addColorStop(0, `rgba(255, 190, 80, ${flameA * 0.6})`);
      fg.addColorStop(1, 'rgba(255, 180, 60, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(0, r * 1.25, r * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 235, 140, ${flameA})`;
      ctx.beginPath();
      ctx.arc(0, r * 1.25, r * 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Tali gantung keranjang
      ctx.strokeStyle = rgba(mix(pal.rock, pal.fog, 0.5), 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, r * 1.15);
      ctx.lineTo(-r * 0.22, r * 1.45);
      ctx.moveTo(r * 0.35, r * 1.15);
      ctx.lineTo(r * 0.22, r * 1.45);
      ctx.stroke();

      // Keranjang penumpang (Gondola)
      ctx.fillStyle = rgba(mix(pal.rock, pal.fog, 0.4), 0.9);
      const bw = r * 0.44, bh = r * 0.26;
      ctx.fillRect(-bw / 2, r * 1.45, bw, bh);

      // Sisi yang diterpa cahaya matahari
      if (sunA > 0.08) {
        ctx.strokeStyle = `rgba(255, 240, 180, ${0.45 * sunA})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.98, -Math.PI * 0.7, -Math.PI * 0.1);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawBirds(pal: Palette, nearOnly: boolean) {
    const ctx = this.ctx;
    for (const b of this.birds) {
      if (b.near !== nearOnly) continue;
      const x = b.x - this.camX * (b.near ? 0.95 : 0.3);
      const span = W + 700;
      const sx = ((x + 350) % span + span) % span - 350;
      const sy = b.y;
      const sz = b.size;

      // Kepakan sayap bangau anggun
      const flapAngle = Math.sin(this.time * 6.5 + b.flap) * 0.75;

      ctx.save();
      ctx.translate(sx, sy);

      // Tubuh putih bangau
      ctx.fillStyle = b.near ? '#ffffff' : rgba(mix([255, 255, 255], pal.fog, 0.3), 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, sz, sz * 0.32, 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Leher panjang & kepala
      ctx.beginPath();
      ctx.moveTo(sz * 0.6, 0);
      ctx.quadraticCurveTo(sz * 1.2, -sz * 0.15, sz * 1.5, -sz * 0.25);
      ctx.lineTo(sz * 1.4, -sz * 0.1);
      ctx.closePath();
      ctx.fill();

      // Mahkota merah di kepala
      if (b.near) {
        ctx.fillStyle = '#e2483a';
        ctx.beginPath();
        ctx.arc(sz * 1.45, -sz * 0.25, sz * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Kaki ramping menjuntai
      ctx.strokeStyle = rgba(mix([80, 80, 80], pal.fog, 0.4), 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.7, sz * 0.1);
      ctx.lineTo(-sz * 1.6, sz * 0.25);
      ctx.stroke();

      // Sayap putih berujung bulu hitam
      const wingSpan = sz * 1.6;
      const wingDrop = flapAngle * sz * 1.2;

      // Sayap jauh
      ctx.fillStyle = b.near ? '#f0f3f8' : rgba(mix([230, 235, 245], pal.fog, 0.3), 0.85);
      ctx.beginPath();
      ctx.moveTo(sz * 0.1, -sz * 0.1);
      ctx.quadraticCurveTo(0, -wingSpan * 0.7 - wingDrop * 0.8, -sz * 0.5, -wingSpan - wingDrop);
      ctx.quadraticCurveTo(-sz * 0.2, -wingSpan * 0.5 - wingDrop * 0.5, -sz * 0.2, 0);
      ctx.closePath();
      ctx.fill();

      // Ujung bulu sayap hitam
      ctx.fillStyle = '#222226';
      ctx.beginPath();
      ctx.moveTo(-sz * 0.35, -wingSpan * 0.75 - wingDrop * 0.85);
      ctx.lineTo(-sz * 0.5, -wingSpan - wingDrop);
      ctx.lineTo(-sz * 0.25, -wingSpan * 0.8 - wingDrop * 0.8);
      ctx.closePath();
      ctx.fill();

      // Sayap dekat
      ctx.fillStyle = b.near ? '#ffffff' : rgba(mix([255, 255, 255], pal.fog, 0.3), 0.95);
      ctx.beginPath();
      ctx.moveTo(sz * 0.2, 0);
      ctx.quadraticCurveTo(sz * 0.1, wingSpan * 0.7 + wingDrop, -sz * 0.4, wingSpan + wingDrop);
      ctx.quadraticCurveTo(-sz * 0.1, wingSpan * 0.5 + wingDrop * 0.6, -sz * 0.15, sz * 0.1);
      ctx.closePath();
      ctx.fill();

      // Ujung bulu sayap dekat hitam
      ctx.fillStyle = '#1e1e22';
      ctx.beginPath();
      ctx.moveTo(-sz * 0.25, wingSpan * 0.75 + wingDrop * 0.85);
      ctx.lineTo(-sz * 0.4, wingSpan + wingDrop);
      ctx.lineTo(-sz * 0.15, wingSpan * 0.8 + wingDrop * 0.8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  drawValleyFog(pal: Palette) {
    const ctx = this.ctx;
    const t = this.time;
    // 3 lapisan kabut bergulung lembut di lembah bawah (Alto's Odyssey valley fog)
    const fogLayers = [
      { yBase: 560, amp: 26, speed: 16, alpha: 0.22, waveFreq: 0.0035 },
      { yBase: 620, amp: 34, speed: 25, alpha: 0.3, waveFreq: 0.0028 },
      { yBase: 680, amp: 40, speed: 36, alpha: 0.38, waveFreq: 0.0022 },
    ];

    // Kabut ikut mengalir mengikuti ketinggian lereng di layar: saat naga meluncur
    // menuruni lereng, lapisan kabut pun turun perlahan bersamanya.
    const follow = (groundY(this.camX + W * 0.5) - TERRAIN_BASE) * 0.45;

    for (let i = 0; i < fogLayers.length; i++) {
      const fl = fogLayers[i];
      const off = this.camX * (0.12 + i * 0.08) + t * fl.speed;
      const yBase = fl.yBase + follow;
      const g = ctx.createLinearGradient(0, yBase - fl.amp, 0, yBase + 120);
      g.addColorStop(0, rgba(pal.fog, 0));
      g.addColorStop(0.35, rgba(pal.fog, fl.alpha));
      g.addColorStop(1, rgba(pal.fog, fl.alpha * 0.75));
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.moveTo(-350, H + 400);
      for (let x = -350; x <= W + 350; x += 12) {
        const wave = Math.sin((x + off) * fl.waveFreq) * fl.amp
          + Math.sin((x + off) * fl.waveFreq * 2.3 + 1.2) * (fl.amp * 0.35);
        ctx.lineTo(x, yBase + wave);
      }
      ctx.lineTo(W + 350, H + 400);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawGround(pal: Palette) {
    const ctx = this.ctx;
    const x0 = this.camX - 350, x1 = this.camX + W + 500;
    // Sampel ketinggian lereng sekali saja per frame, lalu dipakai ulang oleh isian
    // tanah, strata, tepi lereng, dan rumput — jauh lebih hemat daripada memanggil
    // groundY() berulang kali untuk kontur yang sama.
    const step = 4;
    const n = Math.ceil((x1 - x0) / step) + 1;
    if (this.terrainBuf.length < n) this.terrainBuf = new Float32Array(n + 64);
    const ys = this.terrainBuf;
    for (let i = 0; i < n; i++) ys[i] = groundY(x0 + i * step);
    const yAt = (x: number) => ys[clamp(Math.round((x - x0) / step), 0, n - 1)];

    // Gradasi tanah mengikuti ketinggian lereng di tengah layar, bukan dipatok ke satu
    // garis tetap: jadi lapisan warna tanah ikut "turun" bersama lerengnya.
    const gCenter = yAt(this.camX + W * 0.5);
    const g = ctx.createLinearGradient(0, gCenter - 40, 0, gCenter + 330);
    g.addColorStop(0, rgba(pal.groundTop));
    g.addColorStop(1, rgba(pal.ground));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, H + 400);
    for (let i = 0; i < n; i++) ctx.lineTo(x0 + i * step, ys[i]);
    ctx.lineTo(x1, H + 400);
    ctx.closePath();
    ctx.fill();

    // Strata (tingkat lapisan lereng) yang mengikuti kontur permukaan — inilah yang
    // membuat bukit-bukit terbaca "miring menurun" dan bukan garis datar yang lurus.
    for (let k = 0; k < 4; k++) {
      const depth = 34 + k * 52;
      ctx.strokeStyle = rgba(mix(pal.groundTop, pal.ground, 0.3 + k * 0.2), 0.3 - k * 0.055);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i += 3) ctx.lineTo(x0 + i * step, ys[i] + depth);
      ctx.stroke();
    }

    // Tepi lereng: makin menurun (menghadap matahari), makin terang cahaya tepinya,
    // dan sisi tanjakan diberi bayangan tipis supaya bentuk lerengnya jelas terbaca.
    const litBase = mix(pal.groundTop, pal.fog, 0.55);
    const shade = mix(pal.groundTop, [0, 0, 0], 0.15);
    const rstep = 12;
    for (let wx = Math.floor(x0 / rstep) * rstep; wx <= x1; wx += rstep) {
      const s = (yAt(wx + 20) - yAt(wx - 20)) / 40;
      const lit = clamp(0.5 - s * 2.4, 0, 1);
      ctx.strokeStyle = rgba(litBase, 0.16 + lit * 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx, yAt(wx) + 0.8);
      ctx.lineTo(wx + rstep, yAt(wx + rstep) + 0.8);
      ctx.stroke();
      if (lit < 0.28) {
        ctx.strokeStyle = rgba(shade, (0.28 - lit) * 0.7);
        ctx.beginPath();
        ctx.moveTo(wx, yAt(wx) + 3.4);
        ctx.lineTo(wx + rstep, yAt(wx + rstep) + 3.4);
        ctx.stroke();
      }
    }

    // rumput / rumpun kecil: jarang & pendek, supaya siluet lerengnya tetap bersih
    ctx.fillStyle = rgba(mix(pal.groundTop, [0, 0, 0], 0.2), 0.75);
    const gstep = 30;
    for (let wx = Math.floor(x0 / gstep) * gstep; wx < x1; wx += gstep) {
      const h = hash(wx * 0.13);
      if (h < 0.78) continue;
      const y = yAt(wx);
      const th = 4 + h * 6;
      ctx.beginPath();
      ctx.moveTo(wx - 2.4, y + 2);
      ctx.lineTo(wx, y - th);
      ctx.lineTo(wx + 2.4, y + 2);
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
    // tapak batu: elips yang dimiringkan mengikuti kemiringan lereng, jadi batu tampak
    // benar-benar tumbuh dari lereng (bukan berdiri di garis datar).
    if (rk.dir < 0) {
      const s = groundSlope(rk.x, Math.max(20, rk.w * 0.6));
      ctx.fillStyle = rgba(mix(dark, [0, 0, 0], 0.18), 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 2, rk.w * 0.62, 6 + Math.min(6, Math.abs(s) * 22), Math.atan(s), 0, Math.PI * 2);
      ctx.fill();
    }
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
      case 'gold-dust': {
        const ga = Math.min(1, p.life * 0.6) * (0.6 + 0.4 * Math.sin(p.ph * 4));
        ctx.fillStyle = `rgba(255,225,130,${ga * 0.85})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.8 + 0.25 * Math.sin(p.ph * 3)), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'stardust': {
        const sa = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = `rgba(255,245,215,${sa * 0.95})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,215,110,${sa * 0.35})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
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
    // Undulasi luwes seperti kaligrafi tinta
    const pts: Vec[] = [];
    const ups: Vec[] = [];
    for (let i = 0; i < N; i++) {
      const p0 = b[Math.max(0, i - 1)], p1 = b[Math.min(N - 1, i + 1)];
      let tx = p0.x - p1.x, ty = p0.y - p1.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const ux = ty, uy = -tx;
      const amp = (i / N) * 9.5 * (1 - clamp((this.spd - 300) / 1400, 0, 0.5));
      const o = Math.sin(t * 5.2 - i * 0.28) * amp;
      pts.push({ x: b[i].x + ux * o, y: b[i].y + uy * o });
      ups.push({ x: ux, y: uy });
    }
    const width = (i: number) => {
      const u = i / (N - 1);
      const w = 11.2 * Math.pow(1 - u, 0.72) * (u < 0.08 ? 0.8 + u * 2.5 : 1);
      return Math.max(1.2, w);
    };

    // Selendang Sutra Ekor Naga (Extended Calligraphy Silk Scarf trail like Alto's scarf)
    // Dynamic length: bertambah panjang seiring peningkatan kecepatan dan kombo aliran
    const scarfCount = Math.min(this.hist.length, 25 + Math.floor(clamp((this.spd - 300) / 28, 0, 55)) + Math.min(45, this.combo * 5));
    if (scarfCount > 5) {
      ctx.save();
      const scarfPts: Vec[] = [];
      const tailPt = pts[N - 1];
      scarfPts.push(tailPt);
      for (let k = 1; k < scarfCount; k++) {
        const hp = this.hist[k];
        if (!hp) break;
        const wave = Math.sin(t * 7.5 - k * 0.35) * (k / scarfCount) * 7.5;
        const prevHp = this.hist[Math.max(0, k - 1)];
        let hdx = prevHp.x - hp.x, hdy = prevHp.y - hp.y;
        const hl = Math.hypot(hdx, hdy) || 1;
        hdx /= hl; hdy /= hl;
        scarfPts.push({ x: hp.x - hdy * wave, y: hp.y + hdx * wave });
      }

      // Kilau luar selendang sutra kaligrafi
      ctx.strokeStyle = 'rgba(255, 225, 140, 0.45)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      scarfPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();

      // Pita sutra utama gradasi emas & merah vermilion
      const headS = scarfPts[0], endS = scarfPts[scarfPts.length - 1];
      const sGrad = ctx.createLinearGradient(headS.x, headS.y, endS.x, endS.y);
      sGrad.addColorStop(0, 'rgba(255, 230, 160, 0.95)');
      sGrad.addColorStop(0.3, 'rgba(226, 74, 58, 0.85)');
      sGrad.addColorStop(0.7, 'rgba(156, 34, 52, 0.6)');
      sGrad.addColorStop(1, 'rgba(255, 215, 120, 0)');
      ctx.strokeStyle = sGrad;
      ctx.lineWidth = 9;
      ctx.beginPath();
      scarfPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();

      // Benang emas bordir di tengah selendang
      ctx.strokeStyle = 'rgba(255, 245, 205, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      scarfPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }

    // Luminous silk ribbon trail sepanjang tubuh naga
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

    // Aura boost & celestial flow aura
    if (this.boost > 0 || (this.flowTimer > 0 && this.combo >= 2)) {
      const a = Math.max(clamp(this.boost, 0, 1), clamp(this.flowTimer / 2.5, 0, 1) * Math.min(1, this.combo * 0.25));
      ctx.strokeStyle = `rgba(255,225,130,${0.28 * a})`;
      ctx.lineWidth = 26 + Math.min(18, this.combo * 2);
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

    // Kaki naga
    const legAt = [8, 24];
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    legAt.forEach((li, k) => {
      if (li >= N) return;
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

    // Sirip punggung naga
    ctx.fillStyle = gold;
    for (let i = 4; i < N - 6; i += 2) {
      const p = pts[i], u = ups[i], w = width(i);
      const q = pts[i + 1];
      const fh = w * 0.7 + 2;
      ctx.beginPath();
      ctx.moveTo(p.x + u.x * w * 0.8, p.y + u.y * w * 0.8);
      ctx.lineTo(p.x + u.x * (w + fh) + (q.x - p.x) * 1.2, p.y + u.y * (w + fh) + (q.y - p.y) * 1.2);
      ctx.lineTo(q.x + u.x * w * 0.8, q.y + u.y * w * 0.8);
      ctx.fill();
    }

    // Ekor jumbai berombak
    const tl = pts[N - 1], tu = ups[N - 1], tp = pts[N - 3];
    const dirx = tl.x - tp.x, diry = tl.y - tp.y;
    const dl = Math.hypot(dirx, diry) || 1;
    ctx.fillStyle = gold;
    for (let k = -1; k <= 1; k++) {
      const wav = Math.sin(t * 7 + k) * 4;
      ctx.beginPath();
      ctx.moveTo(tl.x + tu.x * 3, tl.y + tu.y * 3);
      ctx.quadraticCurveTo(tl.x + dirx / dl * 10 + tu.x * (k * 7 + wav), tl.y + diry / dl * 10 + tu.y * (k * 7 + wav), tl.x + dirx / dl * 24 + tu.x * (k * 11 + wav), tl.y + diry / dl * 24 + tu.y * (k * 11 + wav));
      ctx.quadraticCurveTo(tl.x + dirx / dl * 8, tl.y + diry / dl * 8, tl.x - tu.x * 3, tl.y - tu.y * 3);
      ctx.fill();
    }

    // Badan naga kaligrafi
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[N - 1].x, pts[N - 1].y);
    grad.addColorStop(0, red);
    grad.addColorStop(0.6, dark);
    grad.addColorStop(1, '#661424');
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

    // Perut emas
    ctx.strokeStyle = 'rgba(255,214,130,0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 1; i < N - 3; i++) {
      const w = width(i) * 0.55;
      const x = pts[i].x - ups[i].x * w, y = pts[i].y - ups[i].y * w;
      if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Sisik
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    for (let i = 2; i < N - 4; i += 2) {
      const w = width(i) * 0.25;
      ctx.beginPath(); ctx.arc(pts[i].x + ups[i].x * w, pts[i].y + ups[i].y * w, 1.3, 0, Math.PI * 2); ctx.fill();
    }

    // Kepala naga
    const h = pts[0];
    const ha = Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ha);
    // Surai emas
    ctx.fillStyle = gold;
    for (let k = 0; k < 4; k++) {
      const wv = Math.sin(t * 6 + k) * 3;
      ctx.beginPath();
      ctx.moveTo(-2, -6 + k * 2);
      ctx.quadraticCurveTo(-14, -12 + k * 4 + wv, -24 - k * 2, -8 + k * 5 + wv);
      ctx.quadraticCurveTo(-12, -4 + k * 3, -2, -2 + k * 2);
      ctx.fill();
    }
    // Tanduk
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(2, -7); ctx.quadraticCurveTo(-8, -14, -18, -18); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-8, -20); ctx.stroke();
    // Kepala
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
    // Mata
    ctx.fillStyle = '#fff6dc';
    ctx.beginPath(); ctx.ellipse(8, -4.5, 2.6, 1.8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0f18';
    ctx.beginPath(); ctx.arc(8.7, -4.5, 1.1, 0, Math.PI * 2); ctx.fill();
    // Kumis naga luwes meliuk seperti kaligrafi tinta
    ctx.strokeStyle = 'rgba(255,225,130,0.95)';
    ctx.lineWidth = 1.8;
    const w1 = Math.sin(t * 4.2) * 9, w2 = Math.cos(t * 3.6) * 9;
    ctx.beginPath(); ctx.moveTo(22, -1); ctx.bezierCurveTo(8, 14, -18, 6 + w1, -50, 20 + w1); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(21, 2); ctx.bezierCurveTo(6, 20, -14, 16 + w2, -44, 32 + w2); ctx.stroke();
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

    if (this.combo >= 2 && this.flowTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = '700 italic 30px "Cormorant Garamond", serif';
      ctx.fillStyle = `rgba(255,224,150,${0.85 + Math.sin(this.time * 6) * 0.15})`;
      ctx.fillText(`ALIRAN ×${this.combo}`, W / 2, 22);

      // Grace timer bar
      const bwFlow = 74;
      const prog = clamp(this.flowTimer / 3.2, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      this.round(W / 2 - bwFlow / 2, 54, bwFlow, 3, 1.5);
      ctx.fillStyle = 'rgba(255,225,120,0.95)';
      this.round(W / 2 - bwFlow / 2, 54, bwFlow * prog, 3, 1.5);

      ctx.font = '600 11px Quicksand, sans-serif';
      ctx.fillStyle = 'rgba(255,245,210,0.85)';
      ctx.fillText(`+${Math.floor(this.flowBank * this.combo)} poin`, W / 2, 62);
    }

    // meter momentum / boost / speed indicator
    const bw = 170, bx = W / 2 - bw / 2, by = H - 46;
    const m = clamp((this.spd - 300) / 1500, 0, 1);
    const speedRatio = this.spd / 300;
    const isMax = speedRatio >= 5.95;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    this.round(bx, by, bw, 5, 2.5);
    const col = isMax
      ? 'rgba(255,215,90,1)'
      : this.boost > 0 || this.spd > 1100
        ? 'rgba(255,226,140,1)'
        : 'rgba(255,250,240,0.9)';
    ctx.fillStyle = col;
    this.round(bx, by, Math.max(5, bw * m), 5, 2.5);
    ctx.textAlign = 'center';
    ctx.font = '600 10px Quicksand, sans-serif';
    ctx.fillStyle = isMax ? 'rgba(255,225,120,0.95)' : 'rgba(255,250,240,0.75)';
    ctx.fillText(
      isMax ? '✦ KECEPATAN MAKSIMAL (6.0x) ✦' : `KECEPATAN ${speedRatio.toFixed(1)}x / 6.0x`,
      W / 2,
      by + 12
    );

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

  drawGuideReticle() {
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

export class ZenAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  windGain: GainNode | null = null;
  windFilter: BiquadFilterNode | null = null;
  padFilter: BiquadFilterNode | null = null;
  delay: DelayNode | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.85;
    master.connect(ctx.destination);
    this.master = master;

    // echo / space
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2200;
    delay.connect(dlp);
    dlp.connect(fb);
    fb.connect(delay);
    dlp.connect(master);
    this.delay = delay;

    // ambient pad
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 650;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    padFilter.connect(padGain);
    padGain.connect(master);
    this.padFilter = padFilter;
    const notes = [73.42, 146.83, 220.0, 329.63, 369.99];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.22 / (1 + i * 0.3);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.12;
      const lfoG = ctx.createGain();
      lfoG.gain.value = g.gain.value * 0.8;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      o.connect(g);
      g.connect(padFilter);
      o.start();
      lfo.start();
    });

    // wind noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.04 * w) / 1.04;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 500;
    wf.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    src.connect(wf);
    wf.connect(wg);
    wg.connect(master);
    src.start();
    this.windGain = wg;
    this.windFilter = wf;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.1);
  }

  setWind(v: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.02 + v * 0.16, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + v * 1300, t, 0.15);
    if (this.padFilter) {
      // Soaring celestial pad filter opening as flight speed builds
      this.padFilter.frequency.setTargetAtTime(650 + v * 750, t, 0.2);
    }
  }

  chime(index: number, perfect = false) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.delay) return;
    // Harmonic pentatonic scale with lush ethereal overtones
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
    const baseFreq = scale[Math.min(index, scale.length - 1)];
    const t = ctx.currentTime;

    const playTone = (freq: number, vol: number, type: OscillatorType, dur: number, at = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + at);
      o.frequency.exponentialRampToValueAtTime(freq * 1.008, t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(vol, t + at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.00008, t + at + dur);
      o.connect(g);
      g.connect(this.master!);
      g.connect(this.delay!);
      o.start(t + at);
      o.stop(t + at + dur + 0.04);
    };

    // Primary fundamental singing bell
    playTone(baseFreq, 0.18, 'sine', 1.8);
    // Fifth harmonic (celestial resonance)
    playTone(baseFreq * 1.5, 0.08, 'sine', 1.5, 0.01);
    // Octave shimmer
    playTone(baseFreq * 2, 0.06, 'triangle', 1.2, 0.02);
    // Crystal high sparkle
    playTone(baseFreq * 3, 0.025, 'sine', 0.8, 0.03);

    if (perfect) {
      // Extra celebratory chord for perfect hit
      playTone(baseFreq * 2.5, 0.09, 'sine', 2.0, 0.05);
      playTone(baseFreq * 4, 0.03, 'sine', 1.0, 0.08);
    }
  }

  whoosh(speedNorm: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const startF = 180 + speedNorm * 120;
    o.frequency.setValueAtTime(startF, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * speedNorm, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.38);
  }

  bump() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.35);
  }

  crash() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.delay) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 1.2);
    // soft gong
    [196, 293.66, 392].forEach((f, i) => {
      const oo = ctx.createOscillator();
      oo.type = 'sine';
      oo.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0, t + 0.05);
      gg.gain.linearRampToValueAtTime(0.06 / (i + 1), t + 0.08);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      oo.connect(gg);
      gg.connect(this.master!);
      gg.connect(this.delay!);
      oo.start(t + 0.05);
      oo.stop(t + 3.1);
    });
  }

  missionComplete() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.delay || this.muted) return;
    const t = ctx.currentTime;
    // Ascending celebratory pentatonic harp
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t + i * 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.07);
      g.gain.linearRampToValueAtTime(0.14, t + i * 0.07 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 1.6);
      o.connect(g);
      g.connect(this.master!);
      g.connect(this.delay!);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 1.7);
    });
  }

  levelUp() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.delay || this.muted) return;
    const t = ctx.currentTime;
    // Grand triumphant chords (Alto's Odyssey level up chime)
    const chords = [
      [392.0, 523.25, 659.25],
      [440.0, 587.33, 880.0],
      [523.25, 659.25, 1046.5, 1318.51],
    ];
    chords.forEach((chord, ci) => {
      chord.forEach((f) => {
        const o = ctx.createOscillator();
        o.type = ci === 2 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(f, t + ci * 0.22);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + ci * 0.22);
        g.gain.linearRampToValueAtTime(0.16, t + ci * 0.22 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ci * 0.22 + 2.8);
        o.connect(g);
        g.connect(this.master!);
        g.connect(this.delay!);
        o.start(t + ci * 0.22);
        o.stop(t + ci * 0.22 + 2.9);
      });
    });
  }

  biomeEntered() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.delay || this.muted) return;
    const t = ctx.currentTime;
    // Deep mystical Tibetan singing bowl resonance
    const freqs = [146.83, 293.66, 440.0, 587.33];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12 / (1 + i * 0.4), t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.0);
      o.connect(g);
      g.connect(this.master!);
      g.connect(this.delay!);
      o.start(t);
      o.stop(t + 4.1);
    });
  }
}

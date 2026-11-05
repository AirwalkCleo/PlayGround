export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientStarted = false;
    this.noiseBuffer = null;
    this.volume = 0.62;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.createNoise(2.2);
    this.startAmbient();
  }

  createNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.985 * last + 0.015 * white;
      data[i] = last * 3.3 + white * 0.18;
    }
    return buffer;
  }

  startAmbient() {
    if (this.ambientStarted || !this.ctx) return;
    this.ambientStarted = true;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.075;
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    // A distant, low prairie drone.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.018;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 150;
    droneFilter.connect(droneGain).connect(this.master);
    for (const [freq, detune] of [[55, -6], [82.5, 4], [110, 11]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.32;
      osc.connect(g).connect(droneFilter);
      osc.start();
    }
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.frequency.value = 0.045;
    shimmerGain.gain.value = 0.009;
    shimmer.connect(shimmerGain).connect(droneGain.gain);
    shimmer.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime + 0.12);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  noiseBurst({ duration = 0.18, gain = 0.3, freq = 1200, type = 'lowpass', q = 0.7, decay = 0.95 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration * decay);
    src.connect(filter).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + duration);
  }

  tone({ freq = 220, endFreq = freq, duration = 0.3, type = 'sine', gain = 0.16, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  shot() {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 0.24, gain: 0.55, freq: 2600, type: 'lowpass', q: 0.8, decay: 0.78 });
    this.tone({ freq: 140, endFreq: 42, duration: 0.22, type: 'triangle', gain: 0.38 });
    this.tone({ freq: 62, endFreq: 34, duration: 0.32, type: 'sine', gain: 0.24 });
    this.noiseBurst({ duration: 0.06, gain: 0.25, freq: 6000, type: 'highpass', q: 0.5, decay: 0.7 });
  }

  dryFire() {
    this.tone({ freq: 900, endFreq: 440, duration: 0.05, type: 'square', gain: 0.045 });
  }

  reload() {
    if (!this.ctx) return;
    this.tone({ freq: 1200, endFreq: 580, duration: 0.035, type: 'square', gain: 0.05 });
    this.tone({ freq: 840, endFreq: 320, duration: 0.045, type: 'square', gain: 0.055, delay: 0.24 });
    this.tone({ freq: 560, endFreq: 210, duration: 0.05, type: 'square', gain: 0.06, delay: 0.52 });
    this.tone({ freq: 280, endFreq: 160, duration: 0.06, type: 'square', gain: 0.06, delay: 0.78 });
    this.noiseBurst({ duration: 0.04, gain: 0.07, freq: 3400, type: 'bandpass', q: 2 });
  }

  hit(headshot = false) {
    this.tone({ freq: headshot ? 1650 : 1200, endFreq: headshot ? 900 : 620, duration: 0.075, type: 'triangle', gain: 0.11 });
    if (headshot) this.tone({ freq: 2100, endFreq: 1400, duration: 0.08, type: 'sine', gain: 0.06, delay: 0.02 });
    this.noiseBurst({ duration: 0.06, gain: 0.08, freq: 2400, type: 'bandpass', q: 1.1 });
  }

  hurt() {
    this.tone({ freq: 90, endFreq: 36, duration: 0.34, type: 'sine', gain: 0.32 });
    this.noiseBurst({ duration: 0.25, gain: 0.18, freq: 320, type: 'lowpass', q: 0.7 });
  }

  roar(boss = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = boss ? 1.5 : 0.95;
    const base = boss ? 58 : 86 + Math.random() * 28;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const tremolo = ctx.createOscillator();
    const tremGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 0.7, now + dur * 0.55);
    osc.frequency.linearRampToValueAtTime(base * 1.2, now + dur);
    osc2.frequency.setValueAtTime(base * 1.01, now);
    osc2.frequency.linearRampToValueAtTime(base * 1.5, now + dur * 0.5);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(boss ? 700 : 1200, now);
    filter.frequency.linearRampToValueAtTime(boss ? 340 : 620, now + dur);
    filter.Q.value = 5;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(boss ? 0.26 : 0.13, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    tremolo.frequency.value = boss ? 13 : 19;
    tremGain.gain.value = 0.06;
    tremolo.connect(tremGain).connect(g.gain);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(g).connect(this.master);
    osc.start(now);
    osc2.start(now);
    tremolo.start(now);
    osc.stop(now + dur + 0.05);
    osc2.stop(now + dur + 0.05);
    tremolo.stop(now + dur + 0.05);
    this.noiseBurst({ duration: dur * 0.9, gain: boss ? 0.16 : 0.09, freq: 420, type: 'bandpass', q: 1.8, decay: 0.9 });
  }

  fireWhoosh() {
    this.noiseBurst({ duration: 0.45, gain: 0.11, freq: 900, type: 'bandpass', q: 1.7, decay: 0.92 });
    this.tone({ freq: 110, endFreq: 48, duration: 0.35, type: 'sawtooth', gain: 0.06 });
  }

  explosion(boss = false) {
    if (!this.ctx) return;
    this.noiseBurst({ duration: boss ? 1.1 : 0.7, gain: boss ? 0.55 : 0.38, freq: 900, type: 'lowpass', q: 0.6, decay: 0.94 });
    this.tone({ freq: 65, endFreq: 23, duration: 0.7, type: 'sine', gain: 0.48 });
    this.tone({ freq: 130, endFreq: 40, duration: 0.35, type: 'triangle', gain: 0.18 });
    this.noiseBurst({ duration: 0.12, gain: 0.2, freq: 5000, type: 'highpass', q: 0.4, decay: 0.7 });
  }

  dynamiteFuse() {
    this.noiseBurst({ duration: 0.08, gain: 0.06, freq: 5500, type: 'highpass', q: 0.5, decay: 0.7 });
  }

  waveHorn() {
    if (!this.ctx) return;
    this.tone({ freq: 98, duration: 1.5, endFreq: 98, type: 'sawtooth', gain: 0.12 });
    this.tone({ freq: 147, duration: 1.5, endFreq: 147, type: 'sawtooth', gain: 0.08, delay: 0.06 });
    this.tone({ freq: 196, duration: 1.2, endFreq: 196, type: 'triangle', gain: 0.05, delay: 0.12 });
    this.noiseBurst({ duration: 1.3, gain: 0.04, freq: 300, type: 'lowpass', q: 0.6, decay: 0.9 });
  }

  victory() {
    if (!this.ctx) return;
    const notes = [146.8, 185, 220, 293.7, 370];
    notes.forEach((f, i) => {
      this.tone({ freq: f, endFreq: f, duration: 2.4 - i * 0.18, type: 'triangle', gain: 0.07, delay: i * 0.18 });
      this.tone({ freq: f * 2, endFreq: f * 2, duration: 1.4, type: 'sine', gain: 0.025, delay: i * 0.18 });
    });
  }

  defeat() {
    if (!this.ctx) return;
    this.tone({ freq: 110, endFreq: 55, duration: 2.5, type: 'sawtooth', gain: 0.12 });
    this.tone({ freq: 164, endFreq: 82, duration: 2.2, type: 'triangle', gain: 0.07, delay: 0.12 });
    this.noiseBurst({ duration: 2.2, gain: 0.06, freq: 260, type: 'lowpass', q: 0.6, decay: 0.97 });
  }

  click() {
    this.tone({ freq: 340, endFreq: 220, duration: 0.05, type: 'square', gain: 0.035 });
  }
}

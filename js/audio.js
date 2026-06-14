/**
 * Procedural audio via Web Audio API — gunshots + footsteps.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  playGunshot(weaponId) {
    this.unlock();
    if (!this.ctx) return;

    const category = this._category(weaponId);
    switch (category) {
      case 'sniper': this._sniper(); break;
      case 'rifle': this._rifle(); break;
      case 'smg': this._smg(); break;
      default: this._pistol(); break;
    }
  }

  /** @param {'run'|'walk'|'crouch'} mode */
  playFootstep(mode = 'run') {
    this.unlock();
    if (!this.ctx) return;

    const vol = mode === 'crouch' ? 0.08 : mode === 'walk' ? 0.1 : 0.14;
    const freq = mode === 'crouch' ? 90 : mode === 'walk' ? 110 : 130;
    const dur = mode === 'crouch' ? 0.04 : 0.05;

    this._noise(dur, vol, freq);
    this._tone(freq * 0.6, dur * 0.8, vol * 0.35, 'sine');
  }

  _category(id) {
    if (id === 'operator' || id === 'marshal') return 'sniper';
    if (['vandal', 'phantom', 'bulldog', 'guardian'].includes(id)) return 'rifle';
    if (['spectre', 'stinger'].includes(id)) return 'smg';
    return 'pistol';
  }

  _noise(duration, gain, filterFreq) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start();
  }

  _tone(freq, duration, gain, type = 'square') {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, this.ctx.currentTime + duration);
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  _pistol() {
    this._noise(0.08, 0.35, 1800);
    this._tone(180, 0.06, 0.15, 'sawtooth');
  }

  _rifle() {
    this._noise(0.1, 0.45, 1200);
    this._tone(120, 0.08, 0.2, 'sawtooth');
    this._tone(60, 0.12, 0.1, 'square');
  }

  _smg() {
    this._noise(0.06, 0.3, 2000);
    this._tone(200, 0.04, 0.12, 'sawtooth');
  }

  _sniper() {
    this._noise(0.18, 0.55, 600);
    this._tone(80, 0.15, 0.25, 'sawtooth');
    this._tone(40, 0.2, 0.15, 'square');
  }

  /** Valorant-style reload audio by weapon class. */
  playReload(weaponId) {
    this.unlock();
    if (!this.ctx) return;
    const cat = this._category(weaponId);
    const dur = cat === 'sniper' ? 0.38 : cat === 'rifle' ? 0.3 : 0.24;
    // Mag release + slide pull
    this._noise(0.1, 0.18, 320);
    this._tone(cat === 'pistol' ? 320 : 200, dur * 0.45, 0.14, 'square');
    // Mag insert + chamber
    setTimeout(() => {
      this._noise(0.08, 0.16, 520);
      this._tone(140, 0.1, 0.12, 'sine');
      this._tone(90, 0.06, 0.1, 'triangle');
    }, dur * 420);
    // Final click
    setTimeout(() => {
      this._noise(0.05, 0.08, 900);
      this._tone(220, 0.04, 0.1, 'square');
    }, dur * 850);
  }
}

export const audio = new AudioManager();

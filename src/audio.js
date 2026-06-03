// Procedural 8-bit style sound effects via the Web Audio API.
// No audio files — every blip is synthesized, like old sound chips.

export class Audio {
  constructor() {
    this.ctx = null;
  }

  // Browsers require audio to start from a user gesture (the click-to-play).
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Core: a short oscillator note with an envelope.
  _blip(freq, dur, type = 'square', gain = 0.15, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A bright two-tone "ding" for collecting a gem.
  pickup() {
    this._blip(660, 0.08, 'square', 0.18);
    setTimeout(() => this._blip(990, 0.12, 'square', 0.18), 70);
  }

  // Soft thud for footsteps.
  step() {
    this._blip(110 + Math.random() * 20, 0.06, 'triangle', 0.06, 70);
  }

  // Rising fanfare when all gems are collected.
  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this._blip(f, 0.18, 'square', 0.2), i * 120));
  }
}

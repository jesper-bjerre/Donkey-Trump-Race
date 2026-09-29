export type SoundName =
  | 'footstep'
  | 'ladderRung'
  | 'jump'
  | 'land'
  | 'barrelThrow'
  | 'barrelDrop'
  | 'barrelLand'
  | 'bossGrunt'
  | 'barrelHit'
  | 'dizzy'
  | 'fall'
  | 'respawn'
  | 'shove'
  | 'itemPickup'
  | 'speedBoost'
  | 'shield'
  | 'tweetStorm'
  | 'shieldBlock'
  | 'rescue'
  | 'countdownBeep'
  | 'go';

/** Where the sound director sends its cues; a fake in tests, Web Audio in the browser. */
export interface SoundSink {
  /** `volume` 0..1 after distance falloff; `pitch` multiplies the base frequency. */
  play(name: SoundName, volume: number, pitch?: number): void;
  /** Continuous rolling-barrel rumble, 0 (silent) .. 1. */
  setRumble(level: number): void;
}

const MUTE_KEY = 'dtr.soundMuted';
const MASTER_VOLUME = 0.55;

interface ToneOptions {
  from: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  volume: number;
  delay?: number;
  attack?: number;
  /** Optional low-pass cutoff to soften bright waveforms. */
  lowpass?: number;
}

interface NoiseOptions {
  duration: number;
  filter: BiquadFilterType;
  from: number;
  to?: number;
  q?: number;
  volume: number;
  delay?: number;
  attack?: number;
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Procedural sound effects: every sound is synthesised with Web Audio (filtered noise for
 * shoes, wood and impacts; tuned partials for metal rungs and chimes), so the game ships
 * no audio files. Silently does nothing where Web Audio is unavailable.
 */
export class SoundEngine implements SoundSink {
  private readonly ctx: AudioContext | null;
  private readonly master: GainNode | null = null;
  private readonly noise: AudioBuffer | null = null;
  private readonly rumbleGain: GainNode | null = null;
  private readonly rumbleFilter: BiquadFilterNode | null = null;
  private mutedValue: boolean;

  constructor() {
    this.mutedValue = readMuted();
    const Ctor =
      typeof window !== 'undefined'
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    let ctx: AudioContext | null = null;
    try {
      ctx = Ctor ? new Ctor() : null;
    } catch {
      ctx = null;
    }
    this.ctx = ctx;
    if (!ctx) return;

    this.master = ctx.createGain();
    this.master.gain.value = this.mutedValue ? 0 : MASTER_VOLUME;
    const compressor = ctx.createDynamicsCompressor();
    this.master.connect(compressor).connect(ctx.destination);

    const length = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    // Rolling barrels: looping brown-ish noise through a low-pass, faded by setRumble().
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noise;
    rumble.loop = true;
    this.rumbleFilter = ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 160;
    this.rumbleFilter.Q.value = 4;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    rumble.connect(this.rumbleFilter).connect(this.rumbleGain).connect(this.master);
    rumble.start();

    // Browsers keep audio suspended until the page has had a user gesture.
    const unlock = () => void ctx.resume().catch(() => undefined);
    for (const type of ['keydown', 'pointerdown', 'touchstart'] as const)
      window.addEventListener(type, unlock, { passive: true });
    this.removeUnlock = () => {
      for (const type of ['keydown', 'pointerdown', 'touchstart'] as const)
        window.removeEventListener(type, unlock);
    };
    unlock();
  }

  private removeUnlock: () => void = () => undefined;

  get available(): boolean {
    return this.ctx !== null;
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Private mode or blocked storage: the setting just is not remembered.
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  dispose(): void {
    this.removeUnlock();
    void this.ctx?.close().catch(() => undefined);
  }

  setRumble(level: number): void {
    if (!this.ctx || !this.rumbleGain || !this.rumbleFilter) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, level));
    // A little flutter reads as barrel staves thumping over the deck plates.
    const flutter = clamped > 0 ? 0.85 + Math.random() * 0.3 : 1;
    this.rumbleGain.gain.setTargetAtTime(clamped * 0.9 * flutter, t, 0.08);
    this.rumbleFilter.frequency.setTargetAtTime(120 + clamped * 140, t, 0.2);
  }

  play(name: SoundName, volume: number, pitch = 1): void {
    if (!this.ctx || this.mutedValue || volume <= 0.01 || this.ctx.state !== 'running') return;
    const v = Math.min(1, volume);
    const p = pitch;
    switch (name) {
      case 'footstep':
        // Soft heel on a steel deck: a dull thump plus a faint metallic tick.
        this.noiseBurst({
          duration: 0.07,
          filter: 'lowpass',
          from: 900 * p,
          to: 250,
          volume: v * 0.55,
        });
        this.tone({ from: 120 * p, to: 60, duration: 0.07, volume: v * 0.35 });
        this.noiseBurst({
          duration: 0.02,
          filter: 'bandpass',
          from: 3200 * p,
          q: 3,
          volume: v * 0.08,
        });
        break;
      case 'ladderRung':
        // Hand on a hollow metal rung.
        this.tone({ from: 1240 * p, duration: 0.16, type: 'triangle', volume: v * 0.16 });
        this.tone({ from: 1873 * p, duration: 0.1, volume: v * 0.1 });
        this.tone({ from: 620 * p, duration: 0.12, volume: v * 0.12 });
        this.noiseBurst({ duration: 0.025, filter: 'bandpass', from: 2600, q: 2, volume: v * 0.2 });
        break;
      case 'jump':
        this.noiseBurst({
          duration: 0.12,
          filter: 'bandpass',
          from: 700,
          to: 1800,
          q: 1.2,
          volume: v * 0.25,
        });
        this.tone({
          from: 240 * p,
          to: 420 * p,
          duration: 0.12,
          type: 'triangle',
          volume: v * 0.12,
        });
        break;
      case 'land':
        this.tone({ from: 95, to: 45, duration: 0.14, volume: v * 0.6 });
        this.noiseBurst({ duration: 0.09, filter: 'lowpass', from: 600, to: 150, volume: v * 0.5 });
        break;
      case 'barrelThrow':
        this.noiseBurst({
          duration: 0.35,
          filter: 'bandpass',
          from: 300,
          to: 1400,
          q: 1.5,
          volume: v * 0.5,
          attack: 0.08,
        });
        break;
      case 'barrelDrop':
        // Wooden knock as a barrel tips over a ladder opening.
        this.tone({ from: 190, to: 120, duration: 0.12, type: 'triangle', volume: v * 0.35 });
        this.noiseBurst({ duration: 0.05, filter: 'bandpass', from: 900, q: 2, volume: v * 0.3 });
        break;
      case 'barrelLand':
        this.tone({ from: 85, to: 40, duration: 0.25, volume: v * 0.8 });
        this.noiseBurst({ duration: 0.18, filter: 'lowpass', from: 700, to: 120, volume: v * 0.6 });
        this.tone({ from: 210, to: 170, duration: 0.08, type: 'triangle', volume: v * 0.25 });
        break;
      case 'bossGrunt':
        this.tone({
          from: 150,
          to: 85,
          duration: 0.5,
          type: 'sawtooth',
          volume: v * 0.35,
          lowpass: 650,
          attack: 0.04,
        });
        this.tone({
          from: 225,
          to: 128,
          duration: 0.45,
          type: 'sawtooth',
          volume: v * 0.15,
          lowpass: 900,
          attack: 0.04,
        });
        this.noiseBurst({
          duration: 0.4,
          filter: 'bandpass',
          from: 500,
          q: 1,
          volume: v * 0.15,
          attack: 0.05,
        });
        break;
      case 'barrelHit':
        // Wooden crash and a body thump.
        this.tone({ from: 90, to: 32, duration: 0.4, volume: v });
        this.noiseBurst({
          duration: 0.45,
          filter: 'lowpass',
          from: 2400,
          to: 180,
          volume: v * 0.85,
        });
        this.tone({ from: 240, to: 180, duration: 0.1, type: 'triangle', volume: v * 0.4 });
        break;
      case 'dizzy':
        // Cartoon birds circling his head.
        for (let i = 0; i < 4; i++) {
          this.tone({
            from: 2100 + (i % 2) * 500,
            to: 2700 + (i % 2) * 400,
            duration: 0.07,
            volume: v * 0.12,
            delay: 0.3 + i * 0.13,
          });
        }
        break;
      case 'fall':
        this.tone({ from: 1500, to: 180, duration: 1.1, volume: v * 0.3, attack: 0.05 });
        this.noiseBurst({
          duration: 1.0,
          filter: 'highpass',
          from: 2500,
          to: 800,
          volume: v * 0.08,
          attack: 0.3,
        });
        break;
      case 'respawn':
        this.tone({ from: 420, to: 950, duration: 0.18, type: 'triangle', volume: v * 0.3 });
        this.tone({ from: 840, to: 1900, duration: 0.14, volume: v * 0.12, delay: 0.06 });
        break;
      case 'shove':
        this.noiseBurst({
          duration: 0.11,
          filter: 'lowpass',
          from: 1500,
          to: 300,
          volume: v * 0.8,
        });
        this.tone({ from: 160, to: 70, duration: 0.12, volume: v * 0.6 });
        break;
      case 'itemPickup':
        [880, 1320, 1760].forEach((f, i) =>
          this.tone({
            from: f,
            duration: 0.14,
            type: 'triangle',
            volume: v * 0.22,
            delay: i * 0.06,
          }),
        );
        break;
      case 'speedBoost':
        this.tone({ from: 280, to: 1700, duration: 0.4, type: 'triangle', volume: v * 0.28 });
        this.noiseBurst({
          duration: 0.4,
          filter: 'bandpass',
          from: 600,
          to: 4000,
          q: 1,
          volume: v * 0.15,
        });
        break;
      case 'shield':
        [660, 990, 1320].forEach((f, i) =>
          this.tone({
            from: f,
            to: f * 1.01,
            duration: 0.6,
            volume: v * 0.14,
            delay: i * 0.05,
            attack: 0.04,
          }),
        );
        break;
      case 'tweetStorm':
        for (let i = 0; i < 7; i++) {
          const f = 2000 + Math.random() * 1400;
          this.tone({ from: f, to: f * 1.35, duration: 0.06, volume: v * 0.14, delay: i * 0.07 });
        }
        this.noiseBurst({
          duration: 0.5,
          filter: 'bandpass',
          from: 1200,
          to: 2500,
          q: 0.8,
          volume: v * 0.12,
          attack: 0.1,
        });
        break;
      case 'shieldBlock':
        this.tone({
          from: 1180,
          to: 1150,
          duration: 0.45,
          type: 'square',
          volume: v * 0.08,
          lowpass: 3000,
        });
        this.tone({ from: 1780, duration: 0.4, volume: v * 0.16 });
        this.noiseBurst({ duration: 0.05, filter: 'highpass', from: 2000, volume: v * 0.3 });
        break;
      case 'rescue':
        // Little fanfare: C–E–G–C, then the chord.
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone({
            from: f,
            duration: 0.16,
            type: 'triangle',
            volume: v * 0.25,
            delay: i * 0.12,
          }),
        );
        [523, 659, 784, 1047].forEach((f) =>
          this.tone({
            from: f,
            duration: 0.9,
            type: 'triangle',
            volume: v * 0.14,
            delay: 0.5,
            attack: 0.02,
          }),
        );
        break;
      case 'countdownBeep':
        this.tone({ from: 660, duration: 0.16, type: 'square', volume: v * 0.12, lowpass: 2500 });
        break;
      case 'go':
        this.tone({ from: 990, duration: 0.4, type: 'square', volume: v * 0.14, lowpass: 3000 });
        break;
    }
  }

  private envelope(
    gain: GainNode,
    start: number,
    attack: number,
    duration: number,
    volume: number,
  ) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.01, duration));
  }

  private tone(o: ToneOptions): void {
    const ctx = this.ctx!;
    const start = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.from, start);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, start + o.duration);
    const gain = ctx.createGain();
    this.envelope(gain, start, o.attack ?? 0.005, o.duration, o.volume);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      node = node.connect(filter);
    }
    node.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + o.duration + 0.05);
  }

  private noiseBurst(o: NoiseOptions): void {
    const ctx = this.ctx!;
    const start = ctx.currentTime + (o.delay ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.from, start);
    if (o.to !== undefined) filter.frequency.exponentialRampToValueAtTime(o.to, start + o.duration);
    filter.Q.value = o.q ?? 0.7;
    const gain = ctx.createGain();
    this.envelope(gain, start, o.attack ?? 0.003, o.duration, o.volume);
    source.connect(filter).connect(gain).connect(this.master!);
    // Random offset so repeated bursts never sound identical.
    source.start(start, Math.random() * 1.5, o.duration + 0.05);
  }
}

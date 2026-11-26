import {AmbientSoundMode} from '../types/app';

const AMBIENT_MODE_KEY = 'nabd_ambient_mode';
const AMBIENT_VOL_KEY = 'nabd_ambient_volume';

export class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private activeStoppers: Array<() => void> = [];
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;

  private _isPlaying = false;
  private _mode: AmbientSoundMode = 'rain';
  private _volume = 0.42;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedMode = localStorage.getItem(AMBIENT_MODE_KEY);
        if (savedMode === 'rain' || savedMode === 'waves' || savedMode === 'romantic') {
          this._mode = savedMode;
        }
        const savedVol = Number(localStorage.getItem(AMBIENT_VOL_KEY));
        if (Number.isFinite(savedVol) && savedVol >= 0.02 && savedVol <= 1) {
          this._volume = savedVol;
        }
      } catch {
        // Ignore storage restrictions
      }
    }
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get mode(): AmbientSoundMode {
    return this._mode;
  }

  public get volume(): number {
    return this._volume;
  }

  public setMode(nextMode: AmbientSoundMode) {
    if (this._mode === nextMode) return;
    this._mode = nextMode;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AMBIENT_MODE_KEY, nextMode);
      } catch {
        // ignore
      }
    }
    if (this._isPlaying) {
      this.stopImmediateCleanup();
      this.startInternal();
    }
  }

  public setVolume(nextVol: number) {
    const clamped = Math.max(0.02, Math.min(1, Number(nextVol) || 0.42));
    this._volume = clamped;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AMBIENT_VOL_KEY, String(clamped));
      } catch {
        // ignore
      }
    }
    if (this.ctx && this.masterGain && this._isPlaying) {
      const now = this.ctx.currentTime;
      const target = this.getScaledMasterGain();
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(
        Math.max(0.0001, this.masterGain.gain.value),
        now
      );
      this.masterGain.gain.exponentialRampToValueAtTime(target, now + 0.18);
    }
  }

  public toggle(): boolean {
    if (this._isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this._isPlaying;
  }

  public start() {
    if (typeof window === 'undefined') return;
    if (this._isPlaying) return;
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    this.stopImmediateCleanup();
    this._isPlaying = true;
    this.startInternal();
  }

  public stop() {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(
        Math.max(0.0001, this.masterGain.gain.value),
        now
      );
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      if (this.stopTimeout) clearTimeout(this.stopTimeout);
      this.stopTimeout = setTimeout(() => {
        if (!this._isPlaying) {
          this.stopImmediateCleanup();
        }
      }, 620);
    } else {
      this.stopImmediateCleanup();
    }
  }

  private getScaledMasterGain(): number {
    // Soft background ceiling so ambient audio stays soothing under game SFX
    return Math.max(0.002, this._volume * 0.28);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext})
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  private startInternal() {
    const ctx = this.ensureContext();
    if (!ctx) {
      this._isPlaying = false;
      return;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(this.getScaledMasterGain(), now + 0.9);
    master.connect(ctx.destination);
    this.masterGain = master;
    this.activeNodes.push(master);

    if (this._mode === 'rain') {
      this.setupRain(ctx, master);
    } else if (this._mode === 'waves') {
      this.setupWaves(ctx, master);
    } else {
      this.setupRomanticPad(ctx, master);
    }
  }

  private setupRain(ctx: AudioContext, master: GainNode) {
    const buffer = this.createPinkNoiseBuffer(ctx, 4);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1050, ctx.currentTime);
    lowpass.Q.setValueAtTime(0.5, ctx.currentTime);

    const warmth = ctx.createBiquadFilter();
    warmth.type = 'highpass';
    warmth.frequency.setValueAtTime(160, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.85, ctx.currentTime);

    source.connect(warmth);
    warmth.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(master);
    source.start();

    this.activeNodes.push(source, warmth, lowpass, rainGain);
    this.activeStoppers.push(() => {
      try {
        source.stop();
      } catch {
        // ignore
      }
    });
  }

  private setupWaves(ctx: AudioContext, master: GainNode) {
    const buffer = this.createPinkNoiseBuffer(ctx, 5);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);

    const swellGain = ctx.createGain();
    swellGain.gain.setValueAtTime(0.55, ctx.currentTime);

    // Slow 0.12 Hz LFO sweeping both filter cutoff and wave swell gain
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);

    const filterLfoDepth = ctx.createGain();
    filterLfoDepth.gain.setValueAtTime(340, ctx.currentTime);

    const gainLfoDepth = ctx.createGain();
    gainLfoDepth.gain.setValueAtTime(0.32, ctx.currentTime);

    lfo.connect(filterLfoDepth);
    filterLfoDepth.connect(filter.frequency);

    lfo.connect(gainLfoDepth);
    gainLfoDepth.connect(swellGain.gain);

    source.connect(filter);
    filter.connect(swellGain);
    swellGain.connect(master);

    source.start();
    lfo.start();

    this.activeNodes.push(source, filter, swellGain, lfo, filterLfoDepth, gainLfoDepth);
    this.activeStoppers.push(() => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        // ignore
      }
    });
  }

  private setupRomanticPad(ctx: AudioContext, master: GainNode) {
    // Stereo delay / reverb-style feedback network
    const delayLeft = ctx.createDelay(1.0);
    delayLeft.delayTime.setValueAtTime(0.36, ctx.currentTime);
    const delayRight = ctx.createDelay(1.0);
    delayRight.delayTime.setValueAtTime(0.48, ctx.currentTime);

    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.32, ctx.currentTime);

    const wetFilter = ctx.createBiquadFilter();
    wetFilter.type = 'lowpass';
    wetFilter.frequency.setValueAtTime(1400, ctx.currentTime);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.45, ctx.currentTime);

    const padBus = ctx.createGain();
    padBus.gain.setValueAtTime(0.45, ctx.currentTime);

    padBus.connect(master);
    padBus.connect(delayLeft);
    delayLeft.connect(delayRight);
    delayRight.connect(wetFilter);
    wetFilter.connect(feedback);
    feedback.connect(delayLeft);
    wetFilter.connect(wetGain);
    wetGain.connect(master);

    this.activeNodes.push(
      delayLeft,
      delayRight,
      feedback,
      wetFilter,
      wetGain,
      padBus
    );

    // Warm Cmaj7 -> Am7 -> Fmaj7 -> G6 chord progression
    const chords: number[][] = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 329.63], // G6
    ];
    let chordIdx = 0;

    const triggerChord = () => {
      if (!this._isPlaying || !this.ctx) return;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;
      const now = this.ctx.currentTime;
      const duration = 4.6;

      chord.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(i % 2 === 0 ? -4 : 4, now);

        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.095, now + 1.3);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(noteGain);
        noteGain.connect(padBus);

        osc.start(now);
        osc.stop(now + duration + 0.08);
      });
    };

    triggerChord();
    this.chordTimer = setInterval(triggerChord, 4000);
  }

  private stopImmediateCleanup() {
    if (this.chordTimer) {
      clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    this.activeStoppers.forEach((fn) => fn());
    this.activeStoppers = [];
    this.activeNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];
    this.masterGain = null;
  }
}

export const ambientAudio = new AmbientAudioEngine();

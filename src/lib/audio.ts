/**
 * Small Web Audio engine. Every sound in WaveLab is a sum of sine harmonics,
 * built with a PeriodicWave, so what students hear is exactly what the
 * graphs draw.
 */

export interface ToneSpec {
  freq: number;
  /** Amplitude of harmonic 1, 2, 3... (index 0 = fundamental). */
  harmonics: number[];
  /** Phase of each harmonic in radians (optional). */
  phases?: number[];
  /** Peak level 0..1 after normalising (see `normalize`). */
  level?: number;
  /** 'rms' = equal loudness across shapes, 'none' = level is applied as-is. */
  normalize?: 'rms' | 'none';
  duration?: number;
  attack?: number;
  release?: number;
  /** Seconds from now. */
  delay?: number;
}

export interface ClipPart {
  url: string;
  delayMs?: number;
  /** 1 = as recorded, -1 = polarity flipped. */
  gain?: number;
}
export interface ClipPlayer {
  set: (index: number, change: { delayMs?: number; gain?: number }) => void;
  stop: () => void;
  ready: Promise<void>;
}

type Voice = { osc: OscillatorNode; gain: GainNode };

/**
 * Ears are far more sensitive to high pitches, so higher (and brighter) sounds are
 * turned down. `freq` is the note; `harmonics` makes bright sounds count as higher.
 */
export function loudnessComp(freq: number, harmonics: number[] = [1]) {
  let num = 0;
  let den = 0;
  harmonics.forEach((a, i) => {
    num += (i + 1) * a * a;
    den += a * a;
  });
  const centroid = den > 0 ? num / den : 1;
  const effective = freq * Math.sqrt(centroid);
  return effective <= 250 ? 1 : Math.pow(250 / effective, 0.6);
}

const VOLUME_KEY = 'wavelab-volume';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<Voice>();
  private drones = new Map<string, Voice>();
  private userVolume = (() => {
    try {
      const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '');
      return Number.isFinite(v) ? v : 0.6;
    } catch {
      return 0.6;
    }
  })();

  get volume() {
    return this.userVolume;
  }

  setVolume(v: number) {
    this.userVolume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.userVolume * 0.7, this.ctx.currentTime, 0.02);
    try {
      localStorage.setItem(VOLUME_KEY, String(this.userVolume));
    } catch {
      /* fine */
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.ratio.value = 8;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.userVolume * 0.7;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private wave(ctx: AudioContext, harmonics: number[], phases?: number[]) {
    const n = harmonics.length + 1;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    harmonics.forEach((a, i) => {
      const p = phases?.[i] ?? 0;
      // a·sin(nωt + p) = a·cos(p)·sin(nωt) + a·sin(p)·cos(nωt)
      imag[i + 1] = a * Math.cos(p);
      real[i + 1] = a * Math.sin(p);
    });
    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  }

  /** Scale so different shapes sound about equally loud. */
  private rmsScale(harmonics: number[]) {
    const rms = Math.sqrt(harmonics.reduce((s, a) => s + (a * a) / 2, 0));
    return rms > 0 ? 0.7071 / rms : 0;
  }

  play(spec: ToneSpec) {
    const ctx = this.ensure();
    const level = spec.level ?? 0.5;
    const dur = spec.duration ?? 1.2;
    const attack = spec.attack ?? 0.02;
    const release = spec.release ?? 0.12;
    const scale = spec.normalize === 'none' ? 1 : this.rmsScale(spec.harmonics);
    const start = ctx.currentTime + 0.02 + (spec.delay ?? 0);

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave(ctx, spec.harmonics, spec.phases));
    osc.frequency.value = spec.freq;
    const gain = ctx.createGain();
    const peak = Math.max(0.0001, level * scale * 0.5 * loudnessComp(spec.freq, spec.harmonics));
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, start + Math.max(attack, dur - release));
    gain.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    const v = { osc, gain };
    this.voices.add(v);
    osc.onended = () => {
      gain.disconnect();
      this.voices.delete(v);
    };
  }

  /** White noise: not periodic, so it has no pitch. */
  playNoise(level = 0.4, duration = 1, delay = 0) {
    const ctx = this.ensure();
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const start = ctx.currentTime + 0.02 + delay;
    const peak = level * 0.25;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.02);
    gain.gain.setValueAtTime(peak, start + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    src.connect(gain).connect(this.master!);
    src.start(start);
    const v = { osc: src as unknown as OscillatorNode, gain };
    this.voices.add(v);
    src.onended = () => {
      gain.disconnect();
      this.voices.delete(v);
    };
  }

  // ---------- Hammond-style organ ----------
  private leslie: { input: GainNode; tremolo: GainNode; lfo: OscillatorNode; tremDepth: GainNode; detune: GainNode } | null = null;

  /** The Leslie speaker: a spinning horn that wobbles pitch and volume. */
  private ensureLeslie() {
    const ctx = this.ensure();
    if (this.leslie) return this.leslie;
    const input = ctx.createGain();
    const tremolo = ctx.createGain();
    tremolo.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.8;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0;
    const detune = ctx.createGain();
    detune.gain.value = 0;
    lfo.connect(tremDepth).connect(tremolo.gain);
    lfo.connect(detune);
    lfo.start();
    input.connect(tremolo).connect(this.master!);
    this.leslie = { input, tremolo, lfo, tremDepth, detune };
    return this.leslie;
  }

  /** 'off', 'slow' (chorale) or 'fast' (tremolo). Speed changes ramp, like a real Leslie spinning up. */
  setLeslie(mode: 'off' | 'slow' | 'fast') {
    const l = this.ensureLeslie();
    const t = this.ctx!.currentTime;
    const speed = mode === 'fast' ? 6.6 : 0.8;
    l.lfo.frequency.cancelScheduledValues(t);
    l.lfo.frequency.setTargetAtTime(speed, t, mode === 'fast' ? 0.6 : 1.2);
    l.tremDepth.gain.setTargetAtTime(mode === 'off' ? 0 : 0.22, t, 0.2);
    l.detune.gain.setTargetAtTime(mode === 'off' ? 0 : 9, t, 0.2);
  }

  /**
   * One organ note. `harmonics` are relative to the 16' (sub-octave) pitch, so the
   * oscillator runs at half the note's frequency.
   */
  playOrgan(spec: { freq: number; harmonics: number[]; level?: number; duration: number; delay?: number }) {
    const ctx = this.ensure();
    const l = this.ensureLeslie();
    const start = ctx.currentTime + 0.02 + (spec.delay ?? 0);
    const base = spec.freq / 2;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave(ctx, spec.harmonics));
    osc.frequency.value = base;
    l.detune.connect(osc.detune);
    const gain = ctx.createGain();
    const sum = spec.harmonics.reduce((s, a) => s + a, 0) || 1;
    const peak = ((spec.level ?? 0.5) * 0.9 * loudnessComp(base, spec.harmonics)) / Math.sqrt(sum);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.004); // organs speak instantly
    gain.gain.setValueAtTime(peak, start + Math.max(0.01, spec.duration - 0.03));
    gain.gain.linearRampToValueAtTime(0, start + spec.duration);
    osc.connect(gain).connect(l.input);
    osc.start(start);
    osc.stop(start + spec.duration + 0.05);
    // key click: a tiny burst of noise at the start of the note
    const clickLen = Math.floor(ctx.sampleRate * 0.006);
    const buf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
    const click = ctx.createBufferSource();
    click.buffer = buf;
    const cg = ctx.createGain();
    cg.gain.value = peak * 0.25;
    click.connect(cg).connect(l.input);
    click.start(start);
    const v = { osc, gain };
    this.voices.add(v);
    osc.onended = () => {
      gain.disconnect();
      try {
        l.detune.disconnect(osc.detune);
      } catch {
        /* already gone */
      }
      this.voices.delete(v);
    };
  }

  /** A held tone whose level can change smoothly while it plays. */
  droneStart(id: string, spec: { freq: number; harmonics: number[]; level: number }) {
    const ctx = this.ensure();
    this.droneStop(id);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave(ctx, spec.harmonics));
    osc.frequency.value = spec.freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    const comp = loudnessComp(spec.freq, spec.harmonics);
    gain.gain.linearRampToValueAtTime(spec.level * 0.5 * comp, ctx.currentTime + 0.05);
    osc.connect(gain).connect(this.master!);
    osc.start();
    this.drones.set(id, { osc, gain });
    this.droneComp.set(id, comp);
  }

  private droneComp = new Map<string, number>();

  droneLevel(id: string, level: number) {
    const v = this.drones.get(id);
    if (!v || !this.ctx) return;
    v.gain.gain.setTargetAtTime(Math.max(0, level) * 0.5 * (this.droneComp.get(id) ?? 1), this.ctx.currentTime, 0.03);
  }

  droneStop(id: string) {
    const v = this.drones.get(id);
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, 0.03);
    v.osc.stop(t + 0.2);
    this.drones.delete(id);
  }

  isDroning(id: string) {
    return this.drones.has(id);
  }

  // ---------- recorded clips (the phase rounds) ----------
  private clipCache = new Map<string, Promise<AudioBuffer>>();
  private liveClips = new Set<ClipPlayer>();

  loadClip(url: string): Promise<AudioBuffer> {
    let p = this.clipCache.get(url);
    if (!p) {
      const ctx = this.ensure();
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Could not load ${url}`);
          return r.arrayBuffer();
        })
        .then((b) => ctx.decodeAudioData(b));
      p.catch(() => this.clipCache.delete(url));
      this.clipCache.set(url, p);
    }
    return p;
  }

  /**
   * Loops several recordings together, all starting on the same sample. Each part can be
   * delayed (milliseconds) and scaled (a negative gain flips its polarity), live.
   * The clips are mixed in Web Audio, so what students hear is the real phase interaction.
   */
  playClips(parts: ClipPart[]): ClipPlayer {
    const ctx = this.ensure();
    let stopped = false;
    const nodes: { src: AudioBufferSourceNode; gain: GainNode; delay: DelayNode }[] = [];
    const player: ClipPlayer = {
      set: (i, p) => {
        const n = nodes[i];
        if (!n) return;
        const t = ctx.currentTime;
        if (p.gain !== undefined) n.gain.gain.setTargetAtTime(p.gain, t, 0.01);
        if (p.delayMs !== undefined) n.delay.delayTime.setTargetAtTime(Math.max(0, p.delayMs) / 1000, t, 0.01);
      },
      stop: () => {
        stopped = true;
        this.liveClips.delete(player);
        const t = ctx.currentTime;
        nodes.forEach((n) => {
          try {
            n.gain.gain.cancelScheduledValues(t);
            n.gain.gain.setTargetAtTime(0, t, 0.02);
            n.src.stop(t + 0.15);
          } catch {
            /* not started yet */
          }
        });
      },
      ready: Promise.all(parts.map((p) => this.loadClip(p.url))).then((bufs) => {
        if (stopped) return;
        const start = ctx.currentTime + 0.06;
        bufs.forEach((buf, i) => {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          const delay = ctx.createDelay(0.1);
          delay.delayTime.value = Math.max(0, parts[i].delayMs ?? 0) / 1000;
          const gain = ctx.createGain();
          gain.gain.value = parts[i].gain ?? 1;
          src.connect(delay).connect(gain).connect(this.master!);
          src.start(start);
          nodes.push({ src, gain, delay });
        });
      }),
    };
    this.liveClips.add(player);
    return player;
  }

  stopAll() {
    this.liveClips.forEach((c) => c.stop());
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.02);
        v.osc.stop(t + 0.1);
      } catch {
        /* already stopped */
      }
    }
    this.voices.clear();
    for (const id of [...this.drones.keys()]) this.droneStop(id);
  }
}

export const audio = new AudioEngine();

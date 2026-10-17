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

type Voice = { osc: OscillatorNode; gain: GainNode };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<Voice>();
  private drones = new Map<string, Voice>();

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.ratio.value = 8;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
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
    const peak = Math.max(0.0001, level * scale * 0.5);
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

  /** A held tone whose level can change smoothly while it plays. */
  droneStart(id: string, spec: { freq: number; harmonics: number[]; level: number }) {
    const ctx = this.ensure();
    this.droneStop(id);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave(ctx, spec.harmonics));
    osc.frequency.value = spec.freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(spec.level * 0.5, ctx.currentTime + 0.05);
    osc.connect(gain).connect(this.master!);
    osc.start();
    this.drones.set(id, { osc, gain });
  }

  droneLevel(id: string, level: number) {
    const v = this.drones.get(id);
    if (!v || !this.ctx) return;
    v.gain.gain.setTargetAtTime(Math.max(0, level) * 0.5, this.ctx.currentTime, 0.03);
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

  stopAll() {
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

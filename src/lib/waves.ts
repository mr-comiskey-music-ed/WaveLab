export type WaveType = 'sine' | 'triangle' | 'square' | 'sawtooth';

export const WAVE_NAMES: Record<WaveType, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  sawtooth: 'Sawtooth',
};

export const WAVE_TYPES: WaveType[] = ['sine', 'triangle', 'square', 'sawtooth'];

/** Harmonic amplitudes (index 0 = harmonic 1). Signs give the textbook shapes. */
export function recipe(type: WaveType, count = 32): number[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    switch (type) {
      case 'sine':
        return n === 1 ? 1 : 0;
      case 'square':
        return n % 2 ? 4 / (Math.PI * n) : 0;
      case 'triangle': {
        if (n % 2 === 0) return 0;
        const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
        return (sign * 8) / (Math.PI * Math.PI * n * n);
      }
      case 'sawtooth':
        return ((n % 2 ? 1 : -1) * 2) / (Math.PI * n);
    }
  });
}

/** Value of a harmonic sum at `x` cycles into the wave. */
export function harmonicValue(amps: number[], x: number, phases?: number[]): number {
  let y = 0;
  for (let i = 0; i < amps.length; i++) {
    if (amps[i] === 0) continue;
    y += amps[i] * Math.sin(2 * Math.PI * (i + 1) * x + (phases?.[i] ?? 0));
  }
  return y;
}

/** Highest |value| over one cycle — used to scale graphs. */
export function peakOf(amps: number[], phases?: number[]): number {
  let p = 0;
  for (let k = 0; k < 400; k++) p = Math.max(p, Math.abs(harmonicValue(amps, k / 400, phases)));
  return p || 1;
}

// ---------- randomness helpers ----------
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Note names for friendly labels. */
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
export function midiName(m: number) {
  return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

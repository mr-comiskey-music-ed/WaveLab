import { CONE_OPTIONS, IDEAS } from '../stations/S2Sound';
import { ORDINAL, WHICH_OPTIONS } from '../stations/S3Harmonics';
import { matchGrade, matchScore } from '../stations/S4Additive';
import { ALL_STEPS, INTERVALS } from '../stations/S6Chords';
import { PhaseKind, PhaseSetup, phaseGrade } from './phase';
import type { Rec } from './review';
import { midiName, recipe, WAVE_NAMES, WaveType } from './waves';

/** Turns a stored answer back into words a teacher can read at a glance. */

export interface Desc {
  /** The question, with this student's numbers filled in. */
  ask: string;
  yours: string;
  right: string;
  /** A guess at what went wrong, only when the wrong answer points to a common slip. */
  hint?: string;
  /** Harmonic levels to draw with the question. */
  bars?: number[];
}

const wave = (w: string) => WAVE_NAMES[w as WaveType] ?? w;
const r1 = (x: number) => Math.round(x * 10) / 10;
const hz = (x: string | number) => `${Number(x).toLocaleString()} Hz`;
const labelOf = (opts: { id: string; label: string }[], id: string) => opts.find((o) => o.id === id)?.label ?? id;

/** The multiple-choice style rounds. Returns null for rounds with their own cards (matching and phase). */
export function describe(r: Rec): Desc | null {
  const wrong = r.k !== 'match' && r.k !== 'bass' && r.k !== 'snare' && r.k !== 'overhead' && r.k !== 'train' && r.p !== r.c;
  switch (r.k) {
    case 'amp':
      return { ask: `What is the amplitude of this wave? (It was a ${r.hz} Hz sine wave.)`, yours: r.p, right: r.c };
    case 'louder':
    case 'higher': {
      const mine = r.p === 'a' ? r.a : r.b;
      const other = r.p === 'a' ? r.b : r.a;
      let hint: string | undefined;
      if (wrong && r.k === 'louder' && mine[1] > other[1]) hint = 'Picked the wave that repeats more often. Loudness is how tall the wave is.';
      if (wrong && r.k === 'higher' && mine[0] > other[0]) hint = 'Picked the taller wave. Pitch is how often the wave repeats.';
      return {
        ask: `Which wave will sound ${r.k === 'louder' ? 'louder' : 'higher in pitch'}? (A: amplitude ${r.a[0]}, ${r.a[1]} Hz. B: amplitude ${r.b[0]}, ${r.b[1]} Hz.)`,
        yours: r.p.toUpperCase(),
        right: r.c.toUpperCase(),
        hint,
      };
    }
    case 'hz':
      return { ask: 'This graph shows 1 second. What is the frequency of this wave?', yours: hz(r.p), right: hz(r.c) };
    case 'hz1ms':
      return {
        ask: `This graph shows only 1 millisecond, and the wave repeats ${r.n} ${r.n === 1 ? 'time' : 'times'} in it. What is its frequency?`,
        yours: hz(r.p),
        right: hz(r.c),
        hint: wrong && Number(r.p) === r.n ? 'Gave the number of repeats without scaling up to a full second.' : undefined,
      };
    case 'pitch':
      return { ask: 'One wave is periodic and one is noise. Which one has a pitch you could sing?', yours: r.p.toUpperCase(), right: r.c.toUpperCase() };

    case 'cone':
      return { ask: `At the marked moment on a ${wave(r.wave).toLowerCase()} wave, where is the speaker cone?`, yours: labelOf(CONE_OPTIONS, r.p), right: labelOf(CONE_OPTIONS, r.c) };
    case 'idea': {
      const idea = IDEAS[r.i];
      return { ask: idea?.q ?? 'Big-idea question', yours: idea?.options[Number(r.p)] ?? r.p, right: idea?.options[0] ?? r.c };
    }

    case 'ear': {
      const pair = [r.p, r.c].sort().join('+');
      return {
        ask: `Listen: which waveform is this? (It was a ${wave(r.wave).toLowerCase()} on ${midiName(r.midi)}.)`,
        yours: wave(r.p),
        right: wave(r.c),
        hint: wrong && pair === 'square+triangle' ? 'Square and triangle are the pair most often mixed up: both have only odd harmonics, the square’s are just louder.' : undefined,
      };
    }
    case 'bars':
      return { ask: 'These are the harmonics of a mystery waveform. Which one is it?', yours: wave(r.p), right: wave(r.c), bars: recipe(r.wave as WaveType, 12) };
    case 'math': {
      const right = r.root * r.n;
      let hint: string | undefined;
      if (wrong && Number(r.p) === r.root + r.n) hint = 'Added instead of multiplying.';
      else if (wrong && Number(r.p) === r.root * (r.n + 1)) hint = 'Off by one harmonic (counted the root as harmonic 0).';
      else if (wrong && Number(r.p) === right / 2) hint = 'Halved instead of multiplying.';
      return { ask: `A note’s root frequency is ${r.root} Hz. What is the frequency of its ${ORDINAL[r.n]} harmonic?`, yours: hz(r.p), right: hz(r.c), hint };
    }
    case 'which':
      return { ask: `Which harmonics does a ${wave(r.wave).toLowerCase()} wave have?`, yours: labelOf(WHICH_OPTIONS, r.p), right: labelOf(WHICH_OPTIONS, r.c) };

    case 'point': {
      const p = Number(r.p);
      let hint: string | undefined;
      if (wrong && p === r1(r.va - r.vb)) hint = 'Subtracted the second value instead of adding it.';
      else if (wrong && p === r1(Math.abs(r.va) + Math.abs(r.vb))) hint = 'Added the sizes and ignored that one wave is pulling the other way.';
      else if (wrong && p === r1(-(r.va + r.vb))) hint = 'Right size, wrong direction.';
      else if (wrong && p === r.va) hint = 'Gave just the first wave’s value.';
      return { ask: `At the marked moment one wave is at ${r.va} and the other is at ${r.vb}. Where is the combined wave?`, yours: r.p, right: r.c, hint };
    }
    case 'pick': {
      const names: Record<string, string> = {
        sum: 'The real sum: the slow wave with the faster wiggle on top',
        diff: 'The graph that subtracts the faster wave instead of adding it',
        only: 'The graph that just makes the slow wave taller',
      };
      return { ask: `A 1 Hz wave and a ${r.hz} Hz wave at ${r.amp} amplitude are added together. Which graph shows the combined wave?`, yours: names[r.p] ?? r.p, right: names.sum };
    }

    case 'click': {
      const away = Math.abs((INTERVALS.find((i) => i.id === r.p)?.steps[1] ?? 0) - (INTERVALS.find((i) => i.id === r.c)?.steps[1] ?? 0));
      return {
        ask: `Click through the intervals to match the mystery wave. (Starting note ${midiName(r.root)}.)`,
        yours: INTERVALS.find((i) => i.id === r.p)?.name ?? r.p,
        right: INTERVALS.find((i) => i.id === r.c)?.name ?? r.c,
        hint: wrong ? `${away} piano ${away === 1 ? 'step' : 'steps'} away from the right interval.` : undefined,
      };
    }
    case 'slider': {
      const away = Math.abs(Number(r.p) - Number(r.c));
      const name = (n: string) => `${ALL_STEPS[Number(n)]?.name ?? n} (${n} steps above ${midiName(r.root)})`;
      return {
        ask: `Slide the upper note to build the mystery interval. (Starting note ${midiName(r.root)}.)`,
        yours: name(r.p),
        right: name(r.c),
        hint: wrong ? `${away} piano ${away === 1 ? 'step' : 'steps'} away from the right interval.` : undefined,
      };
    }
  }
  return null;
}

/** For the by-ear matching rounds: which harmonics were off, in words. */
export function harmonicNotes(mine: number[], target: number[]): string[] {
  const mMax = Math.max(...mine, 1e-9);
  const tMax = Math.max(...target, 1e-9);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const out: string[] = [];
  target.forEach((t, i) => {
    const a = (mine[i] ?? 0) / mMax;
    const b = t / tMax;
    if (Math.abs(a - b) >= 0.2) out.push(`Harmonic ${i + 1}: too ${a > b ? 'loud' : 'quiet'} (theirs ${pct(a)}, mystery ${pct(b)})`);
  });
  return out;
}

/** Where every phase control ended up for a stored phase round (the rest sit at harmless defaults). */
export function setupOf(r: Extract<Rec, { k: PhaseKind }>): PhaseSetup {
  const s: PhaseSetup = { bassBase: 4, nudge: 0, snareFlip: false, leftX: 60, micX: 250, busTarget: 2, busDelay: 2, busFlip: false };
  switch (r.k) {
    case 'bass':
      return { ...s, bassBase: r.base, nudge: r.nudge };
    case 'snare':
      return { ...s, snareFlip: r.flip };
    case 'overhead':
      return { ...s, leftX: r.lx, micX: r.rx };
    case 'train':
      return { ...s, busTarget: r.tgt, busDelay: r.delay, busFlip: r.flip };
  }
}

/** What the stored answer on its own would have scored (so a retry or later tweak can be spotted). */
export function attemptGrade(r: Rec): number {
  switch (r.k) {
    case 'match':
      return matchGrade(matchScore(r.m, r.t), r.peek);
    case 'bass':
    case 'snare':
    case 'overhead':
    case 'train':
      return phaseGrade(r.k, setupOf(r));
    default:
      return r.p === r.c ? 100 : 50;
  }
}

import { audio } from './audio';
import { Capstone, CAPSTONE_PITCHES } from './stations';
import { midiToFreq } from './waves';

export const CAPSTONE_BARS = 8;
export const MIN_WHY = 40;

export const emptyCapstone = (brief: number): Capstone => ({
  brief,
  name: '',
  why: '',
  bars: [10, 0, 0, 0, 0, 0, 0, 0],
  pitch: 1,
  punchy: false,
});

export const capstoneAmps = (c: Capstone) => c.bars.map((b) => b / 10);

export function capstoneComplete(c?: Capstone) {
  if (!c) return false;
  return c.brief >= 0 && c.name.trim().length > 0 && c.why.trim().length >= MIN_WHY && c.bars.some((b) => b > 0);
}

/** One note or chord in a riff. Times are in beats; notes are semitones above the chosen pitch. */
interface RiffEvent {
  at: number;
  notes: number[];
  len: number;
  /** Seconds between chord notes, for a strummed/rolled chord. */
  roll?: number;
}
interface Riff {
  bpm: number;
  beats: number;
  events: RiffEvent[];
  mood: string;
}

const seq = (notes: number[], step: number, len = step * 0.9, start = 0): RiffEvent[] => notes.map((n, i) => ({ at: start + i * step, notes: [n], len }));

/** A short loop for each brief, in the same order as CAPSTONE_BRIEFS. */
export const RIFFS: Riff[] = [
  // Lonely robot: slow, minor, a little spooky (the tritone)
  { bpm: 66, beats: 8, mood: 'slow and minor, a little spooky', events: seq([0, 3, 7, 6, 3, 2, -1, 0], 1, 0.95) },
  // Sleep app notification: gentle, major, lots of space
  { bpm: 72, beats: 4, mood: 'gentle and major, with lots of space', events: seq([7, 12, 16], 0.5, 2.2) },
  // Final boss: fast, driving, minor and chromatic
  { bpm: 152, beats: 8, mood: 'fast, driving, minor and chromatic', events: seq([0, 0, 12, 0, 1, 0, 13, 0, 0, 0, 12, 0, -1, 0, 11, 0], 0.5, 0.42) },
  // Alarm: repeated high-low beeps
  { bpm: 140, beats: 4, mood: 'urgent, repeated beeps', events: seq([12, 0, 12, 0, 12, 0, 12, 0], 0.25, 0.2) },
  // R&B pad: rolled major-7th / 9th chords
  {
    bpm: 66,
    beats: 8,
    mood: 'slow, rolled 7th and 9th chords',
    events: [
      { at: 0, notes: [0, 4, 7, 11, 14], len: 3.9, roll: 0.07 },
      { at: 4, notes: [-3, 0, 4, 7, 11], len: 3.9, roll: 0.07 },
    ],
  },
  // Healing spell: whole-tone run, then a shimmering rolled chord
  {
    bpm: 96,
    beats: 8,
    mood: 'a whole-tone run, then a shimmering rolled chord',
    events: [...seq([0, 2, 4, 6, 8, 10, 12], 0.5, 0.45), { at: 4, notes: [0, 4, 7, 11, 14, 18], len: 3.8, roll: 0.09 }],
  },
  // Club bass: steady, punchy, minor
  { bpm: 124, beats: 4, mood: 'steady, low and minor', events: seq([0, 0, 12, 0, 3, 0, 5, 7], 0.5, 0.4) },
  // Doorbell 3000: bright rising arpeggio
  { bpm: 100, beats: 4, mood: 'a bright rising arpeggio', events: [...seq([12, 16, 19, 23], 0.25, 0.24), { at: 1, notes: [24, 19], len: 1.4, roll: 0.12 }] },
];

export const riffFor = (brief: number) => RIFFS[brief] ?? RIFFS[0];

/** Every note a riff can play (for sizing the piano). */
export function riffRange(c: Capstone): [number, number] {
  const root = CAPSTONE_PITCHES[c.pitch]?.midi ?? 48;
  const all = riffFor(c.brief).events.flatMap((e) => e.notes);
  return [root + Math.min(0, ...all), root + Math.max(12, ...all)];
}

function playEvent(c: Capstone, e: RiffEvent, beatSec: number, delay: number) {
  const amps = capstoneAmps(c);
  const root = CAPSTONE_PITCHES[c.pitch]?.midi ?? 48;
  const dur = Math.max(0.12, e.len * beatSec);
  e.notes.forEach((n, i) =>
    audio.play({
      freq: midiToFreq(root + n),
      harmonics: amps,
      level: e.notes.length > 2 ? 0.32 : 0.5,
      duration: dur,
      attack: c.punchy ? 0.005 : Math.min(0.25, dur * 0.4),
      release: c.punchy ? Math.min(0.3, dur * 0.6) : Math.min(0.35, dur * 0.4),
      delay: delay + (e.roll ?? 0) * i,
    })
  );
}

/** A single held note. */
export function playCapstoneNote(c: Capstone) {
  audio.stopAll();
  if (!c.bars.some((b) => b > 0)) return;
  playEvent(c, { at: 0, notes: [0], len: 3 }, 0.5, 0);
}

/**
 * Plays the brief's riff on a loop (or once). Reads the latest sound each time round,
 * so changes to the faders are heard on the next pass. `onNotes` lights up the piano.
 */
export function startRiff(getCap: () => Capstone, onNotes: (midi: number[]) => void, loop = true) {
  let stopped = false;
  const timers: number[] = [];
  const active = new Map<number, number>();
  const show = () => onNotes([...active.keys()]);
  const press = (notes: number[], down: boolean) => {
    if (stopped) return;
    for (const m of notes) {
      const n = (active.get(m) ?? 0) + (down ? 1 : -1);
      if (n > 0) active.set(m, n);
      else active.delete(m);
    }
    show();
  };
  const cycle = () => {
    if (stopped) return;
    const c = getCap();
    const riff = riffFor(c.brief);
    const beatSec = 60 / riff.bpm;
    const root = CAPSTONE_PITCHES[c.pitch]?.midi ?? 48;
    if (c.bars.some((b) => b > 0)) {
      riff.events.forEach((e) => {
        const at = e.at * beatSec;
        playEvent(c, e, beatSec, at);
        const midis = e.notes.map((n) => root + n);
        timers.push(window.setTimeout(() => press(midis, true), at * 1000));
        timers.push(window.setTimeout(() => press(midis, false), (at + e.len * beatSec) * 1000));
      });
    }
    const len = riff.beats * beatSec * 1000;
    if (loop) timers.push(window.setTimeout(cycle, len));
    else timers.push(window.setTimeout(() => {
      active.clear();
      show();
    }, len));
  };
  cycle();
  return () => {
    stopped = true;
    timers.forEach((t) => window.clearTimeout(t));
    onNotes([]);
    audio.stopAll();
  };
}

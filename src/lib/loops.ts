/**
 * A tiny loop player shared by the riff demos and the organ.
 * Times are in beats; notes are MIDI numbers.
 */
export interface LoopEvent {
  at: number;
  notes: number[];
  len: number;
  /** Seconds between notes of a chord (for a rolled/strummed chord). */
  roll?: number;
  /** Free tag, e.g. 'bass' vs 'chord'. */
  part?: string;
}

export interface Loop {
  bpm: number;
  beats: number;
  events: LoopEvent[];
}

const LOOKAHEAD_MS = 80;

/** Starts a loop; returns a stop function. `onNotes` gets the MIDI notes sounding right now. */
export function startLoop(
  getLoop: () => Loop,
  playEvent: (e: LoopEvent, delaySec: number, beatSec: number) => void,
  onNotes: (midi: number[]) => void = () => {},
  repeat = true,
  onStop: () => void = () => {}
) {
  let stopped = false;
  const timers: number[] = [];
  const active = new Map<number, number>();
  const press = (notes: number[], down: boolean) => {
    if (stopped) return;
    for (const m of notes) {
      const n = (active.get(m) ?? 0) + (down ? 1 : -1);
      if (n > 0) active.set(m, n);
      else active.delete(m);
    }
    onNotes([...active.keys()]);
  };
  const cycle = () => {
    if (stopped) return;
    const loop = getLoop();
    const beatSec = 60 / loop.bpm;
    const t0 = performance.now();
    loop.events.forEach((e) => {
      const at = e.at * beatSec;
      // Each note is handed to the sound engine just before it plays (not the whole loop up front),
      // so anything that changes while the loop runs is heard on the very next note.
      timers.push(
        window.setTimeout(() => {
          if (stopped) return;
          playEvent(e, Math.max(0, (t0 + at * 1000 - performance.now()) / 1000), beatSec);
        }, Math.max(0, at * 1000 - LOOKAHEAD_MS))
      );
      timers.push(window.setTimeout(() => press(e.notes, true), at * 1000));
      timers.push(window.setTimeout(() => press(e.notes, false), (at + e.len * beatSec) * 1000));
    });
    const len = loop.beats * beatSec * 1000;
    timers.push(window.setTimeout(repeat ? cycle : () => onStop(), len));
  };
  cycle();
  return () => {
    stopped = true;
    timers.forEach((t) => window.clearTimeout(t));
    active.clear();
    onNotes([]);
    onStop();
  };
}

/** Helper: a run of single notes, `step` beats apart. */
export const run = (notes: number[], step: number, len = step * 0.9, start = 0, part?: string): LoopEvent[] =>
  notes.map((n, i) => ({ at: start + i * step, notes: [n], len, part }));

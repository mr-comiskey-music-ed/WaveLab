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

const RIFF = [0, 3, 7, 12, 10, 7];

export function playCapstone(c: Capstone, riff = false) {
  audio.stopAll();
  const amps = capstoneAmps(c);
  if (!amps.some((a) => a > 0)) return;
  const root = CAPSTONE_PITCHES[c.pitch]?.midi ?? 48;
  const notes = riff ? RIFF : [0];
  const len = riff ? 0.32 : 1.6;
  notes.forEach((n, i) =>
    audio.play({
      freq: midiToFreq(root + n),
      harmonics: amps,
      level: 0.55,
      duration: riff ? len * 0.95 : len,
      attack: c.punchy ? 0.005 : 0.18,
      release: c.punchy ? (riff ? 0.12 : 0.9) : 0.25,
      delay: i * len,
    })
  );
}

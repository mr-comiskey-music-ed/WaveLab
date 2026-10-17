export type StationId = 'read' | 'sound' | 'harm' | 'add' | 'phase' | 'chord' | 'make';

export interface StationInfo {
  id: StationId;
  /** Short name for the step bar. */
  short: string;
  title: string;
  /** The Pudding section students read before this station. */
  pudding: string;
  /** What students should be able to do afterwards. */
  goal: string;
  /** Counts toward the auto-graded score (the capstone is teacher-graded). */
  auto: boolean;
}

export const STATIONS: StationInfo[] = [
  {
    id: 'read',
    short: 'Reading',
    title: 'Reading waveforms',
    pudding: '1. Reading Waveforms (time, displacement, amplitude, frequency)',
    goal: 'Read loudness and pitch straight off a graph, before you hear it.',
    auto: true,
  },
  {
    id: 'sound',
    short: 'Sound',
    title: 'How sound works',
    pudding: '2. How Sound Works',
    goal: 'Connect the line on the graph to a real speaker pushing real air.',
    auto: true,
  },
  {
    id: 'harm',
    short: 'Harmonics',
    title: 'Harmonics',
    pudding: '3. Harmonics (triangle, square and sawtooth)',
    goal: 'Name the four basic waves by ear, and by their harmonic recipe.',
    auto: true,
  },
  {
    id: 'add',
    short: 'Additive',
    title: 'Additive synthesis',
    pudding: '4. Additive Synthesis',
    goal: 'Rebuild a sound from sine waves, using your ears.',
    auto: true,
  },
  {
    id: 'phase',
    short: 'Phase',
    title: 'Phase',
    pudding: '4. Additive Synthesis → Phase',
    goal: 'Hear phase cancellation and fix it the way an engineer would.',
    auto: true,
  },
  {
    id: 'chord',
    short: 'Chords',
    title: 'Chords',
    pudding: '4. Additive Synthesis → Chords',
    goal: 'See why some intervals blend smoothly and others clash.',
    auto: true,
  },
  {
    id: 'make',
    short: 'Make',
    title: 'Make a sound',
    pudding: 'In Conclusion',
    goal: 'Design an original sound for a brief and explain it with harmonics.',
    auto: false,
  },
];

export const AUTO_STATIONS = STATIONS.filter((s) => s.auto);

export interface StationResult {
  /** One score per round, 0–100. */
  rounds: number[];
}

export interface Capstone {
  brief: number;
  name: string;
  why: string;
  /** Harmonic levels 0–10, index 0 = harmonic 1. */
  bars: number[];
  /** Index into CAPSTONE_PITCHES. */
  pitch: number;
  punchy: boolean;
}

export type Results = Partial<Record<StationId, StationResult>>;

export const stationScore = (r?: StationResult) =>
  r && r.rounds.length ? Math.round(r.rounds.reduce((a, b) => a + b, 0) / r.rounds.length) : null;

/** Average of the six auto-graded stations; unfinished stations count as 0. */
export function overallScore(results: Results) {
  const scores = AUTO_STATIONS.map((s) => stationScore(results[s.id]) ?? 0);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export const CAPSTONE_BRIEFS = [
  'The theme for a lonely robot exploring an empty city',
  'A notification sound for an app that helps people sleep',
  'The final boss in a retro video game',
  'An alarm that is impossible to ignore',
  'A warm pad for the slow intro of an R&B song',
  'A sound for a magic spell that heals',
  'The bass for a song played in a huge, dark club',
  'A doorbell for a house in the year 3000',
];

export const CAPSTONE_PITCHES = [
  { label: 'Low', midi: 36 },
  { label: 'Middle', midi: 48 },
  { label: 'High', midi: 60 },
  { label: 'Very high', midi: 72 },
];

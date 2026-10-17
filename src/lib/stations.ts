export type StationId = 'read' | 'sound' | 'harm' | 'add' | 'phase' | 'chord' | 'make';

export const SITE_URL = 'https://pudding.cool/2018/02/waveforms/';
export const SITE_NAME = 'the Waveforms site';

export interface StationInfo {
  id: StationId;
  /** Short name for the step bar. */
  short: string;
  title: string;
  /** The section of the Waveforms site students read before this station. */
  section: string;
  /** Text on the Waveforms site that marks where this section starts (for jump links). */
  jumpText: string;
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
    section: '1. Reading Waveforms (Time, Displacement, Amplitude and Frequency)',
    jumpText: '1. Reading Waveforms',
    goal: 'Read loudness and pitch straight off a graph, before you hear it.',
    auto: true,
  },
  {
    id: 'sound',
    short: 'Sound',
    title: 'How sound works',
    section: '2. How Sound Works',
    jumpText: '2. How Sound Works',
    goal: 'Connect the line on the graph to a real speaker and real air molecules.',
    auto: true,
  },
  {
    id: 'harm',
    short: 'Harmonics',
    title: 'Harmonics',
    section: '3. Harmonics (The Triangle, Square and Sawtooth Waveforms)',
    jumpText: '3. Harmonics',
    goal: 'Name the four basic waveforms by ear and by their harmonics, and work out harmonic frequencies.',
    auto: true,
  },
  {
    id: 'add',
    short: 'Additive',
    title: 'Additive synthesis',
    section: '4. Additive Synthesis (the part before Phase)',
    jumpText: '4. Additive Synthesis',
    goal: 'Add waves point by point, then rebuild a sound from sine waves by ear.',
    auto: true,
  },
  {
    id: 'phase',
    short: 'Phase',
    title: 'Phase',
    section: '4. Additive Synthesis: Phase',
    jumpText: 'Something counter-intuitive about waveform addition',
    goal: 'Hear phase cancellation between two mics and fix it the way an engineer would.',
    auto: true,
  },
  {
    id: 'chord',
    short: 'Chords',
    title: 'Chords',
    section: '4. Additive Synthesis: Chords',
    jumpText: 'Another way to think of waveform addition',
    goal: 'See a chord as waves added together, and recognise intervals by ear.',
    auto: true,
  },
  {
    id: 'make',
    short: 'Make',
    title: 'Make a sound',
    section: 'In Conclusion',
    jumpText: 'In Conclusion',
    goal: 'Design an original sound for a brief and explain it with harmonics.',
    auto: false,
  },
];

/** Link that opens the Waveforms site scrolled to a station's section (Chrome "jump to text"). */
export function sectionLink(info: StationInfo) {
  const text = encodeURIComponent(info.jumpText).replace(/-/g, '%2D');
  // The query string forces a fresh load so the jump works even if the window is already open.
  return `${SITE_URL}?from=wavelab-${info.id}#:~:text=${text}`;
}

/** Sections chosen by the teacher's link (?s=read,harm). Empty or missing = all. */
export function assignedFromUrl(search: string): StationId[] {
  const raw = new URLSearchParams(search).get('s');
  if (!raw) return STATIONS.map((s) => s.id);
  const ids = raw.split(',').filter((id): id is StationId => STATIONS.some((s) => s.id === id));
  return ids.length ? STATIONS.filter((s) => ids.includes(s.id)).map((s) => s.id) : STATIONS.map((s) => s.id);
}

export interface StationResult {
  /** One score per round, 0–100. Right/wrong rounds are 100 or 50. */
  rounds: number[];
}

/** Grade for a right/wrong round: a wrong answer still earns half credit. */
export const mcScore = (ok: boolean) => (ok ? 100 : 50);

/** Grade for a skill round from a 0–1 quality: never below 50. */
export const skillScore = (quality: number) => Math.round(50 + 50 * Math.max(0, Math.min(1, quality)));

/** Words students see instead of numbers. */
export function roundWord(score: number, kind: 'mc' | 'skill') {
  if (kind === 'mc') return score >= 100 ? 'Correct' : 'Not quite';
  return score >= 95 ? 'Nailed it' : score >= 80 ? 'Close' : 'Keep practicing';
}

export const roundTone = (score: number) => (score >= 95 ? 'good' : score > 60 ? 'part' : 'miss');

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

/** Average of the assigned auto-graded stations; unfinished ones count as 0. */
export function overallScore(results: Results, assigned: StationId[] = STATIONS.map((s) => s.id)) {
  const auto = STATIONS.filter((s) => s.auto && assigned.includes(s.id));
  if (!auto.length) return null;
  const scores = auto.map((s) => stationScore(results[s.id]) ?? 0);
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

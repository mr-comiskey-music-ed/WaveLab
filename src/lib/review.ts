import { readSaved } from './persist';
import { PHASE_TITLES, PhaseKind } from './phase';
import { Results, StationId, STATIONS } from './stations';

/**
 * What a student actually saw and answered in each round, packed small enough to ride along in their code.
 * Their questions are random, so a score alone can't say what they were asked; this can.
 * It's read from the student's saved progress when they make their code (nothing new is stored anywhere).
 *
 * `p` is what they picked and `c` is the right answer, both as the option ids the station uses.
 */
type Pick = { p: string; c: string };

export type Rec =
  // Reading waveforms
  | (Pick & { k: 'amp'; amp: number; hz: number })
  | (Pick & { k: 'louder' | 'higher'; a: [number, number]; b: [number, number] }) // [amplitude, Hz] of waves A and B
  | (Pick & { k: 'hz'; hz: number })
  | (Pick & { k: 'hz1ms'; n: number })
  | (Pick & { k: 'pitch' })
  // How sound works
  | (Pick & { k: 'cone'; wave: string })
  | (Pick & { k: 'idea'; i: number })
  // Harmonics
  | (Pick & { k: 'ear'; wave: string; midi: number })
  | (Pick & { k: 'bars'; wave: string })
  | (Pick & { k: 'math'; root: number; n: number })
  | (Pick & { k: 'which'; wave: string })
  // Additive synthesis
  | (Pick & { k: 'point'; va: number; vb: number })
  | (Pick & { k: 'pick'; hz: number; amp: number })
  | { k: 'match'; t: number[]; m: number[]; midi: number; peek: boolean; hint: boolean; cl?: string }
  // Phase: where each control was left when the round was locked in
  | { k: 'bass'; base: number; nudge: number }
  | { k: 'snare'; flip: boolean }
  | { k: 'overhead'; lx: number; rx: number }
  | { k: 'train'; tgt: number; delay: number; flip: boolean }
  // Chords
  | (Pick & { k: 'click' | 'slider'; root: number; ans: string });

/** Per station, one entry per round (same order as the scores). `null` = no detail for that round. */
export type Review = Partial<Record<StationId, (Rec | null)[]>>;

const rec = <T>(key: string) => readSaved<T>(key);
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Reads the student's saved answers for the assigned, finished stations. */
export function collectReview(results: Results, assigned: StationId[]): Review {
  const out: Review = {};
  const add = (id: StationId, build: (i: number) => Rec | null) => {
    const n = results[id]?.rounds.length ?? 0;
    if (!assigned.includes(id) || !n) return;
    const recs = Array.from({ length: n }, (_, i) => {
      try {
        return build(i);
      } catch {
        return null; // a half-saved round just gets no detail
      }
    });
    if (recs.some(Boolean)) out[id] = recs;
  };

  // 1. Reading waveforms
  {
    const qs = rec<any[]>('read:qs') ?? [];
    const picked = rec<Record<number, string>>('read:picked') ?? {};
    add('read', (i) => {
      const q = qs[i];
      const p = picked[i];
      if (!q || p === undefined) return null;
      switch (q.kind) {
        case 'amp':
          return { k: 'amp', amp: q.tone.amp, hz: q.tone.hz, p, c: String(q.tone.amp) };
        case 'louder':
        case 'higher':
          return { k: q.kind, a: [q.a.amp, q.a.hz], b: [q.b.amp, q.b.hz], p, c: q.answer };
        case 'hz':
          return { k: 'hz', hz: q.tone.hz, p, c: String(q.tone.hz) };
        case 'hz1ms':
          return { k: 'hz1ms', n: q.cycles, p, c: String(q.cycles * 1000) };
        case 'pitch':
          return { k: 'pitch', p, c: q.answer };
      }
      return null;
    });
  }

  // 2. How sound works
  {
    const qs = rec<any[]>('sound:qs') ?? [];
    const picked = rec<Record<number, string>>('sound:picked') ?? {};
    add('sound', (i) => {
      const q = qs[i];
      const p = picked[i];
      if (!q || p === undefined) return null;
      return q.kind === 'cone' ? { k: 'cone', wave: q.wave, p, c: q.want } : { k: 'idea', i: q.idea, p, c: '0' };
    });
  }

  // 3. Harmonics (a retry swaps in fresh ear questions, so this is the latest try)
  {
    const qs = rec<any[]>('harm:qs') ?? [];
    const picked = rec<Record<number, string>>('harm:picked') ?? {};
    add('harm', (i) => {
      const q = qs[i];
      const p = picked[i];
      if (!q || p === undefined) return null;
      switch (q.kind) {
        case 'ear':
          return { k: 'ear', wave: q.wave, midi: q.midi, p, c: q.wave };
        case 'bars':
          return { k: 'bars', wave: q.wave, p, c: q.wave };
        case 'math':
          return { k: 'math', root: q.root, n: q.n, p, c: String(q.root * q.n) };
        case 'which':
          return { k: 'which', wave: q.wave, p, c: q.wave === 'sawtooth' ? 'all' : q.wave === 'sine' ? 'none' : 'odd' };
      }
      return null;
    });
  }

  // 4. Additive synthesis
  {
    const qs = rec<any[]>('add:qs') ?? [];
    const picked = rec<Record<number, string>>('add:picked') ?? {};
    const mine = rec<Record<number, number[]>>('add:mine') ?? {};
    const peeked = rec<Record<number, boolean>>('add:peeked') ?? {};
    const hinted = rec<Record<number, boolean>>('add:hinted') ?? {};
    const raw = rec<Record<number, number>>('add:raw') ?? {};
    add('add', (i) => {
      const q = qs[i];
      if (!q) return null;
      if (q.kind === 'match') {
        // Only locked-in matches count: a retry that isn't finished has fresh, untouched faders.
        if (raw[i] === undefined || !mine[i]) return null;
        return { k: 'match', t: q.target, m: mine[i].map(round2), midi: q.midi, peek: !!peeked[i], hint: !!hinted[i], ...(q.classic ? { cl: q.classic } : {}) };
      }
      const p = picked[i];
      if (p === undefined) return null;
      if (q.kind === 'point') return { k: 'point', va: q.va, vb: q.vb, p, c: String(Math.round((q.va + q.vb) * 10) / 10) };
      return { k: 'pick', hz: q.b.hz, amp: q.b.amp, p, c: 'sum' };
    });
  }

  // 5. Phase: scores are in the order this student's rounds were saved, so records are too
  {
    const rounds = rec<any[]>('phase4:rounds') ?? [];
    const snaps = rec<Record<number, { snareFlip: boolean; micX: number; busFlip: boolean; nudge?: number; busDelay?: number }>>('phase4:snaps') ?? {};
    const nudgeNow = rec<number>('phase4:nudge') ?? 0;
    const busDelayNow = rec<number>('phase4:busDelay') ?? 0;
    add('phase', (i) => {
      const rd = rounds[i];
      const s = snaps[i];
      if (!rd || !s) return null;
      switch (rd.kind) {
        case 'bass':
          return { k: 'bass', base: round2(rd.base), nudge: round2(s.nudge ?? nudgeNow) };
        case 'snare':
          return { k: 'snare', flip: !!s.snareFlip };
        case 'overhead':
          return { k: 'overhead', lx: rd.leftX, rx: s.micX };
        case 'train':
          return { k: 'train', tgt: round2(rd.targetMs), delay: round2(s.busDelay ?? busDelayNow), flip: !!s.busFlip };
      }
      return null;
    });
  }

  // 6. Chords
  {
    const qs = rec<any[]>('chord4:qs') ?? [];
    const picked = rec<Record<number, string>>('chord4:picked') ?? {};
    const STEPS: Record<string, number> = { P8: 12, P5: 7, P4: 5, M3: 4, m3: 3, M2: 2 };
    add('chord', (i) => {
      const q = qs[i];
      const p = picked[i];
      if (!q || p === undefined) return null;
      return { k: q.kind, root: q.root, ans: q.answer, p, c: q.kind === 'slider' ? String(STEPS[q.answer]) : q.answer };
    });
  }

  return out;
}

/** Checks a decoded review is the right shape (so a damaged one can't break the grader). */
export function cleanReview(raw: unknown): Review | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ids = new Set<string>(STATIONS.map((s) => s.id));
  const out: Review = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!ids.has(id) || !Array.isArray(list)) continue;
    out[id as StationId] = list.map((r) => (r && typeof r === 'object' && typeof (r as Rec).k === 'string' ? (r as Rec) : null));
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------- names for the rounds ----------

/**
 * The question each round asks, in general terms (the exact numbers differ per student).
 * Rounds sit in the same place for every student, so this works for codes with and without answers.
 */
const SLOT_TITLES: Partial<Record<StationId, string[]>> = {
  read: ['Read the amplitude from a graph', 'Which wave is louder?', 'Find the frequency (1-second graph)', 'Which wave is higher in pitch?', 'Which wave has a pitch (periodic vs noise)?', 'Find the frequency of a real sound (1 ms graph)'],
  sound: ['Where is the speaker cone?', 'Do air molecules travel to your ear?', 'Where is the speaker cone?', 'Big-idea question', 'Where is the speaker cone?', 'Big-idea question'],
  harm: [
    'Name the waveform by ear',
    'Name the waveform by ear',
    'Name the waveform from its harmonics',
    'Find a harmonic’s frequency',
    'Name the waveform by ear',
    'Name the waveform from its harmonics',
    'Name the waveform by ear',
    'Which harmonics does the waveform have?',
  ],
  add: ['Add two waves at one moment', 'Pick the combined wave', 'Match 3 harmonics by ear', 'Match 4 harmonics by ear', 'Match 5 harmonics by ear (start of a real waveform)'],
  phase: [PHASE_TITLES.snare, PHASE_TITLES.train, PHASE_TITLES.bass, PHASE_TITLES.overhead], // newest order; see roundTitle
  chord: ['Find the interval by clicking through them', 'Build the interval by sliding the upper note', 'Find the interval by clicking through them', 'Build the interval by sliding the upper note'],
};

/** The usual order of a station's rounds, for sorting. */
export const titlesFor = (id: StationId) => SLOT_TITLES[id] ?? [];

/** The name of round `i` of a station. Phase rounds follow the student's own order when their code says what it was. */
export function roundTitle(id: StationId, i: number, r?: Rec | null) {
  if (id === 'phase' && r && r.k in PHASE_TITLES) return PHASE_TITLES[r.k as PhaseKind];
  // The phase rounds were reordered, so a code without answers can't say which round sat where.
  if (id === 'phase') return `Phase round ${i + 1}`;
  return SLOT_TITLES[id]?.[i] ?? `Round ${i + 1}`;
}

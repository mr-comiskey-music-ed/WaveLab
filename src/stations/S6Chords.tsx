import { useState } from 'react';
import { audio } from '../lib/audio';
import { pick, shuffle } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Choices, Feedback, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

interface Interval {
  id: string;
  name: string;
  p: number; // upper note = p/q × lower note
  q: number;
}

const INTERVALS: Interval[] = [
  { id: 'P8', name: 'Octave', p: 2, q: 1 },
  { id: 'P5', name: 'Perfect fifth', p: 3, q: 2 },
  { id: 'P4', name: 'Perfect fourth', p: 4, q: 3 },
  { id: 'M3', name: 'Major third', p: 5, q: 4 },
  { id: 'm3', name: 'Minor third', p: 6, q: 5 },
  { id: 'M2', name: 'Major second', p: 9, q: 8 },
  { id: 'm2', name: 'Minor second', p: 16, q: 15 },
  { id: 'TT', name: 'Tritone', p: 45, q: 32 },
];
const byId = (id: string) => INTERVALS.find((i) => i.id === id)!;

const LOW = 220;
const WINDOW = 0.03; // 30 ms

const lowWave = (t: number) => 0.5 * Math.sin(2 * Math.PI * LOW * t);
const highWave = (iv: Interval) => (t: number) => 0.5 * Math.sin(2 * Math.PI * LOW * (iv.p / iv.q) * t);
const sumWave = (iv: Interval) => {
  const hi = highWave(iv);
  return (t: number) => lowWave(t) + hi(t);
};
const repeatMs = (iv: Interval) => (iv.q / LOW) * 1000;

function playInterval(iv: Interval, delay = 0) {
  audio.play({ freq: LOW, harmonics: [1], level: 0.4, duration: 1.6, delay, attack: 0.04 });
  audio.play({ freq: (LOW * iv.p) / iv.q, harmonics: [1], level: 0.4, duration: 1.6, delay, attack: 0.04 });
}

type Q = { a: Interval; b: Interval; answer: 'a' | 'b' };

function makeQuestions(): Q[] {
  const simple = ['P8', 'P5', 'P4', 'M3'];
  const tense = ['M2', 'm2', 'TT'];
  const pairs: [string, string][] = [
    [pick(simple), pick(tense)],
    [pick(['P8', 'P5']), pick(['m3', 'M3'])],
    [pick(simple), pick(tense)],
    [pick(['P5', 'P4', 'M3']), pick(['m2', 'TT'])],
  ];
  return pairs.map(([s, t]) => {
    const [a, b] = shuffle([byId(s), byId(t)]);
    return { a, b, answer: a.q < b.q ? 'a' : 'b' };
  });
}

/** Things to explore: the intervals, plus Pudding's C major chord (three sine waves, 4:5:6). */
interface Stack {
  id: string;
  name: string;
  notes: number[]; // multiples of the lowest note
  period: number; // the mix repeats every `period` cycles of the lowest note
  ratio: string;
}
const STACKS: Stack[] = [
  ...INTERVALS.map((iv) => ({ id: iv.id, name: iv.name, notes: [1, iv.p / iv.q], period: iv.q, ratio: `${iv.p}:${iv.q}` })),
  { id: 'CM', name: 'C major chord', notes: [1, 5 / 4, 3 / 2], period: 4, ratio: '4:5:6' },
];
const CHORD_LOW = 261.63; // C4 for the chord

function playStack(st: Stack) {
  const base = st.id === 'CM' ? CHORD_LOW : LOW;
  st.notes.forEach((m) => audio.play({ freq: base * m, harmonics: [1], level: 0.35, duration: 1.6, attack: 0.04 }));
}

export function S6Chords({ info, done, onComplete, onNext }: StationProps) {
  const [exId, setExId] = useState('P5');
  const ex = STACKS.find((s) => s.id === exId)!;
  const exLow = ex.id === 'CM' ? CHORD_LOW : LOW;
  const exScale = 1 / ex.notes.length;
  const exRepeatMs = (ex.period / exLow) * 1000;
  const [qs] = useState(makeQuestions);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState(false);
  const r = useRounds(qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;

  const hearPair = () => {
    audio.stopAll();
    playInterval(q.a);
    playInterval(q.b, 2);
  };
  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(id === q.answer ? 100 : 0);
    hearPair();
  };
  const win = q.answer === 'a' ? q.a : q.b;
  const lose = q.answer === 'a' ? q.b : q.a;

  return (
    <div className="station">
      <StationHeader {...info} />
      <Section title="Stack notes" note="As The Pudding says, playing a chord is just adding waves together. Pick an interval, or Pudding's C major chord, and watch the shape of the mix.">
        <div className="seg wrap" role="group" aria-label="Interval">
          {STACKS.map((st) => (
            <button
              key={st.id}
              className={st.id === exId ? 'on' : ''}
              aria-pressed={st.id === exId}
              onClick={() => {
                setExId(st.id);
                audio.stopAll();
                playStack(st);
              }}
            >
              {st.name}
            </button>
          ))}
        </div>
        <WavePlot
          tag={ex.notes.length === 3 ? 'The three notes' : 'The two notes'}
          traces={ex.notes.map((m, i) => ({
            fn: (t: number) => exScale * 1.6 * Math.sin(2 * Math.PI * exLow * m * t),
            color: ['var(--trace-a)', 'var(--trace-b)', '#2e9e6b'][i],
            width: 1.8,
          }))}
          duration={WINDOW}
          yMax={1.05}
          height={100}
          label="The individual notes"
        />
        <WavePlot
          tag="Added together"
          traces={[{ fn: (t: number) => ex.notes.reduce((sum, m) => sum + exScale * 1.6 * Math.sin(2 * Math.PI * exLow * m * t), 0), color: 'var(--ink)', width: 2.5 }]}
          duration={WINDOW}
          timeAxis
          yMax={1.7}
          height={130}
          label="The notes added together"
        />
        <p className="about">
          <strong>{ex.name}</strong>: {ex.notes.length === 3 ? 'three notes whose frequencies are in the ratio' : 'the two notes vibrate in the ratio'} {ex.ratio}. The mix repeats its pattern every {exRepeatMs.toFixed(1)} ms
          {exRepeatMs > WINDOW * 1000 ? ', which is longer than this whole graph.' : '.'} Simple ratios repeat quickly and tend to sound smooth; complicated ratios take much longer and sound tense.
        </p>
        <p className="hint">
          Western music splits the octave into 12 equal steps, so a real piano rounds these ratios very slightly. The idea still holds.
        </p>
        <PlayButton onClick={() => playStack(ex)}>Play {ex.name.toLowerCase()}</PlayButton>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={qs.map((x) => `${x.a.name} vs. ${x.b.name}`)} onNext={onNext} />
      ) : (
        <Section title="Spot the smooth one" note="Each graph is two notes added together. Decide from the shape first; the sound plays after you answer.">
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          <p className="question">Which mix repeats its pattern sooner (so it will probably sound smoother)?</p>
          <div className="pair">
            <WavePlot tag="A" traces={[{ fn: sumWave(q.a), color: 'var(--trace-a)', width: 2.2 }]} duration={WINDOW} yMax={1.05} height={110} label="Mix A" />
            <WavePlot tag="B" traces={[{ fn: sumWave(q.b), color: 'var(--trace-b)', width: 2.2 }]} duration={WINDOW} yMax={1.05} height={110} label="Mix B" />
          </div>
          <Choices options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} correct={q.answer} picked={choice} onPick={choose} />
          {choice && (
            <>
              <Feedback ok={choice === q.answer}>
                {q.answer.toUpperCase()} was a <strong>{win.name.toLowerCase()}</strong> ({win.p}:{win.q}), which repeats every {repeatMs(win).toFixed(1)} ms. The other was a{' '}
                <strong>{lose.name.toLowerCase()}</strong> ({lose.p}:{lose.q}), which takes {repeatMs(lose).toFixed(1)} ms to repeat. You'll hear A, then B.
              </Feedback>
              <PlayButton onClick={hearPair}>Hear A, then B again</PlayButton>
            </>
          )}
          {r.answered && <NextButton isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />}
        </Section>
      )}
    </div>
  );
}

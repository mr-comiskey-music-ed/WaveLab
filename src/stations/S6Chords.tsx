import { useState } from 'react';
import { audio } from '../lib/audio';
import { midiName, midiToFreq, randInt, shuffle } from '../lib/waves';
import { useSaved } from '../lib/persist';
import { mcScore } from '../lib/stations';
import { WavePlot } from '../components/WavePlot';
import { Piano } from '../components/Piano';
import { Feedback, FeedbackSlot, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

interface Stack {
  id: string;
  name: string;
  /** Semitones above the lowest note (as on a piano). */
  steps: number[];
  /** Simple whole-number ratio of the frequencies, for the graph. */
  ratio: number[];
}

const INTERVALS: Stack[] = [
  { id: 'P8', name: 'Octave', steps: [0, 12], ratio: [1, 2] },
  { id: 'P5', name: 'Perfect fifth', steps: [0, 7], ratio: [2, 3] },
  { id: 'P4', name: 'Perfect fourth', steps: [0, 5], ratio: [3, 4] },
  { id: 'M3', name: 'Major third', steps: [0, 4], ratio: [4, 5] },
  { id: 'm3', name: 'Minor third', steps: [0, 3], ratio: [5, 6] },
  { id: 'M2', name: 'Major second', steps: [0, 2], ratio: [8, 9] },
];
const EXPLORE: Stack[] = [...INTERVALS, { id: 'CM', name: 'C major chord', steps: [0, 4, 7], ratio: [4, 5, 6] }];
const byId = (id: string) => EXPLORE.find((s) => s.id === id)!;

const EXPLORE_ROOT = 48; // C3
const WINDOW = 0.03; // 30 ms
const COLORS = ['var(--trace-a)', 'var(--trace-b)', '#2e9e6b'];

function playStack(st: Stack, root: number) {
  st.steps.forEach((s, i) =>
    audio.play({ freq: midiToFreq(root + s), harmonics: [1, 0.25, 0.1], level: 0.4, duration: 1.4, attack: 0.02, delay: i * 0.04 })
  );
}

/** answer = the interval on the piano; options = the four graphs to choose from (ids of intervals, shuffled). */
type Q = { answer: string; root: number; options: string[] };

function makeQuestions(): Q[] {
  return shuffle(INTERVALS.map((i) => i.id))
    .slice(0, 4)
    .map((answer) => {
      const others = shuffle(INTERVALS.map((i) => i.id).filter((id) => id !== answer)).slice(0, 3);
      return { answer, root: randInt(48, 55), options: shuffle([answer, ...others]) };
    });
}

/** The two notes' sine waves added together, drawn over six cycles of the lower note. */
function sumFn(st: Stack, root: number) {
  const freqs = st.steps.map((s) => midiToFreq(root + s));
  return (t: number) => freqs.reduce((sum, f) => sum + 0.8 * Math.sin(2 * Math.PI * f * t), 0);
}

export function S6Chords({ info, done, onComplete, onNext }: StationProps) {
  const [exId, setExId] = useState('P5');
  const ex = byId(exId);
  const baseHz = midiToFreq(EXPLORE_ROOT) / ex.ratio[0];
  const exTraces = ex.ratio.map((n, i) => ({ fn: (t: number) => (1.6 / ex.ratio.length) * Math.sin(2 * Math.PI * baseHz * n * t), color: COLORS[i], width: 1.8 }));
  const repeatMs = (1000 / baseHz).toFixed(1);

  const [qs] = useSaved('chord2:qs', makeQuestions);
  const [picked, setPicked] = useSaved<Record<number, string>>('chord2:picked', {});
  const [summary, setSummary] = useSaved('chord2:summary', false);
  const r = useRounds('chord2', qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;
  const answerStack = byId(q.answer);
  const rootHz = midiToFreq(q.root);

  const choose = (id: string) => {
    if (choice) return;
    setPicked({ ...picked, [r.index]: id });
    r.answer(mcScore(id === q.answer));
  };

  return (
    <div className="station">
      <StationHeader info={info} />
      <Section
        title="Stack notes"
        note={
          <>
            An <strong>interval</strong> is the distance between two notes, counted in steps (keys) on a piano. A <strong>chord</strong> is three or more notes played at the same time. As the
            Waveforms site says, playing notes together is just adding their waves together.
          </>
        }
      >
        <div className="seg wrap" role="group" aria-label="Interval or chord">
          {EXPLORE.map((st) => (
            <button
              key={st.id}
              className={st.id === exId ? 'on' : ''}
              aria-pressed={st.id === exId}
              onClick={() => {
                setExId(st.id);
                audio.stopAll();
                playStack(st, EXPLORE_ROOT);
              }}
            >
              {st.name}
            </button>
          ))}
        </div>
        <Piano lo={48} hi={71} lit={ex.steps.map((s) => EXPLORE_ROOT + s)} label={ex.name} />
        <p className="about">
          <strong>{ex.name}</strong>: {ex.steps.map((s) => midiName(EXPLORE_ROOT + s)).join(' + ')}
          {ex.steps.length === 2 ? `, ${ex.steps[1]} piano steps apart.` : ', the 1st, 3rd and 5th notes of the C major scale.'}
        </p>
        <WavePlot tag={ex.steps.length === 3 ? 'The three notes' : 'The two notes'} traces={exTraces} duration={WINDOW} yMax={1.7} height={130} label="The individual notes" />
        <WavePlot
          tag="Added together"
          traces={[{ fn: (t: number) => exTraces.reduce((sum, tr) => sum + tr.fn(t), 0), color: 'var(--ink)', width: 2.5 }]}
          duration={WINDOW}
          timeAxis
          yMax={1.7}
          height={130}
          label="The notes added together"
        />
        <p className="hint">
          These notes vibrate in the ratio {ex.ratio.join(':')}, so the added-up wave repeats its pattern every {repeatMs} ms. Simple ratios like the octave (1:2) repeat quickly; more complicated ones
          take longer. (A real piano rounds these ratios very slightly so that 12 equal steps fit in an octave.)
        </p>
        <PlayButton onClick={() => playStack(ex, EXPLORE_ROOT)}>Play {ex.name.toLowerCase()}</PlayButton>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={qs.map((x) => `Match the ${byId(x.answer).name.toLowerCase()}'s waveform`)} kinds={qs.map(() => 'mc' as const)} onNext={onNext} />
      ) : (
        <Section
          title="Match the interval"
          note="The piano shows two keys pressed together. Their two sine waves add up to one combined wave. Find the graph that matches."
        >
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          <div className="q-stage stage-chord">
            <p className="question">These two keys are played together. Which graph shows their added-together wave?</p>
            <Piano lo={48} hi={71} lit={answerStack.steps.map((s) => q.root + s)} label="The two keys that are played" />
            <p className="hint">Hint: count how many times the higher note wiggles for each wiggle of the lower note. The ratio box above will help.</p>
            <div className="choice-plots two">
              {q.options.map((id, i) => {
                const st = byId(id);
                const letter = String.fromCharCode(65 + i);
                const cls = !choice ? '' : id === q.answer ? 'right' : id === choice ? 'wrong' : 'dim';
                return (
                  <button key={id} className={`choice plot-choice ${cls}`} disabled={!!choice} onClick={() => choose(id)} aria-label={`Graph ${letter}`}>
                    <WavePlot tag={letter} traces={[{ fn: sumFn(st, q.root), color: 'var(--ink)', width: 2.2 }]} duration={6 / rootHz} yMax={1.7} height={110} label={`Option ${letter}`} />
                  </button>
                );
              })}
            </div>
            <div className="btn-row">
              <PlayButton disabled={!choice} onClick={() => playStack(answerStack, q.root)}>
                Hear the interval
              </PlayButton>
            </div>
          </div>
          <FeedbackSlot>
            {choice && (
              <Feedback ok={choice === q.answer}>
                It was a <strong>{answerStack.name.toLowerCase()}</strong>: {answerStack.steps.map((s) => midiName(q.root + s)).join(' and ')}, {answerStack.steps[1]} piano steps apart. The notes vibrate in the
                ratio {answerStack.ratio.join(':')}, so the added wave has {answerStack.ratio[1]} wiggles of the higher note for every {answerStack.ratio[0]} of the lower.
                {choice !== q.answer && ` Your pick was the graph for a ${byId(choice).name.toLowerCase()} (${byId(choice).ratio.join(':')}).`}
              </Feedback>
            )}
          </FeedbackSlot>
          <NextButton index={r.index} onPrev={r.prev} answered={r.answered} isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />
        </Section>
      )}
    </div>
  );
}

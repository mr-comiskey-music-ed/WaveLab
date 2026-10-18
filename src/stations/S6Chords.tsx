import { useEffect, useRef, useState } from 'react';
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
/** Every step from 0 to 12 in pure tuning (for the slider rounds). */
const ALL_STEPS: Stack[] = [
  { id: 's0', name: 'Same note', steps: [0, 0], ratio: [1, 1] },
  { id: 's1', name: 'Minor second', steps: [0, 1], ratio: [15, 16] },
  { id: 's2', name: 'Major second', steps: [0, 2], ratio: [8, 9] },
  { id: 's3', name: 'Minor third', steps: [0, 3], ratio: [5, 6] },
  { id: 's4', name: 'Major third', steps: [0, 4], ratio: [4, 5] },
  { id: 's5', name: 'Perfect fourth', steps: [0, 5], ratio: [3, 4] },
  { id: 's6', name: 'Tritone', steps: [0, 6], ratio: [32, 45] },
  { id: 's7', name: 'Perfect fifth', steps: [0, 7], ratio: [2, 3] },
  { id: 's8', name: 'Minor sixth', steps: [0, 8], ratio: [5, 8] },
  { id: 's9', name: 'Major sixth', steps: [0, 9], ratio: [3, 5] },
  { id: 's10', name: 'Minor seventh', steps: [0, 10], ratio: [5, 9] },
  { id: 's11', name: 'Major seventh', steps: [0, 11], ratio: [8, 15] },
  { id: 's12', name: 'Octave', steps: [0, 12], ratio: [1, 2] },
];

const EXPLORE: Stack[] = [...INTERVALS, { id: 'CM', name: 'C major chord', steps: [0, 4, 7], ratio: [4, 5, 6] }];
const byId = (id: string) => EXPLORE.find((s) => s.id === id)!;

const EXPLORE_ROOT = 48; // C3
const WINDOW = 0.03; // 30 ms
const COLORS = ['var(--trace-a)', 'var(--trace-b)', '#2e9e6b'];

/**
 * Plays the stack in "pure" tuning: each note is the lowest note times its whole-number ratio, so every
 * wave lines up exactly with the graphs and nothing beats. (A real piano rounds these ratios slightly,
 * which is where the slow wobbling in a piano chord comes from.)
 */
function playStack(st: Stack, root: number) {
  const base = midiToFreq(root);
  st.ratio.forEach((n, i) =>
    audio.play({ freq: (base * n) / st.ratio[0], harmonics: [1, 0.25, 0.1], level: 0.4, duration: 1.4, attack: 0.02, delay: i * 0.04 })
  );
}

/** 'click' rounds: click through the intervals. 'slider' rounds: build the interval by sliding the upper note. */
type Q = { kind: 'click' | 'slider'; answer: string; root: number };

function makeQuestions(): Q[] {
  return shuffle(INTERVALS.map((i) => i.id))
    .slice(0, 4)
    .map((answer, i): Q => ({ kind: i % 2 === 0 ? 'click' : 'slider', answer, root: randInt(48, 55) }));
}

/** The two notes' sine waves added together (in pure tuning), drawn over six cycles of the lower note. */
function sumFn(st: Stack, root: number) {
  const base = midiToFreq(root);
  const freqs = st.ratio.map((n) => (base * n) / st.ratio[0]);
  return (t: number) => freqs.reduce((sum, f) => sum + 0.8 * Math.sin(2 * Math.PI * f * t), 0);
}

export function S6Chords({ info, done, onComplete, onNext }: StationProps) {
  const [exId, setExId] = useState('P5');
  const ex = byId(exId);
  const baseHz = midiToFreq(EXPLORE_ROOT) / ex.ratio[0];
  const exTraces = ex.ratio.map((n, i) => ({ fn: (t: number) => (1.6 / ex.ratio.length) * Math.sin(2 * Math.PI * baseHz * n * t), color: COLORS[i], width: 1.8 }));
  const repeatMs = (1000 / baseHz).toFixed(1);

  const [qs] = useSaved('chord4:qs', makeQuestions);
  const [tried, setTried] = useSaved<Record<number, string>>('chord4:tried', {});
  const [picked, setPicked] = useSaved<Record<number, string>>('chord4:picked', {});
  const [slid, setSlid] = useSaved<Record<number, number>>('chord4:slid', {});
  const [summary, setSummary] = useSaved('chord4:summary', false);
  const r = useRounds('chord4', qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;
  const answerStack = byId(q.answer);
  const rootHz = midiToFreq(q.root);
  const slider = q.kind === 'slider';
  const steps = slid[r.index] ?? 0; // slider rounds: piano steps above the root
  const current = slider ? (slid[r.index] !== undefined || choice ? `s${steps}` : null) : tried[r.index] ?? null;
  const built = ALL_STEPS[steps];
  const shown = choice ? (slider ? built : answerStack) : current ? (slider ? built : byId(current)) : null;
  const pianoNotes = slider ? [q.root, q.root + steps] : shown ? shown.steps.map((s) => q.root + s) : [q.root];

  const hearTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hearTimer.current), []);

  const audition = (id: string) => {
    if (choice) return;
    setTried({ ...tried, [r.index]: id });
    audio.stopAll();
    playStack(byId(id), q.root);
  };
  const slide = (n: number) => {
    if (choice) return;
    setSlid({ ...slid, [r.index]: n });
    window.clearTimeout(hearTimer.current);
    hearTimer.current = window.setTimeout(() => {
      audio.claim('chord-slider');
      playStack(ALL_STEPS[n], q.root);
    }, 250);
  };
  const submit = () => {
    if (!current) return;
    const mine = slider ? steps === answerStack.steps[1] : current === q.answer;
    setPicked({ ...picked, [r.index]: slider ? String(steps) : current });
    r.answer(mcScore(mine));
  };
  const correct = slider ? choice !== null && Number(choice) === answerStack.steps[1] : choice === q.answer;

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
        <StationDone scores={r.scores} labels={qs.map((x) => `${x.kind === 'slider' ? 'Build' : 'Match'} the ${byId(x.answer).name.toLowerCase()}`)} kinds={qs.map(() => 'mc' as const)} onNext={onNext} />
      ) : (
        <Section
          title="Match the interval"
          note="Each round shows a mystery wave: two notes added together. In some rounds you click through the intervals to find the match. In others you build it by sliding the upper note up the piano. When your wave matches, submit it."
        >
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          <h4 className="round-title">{slider ? 'Build it: slide the upper note' : 'Find it: click through the intervals'}</h4>
          <div className="q-stage stage-chord">
            <WavePlot tag="Mystery wave" traces={[{ fn: sumFn(answerStack, q.root), color: 'var(--ink)', width: 2.5 }]} duration={6 / rootHz} yMax={1.7} height={120} label="The mystery wave: two notes added together" />
            {slider ? (
              <label className="slider wide">
                <span>
                  Upper note: {steps} piano {steps === 1 ? 'step' : 'steps'} above {midiName(q.root)}
                  {slid[r.index] !== undefined || choice ? ` (${built.name.toLowerCase()})` : ''}
                </span>
                <input type="range" min={0} max={12} step={1} value={steps} disabled={!!choice} onChange={(e) => slide(+e.target.value)} />
              </label>
            ) : (
              <div className="seg wrap" role="group" aria-label="Try an interval">
                {INTERVALS.map((iv) => {
                  const cls = choice ? (iv.id === q.answer ? 'right-pill' : iv.id === choice ? 'wrong-pill' : '') : iv.id === current ? 'on' : '';
                  return (
                    <button key={iv.id} className={cls} aria-pressed={iv.id === current} disabled={!!choice} onClick={() => audition(iv.id)}>
                      {iv.name}
                    </button>
                  );
                })}
              </div>
            )}
            <Piano lo={48} hi={71} lit={pianoNotes} label={choice ? (correct ? 'Your answer' : 'Your answer and the real one are in the explanation') : current ? 'Your choice' : 'The starting note'} />
            <WavePlot
              tag={shown ? `${shown.name}, added together` : 'Your interval'}
              traces={shown ? [{ fn: sumFn(shown, q.root), color: 'var(--trace-a)', width: 2.5 }] : []}
              duration={6 / rootHz}
              yMax={1.7}
              height={120}
              label={shown ? `The wave for a ${shown.name.toLowerCase()}` : 'Pick an interval to see its wave'}
            />
            <div className="btn-row">
              <button className="btn primary" disabled={!current || !!choice} onClick={submit}>
                {current ? `Submit: ${shown!.name}` : slider ? 'Move the slider to submit' : 'Pick an interval to submit'}
              </button>
              <PlayButton disabled={!choice} onClick={() => playStack(answerStack, q.root)}>
                Hear the answer
              </PlayButton>
            </div>
          </div>
          <FeedbackSlot>
            {choice && (
              <Feedback ok={correct}>
                It was a <strong>{answerStack.name.toLowerCase()}</strong>: {answerStack.steps.map((s) => midiName(q.root + s)).join(' and ')}, {answerStack.steps[1]} piano steps apart. The notes vibrate in the
                ratio {answerStack.ratio.join(':')}, so the added wave has {answerStack.ratio[1]} wiggles of the higher note for every {answerStack.ratio[0]} of the lower.
                {!correct && ` You ${slider ? 'built' : 'picked'} a ${slider ? built.name.toLowerCase() : byId(choice).name.toLowerCase()} (${(slider ? built : byId(choice)).ratio.join(':')}).`}
              </Feedback>
            )}
          </FeedbackSlot>
          <NextButton index={r.index} onPrev={r.prev} answered={r.answered} isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />
        </Section>
      )}
    </div>
  );
}

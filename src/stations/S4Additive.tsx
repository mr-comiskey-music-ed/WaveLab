import { useMemo } from 'react';
import { audio } from '../lib/audio';
import { harmonicValue, midiToFreq, peakOf, pick, rand, randInt, shuffle, WAVE_NAMES } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { HarmonicBars } from '../components/HarmonicBars';
import { Drawbars } from '../components/Drawbars';
import { Choices, Feedback, FeedbackSlot, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import { useSaved } from '../lib/persist';
import { mcScore, skillScore } from '../lib/stations';
import type { StationProps } from './types';
import { HammondOrgan } from '../components/HammondOrgan';

const LEVELS = [0, 0.25, 0.5, 0.75, 1];
/** Match closeness (0–100) at or above this counts as a full-credit match. */
const FULL_MATCH = 80;
/** Peeking at the shape caps the grade for that round. */
const PEEK_CAP_QUALITY = 0.6;
const matchQuality = (raw: number) => (raw - 40) / (FULL_MATCH - 40);

/** 0–100: how close two harmonic recipes are, ignoring overall volume. */
export function matchScore(mine: number[], target: number[]) {
  const mMax = Math.max(...mine);
  if (mMax <= 0) return 0;
  const tMax = Math.max(...target);
  let num = 0;
  let den = 0;
  for (let i = 0; i < target.length; i++) {
    const a = (mine[i] ?? 0) / mMax;
    const b = target[i] / tMax;
    num += Math.min(a, b);
    den += Math.max(a, b);
  }
  return Math.round((num / den) * 100);
}

function randomTarget(count: number): number[] {
  for (;;) {
    const t = [1, ...Array.from({ length: count - 1 }, () => pick(LEVELS))];
    const nonzero = t.slice(1).filter((x) => x > 0).length;
    if (nonzero >= 2 && nonzero <= count - 1) return t;
  }
}

/** The start of a Part 3 waveform, rounded to fader steps. */
const CLASSIC = {
  square: [1, 0, 0.35, 0, 0.2],
  sawtooth: [1, 0.5, 0.35, 0.25, 0.2],
} as const;

type Wave2 = { hz: number; amp: number };
type Q =
  | { kind: 'point'; a: Wave2; b: Wave2; t: number; va: number; vb: number; options: number[] }
  | { kind: 'pick'; a: Wave2; b: Wave2; order: string[] }
  | { kind: 'match'; target: number[]; midi: number; classic?: keyof typeof CLASSIC };

const sine = (w: Wave2) => (t: number) => w.amp * Math.sin(2 * Math.PI * w.hz * t);
const r1 = (x: number) => Math.round(x * 10) / 10;

function makePoint(): Q {
  const a = { hz: 1, amp: 1 };
  const b = { hz: pick([2, 3, 4]), amp: pick([0.5, 0.6]) };
  // Find a moment where both values are clear and they point opposite ways (the tricky case).
  for (;;) {
    const t = rand(0.05, 0.95);
    const va = r1(sine(a)(t));
    const vb = r1(sine(b)(t));
    if (Math.abs(va) >= 0.3 && Math.abs(vb) >= 0.3 && Math.sign(va) !== Math.sign(vb)) {
      const right = r1(va + vb);
      const wrong = [r1(va - vb), r1(Math.abs(va) + Math.abs(vb)), r1(vb - va), va, r1(-(va + vb))].filter((x, i, arr) => x !== right && arr.indexOf(x) === i);
      return { kind: 'point', a, b, t, va, vb, options: shuffle([right, ...shuffle(wrong).slice(0, 3)]) };
    }
  }
}

function makePick(): Q {
  return { kind: 'pick', a: { hz: 1, amp: 1 }, b: { hz: pick([2, 3, 4, 5]), amp: pick([0.33, 0.5]) }, order: shuffle(['sum', 'diff', 'only']) };
}

function makeQuestions(): Q[] {
  const classic = pick(['square', 'sawtooth'] as const);
  return [
    makePoint(),
    makePick(),
    { kind: 'match', target: [...CLASSIC[classic]], midi: randInt(45, 52), classic },
    { kind: 'match', target: randomTarget(4), midi: randInt(45, 52) },
    { kind: 'match', target: randomTarget(6), midi: randInt(45, 52) },
  ];
}

const LABEL = (q: Q) => (q.kind === 'point' ? 'Add two points' : q.kind === 'pick' ? 'Pick the combined wave' : `Match ${q.target.length} harmonics by ear`);

export function S4Additive({ info, done, onComplete, onNext }: StationProps) {
  const [qs] = useSaved('add:qs', makeQuestions);
  const [mine, setMine] = useSaved<Record<number, number[]>>('add:mine', () =>
    Object.fromEntries(qs.map((q, i) => [i, q.kind === 'match' ? q.target.map((_, k) => (k === 0 ? 1 : 0)) : []]))
  );
  const [peeked, setPeeked] = useSaved<Record<number, boolean>>('add:peeked', {});
  const [raw, setRaw] = useSaved<Record<number, number>>('add:raw', {});
  const [picked, setPicked] = useSaved<Record<number, string>>('add:picked', {});
  const [summary, setSummary] = useSaved('add:summary', false);
  const r = useRounds('add', qs.length, done, onComplete);
  const q = qs[r.index];
  const bars = mine[r.index];
  const locked = r.answered;
  const choice = picked[r.index] ?? null;

  const mineFn = useMemo(() => {
    if (!bars?.length) return () => 0;
    const p = peakOf(bars);
    return (t: number) => (0.95 * harmonicValue(bars, t)) / p;
  }, [bars]);
  const targetFn = useMemo(() => {
    if (q.kind !== 'match') return () => 0;
    const p = peakOf(q.target);
    return (t: number) => (0.95 * harmonicValue(q.target, t)) / p;
  }, [q]);

  // ---- match helpers ----
  const playH = (h: number[], delay = 0) => q.kind === 'match' && audio.play({ freq: midiToFreq(q.midi), harmonics: h, level: 0.55, duration: 1.3, delay });
  const playTarget = () => {
    audio.stopAll();
    if (q.kind === 'match') playH(q.target);
  };
  const playMine = () => {
    audio.stopAll();
    if (Math.max(...bars) > 0) playH(bars);
  };
  const playBoth = () => {
    audio.stopAll();
    if (q.kind !== 'match') return;
    playH(q.target);
    if (Math.max(...bars) > 0) playH(bars, 1.6);
  };
  const lockIn = () => {
    if (q.kind !== 'match') return;
    const score = matchScore(bars, q.target);
    setRaw({ ...raw, [r.index]: score });
    const quality = matchQuality(score);
    r.answer(skillScore(peeked[r.index] ? Math.min(quality, PEEK_CAP_QUALITY) : quality));
  };

  // ---- choice helpers ----
  const choose = (id: string, correct: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(mcScore(id === correct));
  };

  const playPair = (a: Wave2, b: Wave2) => {
    audio.stopAll();
    audio.play({ freq: 110 * a.hz, harmonics: [1], level: a.amp * 0.6, normalize: 'none', duration: 1.4 });
    audio.play({ freq: 110 * b.hz, harmonics: [1], level: b.amp * 0.6, normalize: 'none', duration: 1.4 });
  };

  const score = r.current;
  return (
    <div className="station">
      <StationHeader info={info} />
      {summary ? (
        <StationDone scores={r.scores} labels={qs.map(LABEL)} kinds={qs.map((x) => (x.kind === 'match' ? 'skill' : 'mc'))} onNext={onNext} />
      ) : (
        <Section title="Check yourself" note="First, waveform addition. Then rebuild sounds from sine waves using your ears.">
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />

          {q.kind === 'point' && (
            <>
              <p className="question">
                At the marked moment, the blue wave is at {q.va} and the pink wave is at {q.vb}. Where will the combined wave be at that moment?
              </p>
              <WavePlot
                traces={[
                  { fn: sine(q.a), color: 'var(--trace-a)' },
                  { fn: sine(q.b), color: 'var(--trace-b)' },
                  ...(choice ? [{ fn: (t: number) => sine(q.a)(t) + sine(q.b)(t), color: 'var(--ink)', width: 2.5 }] : []),
                ]}
                duration={1}
                yMax={1.7}
                yLabels
                height={190}
                markers={[{ t: q.t, color: 'var(--ink)' }]}
                label="Two waves with one moment marked"
              />
              <Choices
                options={q.options.map((o) => ({ id: String(o), label: String(o) }))}
                correct={String(r1(q.va + q.vb))}
                picked={choice}
                onPick={(id) => choose(id, String(r1(q.va + q.vb)))}
                columns={4}
              />
              <FeedbackSlot>{choice && (
                <Feedback ok={choice === String(r1(q.va + q.vb))}>
                  Just add the two displacements: {q.va} + ({q.vb}) = {r1(q.va + q.vb)}. One wave pushes, the other pulls, like two people in a tug-of-war, so they partly cancel. The black line is the combined wave.
                </Feedback>
              )}</FeedbackSlot>
            </>
          )}

          {q.kind === 'pick' && (
            <>
              <p className="question">
                A {q.a.hz} Hz wave (blue) and a {q.b.hz} Hz wave at {q.b.amp} amplitude (pink) are added together. Which graph shows the combined wave?
              </p>
              <div className="plot-match">
              <WavePlot
                traces={[
                  { fn: sine(q.a), color: 'var(--trace-a)' },
                  { fn: sine(q.b), color: 'var(--trace-b)' },
                ]}
                duration={1}
                yMax={1.6}
                height={120}
                label="The two waves to add"
              />
              </div>
              <div className="choice-plots">
                {q.order.map((kind, i) => {
                  const fn =
                    kind === 'sum'
                      ? (t: number) => sine(q.a)(t) + sine(q.b)(t)
                      : kind === 'diff'
                      ? (t: number) => sine(q.a)(t) - sine(q.b)(t)
                      : (t: number) => (1 + q.b.amp) * sine(q.a)(t);
                  const id = String.fromCharCode(65 + i);
                  const isRight = kind === 'sum';
                  const cls = !choice ? '' : isRight ? 'right' : choice === kind ? 'wrong' : 'dim';
                  return (
                    <button key={kind} className={`choice plot-choice ${cls}`} disabled={!!choice} onClick={() => choose(kind, 'sum')} aria-label={`Graph ${id}`}>
                      <WavePlot tag={id} traces={[{ fn, color: 'var(--ink)', width: 2.2 }]} duration={1} yMax={1.6} height={120} label={`Option ${id}`} />
                    </button>
                  );
                })}
              </div>
              <FeedbackSlot>{choice && (
                <Feedback ok={choice === 'sum'}>
                  The combined wave follows the slow blue wave but carries the faster pink wiggle on top. One wrong graph subtracts the pink wave instead of adding it; the other just makes the blue wave taller.
                </Feedback>
              )}</FeedbackSlot>
              <div className="btn-row">
                <PlayButton disabled={!choice} onClick={() => playPair(q.a, q.b)}>
                  Hear them together (sped up)
                </PlayButton>
              </div>
            </>
          )}

          {q.kind === 'match' && (
            <>
              <p className="question">
                {q.classic
                  ? 'This mystery sound is the start of one of the waveforms from Part 3, built from its first five harmonics (like the Waveforms site’s 1 Hz + 3 Hz example). Rebuild it with the faders.'
                  : 'A new mystery sound, built from sine waves at harmonics 1, 2, 3... Rebuild it with the faders.'}
              </p>
              <p className="hint">Compare by ear as many times as you like, then lock it in.</p>
              <div className="btn-row">
                <PlayButton kind="primary" onClick={playTarget}>
                  Mystery sound
                </PlayButton>
                <PlayButton onClick={playMine}>My sound</PlayButton>
                <PlayButton onClick={playBoth}>Mystery, then mine</PlayButton>
              </div>
              <Drawbars values={bars} disabled={locked} onChange={(v) => setMine({ ...mine, [r.index]: v })} />
              <WavePlot
                traces={[
                  ...(peeked[r.index] || locked ? [{ fn: (t: number) => targetFn(t * 2), color: 'var(--trace-b)', dashed: true, width: 2 }] : []),
                  { fn: (t: number) => mineFn(t * 2), color: 'var(--trace-a)' },
                ]}
                duration={1}
                height={130}
                label="Your wave shape"
              />
              <p className="legend">
                <span className="key a" /> Your wave
                {(peeked[r.index] || locked) && (
                  <>
                    <span className="key b dashed" /> Mystery wave
                  </>
                )}
              </p>
              {!locked && (
                <div className="btn-row">
                  <button className="btn primary" onClick={lockIn}>
                    Lock in my match
                  </button>
                  {!peeked[r.index] && (
                    <button className="btn quiet" onClick={() => setPeeked({ ...peeked, [r.index]: true })}>
                      Peek at the mystery shape (you'll get less credit this round)
                    </button>
                  )}
                </div>
              )}
              {locked && score !== null && (
                <>
                  <Feedback ok={raw[r.index] >= FULL_MATCH ? true : raw[r.index] >= 60 ? 'partial' : false}>
                    You matched it {raw[r.index]}%{raw[r.index] >= FULL_MATCH ? ', which counts as a full match' : ''}.{' '}
                    {q.classic
                      ? `It was the start of a ${WAVE_NAMES[q.classic].toLowerCase()} wave: ${q.classic === 'square' ? 'odd harmonics only, each one quieter (1, 1/3, 1/5).' : 'every harmonic, each one quieter (1, 1/2, 1/3, 1/4, 1/5).'} Add more harmonics and it gets closer and closer to the real thing.`
                      : 'Here’s the real recipe. Play both again and listen for the difference.'}
                  </Feedback>
                  <div className="split">
                    <figure className="compare">
                      <figcaption>Mystery recipe</figcaption>
                      <HarmonicBars amps={q.target} count={q.target.length} color="var(--trace-b)" label="The mystery sound's harmonics" />
                    </figure>
                    <figure className="compare">
                      <figcaption>Your recipe</figcaption>
                      <HarmonicBars amps={bars} count={bars.length} label="Your harmonics" />
                    </figure>
                  </div>
                </>
              )}
            </>
          )}

          <NextButton index={r.index} onPrev={r.prev} answered={r.answered} isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />
        </Section>
      )}

      <Section
        title="Playground: the drawbar organ"
        note={
          <>
            Fun fact: a Hammond organ (the sound of the Black church and gospel music, and all over blues, R&B, soul, jazz and rock) is additive synthesis you can play. Each drawbar adds one sine-wave harmonic, just like the faders above. Pull a bar down to make it louder. The names (16′,
            8′, 4′...) come from pipe-organ pipe lengths: 8′ is the note you play, 4′ is an octave up, 16′ an octave down. The Leslie is the spinning speaker that gives the organ its swirl.
            Nothing here is graded, so play!
          </>
        }
      >
        <HammondOrgan />
      </Section>

      <section className="panel next-idea">
        <h3>Where this goes next</h3>
        <p>
          Additive synthesis builds a sound up from sine waves. Most synths work the other way around: start with a harmonic-rich wave like a saw or square, then use a filter to take harmonics
          away. That’s called <strong>subtractive synthesis</strong>.
        </p>
        <a className="btn secondary" href="https://synthlab.mrcomiskey.com" target="_blank" rel="noopener">
          Try subtractive synthesis in SynthLab
        </a>
      </section>
    </div>
  );
}

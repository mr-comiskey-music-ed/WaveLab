import { useMemo, useState } from 'react';
import { audio } from '../lib/audio';
import { harmonicValue, midiToFreq, peakOf, pick, randInt } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { HarmonicBars } from '../components/HarmonicBars';
import { Drawbars } from '../components/Drawbars';
import { Feedback, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

const LEVELS = [0, 0.25, 0.5, 0.75, 1];

function makeTarget(count: number): number[] {
  for (;;) {
    const t = [1, ...Array.from({ length: count - 1 }, () => pick(LEVELS))];
    const nonzero = t.slice(1).filter((x) => x > 0).length;
    if (nonzero >= Math.min(2, count - 1) && nonzero <= count - 1) return t;
  }
}

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

const PEEK_CAP = 80;

type Round = { target: number[]; midi: number };

export function S4Additive({ info, done, onComplete, onNext }: StationProps) {
  const [rounds] = useState<Round[]>(() => [3, 4, 6].map((n) => ({ target: makeTarget(n), midi: randInt(45, 52) })));
  const [mine, setMine] = useState<number[][]>(() => rounds.map((rd) => rd.target.map((_, i) => (i === 0 ? 1 : 0))));
  const [peeked, setPeeked] = useState<boolean[]>([false, false, false]);
  const [raw, setRaw] = useState<Record<number, number>>({});
  const [summary, setSummary] = useState(false);
  const r = useRounds(rounds.length, done, onComplete);
  const rd = rounds[r.index];
  const bars = mine[r.index];
  const locked = r.answered;

  const mineFn = useMemo(() => {
    const p = peakOf(bars);
    return (t: number) => (0.95 * harmonicValue(bars, t)) / p;
  }, [bars]);
  const targetFn = useMemo(() => {
    const p = peakOf(rd.target);
    return (t: number) => (0.95 * harmonicValue(rd.target, t)) / p;
  }, [rd]);

  const play = (h: number[], delay = 0) => audio.play({ freq: midiToFreq(rd.midi), harmonics: h, level: 0.55, duration: 1.3, delay });
  const playTarget = () => {
    audio.stopAll();
    play(rd.target);
  };
  const playMine = () => {
    audio.stopAll();
    if (Math.max(...bars) > 0) play(bars);
  };
  const playBoth = () => {
    audio.stopAll();
    play(rd.target);
    if (Math.max(...bars) > 0) play(bars, 1.6);
  };

  const lockIn = () => {
    const score = matchScore(bars, rd.target);
    setRaw({ ...raw, [r.index]: score });
    r.answer(peeked[r.index] ? Math.min(score, PEEK_CAP) : score);
  };

  const score = r.current;
  return (
    <div className="station">
      <StationHeader {...info} />
      {summary ? (
        <StationDone scores={r.scores} labels={rounds.map((x) => `Match ${x.target.length} harmonics`)} onNext={onNext} />
      ) : (
        <Section
          title="Match it by ear"
          note="A mystery sound is built from sine waves at harmonics 1, 2, 3... Rebuild it with the faders. Compare by ear as many times as you like, then lock it in."
        >
          <RoundBar index={r.index} total={rounds.length} scores={r.scores} />
          <div className="btn-row">
            <PlayButton kind="primary" onClick={playTarget}>
              Mystery sound
            </PlayButton>
            <PlayButton onClick={playMine}>My sound</PlayButton>
            <PlayButton onClick={playBoth}>Mystery, then mine</PlayButton>
          </div>
          <Drawbars
            values={bars}
            disabled={locked}
            onChange={(v) => setMine(mine.map((m, i) => (i === r.index ? v : m)))}
            colorFor={() => 'var(--trace-a)'}
          />
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
                <button className="btn quiet" onClick={() => setPeeked(peeked.map((p, i) => (i === r.index ? true : p)))}>
                  Peek at the mystery shape (max {PEEK_CAP}% this round)
                </button>
              )}
            </div>
          )}
          {locked && score !== null && (
            <>
              <Feedback ok={score >= 85 ? true : score >= 60 ? 'partial' : false}>
                Your match: {raw[r.index]}%{peeked[r.index] && raw[r.index] > PEEK_CAP ? ` (capped at ${PEEK_CAP}% for peeking)` : ''}. Here's the real recipe. Play both again and listen for the
                difference.
              </Feedback>
              <div className="split">
                <figure className="compare">
                  <figcaption>Mystery recipe</figcaption>
                  <HarmonicBars amps={rd.target} count={rd.target.length} color="var(--trace-b)" label="The mystery sound's harmonics" />
                </figure>
                <figure className="compare">
                  <figcaption>Your recipe</figcaption>
                  <HarmonicBars amps={bars} count={bars.length} label="Your harmonics" />
                </figure>
              </div>
            </>
          )}
          {r.answered && <NextButton isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />}
        </Section>
      )}
    </div>
  );
}

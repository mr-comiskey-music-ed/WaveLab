import { useMemo } from 'react';
import { audio } from '../lib/audio';
import { pick, rand, randInt, shuffle } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Choices, Feedback, FeedbackSlot, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import { useSaved } from '../lib/persist';
import { mcScore } from '../lib/stations';
import type { StationProps } from './types';

/*
 * Mirrors Part 1 of The Pudding: graphs show 1 second, amplitude runs from 0 to 1,
 * and the sound you hear is about 100 times faster than the wave on screen.
 */

type Tone = { amp: number; hz: number };
type Q =
  | { kind: 'amp'; tone: Tone; options: number[] }
  | { kind: 'louder' | 'higher'; a: Tone; b: Tone; answer: 'a' | 'b' }
  | { kind: 'hz'; tone: Tone; options: number[] }
  | { kind: 'hz1ms'; cycles: number; amp: number; options: number[] }
  | { kind: 'pitch'; amp: number; hz: number; answer: 'a' | 'b'; seed: number };

const SPEED_UP = 100; // what you hear is ~100× faster than the graph (like The Pudding)

function makeAmp(): Q {
  const amp = pick([0.25, 0.5, 0.75, 1]);
  return { kind: 'amp', tone: { amp, hz: randInt(1, 3) }, options: [0.25, 0.5, 0.75, 1] };
}

function makeCompare(kind: 'louder' | 'higher'): Q {
  const loud = pick([0.9, 1]);
  const quiet = pick([0.35, 0.5]);
  const low = randInt(1, 2);
  const high = low + randInt(2, 4);
  // Half the time the other property points the opposite way, so students must read the right one.
  const trick = Math.random() < 0.6;
  let win: Tone, lose: Tone;
  if (kind === 'louder') {
    win = { amp: loud, hz: trick ? low : high };
    lose = { amp: quiet, hz: trick ? high : low };
  } else {
    win = { amp: trick ? quiet : loud, hz: high };
    lose = { amp: trick ? loud : quiet, hz: low };
  }
  const answer = pick(['a', 'b'] as const);
  return answer === 'a' ? { kind, a: win, b: lose, answer } : { kind, a: lose, b: win, answer };
}

function makeHz(): Q {
  const hz = randInt(2, 6);
  const wrong = shuffle([hz - 1, hz + 1, hz * 2, hz + 2].filter((x) => x > 0 && x !== hz)).slice(0, 3);
  return { kind: 'hz', tone: { amp: rand(0.6, 1), hz }, options: shuffle([hz, ...wrong]) };
}

function makeHz1ms(): Q {
  const cycles = randInt(1, 4);
  const right = cycles * 1000;
  const wrong = shuffle([cycles, cycles * 100, (cycles + 1) * 1000, cycles * 10]).slice(0, 3);
  return { kind: 'hz1ms', cycles, amp: rand(0.6, 1), options: shuffle([right, ...wrong]) };
}

function makePitch(): Q {
  return { kind: 'pitch', amp: 0.8, hz: randInt(2, 4), answer: pick(['a', 'b'] as const), seed: randInt(1, 9999) };
}

function makeQuestions(): Q[] {
  return [makeAmp(), makeCompare('louder'), makeHz(), makeCompare('higher'), makePitch(), makeHz1ms()];
}

const sine = (t: Tone) => (x: number) => t.amp * Math.sin(2 * Math.PI * t.hz * x);

/** Smooth-ish random wiggle that never repeats: what white noise looks like. */
function noiseFn(seed: number) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const pts = Array.from({ length: 160 }, r);
  return (x: number) => {
    const f = Math.max(0, Math.min(0.9999, x)) * (pts.length - 1);
    const i = Math.floor(f);
    const k = f - i;
    return 0.8 * (pts[i] * (1 - k) + pts[i + 1] * k);
  };
}

const playTone = (t: Tone, delay = 0, duration = 0.9) =>
  audio.play({ freq: t.hz * SPEED_UP, harmonics: [1], level: t.amp, normalize: 'none', duration, delay });

const LABEL: Record<Q['kind'], string> = {
  amp: 'Read the amplitude',
  louder: 'Which is louder',
  hz: 'Find the frequency',
  higher: 'Which is higher',
  pitch: 'Periodic or not',
  hz1ms: 'Frequency of a real sound',
};

export function S1Reading({ info, done, onComplete, onNext }: StationProps) {
  const [qs] = useSaved('read:qs', makeQuestions);
  const [picked, setPicked] = useSaved<Record<number, string>>('read:picked', {});
  const [summary, setSummary] = useSaved('read:summary', false);
  const r = useRounds('read', qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;
  const noise = useMemo(() => (q.kind === 'pitch' ? noiseFn(q.seed) : null), [q]);

  const playPair = (a: Tone, b: Tone) => {
    audio.stopAll();
    playTone(a);
    playTone(b, 1.1);
  };

  const hear = () => {
    audio.stopAll();
    if (q.kind === 'amp' || q.kind === 'hz') playTone(q.tone, 0, 1.2);
    else if (q.kind === 'louder' || q.kind === 'higher') playPair(q.a, q.b);
    else if (q.kind === 'hz1ms') audio.play({ freq: q.cycles * 1000, harmonics: [1], level: q.amp, normalize: 'none', duration: 1.2 });
    else if (q.kind === 'pitch') {
      const tone = { amp: 0.8, hz: q.hz };
      if (q.answer === 'a') {
        playTone(tone);
        audio.playNoise(0.6, 0.9, 1.1);
      } else {
        audio.playNoise(0.6, 0.9);
        playTone(tone, 1.1);
      }
    }
  };

  const correct =
    q.kind === 'amp' || q.kind === 'hz'
      ? String(q.kind === 'amp' ? q.tone.amp : q.tone.hz)
      : q.kind === 'hz1ms'
      ? String(q.cycles * 1000)
      : q.answer;

  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(mcScore(id === correct));
    hear();
  };

  const ok = choice === correct;
  const AB = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];

  return (
    <div className="station">
      <StationHeader info={info} />
      {summary ? (
        <StationDone scores={r.scores} labels={qs.map((x) => LABEL[x.kind])} kinds={qs.map(() => 'mc' as const)} onNext={onNext} />
      ) : (
        <Section
          title="Predict, then hear"
          note="Like the Waveforms site, these graphs show 1 second and amplitude runs from 0 to 1. Decide before you listen: one try per round, and the sound plays after you answer (sped up about 100 times so you can hear it)."
        >
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />

          {q.kind === 'amp' && (
            <>
              <p className="question">What is the amplitude of this wave?</p>
              <WavePlot traces={[{ fn: sine(q.tone), color: 'var(--trace-a)' }]} duration={1} yMax={1.1} yLabels timeAxis height={230} label="A sine wave with displacement labels" />
              <Choices options={q.options.map((o) => ({ id: String(o), label: String(o) }))} correct={correct} picked={choice} onPick={choose} columns={4} />
              <FeedbackSlot>{choice && (
                <Feedback ok={ok}>
                  Amplitude is how far the wave moves away from 0, its resting position. This wave peaks at {q.tone.amp} and dips to −{q.tone.amp}, so its amplitude is {q.tone.amp}.
                </Feedback>
              )}</FeedbackSlot>
            </>
          )}

          {(q.kind === 'louder' || q.kind === 'higher') && (
            <>
              <p className="question">{q.kind === 'louder' ? 'Which one will sound louder?' : 'Which one will sound higher in pitch?'}</p>
              <div className="pair">
                <WavePlot tag="A" traces={[{ fn: sine(q.a), color: 'var(--trace-a)' }]} duration={1} yMax={1.1} height={120} label="Wave A" />
                <WavePlot tag="B" traces={[{ fn: sine(q.b), color: 'var(--trace-b)' }]} duration={1} yMax={1.1} height={120} label="Wave B" />
              </div>
              <Choices options={AB} correct={q.answer} picked={choice} onPick={choose} />
              <FeedbackSlot>{choice && (
                <Feedback ok={ok}>
                  {q.kind === 'louder'
                    ? `Loudness comes from amplitude: how far the air molecules are displaced. ${q.answer.toUpperCase()} is taller. How many times the wave repeats has nothing to do with loudness.`
                    : `Pitch comes from frequency: how many times the wave repeats in the same amount of time. ${q.answer.toUpperCase()} repeats more often. How tall the wave is has nothing to do with pitch.`}
                </Feedback>
              )}</FeedbackSlot>
            </>
          )}

          {q.kind === 'hz' && (
            <>
              <p className="question">This graph shows 1 second. What is the frequency of this wave?</p>
              <WavePlot traces={[{ fn: sine(q.tone), color: 'var(--trace-a)' }]} duration={1} yMax={1.1} timeAxis height={150} label="A sine wave over 1 second" />
              <Choices options={q.options.map((o) => ({ id: String(o), label: `${o} Hz` }))} correct={correct} picked={choice} onPick={choose} columns={4} />
              <FeedbackSlot>{choice && (
                <Feedback ok={ok}>
                  Hertz means repetitions per second. The wave repeats {q.tone.hz} times in this 1-second graph, so it's {q.tone.hz} Hz. That's far too slow to hear; you just heard it about {SPEED_UP} times faster.
                </Feedback>
              )}</FeedbackSlot>
            </>
          )}

          {q.kind === 'pitch' && noise && (
            <>
              <p className="question">One of these is periodic and one is noise. Which one will have a pitch you could sing?</p>
              <div className="pair">
                <WavePlot tag="A" traces={[{ fn: q.answer === 'a' ? sine({ amp: q.amp, hz: q.hz }) : noise, color: 'var(--trace-a)' }]} duration={1} yMax={1.1} height={110} label="Wave A" />
                <WavePlot tag="B" traces={[{ fn: q.answer === 'b' ? sine({ amp: q.amp, hz: q.hz }) : noise, color: 'var(--trace-b)' }]} duration={1} yMax={1.1} height={110} label="Wave B" />
              </div>
              <Choices options={AB} correct={q.answer} picked={choice} onPick={choose} />
              <FeedbackSlot>{choice && (
                <Feedback ok={ok}>
                  {q.answer.toUpperCase()} is periodic: the same shape repeats over and over, so you hear a steady pitch. The other one never repeats. That's white noise, like static or waves crashing on a beach, and it has no pitch.
                </Feedback>
              )}</FeedbackSlot>
            </>
          )}

          {q.kind === 'hz1ms' && (
            <>
              <p className="question">Now a real, audible sound. This graph shows only 1 millisecond (1/1000 of a second). What is the frequency?</p>
              <WavePlot traces={[{ fn: (x) => q.amp * Math.sin(2 * Math.PI * q.cycles * 1000 * x), color: 'var(--trace-a)' }]} duration={0.001} yMax={1.1} timeAxis height={150} label="A sine wave over 1 millisecond" />
              <p className="hint">Count the repeats. A whole second is 1,000 times longer than this graph.</p>
              <Choices options={q.options.map((o) => ({ id: String(o), label: `${o.toLocaleString()} Hz` }))} correct={correct} picked={choice} onPick={choose} columns={4} />
              <FeedbackSlot>{choice && (
                <Feedback ok={ok}>
                  It repeats {q.cycles} {q.cycles === 1 ? 'time' : 'times'} in 1 millisecond. A second is 1,000 times longer, so that's {q.cycles} × 1,000 = {(q.cycles * 1000).toLocaleString()} Hz. For comparison, the A in the middle of a piano (A4) is 440 Hz.
                </Feedback>
              )}</FeedbackSlot>
            </>
          )}

          <div className="btn-row">
            <PlayButton disabled={!choice} onClick={hear}>
              {q.kind === 'louder' || q.kind === 'higher' || q.kind === 'pitch' ? 'Hear A, then B again' : 'Hear it again'}
            </PlayButton>
          </div>
          <NextButton answered={r.answered} isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />
        </Section>
      )}
    </div>
  );
}

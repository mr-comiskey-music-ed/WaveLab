import { useState } from 'react';
import { audio } from '../lib/audio';
import { pick, rand, randInt, shuffle } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Choices, Feedback, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

type Q =
  | { kind: 'louder' | 'higher'; a: { amp: number; freq: number }; b: { amp: number; freq: number }; answer: 'a' | 'b' }
  | { kind: 'cycles'; cycles: number; amp: number; options: number[] };

const WINDOW = 0.01; // 10 ms

function makeCompare(kind: 'louder' | 'higher'): Q {
  const loud = rand(0.8, 1), quiet = rand(0.3, 0.5);
  const low = randInt(2, 3) * 100 + randInt(0, 4) * 10;
  const high = Math.round(low * rand(1.6, 2.2));
  const answer = pick(['a', 'b'] as const);
  // Distractor: the other property points the opposite way half the time.
  const trick = Math.random() < 0.6;
  let win, lose;
  if (kind === 'louder') {
    win = { amp: loud, freq: trick ? low : high };
    lose = { amp: quiet, freq: trick ? high : low };
  } else {
    win = { amp: trick ? quiet + 0.1 : loud, freq: high };
    lose = { amp: trick ? loud : quiet + 0.1, freq: low };
  }
  return answer === 'a' ? { kind, a: win, b: lose, answer } : { kind, a: lose, b: win, answer };
}

function makeCycles(): Q {
  const cycles = randInt(2, 8);
  const right = cycles * 100;
  const wrong = shuffle([cycles * 10, (cycles + 1) * 100, (cycles - 1) * 100, cycles * 1000].filter((x) => x > 0 && x !== right)).slice(0, 3);
  return { kind: 'cycles', cycles, amp: rand(0.6, 1), options: shuffle([right, ...wrong]) };
}

function makeQuestions(): Q[] {
  return [makeCompare('louder'), makeCompare('higher'), makeCycles(), makeCompare(pick(['louder', 'higher'] as const)), makeCompare('higher'), makeCycles()];
}

const sine = (amp: number, freq: number) => (t: number) => amp * Math.sin(2 * Math.PI * freq * t);

export function S1Reading({ info, done, onComplete, onNext }: StationProps) {
  const [qs] = useState(makeQuestions);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState(false);
  const r = useRounds(qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;

  const playPair = (a: { amp: number; freq: number }, b: { amp: number; freq: number }) => {
    audio.stopAll();
    audio.play({ freq: a.freq, harmonics: [1], level: a.amp, normalize: 'none', duration: 0.8 });
    audio.play({ freq: b.freq, harmonics: [1], level: b.amp, normalize: 'none', duration: 0.8, delay: 1 });
  };

  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    const right = q.kind === 'cycles' ? String(q.cycles * 100) : q.answer;
    r.answer(id === right ? 100 : 0);
    if (q.kind !== 'cycles') playPair(q.a, q.b);
    else audio.play({ freq: q.cycles * 100, harmonics: [1], level: q.amp, normalize: 'none', duration: 1 });
  };

  const showSummary = summary;

  return (
    <div className="station">
      <StationHeader {...info} />
      {showSummary ? (
        <StationDone scores={r.scores} labels={qs.map((x) => (x.kind === 'louder' ? 'Which is louder' : x.kind === 'higher' ? 'Which is higher' : 'Count the cycles'))} onNext={onNext} />
      ) : (
        <Section
          title="Predict, then hear"
          note="Look at the graphs and decide before you listen. You get one try per round; the sound plays after you answer."
        >
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          {q.kind === 'cycles' ? (
            <>
              <p className="question">This graph shows 10 milliseconds of sound. What is its frequency?</p>
              <WavePlot traces={[{ fn: sine(q.amp, q.cycles * 100), color: 'var(--trace-a)' }]} duration={WINDOW} timeAxis label="A sine wave over 10 milliseconds" />
              <p className="hint">Count the full cycles (peak to peak), then ask how many would fit in one whole second.</p>
              <Choices options={q.options.map((o) => ({ id: String(o), label: `${o.toLocaleString()} Hz` }))} correct={String(q.cycles * 100)} picked={choice} onPick={choose} />
              {choice && (
                <Feedback ok={choice === String(q.cycles * 100)}>
                  There are {q.cycles} cycles in 10 ms. A second is 100 times longer, so that's {q.cycles} × 100 = {q.cycles * 100} cycles per second, or {q.cycles * 100} Hz.
                </Feedback>
              )}
            </>
          ) : (
            <>
              <p className="question">{q.kind === 'louder' ? 'Which one will sound louder?' : 'Which one will sound higher in pitch?'}</p>
              <div className="pair">
                <WavePlot tag="A" traces={[{ fn: sine(q.a.amp, q.a.freq), color: 'var(--trace-a)' }]} duration={WINDOW} height={120} label="Wave A" />
                <WavePlot tag="B" traces={[{ fn: sine(q.b.amp, q.b.freq), color: 'var(--trace-b)' }]} duration={WINDOW} height={120} label="Wave B" />
              </div>
              <Choices options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} correct={q.answer} picked={choice} onPick={choose} />
              {choice && (
                <>
                  <Feedback ok={choice === q.answer}>
                    {q.kind === 'louder'
                      ? `Loudness comes from amplitude: how tall the wave is. ${q.answer.toUpperCase()} is taller, so it pushes the air harder. How squished the wave is doesn't matter for loudness.`
                      : `Pitch comes from frequency: how many cycles fit in the same time. ${q.answer.toUpperCase()} has more cycles packed in, so it's higher. How tall the wave is doesn't matter for pitch.`}
                  </Feedback>
                  <PlayButton onClick={() => playPair(q.a, q.b)}>Hear A, then B again</PlayButton>
                </>
              )}
            </>
          )}
          {r.answered && <NextButton isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />}
        </Section>
      )}
    </div>
  );
}

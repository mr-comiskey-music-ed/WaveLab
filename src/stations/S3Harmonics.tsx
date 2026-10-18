import { useMemo, useState } from 'react';
import { audio } from '../lib/audio';
import { harmonicValue, midiToFreq, peakOf, pick, randInt, recipe, shuffle, WaveType, WAVE_NAMES, WAVE_TYPES } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { HarmonicBars } from '../components/HarmonicBars';
import { Choices, Feedback, FeedbackSlot, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import { useSaved } from '../lib/persist';
import { mcScore } from '../lib/stations';
import type { StationProps } from './types';

/** Short descriptions in The Pudding's own terms. */
const ABOUT: Record<WaveType, string> = {
  sine: 'the fundamental waveform. No harmonics at all: a 440 Hz sine plays 440 Hz and nothing else. Pure and a little muffled.',
  triangle: 'odd harmonics only (1st, 3rd, 5th, 7th...), and they taper off quickly. A little brighter than a sine.',
  square: 'the same odd harmonics as the triangle, but they don’t fall off as much, so it sounds much brighter than a triangle.',
  sawtooth: 'every harmonic (1st, 2nd, 3rd, 4th...). Bright and buzzy, a bit like a bowed violin string.',
};

const shape = (type: WaveType) => {
  const amps = recipe(type, 32);
  const p = peakOf(amps);
  return (t: number) => (0.95 * harmonicValue(amps, t)) / p;
};

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

type Q =
  | { kind: 'ear'; wave: WaveType; midi: number }
  | { kind: 'bars'; wave: WaveType }
  | { kind: 'math'; root: number; n: number; options: number[] }
  | { kind: 'which'; wave: Exclude<WaveType, 'sine'> };

const WHICH_OPTIONS = [
  { id: 'all', label: 'Every harmonic: 1st, 2nd, 3rd, 4th...' },
  { id: 'odd', label: 'Odd harmonics only: 1st, 3rd, 5th, 7th...' },
  { id: 'even', label: 'Even harmonics only: 2nd, 4th, 6th...' },
  { id: 'none', label: 'No harmonics, just the root' },
];
const whichAnswer = (w: WaveType) => (w === 'sawtooth' ? 'all' : w === 'sine' ? 'none' : 'odd');

function makeMath(): Q {
  const root = pick([50, 100, 110, 200, 220]);
  const n = randInt(2, 4); // 4th harmonic at most
  const right = root * n;
  const wrong = shuffle([root + n, root * (n + 1), right / 2, root * n * 2, root + 100 * n].filter((x) => x !== right && x > 0)).slice(0, 3);
  return { kind: 'math', root, n, options: shuffle([right, ...wrong]) };
}

function makeQuestions(): Q[] {
  const earWaves = shuffle([...WAVE_TYPES]);
  const ear: Q[] = earWaves.map((wave) => ({ kind: 'ear', wave, midi: randInt(43, 62) }));
  const bars = shuffle(['triangle', 'square', 'sawtooth'] as WaveType[]).slice(0, 2).map((wave): Q => ({ kind: 'bars', wave }));
  return [ear[0], ear[1], bars[0], makeMath(), ear[2], bars[1], ear[3], { kind: 'which', wave: pick(['triangle', 'square', 'sawtooth'] as const) }];
}

const OPTIONS = WAVE_TYPES.map((w) => ({ id: w, label: WAVE_NAMES[w] }));

const LABEL: Record<Q['kind'], string> = {
  ear: 'Name it by ear',
  bars: 'Name it from the harmonics',
  math: 'Harmonic frequency',
  which: 'Which harmonics',
};

export function S3Harmonics({ info, done, onComplete, onNext }: StationProps) {
  const [refWave, setRefWave] = useState<WaveType>('sine');
  const [qs] = useSaved('harm:qs', makeQuestions);
  const [picked, setPicked] = useSaved<Record<number, string>>('harm:picked', {});
  const [summary, setSummary] = useSaved('harm:summary', false);
  const r = useRounds('harm', qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;
  const refFn = useMemo(() => shape(refWave), [refWave]);
  const qWave: WaveType | null = q.kind === 'ear' || q.kind === 'bars' || q.kind === 'which' ? q.wave : null;
  const qFn = useMemo(() => (qWave ? shape(qWave) : null), [qWave]);

  const play = (wave: WaveType, midi: number) => {
    audio.stopAll();
    audio.play({ freq: midiToFreq(midi), harmonics: recipe(wave, 40), level: 0.55, duration: 1.4 });
  };

  const correct = q.kind === 'math' ? String(q.root * q.n) : q.kind === 'which' ? whichAnswer(q.wave) : q.wave;
  const ok = choice === correct;
  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(mcScore(id === correct));
  };

  return (
    <div className="station">
      <StationHeader info={info} />
      <Section title="Listen to the four waveforms" note="Same note, four shapes. The bar chart shows each one's harmonics, like the charts on the Waveforms site (with a 1 Hz root). Listen a few times: you won't see the shapes in the ear rounds.">
        <div className="seg" role="group" aria-label="Waveform">
          {WAVE_TYPES.map((w) => (
            <button
              key={w}
              className={w === refWave ? 'on' : ''}
              aria-pressed={w === refWave}
              onClick={() => {
                setRefWave(w);
                play(w, 48);
              }}
            >
              {WAVE_NAMES[w]}
            </button>
          ))}
        </div>
        <WavePlot traces={[{ fn: (t) => refFn(t * 2), color: 'var(--trace-a)' }]} duration={1} height={120} label={`${WAVE_NAMES[refWave]} wave shape`} />
        <HarmonicBars amps={recipe(refWave, 12)} rootHz={1} label={`Harmonics of a ${refWave} wave`} />
        <p className="about">
          <strong>{WAVE_NAMES[refWave]}:</strong> {ABOUT[refWave]}
        </p>
        <PlayButton onClick={() => play(refWave, 48)}>Play {WAVE_NAMES[refWave].toLowerCase()}</PlayButton>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={qs.map((x) => LABEL[x.kind])} kinds={qs.map(() => 'mc' as const)} onNext={onNext} />
      ) : (
        <Section title="Check yourself" note="One try per round. Ear rounds use a different note each time, so listen for the tone color, not the pitch.">
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />

          {q.kind === 'ear' && (
            <>
              <p className="question">Listen. Which waveform is this?</p>
              <PlayButton kind="primary" onClick={() => play(q.wave, q.midi)}>
                Play the mystery sound
              </PlayButton>
            </>
          )}
          {q.kind === 'bars' && (
            <>
              <p className="question">These are the harmonics of a mystery waveform. Which one is it?</p>
              <HarmonicBars amps={recipe(q.wave, 12)} rootHz={1} color="var(--trace-b)" label="Harmonics of the mystery waveform" />
            </>
          )}
          {(q.kind === 'ear' || q.kind === 'bars') && <Choices options={OPTIONS} correct={q.wave} picked={choice} onPick={choose} columns={4} />}

          {q.kind === 'math' && (
            <>
              <p className="question">
                A note's root frequency is {q.root} Hz. What is the frequency of its {ORDINAL[q.n]} harmonic?
              </p>
              <Choices options={q.options.map((o) => ({ id: String(o), label: `${o.toLocaleString()} Hz` }))} correct={correct} picked={choice} onPick={choose} columns={4} />
            </>
          )}
          {q.kind === 'which' && (
            <>
              <p className="question">Which harmonics does a {WAVE_NAMES[q.wave].toLowerCase()} wave have?</p>
              <Choices options={WHICH_OPTIONS} correct={correct} picked={choice} onPick={choose} columns={1} />
            </>
          )}

          <FeedbackSlot>
            {choice && q.kind === 'math' && (
              <Feedback ok={ok}>
                Harmonics are always multiples of the root frequency. The {ORDINAL[q.n]} harmonic is {q.n} × {q.root} Hz = {(q.n * q.root).toLocaleString()} Hz.
              </Feedback>
            )}
            {choice && qWave && (
              <Feedback ok={ok}>
                {q.kind === 'which' ? 'A' : 'It was a'} <strong>{WAVE_NAMES[qWave].toLowerCase()}</strong>
                {q.kind === 'which' ? ' has ' : ': '}
                {ABOUT[qWave]}
              </Feedback>
            )}
          </FeedbackSlot>
          {q.kind !== 'math' && (
            <div className="split reveal">
              <WavePlot
                traces={choice && qFn ? [{ fn: (t: number) => qFn(t * 2), color: 'var(--trace-b)' }] : []}
                duration={1}
                height={110}
                label={choice ? "The waveform's shape" : 'Shape hidden until you answer'}
              />
              <HarmonicBars amps={choice && qWave ? recipe(qWave, 10) : []} count={10} rootHz={1} color="var(--trace-b)" label="The waveform's harmonics" />
            </div>
          )}
          {q.kind !== 'math' && qWave && (
            <div className="btn-row">
              <PlayButton disabled={!choice} onClick={() => play(qWave, q.kind === 'ear' ? q.midi : 48)}>
                Hear it again
              </PlayButton>
            </div>
          )}
          <NextButton index={r.index} onPrev={r.prev} answered={r.answered} isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />
        </Section>
      )}
    </div>
  );
}

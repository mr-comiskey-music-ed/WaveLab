import { useMemo, useState } from 'react';
import { audio } from '../lib/audio';
import { harmonicValue, midiToFreq, peakOf, pick, randInt, recipe, shuffle, WaveType, WAVE_NAMES, WAVE_TYPES } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { HarmonicBars } from '../components/HarmonicBars';
import { Choices, Feedback, NextButton, PlayButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

const ABOUT: Record<WaveType, string> = {
  sine: 'only the fundamental, no extra harmonics at all. Pure and smooth.',
  triangle: 'odd harmonics only (1, 3, 5...), and they fade away fast. Soft and mellow, a lot like a sine with a little edge.',
  square: 'odd harmonics only (1, 3, 5...), fading slowly. Hollow and reedy, the classic 8-bit video game sound.',
  sawtooth: 'every harmonic (1, 2, 3, 4...), fading slowly. Bright, buzzy and brassy: the most harmonics of the four.',
};

const shape = (type: WaveType) => {
  const amps = recipe(type, 32);
  const p = peakOf(amps);
  return (t: number) => (0.95 * harmonicValue(amps, t)) / p;
};

type Q = { kind: 'ear' | 'bars'; wave: WaveType; midi: number };

function makeQuestions(): Q[] {
  const earWaves = shuffle([...shuffle(WAVE_TYPES), pick(['triangle', 'square', 'sawtooth'] as WaveType[])]);
  const ear: Q[] = earWaves.map((wave) => ({ kind: 'ear', wave, midi: randInt(43, 64) }));
  const bars: Q[] = shuffle(['triangle', 'square', 'sawtooth'] as WaveType[]).map((wave) => ({ kind: 'bars', wave, midi: 48 }));
  return [ear[0], ear[1], bars[0], ear[2], ear[3], bars[1], ear[4], bars[2]];
}

const OPTIONS = WAVE_TYPES.map((w) => ({ id: w, label: WAVE_NAMES[w] }));

export function S3Harmonics({ info, done, onComplete, onNext }: StationProps) {
  const [refWave, setRefWave] = useState<WaveType>('sine');
  const [qs] = useState(makeQuestions);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState(false);
  const r = useRounds(qs.length, done, onComplete);
  const q = qs[r.index];
  const choice = picked[r.index] ?? null;
  const refFn = useMemo(() => shape(refWave), [refWave]);
  const qFn = useMemo(() => shape(q.wave), [q.wave]);

  const play = (wave: WaveType, midi: number) => {
    audio.stopAll();
    audio.play({ freq: midiToFreq(midi), harmonics: recipe(wave, 40), level: 0.55, duration: 1.4 });
  };

  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(id === q.wave ? 100 : 0);
  };

  return (
    <div className="station">
      <StationHeader {...info} />
      <Section title="Listen to the four shapes" note="Same note, four recipes. Listen a few times before the challenge: you won't see the shapes there.">
        <div className="seg" role="group" aria-label="Reference wave">
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
        <div className="split">
          <WavePlot traces={[{ fn: (t) => refFn(t * 2), color: 'var(--trace-a)' }]} duration={1} height={120} label={`${WAVE_NAMES[refWave]} wave shape`} />
          <HarmonicBars amps={recipe(refWave, 12)} label={`Harmonics of a ${refWave} wave`} />
        </div>
        <p className="about">
          <strong>{WAVE_NAMES[refWave]}:</strong> {ABOUT[refWave]}
        </p>
        <PlayButton onClick={() => play(refWave, 48)}>Play {WAVE_NAMES[refWave].toLowerCase()}</PlayButton>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={qs.map((x) => (x.kind === 'ear' ? 'Name it by ear' : 'Name it from the harmonics'))} onNext={onNext} />
      ) : (
        <Section title="Name that wave" note="One try per round. Ear rounds use a different note each time, so listen for the tone color, not the pitch.">
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          {q.kind === 'ear' ? (
            <>
              <p className="question">Listen. Which wave is this?</p>
              <PlayButton kind="primary" onClick={() => play(q.wave, q.midi)}>
                Play the mystery sound
              </PlayButton>
            </>
          ) : (
            <>
              <p className="question">These are the harmonics of a mystery wave. Which wave is it?</p>
              <HarmonicBars amps={recipe(q.wave, 12)} color="var(--trace-b)" label="Harmonics of the mystery wave" />
            </>
          )}
          <Choices options={OPTIONS} correct={q.wave} picked={choice} onPick={choose} columns={4} />
          {choice && (
            <>
              <Feedback ok={choice === q.wave}>
                It was a <strong>{WAVE_NAMES[q.wave].toLowerCase()}</strong>: {ABOUT[q.wave]}
              </Feedback>
              <div className="split">
                <WavePlot traces={[{ fn: (t) => qFn(t * 2), color: 'var(--trace-b)' }]} duration={1} height={110} label="The mystery wave's shape" />
                {q.kind === 'ear' ? <HarmonicBars amps={recipe(q.wave, 12)} color="var(--trace-b)" label="The mystery wave's harmonics" /> : <PlayButton onClick={() => play(q.wave, q.midi)}>Hear it</PlayButton>}
              </div>
            </>
          )}
          {r.answered && <NextButton isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />}
        </Section>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { audio } from '../lib/audio';
import { rand } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Feedback, NextButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

const FREQ = 220; // roughly a snare drum's main tone
const RAD = Math.PI / 180;

/** Level of two equal sine waves added together, 0..1. */
const mixLevel = (deg: number) => Math.abs(Math.cos((deg * RAD) / 2));

type Goal = 'loud' | 'quiet';
type Round = { goal: Goal; offset: number; flipped: boolean; title: string; prompt: string };

function makeRounds(): Round[] {
  let a = rand(50, 310);
  while (Math.abs(a - 180) < 35) a = rand(50, 310);
  return [
    {
      goal: 'loud',
      offset: a,
      flipped: false,
      title: 'Line them up',
      prompt: 'The bottom mic is farther from the drum, so its wave arrives late. Slide the timing until the two mics add up to the fullest, loudest sound.',
    },
    {
      goal: 'quiet',
      offset: rand(20, 340),
      flipped: false,
      title: 'Make them cancel',
      prompt: 'Now do the opposite on purpose: find the setting where the two mics cancel out and the sound nearly disappears. (This is the mistake to avoid in a real session.)',
    },
    {
      goal: 'loud',
      offset: 0,
      flipped: true,
      title: 'Fix the flipped mic',
      prompt: 'The bottom mic faces up at the drum while the top mic faces down, so its wave is upside down. Fix it so the snare sounds full again.',
    },
  ];
}

const scoreFor = (goal: Goal, level: number) =>
  Math.round(goal === 'loud' ? Math.max(0, (level - 0.5) / 0.5) * 100 : Math.max(0, 1 - level / 0.5) * 100);


function MicPlots({ shiftDeg, top = 'var(--trace-a)', bottom = 'var(--trace-b)' }: { shiftDeg: number; top?: string; bottom?: string }) {
  const s = shiftDeg * RAD;
  const cyc = 3 / FREQ;
  return (
    <>
      <WavePlot
        tag="Top mic + bottom mic"
        traces={[
          { fn: (t) => 0.5 * Math.sin(2 * Math.PI * FREQ * t), color: top },
          { fn: (t) => 0.5 * Math.sin(2 * Math.PI * FREQ * t + s), color: bottom },
        ]}
        duration={cyc}
        yMax={1.05}
        height={110}
        label="The top and bottom mic signals"
      />
      <WavePlot
        tag="What you hear (the mix)"
        traces={[{ fn: (t) => 0.5 * Math.sin(2 * Math.PI * FREQ * t) + 0.5 * Math.sin(2 * Math.PI * FREQ * t + s), color: 'var(--ink)', width: 3 }]}
        duration={cyc}
        yMax={1.05}
        height={110}
        label="The two mics added together"
      />
    </>
  );
}

function DroneToggle({ level, id }: { level: number; id: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (on) audio.droneLevel(id, level * 0.8);
  }, [level, on, id]);
  useEffect(() => () => audio.droneStop(id), [id]);
  return (
    <button
      className={`btn ${on ? 'stop' : 'secondary'}`}
      aria-pressed={on}
      onClick={() => {
        if (on) audio.droneStop(id);
        else audio.droneStart(id, { freq: FREQ, harmonics: [1], level: level * 0.8 });
        setOn(!on);
      }}
    >
      {on ? 'Stop the sound' : 'Play the mix (keeps playing while you adjust)'}
    </button>
  );
}

export function S5Phase({ info, done, onComplete, onNext }: StationProps) {
  // explore
  const [exShift, setExShift] = useState(45);
  const [exFlip, setExFlip] = useState(false);
  const exTotal = exShift + (exFlip ? 180 : 0);

  // challenge
  const [rounds] = useState(makeRounds);
  const [adj, setAdj] = useState<number[]>([0, 0, 0]);
  const [flip, setFlip] = useState<boolean[]>([false, false, false]);
  const [summary, setSummary] = useState(false);
  const r = useRounds(rounds.length, done, onComplete);
  const rd = rounds[r.index];
  const total = rd.offset + (rd.flipped ? 180 : 0) + adj[r.index] + (flip[r.index] ? 180 : 0);
  const level = mixLevel(total);
  const locked = r.answered;

  const lockIn = () => {
    audio.droneStop('phase-challenge');
    r.answer(scoreFor(rd.goal, level));
  };

  const feedback = () => {
    const s = r.current ?? 0;
    const ok = s >= 85 ? true : s >= 50 ? 'partial' : false;
    let text =
      rd.goal === 'loud'
        ? 'When the peaks of both mics line up, they add together and the drum sounds full.'
        : 'At 180° one wave peaks while the other dips, so they cancel. Noise-cancelling headphones do this on purpose. In a mix it happens by accident and makes a snare sound thin and weak.';
    if (rd.flipped) {
      text += flip[r.index]
        ? ' The polarity button is exactly how engineers fix this: it flips the wave upside down, fixing every frequency at once.'
        : ' The slider works for this one test tone, but a real drum has many frequencies. The polarity (Ø) button flips the whole wave and fixes all of them at once.';
    }
    return <Feedback ok={ok}>Score: {s}%. {text}</Feedback>;
  };

  return (
    <div className="station">
      <StationHeader {...info} />
      <Section title="Two mics, one drum" note="A snare is often recorded with one mic on top and one underneath. Both hear the same drum, but not at exactly the same time, so their waves are out of phase. As The Pudding puts it, 180° out of phase means one wave is delayed by half a cycle. Try 0°, 90° and 180°, then try the polarity button.">
        <MicPlots shiftDeg={exTotal} />
        <div className="controls">
          <label className="slider">
            <span>Phase of the bottom mic: {Math.round(exShift)}°</span>
            <input type="range" min={0} max={360} step={1} value={exShift} onChange={(e) => setExShift(+e.target.value)} />
          </label>
          <button className={`btn ${exFlip ? 'on-toggle' : 'secondary'}`} aria-pressed={exFlip} onClick={() => setExFlip(!exFlip)}>
            Ø Polarity {exFlip ? 'flipped' : 'normal'}
          </button>
          <DroneToggle id="phase-explore" level={mixLevel(exTotal)} />
        </div>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={rounds.map((x) => x.title)} onNext={onNext} />
      ) : (
        <Section title="Be the engineer" note="Use your eyes, your ears, or both. Lock it in when you're happy.">
          <RoundBar index={r.index} total={rounds.length} scores={r.scores} />
          <h4 className="round-title">{rd.title}</h4>
          <p className="question">{rd.prompt}</p>
          <MicPlots shiftDeg={total} />
          <div className="controls">
            <label className="slider">
              <span>Bottom mic timing</span>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={adj[r.index]}
                disabled={locked}
                onChange={(e) => setAdj(adj.map((v, i) => (i === r.index ? +e.target.value : v)))}
              />
            </label>
            {rd.flipped && (
              <button
                className={`btn ${flip[r.index] ? 'on-toggle' : 'secondary'}`}
                aria-pressed={flip[r.index]}
                disabled={locked}
                onClick={() => setFlip(flip.map((v, i) => (i === r.index ? !v : v)))}
              >
                Ø Polarity {flip[r.index] ? 'flipped' : 'normal'}
              </button>
            )}
            {!locked && <DroneToggle key={r.index} id="phase-challenge" level={level} />}
          </div>
          {!locked && (
            <button className="btn primary" onClick={lockIn}>
              Lock it in
            </button>
          )}
          {locked && feedback()}
          {r.answered && <NextButton isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />}
        </Section>
      )}
    </div>
  );
}

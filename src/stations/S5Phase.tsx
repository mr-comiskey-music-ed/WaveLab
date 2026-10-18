import { useEffect, useMemo, useRef, useState } from 'react';
import { audio, ClipPlayer } from '../lib/audio';
import { rand } from '../lib/waves';
import { useSaved } from '../lib/persist';
import { mcScore, skillScore } from '../lib/stations';
import { DawLane, DawView, DRUM_HZ } from '../components/DawView';
import { distanceToSnare, KitView } from '../components/KitView';
import { HeadphoneScene, SnareSideView } from '../components/PhaseScenes';
import { WavePlot } from '../components/WavePlot';
import { Feedback, FeedbackSlot, LoopButton, NextButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

const SPEED_OF_SOUND = 34.3; // cm per ms
const BASS_HZ = 82.4; // low E on a bass
const BUS_HZ = 60; // the idle rumble in the drawing (the real recording has many more frequencies)
const CLIP = (name: string) => `./audio/${name}.wav`;
const RAD = Math.PI / 180;

type Round =
  | { kind: 'bass'; base: number }
  | { kind: 'snare' }
  | { kind: 'overhead'; leftX: number; startX: number }
  | { kind: 'train'; startMs: number; targetMs: number };

/** The headphone electronics have a built-in delay (the target). The slider starts well away from it. */
function busRound(): Round {
  const targetMs = Math.round(rand(1.6, 4.2) * 20) / 20;
  const startMs = targetMs > 3 ? Math.round(rand(0.2, 1.2) * 20) / 20 : Math.round(rand(4.6, 5.8) * 20) / 20;
  return { kind: 'train', startMs, targetMs };
}

/**
 * Real overhead rooms are so reverberant that a late mic barely sounds wrong. To make the problem easier to hear,
 * the right mic is partly mixed with the left one (as if more of the direct snare reached both mics).
 * Try ?oh=0 (pure recording) up to ?oh=1 (same sound in both) in the address bar to compare.
 */
const blendFromUrl = (key: string, fallback: number) => {
  const v = parseFloat(new URLSearchParams(location.search).get(key) ?? '');
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
};
const OH_BLEND = blendFromUrl('oh', 0.48);
/** Same idea for the snare: the bottom mic is partly blended with the top, so a flipped polarity cancels more of the sound. Try ?sn=0 to 1. */
const SN_BLEND = blendFromUrl('sn', 0.5);

function makeRounds(): Round[] {
  return [
    { kind: 'bass', base: rand(3.5, 6) },
    { kind: 'snare' },
    { kind: 'overhead', leftX: Math.round(rand(45, 85)), startX: Math.round(rand(220, 290)) },
    busRound(),
  ];
}

const TITLES: Record<Round['kind'], string> = {
  bass: 'Bass: line up the DI and the amp mic',
  snare: 'Snare: top and bottom mics',
  overhead: 'Drum overheads: place the mics',
  train: 'Noise-cancelling headphones on a bus',
};

/** Repeats a sound every `everyMs`, reading the latest settings each time. */
function useLoop(play: () => void, everyMs: number) {
  const [on, setOn] = useState(false);
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    if (!on) return;
    playRef.current();
    const id = window.setInterval(() => playRef.current(), everyMs);
    return () => window.clearInterval(id);
  }, [on, everyMs]);
  return [on, () => setOn((v) => !v), setOn] as const;
}

const POLARITY_TEXT =
  'Most mixers, audio interfaces and DAWs have a polarity button, usually marked Ø. It flips a signal upside down, so every push becomes a pull and every pull becomes a push.';

export function S5Phase({ info, done, onComplete, onNext }: StationProps) {
  // ---------- explore: a plain phase playground ----------
  const [exPhase, setExPhase] = useState(60);
  const [exFlip, setExFlip] = useState(false);
  const exShift = exPhase * RAD + (exFlip ? Math.PI : 0);
  const exLevel = Math.abs(Math.cos(exShift / 2));
  const [exOn, exToggle] = useLoop(() => audio.play({ freq: 220, harmonics: [1], level: 0.6 * exLevel + 0.001, normalize: 'none', duration: 0.6 }), 700);

  // ---------- challenge ----------
  const [rounds] = useSaved('phase4:rounds', makeRounds);
  const [nudge, setNudge] = useSaved<number>('phase4:nudge', 0);
  const [snareFlip, setSnareFlip] = useSaved<boolean>('phase4:snareFlip', false);
  const [micX, setMicX] = useSaved<number>('phase4:micX', () => (rounds[2] as { startX: number }).startX);
  const [busDelay, setBusDelay] = useSaved<number>('phase4:busDelay', () => (rounds[3] as { startMs: number }).startMs);
  const [busFlip, setBusFlip] = useSaved<boolean>('phase4:busFlip', false);
  const [summary, setSummary] = useSaved('phase4:summary', false);
  const r = useRounds('phase4', rounds.length, done, onComplete);
  const rd = rounds[r.index];
  const locked = r.answered;

  // Round 1: bass DI vs amp mic in a DAW
  const bassBase = rounds[0].kind === 'bass' ? rounds[0].base : 4;
  const bassOffset = bassBase + nudge;
  const bassLanes = useMemo<DawLane[]>(
    () => [
      { name: 'Bass DI', color: 'var(--trace-a)', startMs: 3 },
      { name: 'Bass amp mic', color: 'var(--trace-b)', startMs: 3 + bassOffset },
    ],
    [bassOffset]
  );

  // Round 3: overheads
  const ohRound = rounds[2].kind === 'overhead' ? rounds[2] : { leftX: 60, startX: 250 };
  const dL = distanceToSnare(ohRound.leftX);
  const dR = distanceToSnare(micX);
  const ohOffsetMs = (dR - dL) / SPEED_OF_SOUND;
  const ohShift = 2 * Math.PI * DRUM_HZ * (ohOffsetMs / 1000);

  // Round 4: bus hum + headphone anti-noise
  const busWave = (t: number, shift = 0) => 0.6 * Math.sin(2 * Math.PI * BUS_HZ * t + shift) + 0.3 * Math.sin(2 * Math.PI * 2 * BUS_HZ * t + 2 * shift);
  const busTarget = rounds[3].kind === 'train' ? rounds[3].targetMs : 2;
  const busOff = busDelay - busTarget; // 0 = the headphones' delay matches the bus noise
  const busShift = -2 * Math.PI * BUS_HZ * (busOff / 1000); // a delay shows up as a phase lag
  const busSign = busFlip ? -1 : 1;

  // The real recordings, looped and mixed live. Sliders and buttons change the mix while it plays.
  const [on, setOn] = useState(false);
  const player = useRef<ClipPlayer | null>(null);
  const parts = (): { url: string; delayMs: number; gain: number }[] => {
    switch (rd.kind) {
      case 'bass':
        return [
          { url: CLIP('bass-di'), delayMs: Math.max(0, -bassOffset), gain: 0.9 },
          { url: CLIP('bass-mic'), delayMs: Math.max(0, bassOffset), gain: 0.9 },
        ];
      case 'snare':
        return [
          { url: CLIP('snare-top'), delayMs: 0, gain: 0.9 },
          { url: CLIP('snare-bottom'), delayMs: 0, gain: (snareFlip ? 0.9 : -0.9) * (1 - SN_BLEND) },
          { url: CLIP('snare-top'), delayMs: 0, gain: (snareFlip ? 0.9 : -0.9) * SN_BLEND },
        ];
      case 'overhead':
        return [
          { url: CLIP('oh-left'), delayMs: Math.max(0, -ohOffsetMs), gain: 0.9 },
          { url: CLIP('oh-right'), delayMs: Math.max(0, ohOffsetMs), gain: 0.9 * (1 - OH_BLEND) },
          { url: CLIP('oh-left'), delayMs: Math.max(0, ohOffsetMs), gain: 0.9 * OH_BLEND },
        ];
      case 'train':
        return [
          { url: CLIP('bus-hum'), delayMs: busTarget, gain: 0.9 },
          { url: CLIP('bus-hum-low'), delayMs: busDelay, gain: busSign * 0.9 },
        ];
    }
  };
  const partsRef = useRef(parts);
  partsRef.current = parts;
  useEffect(() => {
    if (!on) return;
    const p = audio.playClips(partsRef.current());
    player.current = p;
    p.ready.catch(() => setOn(false));
    return () => {
      p.stop();
      player.current = null;
    };
  }, [on, rd.kind]);
  const live = JSON.stringify(parts().map((x) => [x.delayMs, x.gain]));
  useEffect(() => {
    parts().forEach((x, i) => player.current?.set(i, { delayMs: x.delayMs, gain: x.gain }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const toggle = () => setOn((v) => !v);

  const quality = () => {
    switch (rd.kind) {
      case 'bass':
        // within half a millisecond is invisible on the screen and inaudible, so it counts as lined up
        return 1 - Math.max(0, Math.abs(bassOffset) - 0.5) / 2.5;
      case 'snare':
        return snareFlip ? 1 : 0;
      case 'overhead':
        return 1 - Math.abs(dR - dL) / 12;
      case 'train':
        return busFlip ? 1 - Math.abs(busOff) / 1.2 : 0;
    }
  };

  const lockIn = () => {
    setOn(false);
    r.answer(rd.kind === 'snare' ? mcScore(snareFlip) : skillScore(quality()));
  };

  const feedback = () => {
    const s = r.current ?? 50;
    const ok = s >= 95 ? true : s >= 75 ? 'partial' : false;
    const text = {
      bass: 'The DI signal arrives instantly, but the amp mic hears the sound a few milliseconds later, after it travels through the amp and the air. Lining the regions up in the DAW puts them back in phase, so the low end gets bigger instead of thinner. (The mix is the real DI and amp mic from a session.)',
      snare: snareFlip
        ? 'Exactly. The two mics face opposite directions, so one hears a push while the other hears a pull. Flipping the bottom mic’s polarity makes them push together, and the snare gets its body back.'
        : 'The bottom mic needed its polarity flipped. Because the mics face opposite directions, one hears a push while the other hears a pull. The Ø button turns that around so they add up.',
      overhead: `When both overheads are the same distance from the snare, its sound reaches them at the same moment and they stay in phase. Yours ended up ${Math.round(Math.abs(dR - dL))} cm different. Engineers often check this with a tape measure or a mic cable.`,
      train: busFlip
        ? 'The headphones play the bus’s exact opposite, and the closer their timing, the more the deep rumble cancels. That’s phase cancellation used on purpose. The hiss and rattle still come through: they’re high and constantly changing, too fast for the headphones to copy and flip in time. Noise cancelling works best on low, steady sounds like engines.'
        : 'The headphones also needed their polarity flipped. Without the Ø flip, they add a second copy of the rumble instead of cancelling it. Flip it, then fine-tune the timing, and the engine hum drops away.',
    }[rd.kind];
    return <Feedback ok={ok}>{text}</Feedback>;
  };

  return (
    <div className="station">
      <StationHeader info={info} />
      <Section
        title="Phase playground"
        note="Two copies of the same wave. Shift the pink one's phase and watch what happens when they're added together. 180° out of phase means one is delayed by half a cycle."
      >
        <WavePlot
          tag="The two waves"
          traces={[
            { fn: (t) => 0.5 * Math.sin(2 * Math.PI * 3 * t), color: 'var(--trace-a)' },
            { fn: (t) => 0.5 * Math.sin(2 * Math.PI * 3 * t + exShift), color: 'var(--trace-b)' },
          ]}
          duration={1}
          yMax={1.05}
          height={110}
          label="Two waves, one shifted in phase"
        />
        <WavePlot
          tag="Added together"
          traces={[{ fn: (t) => 0.5 * Math.sin(2 * Math.PI * 3 * t) + 0.5 * Math.sin(2 * Math.PI * 3 * t + exShift), color: 'var(--ink)', width: 3 }]}
          duration={1}
          yMax={1.05}
          height={110}
          label="The two waves added together"
        />
        <label className="slider wide">
          <span>Phase of the pink wave: {exPhase}°</span>
          <input type="range" min={0} max={360} step={5} value={exPhase} onChange={(e) => setExPhase(+e.target.value)} />
        </label>
        <div className="btn-row">
          <button className={`btn ${exFlip ? 'on-toggle' : 'secondary'} fixed-w`} aria-pressed={exFlip} onClick={() => setExFlip(!exFlip)}>
            Ø Polarity: {exFlip ? 'flipped' : 'normal'}
          </button>
          <LoopButton on={exOn} onToggle={exToggle} playLabel="Hear the result" />
        </div>
        <p className="about">{POLARITY_TEXT}</p>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={rounds.map((x) => TITLES[x.kind])} kinds={rounds.map((x) => (x.kind === 'snare' ? 'mc' : 'skill'))} onNext={onNext} />
      ) : (
        <Section title="Be the engineer" note="Four real situations where phase matters, using real recordings. Headphones help. Use your eyes, your ears, or both, then lock it in.">
          <RoundBar index={r.index} total={rounds.length} scores={r.scores} />
          <h4 className="round-title">{TITLES[rd.kind]}</h4>

          {rd.kind === 'bass' && (
            <>
              <p className="question">
                Oops: we recorded the bass two ways at once, plugged straight into the interface (a DI) and with a mic on the bass amp, but forgot to check their phase. The amp mic’s copy arrives late.
                Fix it in post: slide the amp mic’s region until the two line up and the low end sounds big.
              </p>
              <DawView lanes={bassLanes} windowMs={30} freq={BASS_HZ} decayMs={30} label="The bass DI and amp mic tracks and their mix" />
              <label className="slider wide">
                <span>Slide the amp mic region (earlier ← → later)</span>
                <input type="range" min={-8} max={3} step={0.1} value={nudge} disabled={locked} onChange={(e) => setNudge(+e.target.value)} />
              </label>
            </>
          )}

          {rd.kind === 'snare' && (
            <>
              <p className="question">
                We’re checking the mics on the top and bottom of the snare and it sounds thin and wrong. The two mics face opposite directions, so when the drum is hit, one mic hears a push while the
                other hears a pull. Use the polarity button on the bottom mic so the two waves build up instead of cancelling.
              </p>
              <SnareSideView flipped={snareFlip} />
              <WavePlot
                tag="Top mic + bottom mic"
                traces={[
                  { fn: (t) => 0.5 * Math.sin(2 * Math.PI * 3 * t), color: 'var(--trace-a)', width: 5 },
                  { fn: (t) => (snareFlip ? 1 : -1) * 0.5 * Math.sin(2 * Math.PI * 3 * t), color: 'var(--trace-b)', width: 2 },
                ]}
                duration={1}
                yMax={1.05}
                height={100}
                label="The two snare mics"
              />
              <WavePlot
                tag="What you hear (the mix)"
                traces={[{ fn: (t) => (snareFlip ? 1 : 0) * Math.sin(2 * Math.PI * 3 * t), color: 'var(--ink)', width: 3 }]}
                duration={1}
                yMax={1.05}
                height={100}
                label="The two mics added together"
              />
              <p className="hint">{POLARITY_TEXT}</p>
            </>
          )}

          {rd.kind === 'overhead' && (
            <>
              <p className="question">
                Overhead mics hang above the drum kit. If one is farther from the snare, the snare’s sound reaches it later and the overheads go out of phase. Move the right overhead (OH R) until the
                combined sound is strongest.
              </p>
              <KitView leftX={ohRound.leftX} rightX={micX} showDistances={false} />
              <WavePlot
                tag="Both overheads added together"
                traces={[{ fn: (t) => 0.5 * Math.sin(2 * Math.PI * 3 * t) + 0.5 * Math.sin(2 * Math.PI * 3 * t - ohShift), color: 'var(--ink)', width: 3 }]}
                duration={1}
                yMax={1.05}
                height={110}
                label="The two overheads added together"
              />
              <label className="slider wide">
                <span>Move the right overhead (OH R) left ← → right</span>
                <input type="range" min={130} max={310} step={1} value={micX} disabled={locked} onChange={(e) => setMicX(+e.target.value)} />
              </label>
            </>
          )}

          {rd.kind === 'train' && (
            <>
              <p className="question">
                You’re riding a bus with noise-cancelling headphones. A tiny mic on the outside hears the engine’s rumble, and the headphones play it back to cancel it. Two things have to be
                right: the copy must be flipped (Ø), and the electronics have a little built-in delay that has to be matched. Flip the polarity, then slide the delay until the rumble is as quiet as you can get it.
              </p>
              <HeadphoneScene />
              <WavePlot
                tag="Bus rumble (blue) + headphones (pink)"
                traces={[
                  { fn: (t) => busWave(t), color: 'var(--trace-a)' },
                  { fn: (t) => busSign * busWave(t, busShift), color: 'var(--trace-b)', width: 2 },
                ]}
                duration={0.04}
                yMax={1.8}
                height={110}
                label="A drawing of the bus rumble and the headphone sound"
              />
              <WavePlot
                tag="What you hear (the low rumble)"
                traces={[{ fn: (t) => busWave(t) + busSign * busWave(t, busShift), color: 'var(--ink)', width: 3 }]}
                duration={0.04}
                yMax={1.8}
                height={110}
                label="What reaches your ear"
              />
              <label className="slider wide">
                <span>Headphone delay: {busDelay.toFixed(2)} ms</span>
                <input type="range" min={0} max={6} step={0.05} value={busDelay} disabled={locked} onChange={(e) => setBusDelay(+e.target.value)} />
              </label>
              <p className="hint">The drawing shows just the rumble’s two lowest tones. The recording has many more, and you’ll hear the hiss no matter what: headphones can’t cancel that.</p>
            </>
          )}

          <div className="btn-row">
            {rd.kind === 'train' && (
              <button className={`btn ${busFlip ? 'on-toggle' : 'secondary'} fixed-w`} aria-pressed={busFlip} disabled={locked} onClick={() => setBusFlip(!busFlip)}>
                Ø Headphone polarity: {busFlip ? 'flipped' : 'normal'}
              </button>
            )}
            {rd.kind === 'snare' && (
              <button className={`btn ${snareFlip ? 'on-toggle' : 'secondary'} fixed-w`} aria-pressed={snareFlip} disabled={locked} onClick={() => setSnareFlip(!snareFlip)}>
                Ø Bottom mic polarity: {snareFlip ? 'flipped' : 'normal'}
              </button>
            )}
            <LoopButton on={on} onToggle={toggle} playLabel={{ bass: 'Play the bass', snare: 'Play the snare', overhead: 'Play the overheads', train: 'Play the bus' }[rd.kind]} />
            <button className="btn primary" disabled={locked} onClick={lockIn}>
              Lock it in
            </button>
          </div>
          <FeedbackSlot tall waiting="When you lock it in, you'll see how you did here.">{locked && feedback()}</FeedbackSlot>
          <NextButton
            index={r.index}
            onPrev={() => {
              setOn(false);
              r.prev();
            }}
            answered={r.answered}
            isLast={r.isLast}
            onNext={() => {
              setOn(false);
              r.next();
            }}
            onFinish={() => {
              setOn(false);
              setSummary(true);
            }}
          />
        </Section>
      )}
    </div>
  );
}

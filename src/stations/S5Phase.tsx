import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../lib/audio';
import { rand } from '../lib/waves';
import { useSaved } from '../lib/persist';
import { skillScore } from '../lib/stations';
import { DawLane, DawView, DRUM_HZ } from '../components/DawView';
import { distanceToSnare, KitView } from '../components/KitView';
import { Feedback, FeedbackSlot, LoopButton, NextButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import type { StationProps } from './types';

const START = 2; // ms where the first mic's hit begins in the view
const SPEED_OF_SOUND = 34.3; // cm per ms

type Round =
  | { kind: 'align'; base: number }
  | { kind: 'cancel'; base: number }
  | { kind: 'flip'; base: number }
  | { kind: 'overhead'; leftX: number; startX: number };

function makeRounds(): Round[] {
  return [
    { kind: 'align', base: rand(1.2, 2.2) },
    { kind: 'cancel', base: rand(-0.4, 0.4) },
    { kind: 'flip', base: 0 },
    { kind: 'overhead', leftX: Math.round(rand(55, 90)), startX: Math.round(rand(230, 290)) },
    { kind: 'overhead', leftX: Math.round(rand(30, 60)), startX: Math.round(rand(150, 175)) },
  ];
}

const TITLES: Record<Round['kind'], string> = {
  align: 'Line up the snare mics',
  cancel: 'Make them cancel (on purpose)',
  flip: 'Fix the flipped snare mic',
  overhead: 'Match the overheads to the snare',
};

/** How loud a steady tone stays when two copies are offset by `ms` (and maybe flipped): 0–1. */
function mixLevel(ms: number, flipped: boolean) {
  const half = (Math.PI * DRUM_HZ * ms) / 1000;
  return Math.abs(flipped ? Math.sin(half) : Math.cos(half));
}

/** Plays drum hits on a loop, reading the latest offset/flip each time. */
function useHitLoop(get: () => { offsetMs: number; flipped: boolean }) {
  const [on, setOn] = useState(false);
  const getRef = useRef(get);
  getRef.current = get;
  useEffect(() => {
    if (!on) return;
    const fire = () => {
      const { offsetMs, flipped } = getRef.current();
      const a = Math.max(0, -offsetMs) / 1000;
      const b = Math.max(0, offsetMs) / 1000;
      const spec = { freq: DRUM_HZ, harmonics: [1, 0.4, 0.2], level: 0.55, normalize: 'none' as const, duration: 0.32, attack: 0.002, release: 0.3 };
      audio.play({ ...spec, delay: a });
      audio.play({ ...spec, delay: b, phases: flipped ? [Math.PI, Math.PI, Math.PI] : undefined });
    };
    fire();
    const id = window.setInterval(fire, 650);
    return () => window.clearInterval(id);
  }, [on]);
  return [on, () => setOn((v) => !v), setOn] as const;
}

const POLARITY_TEXT =
  'Most mixers, audio interfaces and DAWs have a polarity button, usually marked Ø. It flips a signal upside down, so every push becomes a pull. Engineers press it on a snare-bottom mic, because the bottom head moves the opposite way from the top head.';

export function S5Phase({ info, done, onComplete, onNext }: StationProps) {
  // ---------- explore ----------
  const [exNudge, setExNudge] = useState(1.2);
  const [exFlip, setExFlip] = useState(false);
  const exLanes = useMemo<DawLane[]>(
    () => [
      { name: 'Snare top', color: 'var(--trace-a)', startMs: START },
      { name: 'Snare bottom', color: 'var(--trace-b)', startMs: START + exNudge, flip: exFlip },
    ],
    [exNudge, exFlip]
  );
  const [exOn, exToggle] = useHitLoop(() => ({ offsetMs: exNudge, flipped: exFlip }));

  // ---------- challenge ----------
  const [rounds] = useSaved('phase:rounds', makeRounds);
  const [nudge, setNudge] = useSaved<number[]>('phase:nudge', () => rounds.map(() => 0));
  const [flip, setFlip] = useSaved<boolean[]>('phase:flip', () => rounds.map(() => false));
  const [micX, setMicX] = useSaved<number[]>('phase:micX', () => rounds.map((x) => (x.kind === 'overhead' ? x.startX : 0)));
  const [summary, setSummary] = useSaved('phase:summary', false);
  const r = useRounds('phase', rounds.length, done, onComplete);
  const rd = rounds[r.index];
  const locked = r.answered;

  // Offset of the second mic's hit relative to the first (ms), and whether it's upside down.
  let offsetMs = 0;
  let flipped = false;
  let dL = 0;
  let dR = 0;
  if (rd.kind === 'overhead') {
    dL = distanceToSnare(rd.leftX);
    dR = distanceToSnare(micX[r.index]);
    offsetMs = (dR - dL) / SPEED_OF_SOUND;
  } else {
    offsetMs = rd.base + nudge[r.index];
    flipped = rd.kind === 'flip' ? !flip[r.index] : false;
  }
  const lanes = useMemo<DawLane[]>(
    () =>
      rd.kind === 'overhead'
        ? [
            { name: 'Overhead L', color: 'var(--trace-a)', startMs: START + 3 },
            { name: 'Overhead R', color: 'var(--trace-b)', startMs: START + 3 + offsetMs },
          ]
        : [
            { name: 'Snare top', color: 'var(--trace-a)', startMs: START },
            { name: 'Snare bottom', color: 'var(--trace-b)', startMs: START + offsetMs, flip: flipped },
          ],
    [rd.kind, offsetMs, flipped]
  );
  const [on, toggle, setOn] = useHitLoop(() => ({ offsetMs, flipped }));

  const quality = () => {
    switch (rd.kind) {
      case 'align':
        return 1 - Math.abs(offsetMs) / 1.25;
      case 'cancel':
        return 1 - mixLevel(offsetMs, false) / 0.7;
      case 'flip':
        // Sliding half a cycle "works" for one tone but not a whole drum: only the Ø button gets full credit.
        return flip[r.index] && Math.abs(offsetMs) < 0.4 ? 1 : Math.min(mixLevel(offsetMs, flipped), 0.5);
      case 'overhead':
        return 1 - Math.abs(dR - dL) / 12;
    }
  };

  const lockIn = () => {
    setOn(false);
    r.answer(skillScore(quality()));
  };

  const feedback = () => {
    const s = r.current ?? 50;
    const ok = s >= 95 ? true : s >= 75 ? 'partial' : false;
    let text = '';
    if (rd.kind === 'align') text = 'When the peaks of both mics line up, they add together and the snare sounds full and punchy. Engineers do exactly this by nudging audio regions in their DAW.';
    if (rd.kind === 'cancel')
      text = 'About half a cycle apart (180° out of phase), one mic pushes while the other pulls and they cancel. Noise-cancelling headphones do this on purpose. In a mix it happens by accident and makes a snare thin and weak.';
    if (rd.kind === 'flip')
      text = flip[r.index]
        ? 'The polarity button flips the whole wave back, which fixes every frequency of the drum at once.'
        : 'Sliding the region can line up one tone, but a real snare has lots of frequencies, so they can’t all line up that way. The Ø polarity button is the real fix.';
    if (rd.kind === 'overhead')
      text = `Your overheads ended up ${Math.round(Math.abs(dR - dL))} cm different in distance from the snare. When both are the same distance, the snare reaches them at the same moment and sounds solid in the middle of the stereo picture. Engineers really do measure this with a tape measure or a mic cable.`;
    return <Feedback ok={ok}>{text}</Feedback>;
  };

  return (
    <div className="station">
      <StationHeader info={info} />
      <Section
        title="Two mics, one drum"
        note="A snare is often recorded with one mic on top and one underneath. Both hear the same hit, but not at exactly the same moment, so their waves can be out of phase. Each mic is its own track, like in a DAW. Slide the bottom mic's audio region and watch the mix."
      >
        <DawView lanes={exLanes} label="Two snare mic tracks and their mix" />
        <label className="slider wide">
          <span>Slide the snare-bottom region (earlier ← → later)</span>
          <input type="range" min={-3} max={3} step={0.05} value={exNudge} onChange={(e) => setExNudge(+e.target.value)} />
        </label>
        <div className="btn-row">
          <button className={`btn ${exFlip ? 'on-toggle' : 'secondary'} fixed-w`} aria-pressed={exFlip} onClick={() => setExFlip(!exFlip)}>
            Ø Polarity: {exFlip ? 'flipped' : 'normal'}
          </button>
          <LoopButton on={exOn} onToggle={exToggle} playLabel="Play the snare" />
        </div>
        <p className="about">{POLARITY_TEXT}</p>
      </Section>

      {summary ? (
        <StationDone scores={r.scores} labels={rounds.map((x) => TITLES[x.kind])} kinds={rounds.map(() => 'skill' as const)} onNext={onNext} />
      ) : (
        <Section title="Be the engineer" note="Use your eyes, your ears, or both. Lock it in when you're happy.">
          <RoundBar index={r.index} total={rounds.length} scores={r.scores} />
          <h4 className="round-title">{TITLES[rd.kind]}</h4>
          <p className="question">
            {rd.kind === 'align' && 'The bottom mic is a little farther from the drum, so its copy of the hit arrives late. Slide its region until the two tracks line up and the mix sounds fullest.'}
            {rd.kind === 'cancel' && 'Now do the opposite on purpose: slide the region until the two mics cancel and the snare nearly disappears. (This is the mistake to avoid in a real session.)'}
            {rd.kind === 'flip' && 'These two tracks line up in time, but the bottom mic is upside down (it faces up at the drum while the top mic faces down). Fix it so the snare sounds full again.'}
            {rd.kind === 'overhead' &&
              'Overhead mics hang above the kit. If one is farther from the snare, the snare reaches it later and the two overheads go out of phase. Move the right overhead (OH R) so both are the same distance from the snare.'}
          </p>

          {rd.kind === 'overhead' && <KitView leftX={rd.leftX} rightX={micX[r.index]} />}
          <DawView lanes={lanes} label="The two mic tracks and their mix" />

          {rd.kind === 'overhead' ? (
            <label className="slider wide">
              <span>Move the right overhead (OH R) left ← → right</span>
              <input
                type="range"
                min={130}
                max={310}
                step={1}
                value={micX[r.index]}
                disabled={locked}
                onChange={(e) => setMicX(micX.map((v, i) => (i === r.index ? +e.target.value : v)))}
              />
            </label>
          ) : (
            <label className="slider wide">
              <span>Slide the snare-bottom region (earlier ← → later)</span>
              <input
                type="range"
                min={-3}
                max={3}
                step={0.05}
                value={nudge[r.index]}
                disabled={locked}
                onChange={(e) => setNudge(nudge.map((v, i) => (i === r.index ? +e.target.value : v)))}
              />
            </label>
          )}
          <div className="btn-row">
            {rd.kind === 'flip' && (
              <button
                className={`btn ${flip[r.index] ? 'on-toggle' : 'secondary'} fixed-w`}
                aria-pressed={flip[r.index]}
                disabled={locked}
                onClick={() => setFlip(flip.map((v, i) => (i === r.index ? !v : v)))}
              >
                Ø Polarity: {flip[r.index] ? 'flipped' : 'normal'}
              </button>
            )}
            <LoopButton on={on} onToggle={toggle} playLabel={rd.kind === 'overhead' ? 'Play the overheads' : 'Play the snare'} />
            <button className="btn primary" disabled={locked} onClick={lockIn}>
              Lock it in
            </button>
          </div>
          <FeedbackSlot waiting="When you lock it in, you'll see how you did here.">{locked && feedback()}</FeedbackSlot>
          <NextButton
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

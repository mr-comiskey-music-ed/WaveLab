import { useEffect, useMemo, useRef, useState } from 'react';
import { harmonicValue, peakOf, pick, rand, recipe, shuffle, WaveType, WAVE_NAMES } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Choices, Feedback, FeedbackSlot, NextButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
import { useSaved } from '../lib/persist';
import { mcScore } from '../lib/stations';
import type { StationProps } from './types';

const shapeFn = (type: WaveType) => {
  const amps = recipe(type, 24);
  const peak = peakOf(amps);
  return (x: number) => harmonicValue(amps, x) / peak;
};

// ---------- Speaker + air animation ----------
function SpeakerAir({ wave, amp, playheadRef }: { wave: WaveType; amp: number; playheadRef: React.MutableRefObject<number | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fn = useMemo(() => shapeFn(wave), [wave]);
  const live = useRef({ fn, amp });
  live.current = { fn, amp };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const H = 160;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const PERIOD = 2.4; // seconds per cycle on screen (slowed way down)

    const frame = (now: number) => {
      const { fn, amp } = live.current;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const t = reduce ? 0.25 * PERIOD : ((now - t0) / 1000) % (PERIOD * 2);
      const cycles = t / PERIOD;
      playheadRef.current = (cycles % 2) / 2;
      const cone = amp * fn(cycles); // -1..1, + = pushed out

      const blue = getComputedStyle(document.documentElement).getPropertyValue('--trace-a').trim() || '#0380f4';
      // speaker: cabinet, magnet and a cone whose face moves left/right
      ctx.fillStyle = '#17233a';
      ctx.fillRect(0, 18, 22, H - 36);
      const face = 40 + cone * 14;
      ctx.fillStyle = '#c9d3e4';
      ctx.beginPath();
      ctx.moveTo(22, 52);
      ctx.lineTo(face, 22);
      ctx.lineTo(face, H - 22);
      ctx.lineTo(22, H - 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = blue;
      ctx.fillRect(face - 3, 22, 6, H - 44);

      // air molecules: each column copies the cone's motion a little later
      const startX = 66;
      const gap = 13;
      const cols = Math.max(0, Math.floor((W - startX - 10) / gap));
      const rows = 7;
      const lag = 0.05; // cycles of delay per column
      for (let c = 0; c < cols; c++) {
        const d = amp * fn(cycles - c * lag) * 11;
        for (let rI = 0; rI < rows; rI++) {
          const x = startX + c * gap + d + (((c * 7 + rI * 3) % 5) - 2) * 0.5;
          const y = 26 + rI * ((H - 52) / (rows - 1)) + (((c + rI) % 3) - 1) * 2.5;
          ctx.fillStyle = c === 0 ? blue : '#7d8aa3';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#4a5874';
      ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('speaker', 2, 3);
      ctx.fillText('air molecules (the blue column is the dot on the graph)', startX, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playheadRef]);

  return <canvas ref={canvasRef} className="speaker" style={{ height: 160 }} role="img" aria-label="A speaker cone moving back and forth, pushing rows of air molecules" />;
}

// ---------- Check questions ----------
type Want = 'out' | 'rest' | 'in';
type Q =
  | { kind: 'cone'; wave: WaveType; x: number; want: Want }
  | { kind: 'idea'; idea: number; order: number[] };

/** Big-idea questions about how sound travels (from Part 2 of the Waveforms site). */
const IDEAS: { q: string; options: string[]; why: string }[] = [
  {
    q: 'Does a single air molecule travel all the way from the speaker to your ear?',
    options: [
      'No. Each molecule just wobbles back and forth in place and passes the vibration to its neighbours.',
      'Yes. The speaker shoots molecules across the room into your ear.',
      'Only when the sound is loud enough.',
      'Only for high-pitched sounds.',
    ],
    why: 'Molecules only wobble around their resting spot. The vibration is what travels, like a chain reaction or a stadium wave.',
  },
  {
    q: 'When you turn up the amplitude, what changes for the air molecules?',
    options: [
      'They get pushed farther from their resting spot.',
      'They wobble back and forth more times per second.',
      'They travel across the room faster.',
      'More air molecules get created.',
    ],
    why: 'Amplitude is displacement: how far each molecule is pushed. Bigger displacement sounds louder.',
  },
  {
    q: 'When you raise the frequency, what changes for the air molecules?',
    options: [
      'They wobble back and forth more times per second.',
      'They get pushed farther from their resting spot.',
      'They fly to your ear sooner.',
      'Nothing changes for the air, only the speaker.',
    ],
    why: 'Frequency is how many times per second the wobble repeats. More repeats per second sounds higher.',
  },
  {
    q: 'What starts the chain reaction that becomes sound?',
    options: [
      'Something vibrating, like a guitar string or a speaker cone.',
      'Air molecules escaping from the speaker.',
      'Electricity moving through the air.',
      'Your ear pulling the sound toward it.',
    ],
    why: 'Sound always starts with something vibrating. That vibration bumps the air next to it, which bumps the next air, and so on.',
  },
  {
    q: 'The waveform graph you keep seeing shows...',
    options: [
      'How far one air molecule is displaced, over time.',
      'The path one molecule takes across the room.',
      'The shape of the speaker.',
      'How loud the room is at different spots.',
    ],
    why: 'A waveform graphs one molecule’s displacement (up and down on the graph) against time (left to right).',
  },
];

function findPoint(wave: WaveType, want: Want): number {
  const fn = shapeFn(wave);
  for (let tries = 0; tries < 4000; tries++) {
    const x = rand(0.08, 1.92);
    const v = fn(x);
    if (want === 'rest' && Math.abs(v) < 0.05) return x;
    if (want === 'out' && v > 0.6) return x;
    if (want === 'in' && v < -0.6) return x;
  }
  return want === 'out' ? 0.25 : want === 'in' ? 0.75 : 1;
}

function makeQuestions(): Q[] {
  const waves: WaveType[] = ['sine', 'triangle', 'sawtooth', 'square'];
  const cone = (wave: WaveType, want: Want): Q => ({ kind: 'cone', wave, want, x: findPoint(wave, want) });
  const out = pick(['out', 'in'] as Want[]);
  const cones = [cone(pick(waves), out), cone(pick(['sine', 'triangle', 'sawtooth'] as WaveType[]), 'rest'), cone(pick(waves), out === 'out' ? 'in' : 'out')];
  const ideas = [0, ...shuffle([1, 2, 3, 4]).slice(0, 2)].map((idea): Q => ({ kind: 'idea', idea, order: shuffle([0, 1, 2, 3]) }));
  return [cones[0], ideas[0], cones[1], ideas[1], cones[2], ideas[2]];
}

const CONE_OPTIONS = [
  { id: 'out', label: 'Pushed out, toward you' },
  { id: 'rest', label: 'In the middle (at rest)' },
  { id: 'in', label: 'Pulled in, away from you' },
];

/** The cone labels that sit above and below a speaker graph. */
function ConeGraph({ children }: { children: React.ReactNode }) {
  return (
    <div className="cone-graph">
      <span className="cone-label">▲ Speaker cone pushed out (toward you)</span>
      {children}
      <span className="cone-label">▼ Speaker cone pulled in (away from you)</span>
    </div>
  );
}

export function S2Sound({ info, done, onComplete, onNext }: StationProps) {
  const [wave, setWave] = useState<WaveType>('sine');
  const [amp, setAmp] = useState(0.8);
  const playheadRef = useRef<number | null>(0);
  const exploreFn = useMemo(() => shapeFn(wave), [wave]);

  const [qs] = useSaved('sound:qs', makeQuestions);
  const [picked, setPicked] = useSaved<Record<number, string>>('sound:picked', {});
  const [summary, setSummary] = useSaved('sound:summary', false);
  const r = useRounds('sound', qs.length, done, onComplete);
  const q = qs[r.index];
  const qFn = useMemo(() => (q.kind === 'cone' ? shapeFn(q.wave) : null), [q]);
  const choice = picked[r.index] ?? null;
  const correct = q.kind === 'cone' ? q.want : '0';

  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(mcScore(id === correct));
  };

  const explain =
    q.kind === 'cone'
      ? q.want === 'out'
        ? 'The dot is above the middle line, so the cone is pushed out toward the listener.'
        : q.want === 'in'
        ? 'The dot is below the middle line, so the cone is pulled back in.'
        : 'The dot is right on the middle line, so the cone is passing through its resting spot.'
      : IDEAS[q.idea].why;

  return (
    <div className="station">
      <StationHeader info={info} />
      <Section
        title="Watch it in slow motion"
        note="Like on the Waveforms site, the graph shows how one air molecule is displaced over time. Compare the blue dot on the graph with the blue column of molecules right next to the speaker. The molecules only wobble in place: it's the vibration that travels, not the air."
      >
        <SpeakerAir wave={wave} amp={amp} playheadRef={playheadRef} />
        <ConeGraph>
          <WavePlot traces={[{ fn: (t) => amp * exploreFn(t), color: 'var(--trace-a)' }]} duration={2} height={110} playheadRef={playheadRef} label="Speaker position over time" />
        </ConeGraph>
        <div className="controls">
          <div className="seg" role="group" aria-label="Wave shape">
            {(['sine', 'triangle', 'square', 'sawtooth'] as WaveType[]).map((w) => (
              <button key={w} className={w === wave ? 'on' : ''} aria-pressed={w === wave} onClick={() => setWave(w)}>
                {WAVE_NAMES[w]}
              </button>
            ))}
          </div>
          <label className="slider">
            <span>Amplitude</span>
            <input type="range" min={0.1} max={1} step={0.01} value={amp} onChange={(e) => setAmp(+e.target.value)} />
          </label>
        </div>
      </Section>

      {summary ? (
        <StationDone
          scores={r.scores}
          labels={qs.map((x) => (x.kind === 'cone' ? 'Where is the cone?' : IDEAS[x.idea].q))}
          kinds={qs.map(() => 'mc' as const)}
          onNext={onNext}
        />
      ) : (
        <Section title="Check yourself" note="One try per round.">
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          {q.kind === 'cone' && qFn ? (
            <>
              <p className="question">At the moment marked by the dot, where is the speaker cone?</p>
              <WavePlot traces={[{ fn: (t) => 0.9 * qFn(t), color: 'var(--trace-a)' }]} duration={2} height={130} markers={[{ t: q.x, color: 'var(--trace-b)' }]} label="Speaker position over time, with one moment marked" />
              <Choices options={CONE_OPTIONS} correct={correct} picked={choice} onPick={choose} columns={3} />
            </>
          ) : q.kind === 'idea' ? (
            <>
              <p className="question">{IDEAS[q.idea].q}</p>
              <Choices options={q.order.map((i) => ({ id: String(i), label: IDEAS[q.idea].options[i] }))} correct="0" picked={choice} onPick={choose} columns={1} />
            </>
          ) : null}
          <FeedbackSlot>{choice && <Feedback ok={choice === correct}>{explain}</Feedback>}</FeedbackSlot>
          <NextButton index={r.index} onPrev={r.prev} answered={r.answered} isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />
        </Section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { harmonicValue, peakOf, pick, rand, recipe, shuffle, WaveType, WAVE_NAMES } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Choices, Feedback, NextButton, RoundBar, Section, StationDone, StationHeader, useRounds } from '../components/ui';
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
      ctx.fillStyle = '#2a55d4';
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
          ctx.fillStyle = c === 0 ? '#d2366e' : '#7d8aa3';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#4a5874';
      ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('speaker', 2, 3);
      ctx.fillText('air molecules (the pink ones touch the speaker)', startX, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playheadRef]);

  return <canvas ref={canvasRef} className="speaker" style={{ height: 160 }} role="img" aria-label="A speaker cone moving back and forth, pushing rows of air molecules" />;
}

// ---------- Check questions ----------
type Want = 'out' | 'rest' | 'in';
type Q = { kind: 'cone' | 'air'; wave: WaveType; x: number; want: Want };

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
  const restWave = pick(['sine', 'triangle', 'sawtooth'] as WaveType[]);
  const list: Omit<Q, 'x'>[] = [
    { kind: 'cone', wave: pick(waves), want: pick(['out', 'in'] as Want[]) },
    { kind: 'cone', wave: restWave, want: 'rest' },
    { kind: 'air', wave: pick(waves), want: 'out' },
    { kind: 'air', wave: pick(waves), want: 'in' },
    { kind: 'cone', wave: pick(waves), want: pick(['out', 'in'] as Want[]) },
  ];
  return shuffle(list).map((q) => ({ ...q, x: findPoint(q.wave, q.want) }));
}

const CONE_OPTIONS = [
  { id: 'out', label: 'Pushed out, toward you' },
  { id: 'rest', label: 'In the middle (at rest)' },
  { id: 'in', label: 'Pulled in, away from you' },
];
const AIR_OPTIONS = [
  { id: 'out', label: 'Squeezed together' },
  { id: 'in', label: 'Spread apart' },
];

export function S2Sound({ info, done, onComplete, onNext }: StationProps) {
  const [wave, setWave] = useState<WaveType>('sine');
  const [amp, setAmp] = useState(0.8);
  const playheadRef = useRef<number | null>(0);
  const exploreFn = useMemo(() => shapeFn(wave), [wave]);

  const [qs] = useState(makeQuestions);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState(false);
  const r = useRounds(qs.length, done, onComplete);
  const q = qs[r.index];
  const qFn = useMemo(() => shapeFn(q.wave), [q.wave]);
  const choice = picked[r.index] ?? null;

  const choose = (id: string) => {
    setPicked({ ...picked, [r.index]: id });
    r.answer(id === q.want ? 100 : 0);
  };

  const explain =
    q.kind === 'cone'
      ? q.want === 'out'
        ? 'The dot is above the middle line, so the cone is pushed out toward the listener.'
        : q.want === 'in'
        ? 'The dot is below the middle line, so the cone is pulled back in.'
        : 'The dot is right on the middle line, so the cone is passing through its resting spot.'
      : q.want === 'out'
      ? 'The cone is pushed out here, so it crowds the air right in front of it: the molecules get squeezed together (a compression).'
      : 'The cone is pulled back here, so it leaves extra room: the air right in front spreads apart (a rarefaction).';

  return (
    <div className="station">
      <StationHeader {...info} />
      <Section title="Watch it in slow motion" note="The graph is the speaker's position over time. Up on the graph means the cone is pushed out toward you. This is slowed way down: a real 220 Hz note does this 220 times every second.">
        <SpeakerAir wave={wave} amp={amp} playheadRef={playheadRef} />
        <WavePlot traces={[{ fn: (t) => amp * exploreFn(t), color: 'var(--trace-a)' }]} duration={2} height={110} playheadRef={playheadRef} label="Speaker position over time" />
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
        <StationDone scores={r.scores} labels={qs.map((x) => (x.kind === 'cone' ? 'Where is the cone?' : 'What is the air doing?'))} onNext={onNext} />
      ) : (
        <Section title="Check yourself" note="The dot marks one moment in time. One try per round.">
          <RoundBar index={r.index} total={qs.length} scores={r.scores} />
          <p className="question">
            {q.kind === 'cone' ? 'At the moment marked by the dot, where is the speaker cone?' : 'At the moment marked by the dot, what is the air right in front of the speaker doing?'}
          </p>
          <WavePlot traces={[{ fn: (t) => 0.9 * qFn(t), color: 'var(--trace-a)' }]} duration={2} height={130} markers={[{ t: q.x, color: 'var(--trace-b)' }]} label="Speaker position over time, with one moment marked" />
          <Choices options={q.kind === 'cone' ? CONE_OPTIONS : AIR_OPTIONS} correct={q.want} picked={choice} onPick={choose} columns={q.kind === 'cone' ? 3 : 2} />
          {choice && <Feedback ok={choice === q.want}>{explain}</Feedback>}
          {r.answered && <NextButton isLast={r.isLast} onNext={r.next} onFinish={() => setSummary(true)} />}
        </Section>
      )}
    </div>
  );
}

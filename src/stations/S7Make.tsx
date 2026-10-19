import { useEffect, useMemo, useRef, useState } from 'react';
import { Capstone, CAPSTONE_BRIEFS, CAPSTONE_PITCHES, StationInfo } from '../lib/stations';
import { capstoneAmps, capstoneComplete, MIN_WHY, playCapstoneNote, riffFor, riffRange, startRiff } from '../lib/capstone';
import { harmonicValue, peakOf } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Drawbars } from '../components/Drawbars';
import { Piano } from '../components/Piano';
import { LoopButton, PlayButton, Section, StationHeader } from '../components/ui';

interface Props {
  info: StationInfo;
  capstone: Capstone;
  choices: number[];
  onChange: (c: Capstone) => void;
  onFinish: () => void;
}

export function S7Make({ info, capstone: c, choices, onChange, onFinish }: Props) {
  const amps = capstoneAmps(c);
  const barsKey = c.bars.join(',');
  const fn = useMemo(() => {
    const p = peakOf(amps);
    return (t: number) => (0.95 * harmonicValue(amps, t)) / p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barsKey]);
  const set = (patch: Partial<Capstone>) => onChange({ ...c, ...patch });
  const whyLeft = Math.max(0, MIN_WHY - c.why.trim().length);
  const complete = capstoneComplete(c);

  // Looping riff that follows the latest settings.
  const capRef = useRef(c);
  capRef.current = c;
  const [looping, setLooping] = useState(false);
  const [lit, setLit] = useState<number[]>([]);
  useEffect(() => {
    if (!looping) return;
    return startRiff(() => capRef.current, setLit);
  }, [looping]);
  // Restart the loop when the brief changes so the new riff starts cleanly.
  useEffect(() => {
    if (!looping) return;
    setLooping(false);
    const t = window.setTimeout(() => setLooping(true), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.brief]);
  const [lo, hi] = riffRange(c);
  const hasBrief = c.brief >= 0;

  return (
    <div className="station">
      <StationHeader info={info} />
      <Section
        title="1. Pick a brief"
        note="The Waveforms site ends with this idea: sound is just displacement over time, and any sound can be built by adding sine waves. Now you're the sound designer. Choose one job."
      >
        <div className="briefs" role="radiogroup" aria-label="Brief">
          {choices.map((b) => (
            <button key={b} role="radio" aria-checked={c.brief === b} className={`brief${c.brief === b ? ' on' : ''}`} onClick={() => set({ brief: b })}>
              {CAPSTONE_BRIEFS[b]}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="2. Build the sound"
        note={
          hasBrief
            ? `Start the loop: it's ${riffFor(c.brief).mood}, to fit your brief. It keeps playing while you change the faders, so you can hear every change.`
            : 'Pick a brief first, then start the loop and shape the sound with the faders.'
        }
      >
        <div className="btn-row">
          <LoopButton on={looping} onToggle={() => setLooping(!looping)} playLabel="Play the loop" stopLabel="Stop the loop" />
          <PlayButton onClick={() => playCapstoneNote(c)}>Play one note</PlayButton>
        </div>
        <Piano lo={lo} hi={hi} lit={lit} label="Notes the loop is playing" />
        <div className="controls">
          <div className="seg" role="group" aria-label="Register">
            {CAPSTONE_PITCHES.map((p, i) => (
              <button key={p.label} className={c.pitch === i ? 'on' : ''} aria-pressed={c.pitch === i} onClick={() => set({ pitch: i })}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Attack">
            <button className={!c.punchy ? 'on' : ''} aria-pressed={!c.punchy} onClick={() => set({ punchy: false })}>
              Slow/soft attack
            </button>
            <button className={c.punchy ? 'on' : ''} aria-pressed={c.punchy} onClick={() => set({ punchy: true })}>
              Fast/punchy attack
            </button>
          </div>
        </div>
        <Drawbars steps={10} values={amps} onChange={(v) => set({ bars: v.map((x) => Math.round(x * 10)) })} colorFor={(i) => (i % 2 === 0 ? 'var(--trace-a)' : 'var(--trace-b)')} />
        <p className="legend">
          <span className="key a" /> Odd harmonics <span className="key b" /> Even harmonics
        </p>
        <WavePlot traces={[{ fn: (t) => fn(t * 2), color: 'var(--ink)' }]} duration={1} height={110} label="Your sound's wave shape" />
      </Section>

      <Section title="3. Name it and explain it">
        <label className="field">
          <span>Name your sound</span>
          <input type="text" maxLength={40} value={c.name} placeholder="e.g. Rust Bucket Blues" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>What makes the tone (harmonics), register (low/high) and attack (slow/fast) you chose fit the brief?</span>
          <textarea
            rows={4}
            maxLength={400}
            value={c.why}
            placeholder="e.g. I kept only odd harmonics so it sounds hollow and empty, like the city..."
            onChange={(e) => set({ why: e.target.value })}
          />
        </label>
        <p className="muted">{whyLeft > 0 ? `Write at least ${whyLeft} more characters.` : `${c.why.length}/400`}</p>
        {complete ? <p className="ok-line">Your sound is saved and will go into your code.</p> : <p className="muted">Pick a brief, name your sound and explain it to finish this station.</p>}
        <button
          className="btn primary"
          onClick={() => {
            setLooping(false);
            onFinish();
          }}
        >
          Get my code
        </button>
      </Section>
    </div>
  );
}

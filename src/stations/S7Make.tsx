import { useMemo } from 'react';
import { Capstone, CAPSTONE_BRIEFS, CAPSTONE_PITCHES, StationInfo } from '../lib/stations';
import { capstoneAmps, capstoneComplete, MIN_WHY, playCapstone } from '../lib/capstone';
import { harmonicValue, peakOf } from '../lib/waves';
import { WavePlot } from '../components/WavePlot';
import { Drawbars } from '../components/Drawbars';
import { PlayButton, Section, StationHeader } from '../components/ui';

interface Props {
  info: StationInfo;
  capstone: Capstone;
  choices: number[];
  onChange: (c: Capstone) => void;
  onFinish: () => void;
}

export function S7Make({ info, capstone: c, choices, onChange, onFinish }: Props) {
  const amps = capstoneAmps(c);
  const fn = useMemo(() => {
    const p = peakOf(amps);
    return (t: number) => (0.95 * harmonicValue(amps, t)) / p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.bars.join(',')]);
  const set = (patch: Partial<Capstone>) => onChange({ ...c, ...patch });
  const whyLeft = Math.max(0, MIN_WHY - c.why.trim().length);
  const complete = capstoneComplete(c);

  return (
    <div className="station">
      <StationHeader {...info} />
      <Section title="1. Pick a brief" note="You're the sound designer. Choose one job.">
        <div className="briefs" role="radiogroup" aria-label="Brief">
          {choices.map((b) => (
            <button key={b} role="radio" aria-checked={c.brief === b} className={`brief${c.brief === b ? ' on' : ''}`} onClick={() => set({ brief: b })}>
              {CAPSTONE_BRIEFS[b]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="2. Build the sound" note="Mix harmonics 1–8 with the faders. Use what you learned: which harmonics make a sound bright, hollow, soft or buzzy?">
        <Drawbars steps={10} values={amps} onChange={(v) => set({ bars: v.map((x) => Math.round(x * 10)) })} colorFor={(i) => (i % 2 === 0 ? 'var(--trace-a)' : 'var(--trace-b)')} />
        <p className="legend">
          <span className="key a" /> Odd harmonics <span className="key b" /> Even harmonics
        </p>
        <WavePlot traces={[{ fn: (t) => fn(t * 2), color: 'var(--ink)' }]} duration={1} height={110} label="Your sound's wave shape" />
        <div className="controls">
          <div className="seg" role="group" aria-label="Pitch">
            {CAPSTONE_PITCHES.map((p, i) => (
              <button key={p.label} className={c.pitch === i ? 'on' : ''} aria-pressed={c.pitch === i} onClick={() => set({ pitch: i })}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Start of the note">
            <button className={!c.punchy ? 'on' : ''} aria-pressed={!c.punchy} onClick={() => set({ punchy: false })}>
              Soft start
            </button>
            <button className={c.punchy ? 'on' : ''} aria-pressed={c.punchy} onClick={() => set({ punchy: true })}>
              Punchy start
            </button>
          </div>
        </div>
        <div className="btn-row">
          <PlayButton kind="primary" onClick={() => playCapstone(c)}>
            Play a note
          </PlayButton>
          <PlayButton onClick={() => playCapstone(c, true)}>Play a riff</PlayButton>
        </div>
      </Section>

      <Section title="3. Name it and explain it">
        <label className="field">
          <span>Name your sound</span>
          <input type="text" maxLength={40} value={c.name} placeholder="e.g. Rust Bucket Blues" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Why does it fit the brief? Talk about the harmonics you used.</span>
          <textarea
            rows={4}
            maxLength={400}
            value={c.why}
            placeholder="e.g. I kept only odd harmonics so it sounds hollow and empty, like the city..."
            onChange={(e) => set({ why: e.target.value })}
          />
        </label>
        <p className="muted">{whyLeft > 0 ? `Write at least ${whyLeft} more characters.` : `${c.why.length}/400`}</p>
        {complete ? (
          <p className="ok-line">Your sound is saved into your code automatically.</p>
        ) : (
          <p className="muted">Pick a brief, name your sound and explain it to finish this station.</p>
        )}
        <button className="btn primary" onClick={onFinish}>
          Get my code
        </button>
      </Section>
    </div>
  );
}

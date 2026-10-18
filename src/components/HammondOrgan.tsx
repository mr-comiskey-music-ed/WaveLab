import { useEffect, useRef, useState } from 'react';
import { audio } from '../lib/audio';
import { Loop, LoopEvent, run, startLoop } from '../lib/loops';
import { midiToFreq } from '../lib/waves';
import { Piano } from './Piano';
import { LoopButton } from './ui';

/**
 * Hammond drawbars are additive synthesis: each bar adds one sine-wave harmonic.
 * Footages are pipe-organ names for pitch. 8' is the note you play.
 */
const BARS = [
  { foot: "16'", harmonic: 1, color: 'brown' },
  { foot: "5⅓'", harmonic: 3, color: 'brown' },
  { foot: "8'", harmonic: 2, color: 'white' },
  { foot: "4'", harmonic: 4, color: 'white' },
  { foot: "2⅔'", harmonic: 6, color: 'black' },
  { foot: "2'", harmonic: 8, color: 'white' },
  { foot: "1⅗'", harmonic: 10, color: 'black' },
  { foot: "1⅓'", harmonic: 12, color: 'black' },
  { foot: "1'", harmonic: 16, color: 'white' },
] as const;

const PRESETS: { name: string; setting: string }[] = [
  { name: 'Classic jazz', setting: '888000000' },
  { name: 'Gospel, full', setting: '888888888' },
  { name: 'Rock', setting: '888800000' },
  { name: 'Mellow ballad', setting: '008400000' },
  { name: 'Bright whistle', setting: '800000888' },
];

/** Each drawbar step is about 3 dB. */
const levelToAmp = (n: number) => (n <= 0 ? 0 : Math.pow(10, (-(8 - n) * 3) / 20));

function harmonicsFor(levels: number[]) {
  const h = new Array(16).fill(0);
  levels.forEach((lv, i) => (h[BARS[i].harmonic - 1] += levelToAmp(lv)));
  return h;
}

const BASS_SETTING = [8, 0, 8, 0, 0, 0, 0, 0, 0]; // darker sound for the left hand

// A swung gospel/blues loop in F: I7 – IV7 – I7 – V7, left-hand walking bass + right-hand stabs.
const SW = 2 / 3; // swing: the "and" lands two-thirds through the beat
const bar = (start: number, chord: number[], bass: number[]): LoopEvent[] => [
  ...run(bass, 1, 0.85, start, 'bass'),
  { at: start, notes: chord, len: 0.45, part: 'chord' },
  { at: start + 1 + SW, notes: chord, len: 1.2, part: 'chord' },
  { at: start + 3, notes: chord, len: 0.4, part: 'chord' },
  { at: start + 3 + SW, notes: chord, len: 0.3, part: 'chord' },
];
const F7 = [57, 60, 63, 65];
const Bb7 = [56, 58, 62, 65];
const C7 = [55, 58, 60, 64];
const LOOP: Loop = {
  bpm: 92,
  beats: 16,
  events: [...bar(0, F7, [41, 45, 48, 51]), ...bar(4, Bb7, [46, 50, 53, 44]), ...bar(8, F7, [41, 45, 48, 51]), ...bar(12, C7, [48, 52, 55, 46])],
};

function Drawbar({ index, value, onChange }: { index: number; value: number; onChange: (v: number) => void }) {
  const b = BARS[index];
  const trackRef = useRef<HTMLDivElement>(null);
  const fromPointer = (e: React.PointerEvent) => {
    const rect = trackRef.current!.getBoundingClientRect();
    onChange(Math.max(0, Math.min(8, Math.round(((e.clientY - rect.top) / rect.height) * 8))));
  };
  return (
    <div className="hb">
      <span className="hb-foot">{b.foot}</span>
      <div
        ref={trackRef}
        className="hb-slot"
        role="slider"
        tabIndex={0}
        aria-label={`${b.foot} drawbar`}
        aria-valuemin={0}
        aria-valuemax={8}
        aria-valuenow={value}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => e.buttons & 1 && fromPointer(e)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onChange(Math.min(8, value + 1));
          else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onChange(Math.max(0, value - 1));
          else return;
          e.preventDefault();
        }}
      >
        <div className={`hb-rod hb-${b.color}`} style={{ height: `${10 + value * 11.25}%` }}>
          <div className="hb-marks">
            {Array.from({ length: value }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <div className="hb-knob" />
        </div>
      </div>
    </div>
  );
}

export function HammondOrgan() {
  const [levels, setLevels] = useState<number[]>([8, 8, 8, 0, 0, 0, 0, 0, 0]);
  const [leslie, setLeslie] = useState<'off' | 'slow' | 'fast'>('slow');
  const [on, setOn] = useState(false);
  const [lit, setLit] = useState<number[]>([]);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    audio.setLeslie(leslie);
  }, [leslie]);

  useEffect(() => {
    if (!on) return;
    return startLoop(
      () => LOOP,
      (e, delay, beatSec) => {
        const h = harmonicsFor(e.part === 'bass' ? BASS_SETTING : levelsRef.current);
        if (!h.some((x) => x > 0)) return;
        e.notes.forEach((m) => audio.playOrgan({ freq: midiToFreq(m), harmonics: h, level: e.part === 'bass' ? 0.5 : 0.32, duration: e.len * beatSec, delay }));
      },
      setLit
    );
  }, [on]);

  useEffect(() => () => setOn(false), []);

  const setBar = (i: number, v: number) => setLevels(levels.map((x, k) => (k === i ? v : x)));
  const registration = `${levels.slice(0, 2).join('')} ${levels.slice(2, 6).join('')} ${levels.slice(6).join('')}`;
  const playChord = () => {
    const h = harmonicsFor(levels);
    if (!h.some((x) => x > 0)) return;
    [53, 57, 60, 65].forEach((m) => audio.playOrgan({ freq: midiToFreq(m), harmonics: h, level: 0.32, duration: 1.6 }));
  };

  return (
    <div className="hammond">
      <div className="hammond-panel">
        <div className="hammond-bars">
          {levels.map((v, i) => (
            <Drawbar key={i} index={i} value={v} onChange={(nv) => setBar(i, nv)} />
          ))}
        </div>
        <div className="hammond-readout" aria-live="polite">
          <span>Registration</span>
          <strong>{registration}</strong>
        </div>
      </div>
      <div className="seg wrap" role="group" aria-label="Presets">
        {PRESETS.map((p) => (
          <button key={p.name} className={levels.join('') === p.setting ? 'on' : ''} onClick={() => setLevels(p.setting.split('').map(Number))}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="controls">
        <div className="seg" role="group" aria-label="Leslie speaker">
          {(['off', 'slow', 'fast'] as const).map((m) => (
            <button key={m} className={leslie === m ? 'on' : ''} aria-pressed={leslie === m} onClick={() => setLeslie(m)}>
              Leslie {m}
            </button>
          ))}
        </div>
        <LoopButton on={on} onToggle={() => setOn(!on)} playLabel="Play the gospel/blues loop" stopLabel="Stop the loop" />
        <button className="btn secondary" onClick={playChord}>
          Play a chord
        </button>
      </div>
      <Piano lo={36} hi={71} lit={lit} label="Notes the organ is playing" />
    </div>
  );
}

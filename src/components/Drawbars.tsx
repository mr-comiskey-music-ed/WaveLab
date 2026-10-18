import { useRef } from 'react';

interface Props {
  values: number[];
  onChange: (values: number[]) => void;
  disabled?: boolean;
  /** Show the level as a number under each bar. */
  showNumbers?: boolean;
  colorFor?: (i: number) => string;
  /** Number of steps from bottom to top. */
  steps?: number;
}

/** Vertical faders for harmonic levels. Drag, click, or use arrow keys. */
export function Drawbars({ values, onChange, disabled, showNumbers, colorFor, steps = 20 }: Props) {
  const tracks = useRef<(HTMLDivElement | null)[]>([]);

  const setAt = (i: number, v: number) => {
    const snapped = Math.round(Math.max(0, Math.min(1, v)) * steps) / steps;
    if (snapped === values[i]) return;
    const next = [...values];
    next[i] = snapped;
    onChange(next);
  };

  const fromPointer = (i: number, e: React.PointerEvent) => {
    const el = tracks.current[i];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAt(i, 1 - (e.clientY - rect.top) / rect.height);
  };

  return (
    <div className="drawbars" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
      {values.map((v, i) => (
        <div key={i} className="drawbar">
          <div
            ref={(el) => {
              tracks.current[i] = el;
            }}
            className={`track${disabled ? ' off' : ''}`}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Harmonic ${i + 1} level`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v * 100)}
            onPointerDown={(e) => {
              if (disabled) return;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              fromPointer(i, e);
            }}
            onPointerMove={(e) => {
              if (disabled || !(e.buttons & 1)) return;
              fromPointer(i, e);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              const step = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 / steps : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 / steps : 0;
              if (step) {
                e.preventDefault();
                setAt(i, v + step);
              }
            }}
          >
            <div className="fill" style={{ height: `${v * 100}%`, background: colorFor?.(i) }} />
          </div>
          <span className="bar-label">{i + 1}</span>
          {showNumbers && <span className="bar-num">{Math.round(v * 100)}</span>}
        </div>
      ))}
    </div>
  );
}

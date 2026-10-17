import { midiName } from '../lib/waves';

const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * A small piano from `lo` to `hi` (MIDI note numbers). Lit keys are drawn in colour;
 * `rootColor` marks the lowest lit key so intervals read clearly.
 */
export function Piano({ lo, hi, lit, label, showNames = true }: { lo: number; hi: number; lit: number[]; label: string; showNames?: boolean }) {
  const start = lo - (lo % 12); // begin on a C
  const end = hi + (11 - (hi % 12)); // end on a B
  const whites: number[] = [];
  for (let m = start; m <= end; m++) if (!BLACK.has(m % 12)) whites.push(m);
  const W = 100 / whites.length;
  const litSet = new Set(lit);
  const lowest = lit.length ? Math.min(...lit) : -1;
  const xOfWhite = (m: number) => whites.indexOf(m) * W;

  return (
    <figure className="piano" role="img" aria-label={`${label}${lit.length ? ': ' + [...litSet].sort((a, b) => a - b).map(midiName).join(', ') : ''}`}>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none">
        {whites.map((m) => (
          <rect
            key={m}
            x={xOfWhite(m) + 0.15}
            y={0.3}
            width={W - 0.3}
            height={33.4}
            rx={0.8}
            fill={litSet.has(m) ? (m === lowest ? 'var(--trace-a)' : 'var(--trace-b)') : '#fff'}
            stroke="#9aa6ba"
            strokeWidth={0.3}
          />
        ))}
        {Array.from({ length: end - start + 1 }, (_, i) => start + i)
          .filter((m) => BLACK.has(m % 12))
          .map((m) => {
            const x = xOfWhite(m - 1) + W * 0.68;
            return (
              <rect
                key={m}
                x={x}
                y={0}
                width={W * 0.64}
                height={21}
                rx={0.6}
                fill={litSet.has(m) ? (m === lowest ? 'var(--trace-a)' : 'var(--trace-b)') : '#1f2a40'}
                stroke="#1f2a40"
                strokeWidth={0.3}
              />
            );
          })}
      </svg>
      {showNames && (
        <div className="piano-names" style={{ gridTemplateColumns: `repeat(${whites.length}, 1fr)` }}>
          {whites.map((m) => (
            <span key={m}>{m % 12 === 0 ? midiName(m) : ''}</span>
          ))}
        </div>
      )}
    </figure>
  );
}

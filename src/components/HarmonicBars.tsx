/** Display-only bar chart of harmonic levels (a simple spectrum). */
export function HarmonicBars({
  amps,
  count = 12,
  color = 'var(--trace-a)',
  label,
  rootHz,
}: {
  amps: number[];
  count?: number;
  color?: string;
  label: string;
  /** Label bars in Hz (like The Pudding's charts) instead of harmonic numbers. */
  rootHz?: number;
}) {
  const vals = Array.from({ length: count }, (_, i) => Math.abs(amps[i] ?? 0));
  const max = Math.max(...vals, 1e-9);
  const W = 100 / count;
  return (
    <figure className="bars" aria-label={label} role="img">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none">
        <line x1="0" y1="49.5" x2="100" y2="49.5" stroke="var(--grid-strong)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        {vals.map((v, i) => {
          const h = (v / max) * 46;
          return <rect key={i} x={i * W + W * 0.2} y={49.5 - h} width={W * 0.6} height={h} fill={color} rx="0.6" />;
        })}
      </svg>
      <div className="bars-axis" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {vals.map((_, i) => (
          <span key={i}>{rootHz ? `${(i + 1) * rootHz}Hz` : i + 1}</span>
        ))}
      </div>
      <figcaption>{rootHz ? 'Frequency' : 'Harmonic number'}</figcaption>
    </figure>
  );
}

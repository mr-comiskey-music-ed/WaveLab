/** Bird's-eye view of a drum kit with two overhead mics, in centimetres. */

export const SNARE = { x: 120, y: 125 };
export const MIC_Y = 30;
/** Overheads hang about this far above the snare. */
export const MIC_HEIGHT = 90;

export function distanceToSnare(micX: number) {
  const dx = micX - SNARE.x;
  const dy = MIC_Y - SNARE.y;
  return Math.sqrt(dx * dx + dy * dy + MIC_HEIGHT * MIC_HEIGHT);
}

function Mic({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <g>
      <rect x={x - 6} y={MIC_Y - 14} width={12} height={22} rx={6} fill={color} />
      <rect x={x - 2} y={MIC_Y + 8} width={4} height={8} fill={color} />
      <text x={x} y={MIC_Y - 20} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {label}
      </text>
    </g>
  );
}

export function KitView({ leftX, rightX, showDistances = true }: { leftX: number; rightX: number; showDistances?: boolean }) {
  const dL = distanceToSnare(leftX);
  const dR = distanceToSnare(rightX);
  // Labels sit near each mic, along its line, so they don't land on the cymbals.
  const along = (x: number, f: number) => ({ x: x + (SNARE.x - x) * f, y: MIC_Y + 10 + (SNARE.y - MIC_Y - 10) * f });
  const midL = along(leftX, 0.18);
  const midR = along(rightX, 0.18);
  return (
    <svg className="kit" viewBox="0 0 330 230" role="img" aria-label={`Drum kit from above. Left overhead is ${Math.round(dL)} cm from the snare, right overhead is ${Math.round(dR)} cm.`}>
      <rect x="0" y="0" width="330" height="230" rx="8" fill="#f7f9fc" />
      {/* cymbals */}
      <circle cx="78" cy="70" r="30" fill="#f6e7b8" stroke="#d8bf6a" />
      <text x="78" y="74" textAnchor="middle" fontSize="10" fill="#7a6420">crash</text>
      <circle cx="262" cy="88" r="34" fill="#f6e7b8" stroke="#d8bf6a" />
      <text x="262" y="92" textAnchor="middle" fontSize="10" fill="#7a6420">ride</text>
      <circle cx="70" cy="140" r="20" fill="#f6e7b8" stroke="#d8bf6a" />
      <text x="70" y="144" textAnchor="middle" fontSize="10" fill="#7a6420">hi-hat</text>
      {/* drums */}
      <rect x="140" y="128" width="70" height="52" rx="10" fill="#dfe5ef" stroke="#8f9cb3" />
      <text x="175" y="158" textAnchor="middle" fontSize="10" fill="#4a5874">kick</text>
      <circle cx="160" cy="98" r="16" fill="#e8edf5" stroke="#8f9cb3" />
      <circle cx="198" cy="100" r="16" fill="#e8edf5" stroke="#8f9cb3" />
      <circle cx="242" cy="160" r="24" fill="#e8edf5" stroke="#8f9cb3" />
      <text x="242" y="164" textAnchor="middle" fontSize="10" fill="#4a5874">floor tom</text>
      <circle cx={SNARE.x} cy={SNARE.y} r="19" fill="#ffffff" stroke="#17233a" strokeWidth="2" />
      <text x={SNARE.x} y={SNARE.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#17233a">
        snare
      </text>
      <circle cx="175" cy="212" r="12" fill="#cfd6e2" />
      <text x="175" y="216" textAnchor="middle" fontSize="9" fill="#4a5874">seat</text>
      {/* distance lines */}
      <line x1={SNARE.x} y1={SNARE.y} x2={leftX} y2={MIC_Y + 10} stroke="var(--trace-a)" strokeWidth="2" strokeDasharray="5 4" />
      <line x1={SNARE.x} y1={SNARE.y} x2={rightX} y2={MIC_Y + 10} stroke="var(--trace-b)" strokeWidth="2" strokeDasharray="5 4" />
      {showDistances && (
        <>
          <text x={midL.x - 8} y={midL.y} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--trace-a)" paintOrder="stroke" stroke="#f7f9fc" strokeWidth="4">
            {Math.round(dL)} cm
          </text>
          <text x={midR.x + 8} y={midR.y} textAnchor="start" fontSize="12" fontWeight="700" fill="var(--trace-b)" paintOrder="stroke" stroke="#f7f9fc" strokeWidth="4">
            {Math.round(dR)} cm
          </text>
        </>
      )}
      <Mic x={leftX} color="var(--trace-a)" label="OH L" />
      <Mic x={rightX} color="var(--trace-b)" label="OH R" />
    </svg>
  );
}

/** Small illustrations for the phase scenarios. */

/** Side view of a snare with a mic above and below. The arrows show each head moving. */
export function SnareSideView({ flipped }: { flipped: boolean }) {
  return (
    <svg className="scene" viewBox="0 0 360 190" role="img" aria-label="Side view of a snare drum with one mic above pointing down and one mic below pointing up">
      <rect x="0" y="0" width="360" height="190" rx="8" fill="#f7f9fc" />
      {/* drum shell */}
      <rect x="180" y="72" width="130" height="46" rx="4" fill="#e8edf5" stroke="#8f9cb3" strokeWidth="2" />
      <line x1="180" y1="72" x2="310" y2="72" stroke="#17233a" strokeWidth="3" />
      <line x1="180" y1="118" x2="310" y2="118" stroke="#17233a" strokeWidth="3" />
      <text x="245" y="99" textAnchor="middle" fontSize="12" fill="#4a5874">snare</text>
      {/* top mic, pointing down */}
      <g>
        <rect x="235" y="14" width="20" height="34" rx="10" fill="var(--trace-a)" />
        <text x="267" y="30" fontSize="12" fontWeight="700" fill="var(--trace-a)">Top mic</text>
        <path d="M245 52 v12" stroke="var(--trace-a)" strokeWidth="2" markerEnd="url(#arrowA)" />
      </g>
      {/* bottom mic, pointing up */}
      <g>
        <rect x="235" y="142" width="20" height="34" rx="10" fill="var(--trace-b)" />
        <text x="267" y="166" fontSize="12" fontWeight="700" fill="var(--trace-b)">
          {flipped ? 'Bottom mic (Ø)' : 'Bottom mic'}
        </text>
        <path d="M245 138 v-12" stroke="var(--trace-b)" strokeWidth="2" markerEnd="url(#arrowB)" />
      </g>
      {/* head motion when the stick hits */}
      <text x="10" y="60" fontSize="11" fill="#4a5874">Stick hits: the top head</text>
      <text x="10" y="74" fontSize="11" fill="#4a5874">moves away from its mic...</text>
      <text x="10" y="132" fontSize="11" fill="#4a5874">...and the bottom head</text>
      <text x="10" y="146" fontSize="11" fill="#4a5874">moves toward its mic.</text>
      <defs>
        <marker id="arrowA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--trace-a)" />
        </marker>
        <marker id="arrowB" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--trace-b)" />
        </marker>
      </defs>
    </svg>
  );
}

/** A sine path from (x0, cy) to (x1, cy), for the rumble drawing. */
function sinePath(x0: number, x1: number, cy: number, amp: number, wavelength: number, flip = 1) {
  let d = '';
  for (let x = x0; x <= x1; x += 2) {
    const y = cy - flip * amp * Math.sin((2 * Math.PI * (x - x0)) / wavelength);
    d += `${x === x0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`;
  }
  return d;
}
const RUMBLE_PATH = sinePath(170, 256, 100, 11, 28);
const OPPOSITE_PATH = sinePath(298, 350, 126, 6, 17, -1);

/** Noise-cancelling headphones on a bus: an outside mic hears the rumble, the speaker plays the opposite. */
export function HeadphoneScene() {
  return (
    <svg className="scene bus-scene" viewBox="0 0 400 180" role="img" aria-label="A city bus whose engine rumble travels to a person wearing noise-cancelling headphones. The headphone speaker plays the opposite wave.">
      <rect x="0" y="0" width="400" height="180" rx="8" fill="#f7f9fc" />
      {/* road */}
      <line x1="6" y1="153" x2="394" y2="153" stroke="#b9c5d8" strokeWidth="2" strokeDasharray="14 8" />

      {/* the bus */}
      <g>
        <rect x="12" y="58" width="154" height="78" rx="12" fill="#f4b400" stroke="#8a6200" strokeWidth="2" />
        <rect x="13" y="106" width="152" height="6" fill="#d99a00" />
        {[24, 54, 84, 114].map((x) => (
          <rect key={x} x={x} y="68" width="26" height="28" rx="3" fill="#cfe6f7" stroke="#6f8aa6" strokeWidth="1.5" />
        ))}
        {/* front door and windshield */}
        <rect x="144" y="68" width="16" height="62" rx="3" fill="#cfe6f7" stroke="#6f8aa6" strokeWidth="1.5" />
        <line x1="152" y1="68" x2="152" y2="130" stroke="#6f8aa6" strokeWidth="1.2" />
        {/* destination sign + headlight + rear engine grille */}
        <rect x="100" y="60" width="38" height="6" rx="2" fill="#17233a" />
        <rect x="162" y="114" width="6" height="9" rx="2" fill="#fff7c2" stroke="#8a6200" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="17" y1={116 + i * 4.5} x2="34" y2={116 + i * 4.5} stroke="#8a6200" strokeWidth="1.6" />
        ))}
        {/* wheels */}
        {[50, 128].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="136" r="18" fill="#6b4b00" />
            <circle cx={cx} cy="138" r="14" fill="#1f2937" />
            <circle cx={cx} cy="138" r="6" fill="#b8c0cc" />
          </g>
        ))}
      </g>

      {/* the rumble travelling from the bus to the headphones' outside mic */}
      <path d={RUMBLE_PATH} className="rumble-flow" fill="none" stroke="var(--trace-a)" strokeWidth="3" strokeLinecap="round" />
      <text x="213" y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--trace-a)">
        rumble of the bus
      </text>

      {/* head + headphones (big enough to hold the label) */}
      <circle cx="324" cy="100" r="48" fill="#e8edf5" stroke="#8f9cb3" strokeWidth="1.5" />
      <path d="M273 98 a51 51 0 0 1 102 0" fill="none" stroke="#17233a" strokeWidth="5" />
      <rect x="262" y="84" width="16" height="32" rx="6" fill="#17233a" />
      <rect x="370" y="84" width="16" height="32" rx="6" fill="#17233a" />
      <circle cx="259" cy="100" r="4" fill="var(--trace-b)" />
      <text x="324" y="92" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--trace-b)">
        speaker plays
      </text>
      <text x="324" y="106" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--trace-b)">
        the opposite
      </text>
      <path d={OPPOSITE_PATH} fill="none" stroke="var(--trace-b)" strokeWidth="2.5" strokeLinecap="round" />

      {/* outside mic label */}
      <text x="226" y="140" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--trace-b)">
        outside mic
      </text>
      <line x1="238" y1="130" x2="257" y2="106" stroke="var(--trace-b)" strokeWidth="1.3" />
    </svg>
  );
}

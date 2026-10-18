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

/** Noise-cancelling headphones on a bus: an outside mic hears the rumble, the speaker plays the opposite. */
export function HeadphoneScene() {
  return (
    <svg className="scene" viewBox="0 0 320 150" role="img" aria-label="A person wearing noise-cancelling headphones on a bus">
      <rect x="0" y="0" width="320" height="150" rx="8" fill="#f7f9fc" />
      {/* bus window strip */}
      <rect x="10" y="12" width="300" height="40" rx="6" fill="#dfe8f5" stroke="#b9c5d8" />
      {[30, 100, 170, 240].map((x) => (
        <rect key={x} x={x} y="18" width="56" height="28" rx="4" fill="#ffffff" stroke="#b9c5d8" />
      ))}
      <text x="160" y="70" textAnchor="middle" fontSize="11" fill="#4a5874">rumble of the bus</text>
      <path d="M40 82 q10 -8 20 0 t20 0 t20 0 t20 0" fill="none" stroke="var(--trace-a)" strokeWidth="2.5" />
      {/* head + headphones */}
      <circle cx="225" cy="105" r="26" fill="#e8edf5" stroke="#8f9cb3" />
      <path d="M199 100 a26 26 0 0 1 52 0" fill="none" stroke="#17233a" strokeWidth="4" />
      <rect x="191" y="96" width="14" height="24" rx="5" fill="#17233a" />
      <rect x="245" y="96" width="14" height="24" rx="5" fill="#17233a" />
      <circle cx="188" cy="100" r="3" fill="var(--trace-b)" />
      <text x="150" y="132" textAnchor="end" fontSize="11" fill="var(--trace-b)">outside mic</text>
      <line x1="152" y1="128" x2="186" y2="103" stroke="var(--trace-b)" strokeWidth="1.2" />
      <text x="268" y="140" textAnchor="end" fontSize="11" fill="#4a5874">speaker plays the opposite</text>
    </svg>
  );
}

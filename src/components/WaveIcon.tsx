import { WaveType } from '../lib/waves';

/** The little waveform symbols printed on synth oscillator switches. */
const PATHS: Record<WaveType, string> = {
  sine: 'M1 8 C 3.5 0.5, 6.5 0.5, 9 8 S 14.5 15.5, 17 8',
  triangle: 'M1 8 L 5 1.5 L 13 14.5 L 17 8',
  square: 'M1 8 V 2 H 9 V 14 H 17 V 8',
  sawtooth: 'M1 14 L 9 2 V 14 L 17 2 V 8',
};

export function WaveIcon({ type, size = 18 }: { type: WaveType; size?: number }) {
  return (
    <svg className="wave-icon" viewBox="0 0 18 16" width={size} height={size * (16 / 18)} aria-hidden="true">
      <path d={PATHS[type]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

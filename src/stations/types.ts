import type { StationInfo, StationResult } from '../lib/stations';

export interface StationProps {
  info: StationInfo;
  done?: StationResult;
  onComplete: (r: StationResult) => void;
  /** Replaces the saved result after a student retries some rounds. */
  onRevise?: (r: StationResult) => void;
  onNext?: () => void;
}

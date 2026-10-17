import type { StationInfo, StationResult } from '../lib/stations';

export interface StationProps {
  info: StationInfo;
  done?: StationResult;
  onComplete: (r: StationResult) => void;
  onNext?: () => void;
}

import { distanceToSnare, SNARE } from '../components/KitView';
import { mcScore, skillScore } from './stations';

/**
 * The phase station's mixing and grading rules, shared by the student's station and the teacher's
 * review, so the teacher hears and sees exactly what the student's settings did.
 */

export const SPEED_OF_SOUND = 34.3; // cm per ms
export const BASS_HZ = 82.4; // low E on a bass
export const BUS_HZ = 60; // the idle rumble in the drawing (the real recording has many more frequencies)
export const CLIP = (name: string) => `./audio/${name}.wav`;

/**
 * Real overhead rooms are so reverberant that a late mic barely sounds wrong. To make the problem easier to hear,
 * the right mic is partly mixed with the left one (as if more of the direct snare reached both mics).
 * Try ?oh=0 (pure recording) up to ?oh=1 (same sound in both) in the address bar to compare.
 */
const blendFromUrl = (key: string, fallback: number) => {
  const v = parseFloat(new URLSearchParams(location.search).get(key) ?? '');
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
};
export const OH_BLEND = blendFromUrl('oh', 0.48);
/** Same idea for the snare: the bottom mic is partly blended with the top, so a flipped polarity cancels more of the sound. Try ?sn=0 to 1. */
export const SN_BLEND = blendFromUrl('sn', 0.5);

export type PhaseKind = 'bass' | 'snare' | 'overhead' | 'train';

export const PHASE_TITLES: Record<PhaseKind, string> = {
  bass: 'Bass: line up the DI and the amp mic',
  snare: 'Snare: top and bottom mics',
  overhead: 'Drum overheads: place the mics',
  train: 'How do noise-cancelling headphones work?',
};

/** Overhead placement: under 4 cm apart is right, 4 to 8 cm is close, anything farther is wrong. */
export function overheadScore(cmApart: number) {
  if (cmApart < 4) return 100;
  if (cmApart < 8) return Math.round(90 - (cmApart - 4) * 2.5); // 90 down to 80: "Close"
  return Math.round(60 - Math.min(10, (cmApart - 8) * 1.25)); // 60 down to 50: wrong
}

/** Everything a student can adjust in the phase rounds, plus the hidden answers the rounds are built around. */
export interface PhaseSetup {
  /** How late the amp mic starts before any sliding (ms). */
  bassBase: number;
  /** How far the student slid the amp mic region (ms). */
  nudge: number;
  snareFlip: boolean;
  leftX: number;
  micX: number;
  /** The headphones' built-in delay the student is trying to match (ms). */
  busTarget: number;
  busDelay: number;
  busFlip: boolean;
}

export const bassOffsetOf = (s: PhaseSetup) => s.bassBase + s.nudge;
export const overheadGapOf = (s: PhaseSetup) => Math.abs(distanceToSnare(s.micX) - distanceToSnare(s.leftX));

/** The recordings, delays and polarities to mix for a round. */
export function phaseParts(kind: PhaseKind, s: PhaseSetup): { url: string; delayMs: number; gain: number }[] {
  switch (kind) {
    case 'bass': {
      const off = bassOffsetOf(s);
      return [
        { url: CLIP('bass-di'), delayMs: Math.max(0, -off), gain: 0.9 },
        { url: CLIP('bass-mic'), delayMs: Math.max(0, off), gain: 0.9 },
      ];
    }
    case 'snare':
      return [
        { url: CLIP('snare-top'), delayMs: 0, gain: 0.9 },
        { url: CLIP('snare-bottom'), delayMs: 0, gain: (s.snareFlip ? 0.9 : -0.9) * (1 - SN_BLEND) },
        { url: CLIP('snare-top'), delayMs: 0, gain: (s.snareFlip ? 0.9 : -0.9) * SN_BLEND },
      ];
    case 'overhead': {
      const ohOffsetMs = (distanceToSnare(s.micX) - distanceToSnare(s.leftX)) / SPEED_OF_SOUND;
      return [
        { url: CLIP('oh-left'), delayMs: Math.max(0, -ohOffsetMs), gain: 0.9 },
        { url: CLIP('oh-right'), delayMs: Math.max(0, ohOffsetMs), gain: 0.9 * (1 - OH_BLEND) },
        { url: CLIP('oh-left'), delayMs: Math.max(0, ohOffsetMs), gain: 0.9 * OH_BLEND },
      ];
    }
    case 'train':
      return [
        { url: CLIP('bus-hum'), delayMs: s.busTarget, gain: 0.9 },
        { url: CLIP('bus-hum-low'), delayMs: s.busDelay, gain: (s.busFlip ? -1 : 1) * 0.9 },
      ];
  }
}

/** 0 to 1: how well the settings solve the round. */
export function phaseQuality(kind: PhaseKind, s: PhaseSetup) {
  switch (kind) {
    case 'bass':
      // within half a millisecond is invisible on the screen and inaudible, so it counts as lined up
      return 1 - Math.max(0, Math.abs(bassOffsetOf(s)) - 0.5) / 2.5;
    case 'snare':
      return s.snareFlip ? 1 : 0;
    case 'overhead':
      return (overheadScore(overheadGapOf(s)) - 50) / 50;
    case 'train':
      return s.busFlip ? 1 - Math.abs(s.busDelay - s.busTarget) / 1.2 : 0;
  }
}

/** The 0 to 100 grade for a round (the snare is plain right/wrong). */
export const phaseGrade = (kind: PhaseKind, s: PhaseSetup) => (kind === 'snare' ? mcScore(s.snareFlip) : skillScore(phaseQuality(kind, s)));

/** The same setup with every control put where it should be. */
export const solvedSetup = (s: PhaseSetup): PhaseSetup => ({
  ...s,
  nudge: -s.bassBase,
  snareFlip: true,
  micX: 2 * SNARE.x - s.leftX,
  busFlip: true,
  busDelay: s.busTarget,
});

/** A drawing of the bus rumble's two lowest tones, shifted in phase. */
export const busWave = (t: number, shift = 0) => 0.6 * Math.sin(2 * Math.PI * BUS_HZ * t + shift) + 0.3 * Math.sin(2 * Math.PI * 2 * BUS_HZ * t + 2 * shift);
/** How far the headphones' timing is off, as a phase lag in the drawing. */
export const busShiftOf = (s: PhaseSetup) => -2 * Math.PI * BUS_HZ * ((s.busDelay - s.busTarget) / 1000);

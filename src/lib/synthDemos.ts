import { audio } from './audio';
import { Loop, run, startLoop } from './loops';
import { midiToFreq, recipe, WaveType } from './waves';

/** Musical jobs each basic waveform is famous for, with a short loop to hear it in context. */
export interface Role {
  role: string;
  detail: string;
  loop: Loop;
  /** Note length style: 'held' notes ring, 'short' notes are plucky. */
  feel: 'held' | 'short';
}

export const ROLES: Record<WaveType, Role> = {
  sine: {
    role: 'Sub-bass and 808-style bass',
    detail: 'No harmonics means nothing but deep low end, the kind of bass you feel in your chest. (Laptop speakers struggle with it: try headphones.)',
    feel: 'held',
    loop: { bpm: 140, beats: 8, events: [{ at: 0, notes: [36], len: 1.4 }, { at: 1.5, notes: [36], len: 1.2 }, { at: 3, notes: [43], len: 0.9 }, { at: 4, notes: [39], len: 1.4 }, { at: 5.5, notes: [39], len: 1 }, { at: 7, notes: [34], len: 0.9 }] },
  },
  triangle: {
    role: '8-bit video game bass lines and soft flutes',
    detail: 'The classic Nintendo (NES) used a triangle wave for its bass channel: soft and round, but with a little edge.',
    feel: 'short',
    loop: { bpm: 150, beats: 8, events: run([40, 52, 40, 52, 43, 55, 45, 57, 40, 52, 40, 52, 47, 50, 45, 43], 0.5, 0.42) },
  },
  square: {
    role: '8-bit and chiptune melodies, reedy clarinet-like leads',
    detail: 'Old game consoles like the Game Boy played their melodies with square waves. Hollow, bright and very “video game.”',
    feel: 'short',
    loop: { bpm: 150, beats: 8, events: run([72, 76, 79, 84, 83, 79, 76, 74, 72, 74, 76, 79, 77, 76, 74, 71], 0.5, 0.42) },
  },
  sawtooth: {
    role: 'Big synth leads, brass stabs and strings',
    detail: 'With every harmonic, it’s the brightest of the four. Stack a few slightly out-of-tune saws and you get the famous “supersaw” from dance music.',
    feel: 'held',
    loop: {
      bpm: 128,
      beats: 8,
      events: [
        { at: 0, notes: [57, 60, 64], len: 1.4 },
        { at: 1.5, notes: [57, 60, 64], len: 1.4 },
        { at: 3, notes: [55, 59, 62], len: 0.9 },
        { at: 4, notes: [53, 57, 60], len: 1.4 },
        { at: 5.5, notes: [53, 57, 60], len: 1.4 },
        { at: 7, notes: [55, 59, 62], len: 0.9 },
      ],
    },
  },
};

/** Little sound-design jobs for the "what would you reach for?" playground. Answers are what's commonly used. */
export const REACH_FOR: { brief: string; answer: WaveType; loopFrom: WaveType; why: string }[] = [
  { brief: 'The bass line in an old-school 8-bit video game', answer: 'triangle', loopFrom: 'triangle', why: 'The NES had exactly one channel for bass, and it was a triangle wave.' },
  { brief: 'A deep sub-bass you feel more than hear', answer: 'sine', loopFrom: 'sine', why: 'A sine has no harmonics, so all of its energy stays down low.' },
  { brief: 'The hero’s melody in a retro platform game', answer: 'square', loopFrom: 'square', why: 'Chiptune melodies are classically square waves: hollow, bright and cutting.' },
  { brief: 'A huge, bright lead for the drop of a dance track', answer: 'sawtooth', loopFrom: 'sawtooth', why: 'All those harmonics make saws the brightest, biggest-sounding wave, especially stacked into a supersaw.' },
];

/** Plays a role's loop once with any waveform. Returns a stop function. */
export function playRoleLoop(loopFrom: WaveType, wave: WaveType, onNotes: (m: number[]) => void, onEnd: () => void) {
  audio.stopAll();
  const role = ROLES[loopFrom];
  const h = recipe(wave, 40);
  return startLoop(
    () => role.loop,
    (e, delay, beatSec) => {
      const dur = e.len * beatSec;
      e.notes.forEach((m) => {
        const freq = midiToFreq(m);
        const spec = {
          harmonics: h,
          level: e.notes.length > 1 ? 0.3 : 0.55,
          duration: dur,
          attack: role.feel === 'short' ? 0.004 : 0.01,
          release: role.feel === 'short' ? Math.min(0.08, dur * 0.4) : Math.min(0.25, dur * 0.5),
          delay,
        };
        if (wave === 'sawtooth' && e.notes.length > 1) {
          // a mini supersaw: two slightly detuned copies
          audio.play({ ...spec, freq: freq * 1.005, level: spec.level * 0.7 });
          audio.play({ ...spec, freq: freq * 0.995, level: spec.level * 0.7 });
        } else audio.play({ ...spec, freq });
      });
    },
    onNotes,
    false,
    onEnd
  );
}

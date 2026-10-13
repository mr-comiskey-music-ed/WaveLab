import React, { useState, useEffect } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { Harmonic, WaveformType } from '../types';
import { Trophy, HelpCircle, Target, Award, Play, Check, AlertCircle } from 'lucide-react';

interface QuestsModeProps {
  harmonics: Harmonic[];
  onUpdateHarmonics: (harmonics: Harmonic[]) => void;
  fundamentalHz: number;
  onSetScrambled: (scrambled: boolean) => void;
  onUpdateScore: (quest: 'a' | 'b' | 'c', score: number) => void;
}

export const QuestsMode: React.FC<QuestsModeProps> = ({
  harmonics,
  onUpdateHarmonics,
  fundamentalHz,
  onSetScrambled,
  onUpdateScore,
}) => {
  const [activeQuest, setActiveQuest] = useState<'a' | 'b' | 'c'>('a');

  // ========================================================
  // QUEST A: FOURIER ARCHITECT STATE (5 Progressive Missions with Strict Thresholds)
  // ========================================================
  const [questATargetIndex, setQuestATargetIndex] = useState<number>(0);
  const [passedMissions, setPassedMissions] = useState<boolean[]>([false, false, false, false, false]);

  const questATargets = [
    {
      id: 'm1',
      title: 'Mission 1: Fundamental (1f)',
      hint: 'Set the 1f Fundamental drawbar to 100% (1.0). Target success threshold: 50% accuracy.',
      requiredThreshold: 50,
      check: (h: Harmonic[]) => {
        const diff = Math.abs(h[0].amplitude - 1.0);
        const accuracy = Math.max(0, Math.round((1 - diff) * 100));
        return { accuracy, passed: accuracy >= 50 };
      },
    },
    {
      id: 'm2',
      title: 'Mission 2: 2nd Harmonic (2f)',
      hint: 'Set 1f to 100% and 2f to 50%. Target success threshold: 70% accuracy.',
      requiredThreshold: 70,
      check: (h: Harmonic[]) => {
        const d1 = Math.abs(h[0].amplitude - 1.0);
        const d2 = Math.abs(h[1].amplitude - 0.5);
        const accuracy = Math.max(0, Math.round((1 - (d1 + d2) / 2) * 100));
        return { accuracy, passed: accuracy >= 70 };
      },
    },
    {
      id: 'm3',
      title: 'Mission 3: 3rd Harmonic (3f)',
      hint: 'Set 1f = 100%, 2f = 50%, and 3f = 33%. Target success threshold: 85% accuracy.',
      requiredThreshold: 85,
      check: (h: Harmonic[]) => {
        const d1 = Math.abs(h[0].amplitude - 1.0);
        const d2 = Math.abs(h[1].amplitude - 0.5);
        const d3 = Math.abs(h[2].amplitude - 0.33);
        const accuracy = Math.max(0, Math.round((1 - (d1 + d2 + d3) / 3) * 100));
        return { accuracy, passed: accuracy >= 85 };
      },
    },
    {
      id: 'm4',
      title: 'Mission 4: 4th Harmonic (4f)',
      hint: 'Set harmonics 1 through 4 (1f=1.0, 2f=0.5, 3f=0.33, 4f=0.25). Target success threshold: 95% accuracy.',
      requiredThreshold: 95,
      check: (h: Harmonic[]) => {
        const d1 = Math.abs(h[0].amplitude - 1.0);
        const d2 = Math.abs(h[1].amplitude - 0.5);
        const d3 = Math.abs(h[2].amplitude - 0.33);
        const d4 = Math.abs(h[3].amplitude - 0.25);
        const accuracy = Math.max(0, Math.round((1 - (d1 + d2 + d3 + d4) / 4) * 100));
        return { accuracy, passed: accuracy >= 95 };
      },
    },
    {
      id: 'm5',
      title: 'Mission 5: 5th Harmonic (5f)',
      hint: 'Set harmonics 1 through 5 to ideal Sawtooth levels (1.0, 0.5, 0.33, 0.25, 0.20). Target success threshold: 100% accuracy.',
      requiredThreshold: 100,
      check: (h: Harmonic[]) => {
        const d1 = Math.abs(h[0].amplitude - 1.0);
        const d2 = Math.abs(h[1].amplitude - 0.5);
        const d3 = Math.abs(h[2].amplitude - 0.33);
        const d4 = Math.abs(h[3].amplitude - 0.25);
        const d5 = Math.abs(h[4].amplitude - 0.20);
        const accuracy = Math.max(0, Math.round((1 - (d1 + d2 + d3 + d4 + d5) / 5) * 100));
        return { accuracy, passed: accuracy >= 100 };
      },
    },
  ];

  const currentTarget = questATargets[questATargetIndex];
  const targetCheck = currentTarget.check(harmonics);
  const currentMatchPct = targetCheck.accuracy;

  useEffect(() => {
    if (targetCheck.passed && !passedMissions[questATargetIndex]) {
      setPassedMissions((prev) => {
        if (prev[questATargetIndex]) return prev;
        const next = [...prev];
        next[questATargetIndex] = true;
        const passedCount = next.filter(Boolean).length;
        const scoreA = Math.round((passedCount / questATargets.length) * 100);
        setTimeout(() => {
          onUpdateScore('a', scoreA);
        }, 0);
        return next;
      });
    }
  }, [targetCheck.passed, questATargetIndex]);

  // Reset to single sine wave (1f at 100%, others 0) when switching missions
  useEffect(() => {
    const sineHarmonics: Harmonic[] = Array.from({ length: 10 }, (_, i) => ({
      n: i + 1,
      amplitude: i === 0 ? 1.0 : 0.0,
      phase: 0,
      muted: false,
      solo: false,
    }));
    onUpdateHarmonics(sineHarmonics);
    audioEngine.setHarmonics(sineHarmonics);
  }, [questATargetIndex]);

  // ========================================================
  // QUEST B: BLIND SPECTRUM DETECTIVE STATE
  // ========================================================
  const [mysteryRound, setMysteryRound] = useState<number>(0);
  const [mysteryQuestions] = useState([
    {
      waveform: 'sawtooth' as WaveformType,
      freq: 130.81,
      name: 'Mystery Timbre #1',
      clue: 'Notice whether the spectrum contains all frequencies or skips even bars.',
      explanation:
        'Sawtooth has ALL harmonics (1, 2, 3, 4, 5...) producing a rich, buzzy tone.',
    },
    {
      waveform: 'square' as WaveformType,
      freq: 164.81,
      name: 'Mystery Timbre #2',
      clue: 'Listen for a woody, hollow, clarinet-like sound with alternating empty frequency bars.',
      explanation:
        'Square wave contains only ODD harmonics (1, 3, 5, 7...) falling off at 1/n.',
    },
    {
      waveform: 'sine' as WaveformType,
      freq: 220.0,
      name: 'Mystery Timbre #3',
      clue: 'Only a single spike in the frequency spectrum!',
      explanation:
        'The Sine wave is the fundamental building block with ZERO overtones.',
    },
    {
      waveform: 'triangle' as WaveformType,
      freq: 130.81,
      name: 'Mystery Timbre #4',
      clue: 'Odd harmonics are present, but higher overtones are extremely faint.',
      explanation:
        'Triangle waves drop off rapidly at 1/n², leaving a mellow flute-like warmth.',
    },
  ]);

  const [bUserChoice, setBUserChoice] = useState<string | null>(null);
  const [bScoreCount, setBScoreCount] = useState<number>(0);
  const [bFeedback, setBFeedback] = useState<string | null>(null);

  // Play mystery sound
  const playMystery = (waveType: WaveformType, freq: number) => {
    audioEngine.resume();
    audioEngine.setFundamental(freq);
    audioEngine.playPureWave(waveType, freq, 1.2);
    const h = audioEngine.playPresetFormula(waveType);
    if (h) onUpdateHarmonics(h);
  };

  // Switch to Quest B: activate Oscilloscope scramble
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeQuest === 'b') {
        onSetScrambled(true);
      } else {
        onSetScrambled(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeQuest, onSetScrambled]);

  const handleQuestBAnswer = (choice: WaveformType) => {
    setBUserChoice(choice);
    const correct = mysteryQuestions[mysteryRound].waveform;
    const q = mysteryQuestions[mysteryRound];
    if (choice === correct) {
      setBFeedback(`Correct! ${q.explanation}`);
      const newScore = bScoreCount + 1;
      setBScoreCount(newScore);
      setTimeout(() => {
        onUpdateScore('b', Math.round((newScore / mysteryQuestions.length) * 100));
      }, 0);
    } else {
      setBFeedback(`Not quite. This was a ${correct.toUpperCase()} wave. ${q.explanation}`);
    }
  };

  const nextBRound = () => {
    setBUserChoice(null);
    setBFeedback(null);
    if (mysteryRound < mysteryQuestions.length - 1) {
      setMysteryRound((prev) => prev + 1);
    }
  };

  // ========================================================
  // QUEST C: HARMONIC MATH & RATIOS STATE
  // ========================================================
  const [cQuestions] = useState([
    {
      id: 1,
      q: 'If a basic musical note (fundamental 1f) vibrates at 100 Hz, what is the frequency of its 2nd harmonic (2f)?',
      options: ['100 Hz', '200 Hz', '300 Hz', '400 Hz'],
      correct: 1, // 200 Hz (100 * 2)
      explanation: 'Easy math: 2f = 2 × 100 Hz = 200 Hz (exactly one octave higher).',
    },
    {
      id: 2,
      q: 'Which wave type contains ODD harmonics only (1f, 3f, 5f...), giving it a hollow, clarinet-like timbre?',
      options: ['Square or Triangle Wave', 'Sawtooth Wave', 'Pure Sine Wave', 'White Noise'],
      correct: 0,
      explanation: 'Square and Triangle waves use only odd harmonic multiples.',
    },
    {
      id: 3,
      q: 'If the 1st harmonic (fundamental) has 100% volume, what is the amplitude of the 2nd harmonic in a standard Sawtooth wave (which drops off as 1/n)?',
      options: ['50% (Half)', '100% (Equal)', '10% (Quiet)', '0% (Muted)'],
      correct: 0,
      explanation: 'Sawtooth amplitudes drop off as 1/n, so the 2nd harmonic is 1/2 = 50%.',
    },
    {
      id: 4,
      q: 'If a sound wave vibrates 220 times every second, what is its frequency in Hertz (Hz)?',
      options: ['220 Hz', '2 Hz', '2,200 Hz', '0.22 Hz'],
      correct: 0,
      explanation: 'Hertz (Hz) is literally defined as cycles per second!',
    },
  ]);

  const [cAnswers, setCAnswers] = useState<Record<number, number>>({});

  const handleCAnswer = (qIndex: number, optionIndex: number) => {
    const updated = { ...cAnswers, [qIndex]: optionIndex };
    setCAnswers(updated);

    // Calculate score
    let correctCount = 0;
    cQuestions.forEach((q, idx) => {
      if (updated[idx] === q.correct) correctCount++;
    });
    const cScore = Math.round((correctCount / cQuestions.length) * 100);
    setTimeout(() => {
      onUpdateScore('c', cScore);
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Challenge Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1a1d26] border border-white/5 rounded-xl p-3.5 shadow-xl">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#00ff9d]" />
          <span className="text-xs uppercase tracking-[0.2em] text-white font-bold">
            ASSESSMENT CHALLENGE MISSIONS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="tab-quest-a"
            onClick={() => setActiveQuest('a')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeQuest === 'a'
                ? 'bg-[#2a2e3a] text-[#00ff9d] border border-white/10 shadow-sm'
                : 'bg-black/40 text-gray-500 hover:text-white border border-white/10'
            }`}
          >
            Challenge A: Fourier Architect
          </button>
          <button
            id="tab-quest-b"
            onClick={() => setActiveQuest('b')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeQuest === 'b'
                ? 'bg-[#2a2e3a] text-[#00e5ff] border border-white/10 shadow-sm'
                : 'bg-black/40 text-gray-500 hover:text-white border border-white/10'
            }`}
          >
            Challenge B: Blind Detective
          </button>
          <button
            id="tab-quest-c"
            onClick={() => setActiveQuest('c')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeQuest === 'c'
                ? 'bg-[#2a2e3a] text-amber-400 border border-white/10 shadow-sm'
                : 'bg-black/40 text-gray-500 hover:text-white border border-white/10'
            }`}
          >
            Challenge C: Harmonic Math
          </button>
        </div>
      </div>

      {/* ========================================================
          QUEST A UI: THE FOURIER ARCHITECT
      ======================================================== */}
      {activeQuest === 'a' && (
        <div className="bg-[#1a1d26] border border-white/5 rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#00ff9d]/10 text-[#00ff9d] text-xs font-mono font-bold uppercase tracking-wider mb-1 border border-[#00ff9d]/30">
                <Target className="w-3.5 h-3.5" /> MISSION GOAL: WAVEFORM SYNTHESIS
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase">
                {currentTarget.title}
              </h3>
            </div>

            {/* Live Match Meter */}
            <div className="flex items-center gap-3 bg-black/60 px-4 py-2 rounded-xl border border-white/5">
              <div className="text-right">
                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest font-bold">SYNTHESIS ACCURACY:</div>
                <div
                  className="text-lg font-mono font-black"
                  style={{
                    color: currentMatchPct >= currentTarget.requiredThreshold ? '#00ff9d' : currentMatchPct >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                >
                  {currentMatchPct}% <span className="text-[10px] text-gray-400 font-normal">(Req: {currentTarget.requiredThreshold}%)</span>
                </div>
              </div>

              {currentMatchPct >= currentTarget.requiredThreshold && (
                <div className="flex items-center gap-1 text-xs font-black text-black bg-[#00ff9d] px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-[0_0_10px_rgba(0,255,157,0.3)]">
                  <Check className="w-4 h-4 stroke-[3]" /> PASSED!
                </div>
              )}
            </div>
          </div>

          {/* Hint Card */}
          <div className="p-3.5 bg-black/40 rounded-xl border border-white/5 flex items-start gap-2.5 text-xs">
            <HelpCircle className="w-4 h-4 text-[#00ff9d] shrink-0 mt-0.5" />
            <p className="text-gray-300 leading-relaxed font-mono">{currentTarget.hint}</p>
          </div>

          {/* Drawbar adjustments inside Quest A */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
              <span className="uppercase tracking-wider text-[10px]">ADJUST THE 10 HARMONIC DRAWBARS:</span>
              <button
                id="btn-quest-a-listen"
                onClick={() => audioEngine.triggerNote(fundamentalHz, 3.0)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00ff9d] text-black font-black text-xs uppercase tracking-wider hover:bg-[#00ff9d]/90 shadow-[0_0_15px_rgba(0,255,157,0.3)] transition-all"
              >
                <Play className="w-3 h-3 fill-black text-black" /> Play 3s Sustained Wave
              </button>
            </div>

            {/* Quick Drawbars row */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 bg-black/60 p-3 rounded-xl border border-white/5">
              {harmonics.map((h, i) => (
                <div key={h.n} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-mono text-gray-400 font-bold">
                    {Math.round(h.amplitude * 100)}%
                  </span>
                  <input
                    id={`quest-drawbar-${h.n}`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={h.amplitude}
                    onChange={(e) => {
                      const updated = harmonics.map((item, idx) =>
                        idx === i ? { ...item, amplitude: parseFloat(e.target.value) } : item
                      );
                      onUpdateHarmonics(updated);
                      audioEngine.setHarmonics(updated);
                    }}
                    className="h-24 w-1.5 appearance-none bg-black rounded-lg cursor-pointer accent-[#00ff9d] [writing-mode:vertical-lr] [direction:rtl]"
                  />
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{ color: h.n % 2 !== 0 ? '#00e5ff' : '#f59e0b' }}
                  >
                    {h.n}f
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mission Selector & Next Mission Control */}
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-[#00ff9d]" /> Fourier Architect Missions ({questATargetIndex + 1} of {questATargets.length})
              </span>
              <div className="flex items-center gap-2">
                {questATargetIndex < questATargets.length - 1 && (
                  <button
                    id="btn-next-mission"
                    onClick={() => {
                      setQuestATargetIndex((prev) => Math.min(questATargets.length - 1, prev + 1));
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00ff9d] text-black font-black text-xs uppercase tracking-wider hover:bg-[#00ff9d]/90 shadow-[0_0_10px_rgba(0,255,157,0.3)] transition-all"
                  >
                    Next Mission →
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {questATargets.map((t, idx) => {
                const isPassed = passedMissions[idx] || t.check(harmonics).passed;
                const isSelected = questATargetIndex === idx;
                return (
                  <button
                    key={t.id}
                    id={`btn-mission-${t.id}`}
                    onClick={() => {
                      setQuestATargetIndex(idx);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-[#00ff9d]/10 border-[#00ff9d]/50 shadow-[0_0_15px_rgba(0,255,157,0.15)] text-white'
                        : 'bg-black/60 border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono font-bold uppercase text-gray-400">
                        M{idx + 1} ({t.requiredThreshold}%)
                      </span>
                      {isPassed ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00ff9d] text-black flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[3]" /> Passed
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-gray-500 uppercase">
                          {isSelected ? 'Active' : 'Pending'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-tight text-white">
                      {idx === 0 ? '1f Fundamental' : idx === 1 ? '2nd Harmonic' : idx === 2 ? '3rd Harmonic' : idx === 3 ? '4th Harmonic' : '5th Harmonic'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          QUEST B UI: BLIND SPECTRUM DETECTIVE
      ======================================================== */}
      {activeQuest === 'b' && (
        <div className="bg-[#1a1d26] border border-white/5 rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-1 border border-red-500/30">
                <AlertCircle className="w-3.5 h-3.5" /> BLIND EAR & SPECTRUM TEST
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase">
                {mysteryQuestions[mysteryRound].name} (Round {mysteryRound + 1} of{' '}
                {mysteryQuestions.length})
              </h3>
            </div>

            <div className="bg-black/60 px-3.5 py-1.5 rounded-xl border border-white/5 font-mono text-xs">
              <span className="text-gray-500 uppercase tracking-widest text-[9px] mr-1">SCORE:</span>
              <span className="text-[#00e5ff] font-bold">
                {bScoreCount} / {mysteryQuestions.length} ({Math.round((bScoreCount / mysteryQuestions.length) * 100)}%)
              </span>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3 text-center">
            <p className="text-xs text-gray-400 font-mono">
              The oscilloscope above is scrambled! Listen to the mystery tone and inspect the
              frequency spectrum bar trace to identify the target timbre.
            </p>

            <button
              id="btn-play-mystery-sound"
              onClick={() =>
                playMystery(
                  mysteryQuestions[mysteryRound].waveform,
                  mysteryQuestions[mysteryRound].freq
                )
              }
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#00e5ff] text-black font-black text-xs uppercase tracking-wider hover:bg-[#00e5ff]/90 shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all"
            >
              <Play className="w-4 h-4 fill-black text-black" /> AUDITION MYSTERY TIMBRE
            </button>
          </div>

          {/* 4 Choices */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'sine', label: 'Sine Wave' },
              { id: 'triangle', label: 'Triangle Wave' },
              { id: 'square', label: 'Square Wave' },
              { id: 'sawtooth', label: 'Sawtooth Wave' },
            ].map((choice) => (
              <button
                key={choice.id}
                id={`btn-detective-choice-${choice.id}`}
                disabled={bUserChoice !== null}
                onClick={() => handleQuestBAnswer(choice.id as WaveformType)}
                className={`p-3.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                  bUserChoice === choice.id
                    ? choice.id === mysteryQuestions[mysteryRound].waveform
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-black/40 border-white/10 text-gray-300 hover:border-[#00e5ff] hover:text-[#00e5ff]'
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>

          {/* Feedback & Next Round */}
          {bFeedback && (
            <div className="p-4 bg-black/60 rounded-xl border border-white/5 space-y-3">
              <p className="text-xs text-gray-200 leading-relaxed font-mono">{bFeedback}</p>
              {mysteryRound < mysteryQuestions.length - 1 ? (
                <button
                  id="btn-next-mystery-round"
                  onClick={nextBRound}
                  className="px-5 py-2 rounded-lg bg-[#00e5ff] text-black text-xs font-black uppercase tracking-wider hover:bg-[#00e5ff]/90 shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                >
                  Next Mystery Round →
                </button>
              ) : (
                <div className="text-xs font-bold text-[#00ff9d] uppercase tracking-wider">
                  Detective Mission Complete! Score logged to Grade Report.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          QUEST C UI: HARMONIC MATH & RATIOS
      ======================================================== */}
      {activeQuest === 'c' && (
        <div className="bg-[#1a1d26] border border-white/5 rounded-xl p-6 shadow-xl space-y-6">
          <div className="border-b border-white/5 pb-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-1 border border-amber-400/30">
              <Award className="w-3.5 h-3.5" /> ACOUSTIC PHYSICS & RATIOS
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase">
              Harmonic Multiples & Math Calculations
            </h3>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">
              Test theoretical understanding of integer ratios: fₙ = n × f₀
            </p>
          </div>

          <div className="space-y-4">
            {cQuestions.map((q, qIndex) => {
              const selectedOpt = cAnswers[qIndex];
              const isAnswered = selectedOpt !== undefined;
              const isCorrect = isAnswered && selectedOpt === q.correct;

              return (
                <div
                  key={q.id}
                  className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Q{q.id}: {q.q}
                    </span>
                    {isAnswered && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isCorrect ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                        }`}
                      >
                        {isCorrect ? 'CORRECT' : 'INCORRECT'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIndex) => (
                      <button
                        key={optIndex}
                        id={`q${q.id}-opt-${optIndex}`}
                        onClick={() => handleCAnswer(qIndex, optIndex)}
                        className={`p-2.5 rounded-lg text-left text-xs font-mono transition-all ${
                          selectedOpt === optIndex
                            ? optIndex === q.correct
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500'
                              : 'bg-red-500/20 text-red-300 border border-red-500'
                            : 'bg-black/40 text-gray-300 border border-white/10 hover:border-white/30'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {isAnswered && (
                    <p className="text-[11px] text-gray-400 font-mono pt-1">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

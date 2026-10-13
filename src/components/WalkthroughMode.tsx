import React, { useState, useEffect } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { Harmonic, WaveformType } from '../types';
import { Volume2, Zap, Layers, Disc3, ArrowRight, ArrowLeft, CheckCircle2, VolumeX, Activity, Sparkles, Sliders } from 'lucide-react';

interface WalkthroughModeProps {
  onUpdateHarmonics: (harmonics: Harmonic[]) => void;
  onUpdateFundamental: (hz: number) => void;
  onStepChange?: (step: number) => void;
  onPhaseChange?: (deg: number) => void;
  onGoToPlayground?: () => void;
}

export const WalkthroughMode: React.FC<WalkthroughModeProps> = ({
  onUpdateHarmonics,
  onUpdateFundamental,
  onStepChange,
  onPhaseChange,
  onGoToPlayground,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  // Step 1 State: Amplitude
  const [step1Amp, setStep1Amp] = useState<number>(0.7);
  const [step1Interacted, setStep1Interacted] = useState<boolean>(false);

  // Step 2 State: Frequency
  const [step2Freq, setStep2Freq] = useState<number>(220); // A3
  const [step2Interacted, setStep2Interacted] = useState<boolean>(false);

  // Step 3 State: Harmonic Addition
  const [step3H1, setStep3H1] = useState<number>(1.0);
  const [step3H2, setStep3H2] = useState<number>(0.5);
  const [step3H3, setStep3H3] = useState<number>(0.3);
  const [step3Interacted, setStep3Interacted] = useState<boolean>(false);

  // Step 4 State: Wave Recipes
  const [selectedRecipe, setSelectedRecipe] = useState<WaveformType>('sine');
  const [step4Interacted, setStep4Interacted] = useState<boolean>(true); // preset active

  // Step 5 State: Phase & Cancellation (Degrees 0 to 180)
  const [step5PhaseDeg, setStep5PhaseDeg] = useState<number>(0);
  const [step5Interacted, setStep5Interacted] = useState<boolean>(false);

  useEffect(() => {
    onPhaseChange?.(step5PhaseDeg);
  }, [step5PhaseDeg, onPhaseChange]);

  // Audio Play state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Apply state to audio engine according to current step
  useEffect(() => {
    if (currentStep === 1) {
      onUpdateFundamental(220);
      audioEngine.setFundamental(220);
      const h: Harmonic[] = Array.from({ length: 10 }, (_, i) => ({
        n: i + 1,
        amplitude: i === 0 ? step1Amp : 0,
        phase: 0,
        muted: false,
        solo: false,
      }));
      onUpdateHarmonics(h);
      audioEngine.setHarmonics(h);
      audioEngine.setMasterVolume(step1Amp);
    } else if (currentStep === 2) {
      onUpdateFundamental(step2Freq);
      audioEngine.setFundamental(step2Freq);
      const h: Harmonic[] = Array.from({ length: 10 }, (_, i) => ({
        n: i + 1,
        amplitude: i === 0 ? 0.8 : 0,
        phase: 0,
        muted: false,
        solo: false,
      }));
      onUpdateHarmonics(h);
      audioEngine.setHarmonics(h);
      audioEngine.setMasterVolume(0.7);
    } else if (currentStep === 3) {
      onUpdateFundamental(130.81); // C3
      audioEngine.setFundamental(130.81);
      const h: Harmonic[] = Array.from({ length: 10 }, (_, i) => ({
        n: i + 1,
        amplitude: i === 0 ? step3H1 : i === 1 ? step3H2 : i === 2 ? step3H3 : 0,
        phase: 0,
        muted: false,
        solo: false,
      }));
      onUpdateHarmonics(h);
      audioEngine.setHarmonics(h);
      audioEngine.setMasterVolume(0.7);
    } else if (currentStep === 4) {
      onUpdateFundamental(130.81);
      audioEngine.setFundamental(130.81);
      const applied = audioEngine.playPresetFormula(selectedRecipe);
      if (applied) {
        onUpdateHarmonics(applied);
      }
    } else if (currentStep === 5) {
      onUpdateFundamental(220);
      audioEngine.setFundamental(220);
      const phiRad = (step5PhaseDeg * Math.PI) / 180;
      audioEngine.setPhaseInterference(0.5, phiRad);
      const h: Harmonic[] = [
        { n: 1, amplitude: 0.5, phase: 0, muted: false, solo: false },
        { n: 1, amplitude: 0.5, phase: phiRad, muted: false, solo: false },
        ...Array.from({ length: 8 }, (_, i) => ({ n: i + 3, amplitude: 0, phase: 0, muted: false, solo: false }))
      ];
      onUpdateHarmonics(h);
      audioEngine.setMasterVolume(0.7);
    }
  }, [currentStep, step1Amp, step2Freq, step3H1, step3H2, step3H3, selectedRecipe, step5PhaseDeg]);

  const toggleSound = () => {
    audioEngine.resume();
    const next = !isPlaying;
    setIsPlaying(next);
    audioEngine.setDrone(next);
  };

  // Check if current step's action has been taken
  const isStepCompleted = () => {
    switch (currentStep) {
      case 1:
        return step1Interacted;
      case 2:
        return step2Interacted;
      case 3:
        return step3Interacted;
      case 4:
        return step4Interacted;
      case 5:
        return step5Interacted;
      default:
        return true;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stepper Navigation */}
      <div className="flex flex-wrap items-center justify-between bg-[#1a1d26] border border-white/5 rounded-xl p-3.5 shadow-xl gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold">
            LEARN CHAPTER:
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00ff9d]/10 text-[#00ff9d] font-mono font-bold border border-[#00ff9d]/30">
            0{currentStep} / 05
          </span>
        </div>

        {/* Step Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-black/40 p-1 rounded-lg border border-white/10">
          {[
            { step: 1, title: '1. Displacement & Amplitude' },
            { step: 2, title: '2. Frequency & Pitch' },
            { step: 3, title: '3. Harmonic Addition' },
            { step: 4, title: '4. Waveform Recipes' },
            { step: 5, title: '5. Phase & Cancellation' },
          ].map((item) => (
            <button
              key={item.step}
              id={`step-nav-${item.step}`}
              onClick={() => setCurrentStep(item.step as any)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all tracking-wider shrink-0 ${
                currentStep === item.step
                  ? 'bg-[#2a2e3a] text-[#00ff9d] border border-white/10 shadow-sm'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Global Sound Play Toggle */}
        <button
          id="btn-walkthrough-drone"
          onClick={toggleSound}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            isPlaying
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
              : 'bg-[#00ff9d] text-black font-black hover:bg-[#00ff9d]/90 shadow-[0_0_15px_rgba(0,255,157,0.3)]'
          }`}
        >
          {isPlaying ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 fill-black text-black" />}
          {isPlaying ? 'MUTE AUDIO' : 'HEAR AUDIO'}
        </button>
      </div>

      {/* Chapter Content Card */}
      <div className="bg-[#1a1d26] border border-white/5 rounded-xl p-6 shadow-xl relative overflow-hidden space-y-6">
        {/* Step 1: Displacement & Amplitude */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#00ff9d]/10 text-[#00ff9d] text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-[#00ff9d]/30">
                <Volume2 className="w-3.5 h-3.5" /> PRINCIPLE 1: SOUND AS MOLECULAR DISPLACEMENT
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight uppercase">
                Displacement & Amplitude (Loudness)
              </h3>
              <p className="text-gray-300 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                Sound is physical pressure. When an instrument vibrates, it pushes air molecules back
                and forth. The vertical height of a waveform on the oscilloscope represents{' '}
                <strong className="text-[#00ff9d]">amplitude (displacement)</strong>: how far the
                molecules are pushed from their rest position. Greater displacement translates
                directly to greater acoustic volume.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="lg:col-span-2 space-y-4 bg-black/60 p-5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-step1-amp" className="text-xs font-mono text-gray-300 uppercase tracking-wider font-bold">
                    Wave Amplitude (Displacement Level):
                  </label>
                  <span className="text-base font-mono font-bold text-[#00ff9d]">
                    {Math.round(step1Amp * 100)}% ({step1Amp.toFixed(2)} V)
                  </span>
                </div>

                <input
                  id="input-step1-amp"
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.01"
                  value={step1Amp}
                  onChange={(e) => {
                    setStep1Amp(parseFloat(e.target.value));
                    setStep1Interacted(true);
                  }}
                  className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-[#00ff9d]"
                />

                <div className="flex justify-between text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                  <span>Quiet Whisper (0.05)</span>
                  <span>Moderate (0.50)</span>
                  <span>Full Loudness (1.00)</span>
                </div>
              </div>

              {/* Editorial takeaway card */}
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> Required Action:
                </div>
                <p className="text-gray-400 leading-relaxed font-mono">
                  {step1Interacted ? (
                    <span className="text-[#00ff9d]">✓ Slider adjusted! You may now proceed to Chapter 2.</span>
                  ) : (
                    <span className="text-amber-400">⚠️ Please adjust the amplitude slider above to test displacement before continuing.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Frequency & Pitch */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-[#00e5ff]/30">
                <Zap className="w-3.5 h-3.5" /> PRINCIPLE 2: CYCLE SPEED & FREQUENCY
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight uppercase">
                Frequency & Pitch (Hertz / Speed of Cycles)
              </h3>
              <p className="text-gray-300 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                Frequency is measured in <strong className="text-[#00e5ff]">Hertz (Hz)</strong>,
                which indicates how many complete vibration cycles occur in a single second. Fast
                vibrations create high pitch (compressing waves on screen); slower vibrations create
                low bass pitch (expanding waves across the screen). The period is calculated as{' '}
                <code className="text-[#00e5ff] font-mono">T = 1 / f</code>.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="lg:col-span-2 space-y-4 bg-black/60 p-5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-step2-freq" className="text-xs font-mono text-gray-300 uppercase tracking-wider font-bold">
                    Cycle Speed (Fundamental Frequency):
                  </label>
                  <span className="text-base font-mono font-bold text-[#00e5ff]">
                    {Math.round(step2Freq)} Hz (
                    {step2Freq === 110
                      ? 'A2'
                      : step2Freq === 220
                      ? 'A3'
                      : step2Freq === 440
                      ? 'A4'
                      : step2Freq === 880
                      ? 'A5'
                      : 'Variable'}
                    )
                  </span>
                </div>

                <input
                  id="input-step2-freq"
                  type="range"
                  min="65"
                  max="880"
                  step="1"
                  value={step2Freq}
                  onChange={(e) => {
                    setStep2Freq(parseFloat(e.target.value));
                    setStep2Interacted(true);
                  }}
                  className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
                />

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Bass 110 Hz (A2)', hz: 110 },
                    { label: 'Mid 220 Hz (A3)', hz: 220 },
                    { label: 'Standard 440 Hz (A4)', hz: 440 },
                    { label: 'High 880 Hz (A5)', hz: 880 },
                  ].map((preset) => (
                    <button
                      key={preset.hz}
                      id={`btn-preset-freq-${preset.hz}`}
                      onClick={() => {
                        setStep2Freq(preset.hz);
                        setStep2Interacted(true);
                      }}
                      className={`px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wider border transition-all ${
                        step2Freq === preset.hz
                          ? 'bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/50 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                          : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#00e5ff]" /> Required Action:
                </div>
                <p className="text-gray-400 leading-relaxed font-mono">
                  {step2Interacted ? (
                    <span className="text-[#00e5ff]">✓ Frequency adjusted! You may now proceed to Chapter 3.</span>
                  ) : (
                    <span className="text-amber-400">⚠️ Please adjust the frequency slider or select a preset pitch to continue.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Harmonic Addition */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
                <Layers className="w-3.5 h-3.5" /> PRINCIPLE 3: FOURIER ADDITION & INTERFERENCE
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight uppercase">
                Harmonic Addition (Constructive & Destructive Interference)
              </h3>
              <p className="text-gray-300 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                Jean-Baptiste Fourier discovered that <em>any complex periodic wave</em> can be
                constructed by adding pure sine waves at integer multiples ($1f, 2f, 3f...$). When
                the peaks of two waves meet, their amplitudes add together (
                <strong className="text-[#00ff9d]">constructive interference</strong>). When a
                peak meets a trough, they cancel each other out (
                <strong className="text-red-400">destructive interference</strong>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Harmonic 1: Fundamental */}
              <div className="bg-black/60 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-[#00ff9d]">1f Fundamental (131 Hz)</span>
                  <span className="font-mono text-white font-bold">{Math.round(step3H1 * 100)}%</span>
                </div>
                <input
                  id="input-step3-h1"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={step3H1}
                  onChange={(e) => {
                    setStep3H1(parseFloat(e.target.value));
                    setStep3Interacted(true);
                  }}
                  className="w-full h-2 bg-black rounded accent-[#00ff9d]"
                />
                <p className="text-[11px] text-gray-400 font-mono">The root musical pitch you recognize.</p>
              </div>

              {/* Harmonic 2: 2nd Harmonic */}
              <div className="bg-black/60 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-amber-400">2f (1 Octave Up, 262 Hz)</span>
                  <span className="font-mono text-white font-bold">{Math.round(step3H2 * 100)}%</span>
                </div>
                <input
                  id="input-step3-h2"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={step3H2}
                  onChange={(e) => {
                    setStep3H2(parseFloat(e.target.value));
                    setStep3Interacted(true);
                  }}
                  className="w-full h-2 bg-black rounded accent-amber-400"
                />
                <p className="text-[11px] text-gray-400 font-mono">Adds an octave overtone, rippling the shape.</p>
              </div>

              {/* Harmonic 3: 3rd Harmonic */}
              <div className="bg-black/60 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-[#00e5ff]">3f (Octave+5th, 393 Hz)</span>
                  <span className="font-mono text-white font-bold">{Math.round(step3H3 * 100)}%</span>
                </div>
                <input
                  id="input-step3-h3"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={step3H3}
                  onChange={(e) => {
                    setStep3H3(parseFloat(e.target.value));
                    setStep3Interacted(true);
                  }}
                  className="w-full h-2 bg-black rounded accent-[#00e5ff]"
                />
                <p className="text-[11px] text-gray-400 font-mono">Adds a twelfth interval, steepening the slopes.</p>
              </div>
            </div>

            <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs flex items-center justify-between">
              <span className="text-gray-400 font-mono">Required Action: Adjust at least one harmonic dial above.</span>
              {step3Interacted ? (
                <span className="text-[#00ff9d] font-bold font-mono">✓ Harmonics explored!</span>
              ) : (
                <span className="text-amber-400 font-bold font-mono">⚠️ Pending adjustment</span>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Waveform Recipes */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-400/10 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-purple-400/30">
                <Disc3 className="w-3.5 h-3.5" /> PRINCIPLE 4: THE FOUR CLASSIC WAVE RECIPES
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight uppercase">
                Odd vs. All Harmonics (Synthesis Recipes)
              </h3>
              <p className="text-gray-300 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                Every classic synth sound has a precise harmonic recipe. Notice how waves with{' '}
                <strong className="text-[#00e5ff]">Odd Harmonics Only</strong> (Square & Triangle)
                sound hollow or clarinet-like, while waves with{' '}
                <strong className="text-amber-400">All Harmonics</strong> (Sawtooth) sound buzzy,
                brassy, and bright!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  id: 'sine',
                  name: 'Sine Wave',
                  rule: '1f only (Zero Overtones)',
                  drop: 'No harmonics',
                  timbre: 'Pure, hollow, peaceful (Flute, Sub-bass)',
                  color: '#00ff9d',
                },
                {
                  id: 'triangle',
                  name: 'Triangle Wave',
                  rule: 'Odd Harmonics Only (1, 3, 5...)',
                  drop: 'Rapid falloff: 1 / n²',
                  timbre: 'Mellow, warm, gentle (Electric piano, recorder)',
                  color: '#38bdf8',
                },
                {
                  id: 'square',
                  name: 'Square Wave',
                  rule: 'Odd Harmonics Only (1, 3, 5...)',
                  drop: 'Slow falloff: 1 / n',
                  timbre: 'Hollow, woody, reedy (Clarinet, 8-bit chiptune)',
                  color: '#a855f7',
                },
                {
                  id: 'sawtooth',
                  name: 'Sawtooth Wave',
                  rule: 'All Harmonics (1, 2, 3, 4...)',
                  drop: 'Linear falloff: 1 / n',
                  timbre: 'Buzzy, bright, aggressive (Violin, brass horn, synth lead)',
                  color: '#f59e0b',
                },
              ].map((recipe) => (
                <div
                  key={recipe.id}
                  id={`card-recipe-${recipe.id}`}
                  onClick={() => {
                    setSelectedRecipe(recipe.id as WaveformType);
                    setStep4Interacted(true);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedRecipe === recipe.id
                      ? 'bg-black/60 border-[#00ff9d] shadow-[0_0_15px_rgba(0,255,157,0.15)] ring-1 ring-[#00ff9d]'
                      : 'bg-black/40 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white uppercase tracking-wider">{recipe.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: recipe.color }}
                    ></span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <p className="text-[#00ff9d] text-[11px] font-bold">{recipe.rule}</p>
                    <p className="text-gray-400 text-[10px]">{recipe.drop}</p>
                    <p className="text-gray-300 text-[11px] pt-1 font-sans">{recipe.timbre}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Phase & Wave Cancellation */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-400/10 text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-red-400/30">
                <Activity className="w-3.5 h-3.5" /> PRINCIPLE 5: PHASE & WAVE CANCELLATION
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight uppercase">
                Constructive vs. Destructive Interference
              </h3>
              <p className="text-gray-300 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                When two waves of identical frequency combine, their relative alignment (<strong className="text-[#00ff9d]">Phase</strong>) determines their sum. At <strong className="text-[#00ff9d]">0°</strong> (In-Phase), peaks meet peaks, doubling the volume (constructive interference). At <strong className="text-red-400">180°</strong> (Out-of-Phase), peaks meet troughs and completely cancel each other out to absolute silence!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="bg-black/60 p-5 rounded-xl border border-white/5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-gray-300">WAVE 2 PHASE SHIFT:</span>
                  <span className="font-mono text-[#00ff9d] font-bold text-sm">{step5PhaseDeg}°</span>
                </div>
                <input
                  id="input-step5-phase"
                  type="range"
                  min="0"
                  max="180"
                  step="5"
                  value={step5PhaseDeg}
                  onChange={(e) => {
                    setStep5PhaseDeg(parseInt(e.target.value));
                    setStep5Interacted(true);
                  }}
                  className="w-full h-2 bg-black rounded accent-[#00ff9d]"
                />

                <div className="grid grid-cols-5 gap-2 pt-2">
                  {[
                    { deg: 0, label: '0° (In-Phase)' },
                    { deg: 45, label: '45°' },
                    { deg: 90, label: '90°' },
                    { deg: 135, label: '135°' },
                    { deg: 180, label: '180° (Cancel)' },
                  ].map((preset) => (
                    <button
                      key={preset.deg}
                      id={`btn-phase-preset-${preset.deg}`}
                      onClick={() => {
                        setStep5PhaseDeg(preset.deg);
                        setStep5Interacted(true);
                      }}
                      className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold uppercase transition-all ${
                        step5PhaseDeg === preset.deg
                          ? 'bg-[#00ff9d] text-black shadow-[0_0_10px_rgba(0,255,157,0.3)]'
                          : 'bg-black/40 text-gray-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> Required Action:
                </div>
                <p className="text-gray-400 leading-relaxed font-mono">
                  {step5Interacted ? (
                    <span className="text-[#00ff9d]">✓ Phase shift tested! You have completed all Learn chapters.</span>
                  ) : (
                    <span className="text-amber-400">⚠️ Please adjust the phase shift dial or preset to test wave cancellation.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step Navigation Controls */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/5">
          <button
            id="btn-walkthrough-prev"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-black/40 border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Previous Chapter
          </button>

          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest hidden sm:inline">
            {isStepCompleted() ? '✓ Chapter Action Completed' : '⚠️ Action Required on Sliders to Continue'}
          </span>

          {currentStep < 5 ? (
            <button
              id="btn-walkthrough-next"
              disabled={!isStepCompleted()}
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1) as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-[#00ff9d] text-black hover:bg-[#00ff9d]/90 shadow-[0_0_15px_rgba(0,255,157,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next Chapter <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="btn-walkthrough-playground"
              disabled={!isStepCompleted()}
              onClick={() => onGoToPlayground?.()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[#00e5ff] text-black hover:bg-[#00e5ff]/90 shadow-[0_0_15px_rgba(0,229,255,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all animate-pulse"
            >
              <Sliders className="w-4 h-4" /> Go to Playground <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

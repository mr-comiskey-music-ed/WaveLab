import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { Harmonic } from '../types';

interface VisualizerPanelProps {
  isScrambled?: boolean;
  harmonics: Harmonic[];
  fundamentalHz: number;
  isWalkthroughStep2?: boolean;
  isWalkthroughStep5?: boolean;
  walkthroughPhase?: number;
}

export const VisualizerPanel: React.FC<VisualizerPanelProps> = ({
  isScrambled = false,
  harmonics,
  fundamentalHz,
  isWalkthroughStep2 = false,
  isWalkthroughStep5 = false,
  walkthroughPhase = 0,
}) => {
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const timebase = 2; // Fixed default timebase

  useEffect(() => {
    let isRunning = true;
    const timeBuffer = new Float32Array(2048);

    const render = () => {
      if (!isRunning) return;

      const analyser = audioEngine.getAnalyser();

      // ==========================================
      // 1. RENDER OSCILLOSCOPE (Time Domain)
      // ==========================================
      const scopeCanvas = scopeCanvasRef.current;
      if (scopeCanvas) {
        const ctx = scopeCanvas.getContext('2d');
        if (ctx) {
          const width = scopeCanvas.width;
          const height = scopeCanvas.height;

          // Clear with slight dark fade for phosphor trail (Sleek black CRT)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // Draw CRT Oscilloscope Grid
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#141820';
          const gridCols = 10;
          const gridRows = 8;
          for (let x = 0; x <= width; x += width / gridCols) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y <= height; y += height / gridRows) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Center axes
          ctx.strokeStyle = '#222838';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.moveTo(width / 2, 0);
          ctx.lineTo(width / 2, height);
          ctx.stroke();
          ctx.setLineDash([]);

          if (isScrambled) {
            // SCRAMBLE MODE: Draw CRT static noise + Top Secret Stamp
            ctx.fillStyle = '#00ff9d';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';

            // Static noise dots
            for (let i = 0; i < 400; i++) {
              const rx = Math.random() * width;
              const ry = Math.random() * height;
              const size = Math.random() * 2 + 1;
              ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 255, 157, 0.4)' : 'rgba(0, 229, 255, 0.3)';
              ctx.fillRect(rx, ry, size, size);
            }

            // Red warning box
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            const boxW = Math.min(260, width - 40);
            const boxH = 64;
            const bx = (width - boxW) / 2;
            const by = (height - boxH) / 2;
            ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeRect(bx, by, boxW, boxH);

            ctx.fillStyle = '#ef4444';
            ctx.fillText('CLASSIFIED SIGNAL', width / 2, height / 2 - 4);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px sans-serif';
            ctx.fillText('OSCILLOSCOPE BLIND TEST', width / 2, height / 2 + 16);
          } else if (isWalkthroughStep5) {
            // Draw Wave 1 (Cyan), Wave 2 (Amber), and Combined Resultant (Green)
            const cycles = timebase;
            const phi = walkthroughPhase !== undefined ? walkthroughPhase : 0;

            // Wave 1
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x < width; x++) {
              const t = (x / width) * cycles * 2 * Math.PI;
              const y = height / 2 - 0.5 * Math.sin(t) * (height * 0.35);
              if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Wave 2 (Phase Shifted)
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x < width; x++) {
              const t = (x / width) * cycles * 2 * Math.PI;
              const y = height / 2 - 0.5 * Math.sin(t + phi) * (height * 0.35);
              if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Combined Resultant (Sum)
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ff9d';
            ctx.strokeStyle = '#00ff9d';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let x = 0; x < width; x++) {
              const t = (x / width) * cycles * 2 * Math.PI;
              const ySum = 0.5 * Math.sin(t) + 0.5 * Math.sin(t + phi);
              const y = height / 2 - ySum * (height * 0.35);
              if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else if (analyser) {
            analyser.getFloatTimeDomainData(timeBuffer);

            // Oscilloscope Triggering: find zero-crossing with positive slope
            let triggerIndex = 0;
            for (let i = 0; i < timeBuffer.length - 1; i++) {
              if (timeBuffer[i] < 0 && timeBuffer[i + 1] >= 0) {
                triggerIndex = i;
                break;
              }
            }

            // Determine sample window based on fundamental frequency & timebase
            const sampleRate = analyser.context.sampleRate;
            const fixedWindowSamples = Math.floor((sampleRate / 110) * timebase);
            const cycleSamples = Math.max(16, Math.floor(sampleRate / (fundamentalHz || 130.81)));
            const samplesToRender = isWalkthroughStep2
              ? Math.min(fixedWindowSamples, timeBuffer.length - triggerIndex)
              : Math.min(cycleSamples * timebase, timeBuffer.length - triggerIndex);

            // Draw Phosphor Waveform
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00ff9d';
            ctx.strokeStyle = '#00ff9d';
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();

            for (let i = 0; i < samplesToRender; i++) {
              const sampleVal = timeBuffer[triggerIndex + i] || 0;
              const x = (i / samplesToRender) * width;
              const y = height / 2 - sampleVal * (height * 0.42);

              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // reset glow
          } else {
            // Theoretical fallback curve if audio context not running yet
            ctx.strokeStyle = '#00ff9d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const cycles = isWalkthroughStep2 ? (fundamentalHz / 110) * timebase : timebase;
            for (let x = 0; x < width; x++) {
              const t = (x / width) * cycles * 2 * Math.PI;
              let ySum = 0;
              harmonics.forEach((h) => {
                if (!h.muted) {
                  ySum += h.amplitude * Math.sin(h.n * t + h.phase);
                }
              });
              const y = height / 2 - ySum * (height * 0.22);
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }

      // ==========================================
      // 2. RENDER HARMONIC SPECTRUM & FFT
      // ==========================================
      const specCanvas = spectrumCanvasRef.current;
      if (specCanvas) {
        const ctx = specCanvas.getContext('2d');
        if (ctx) {
          const width = specCanvas.width;
          const height = specCanvas.height;

          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // Background Frequency Grid
          ctx.strokeStyle = '#141820';
          ctx.lineWidth = 1;
          for (let y = 0; y <= height; y += height / 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Center axis
          ctx.strokeStyle = '#222838';
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(width, height);
          ctx.stroke();

          if (isScrambled) {
            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';

            for (let i = 0; i < 300; i++) {
              const rx = Math.random() * width;
              const ry = Math.random() * height;
              const size = Math.random() * 2 + 1;
              ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 229, 255, 0.4)' : 'rgba(245, 158, 11, 0.3)';
              ctx.fillRect(rx, ry, size, size);
            }

            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            const boxW = Math.min(260, width - 40);
            const boxH = 64;
            const bx = (width - boxW) / 2;
            const by = (height - boxH) / 2;
            ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeRect(bx, by, boxW, boxH);

            ctx.fillStyle = '#ef4444';
            ctx.fillText('FOURIER DECONVOLUTION', width / 2, height / 2 - 4);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px sans-serif';
            ctx.fillText('SPECTRUM ENCRYPTION ACTIVE', width / 2, height / 2 + 16);
          } else {
            // Draw harmonic bars (1 to 10)
            const barWidth = width / 12;
            harmonics.forEach((h, index) => {
              const x = (index + 1) * (width / 11);
              const barH = h.muted ? 0 : h.amplitude * (height * 0.75);
              const y = height - barH;

              // Color based on odd/even harmonic
              const isOdd = h.n % 2 !== 0;
              const barColor = isOdd ? '#00e5ff' : '#f59e0b';

              ctx.shadowBlur = h.amplitude > 0.1 ? 10 : 0;
              ctx.shadowColor = barColor;
              ctx.fillStyle = barColor;

              // Draw vertical bar with rounded top
              ctx.fillRect(x - barWidth / 3, y, (barWidth * 2) / 3, barH);

              // Harmonic label
              ctx.fillStyle = '#94a3b8';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(`${h.n}f`, x, height - 6);
              ctx.shadowBlur = 0;
            });
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isScrambled, harmonics, fundamentalHz]);

  return (
    <div id="visualizer-container" className="bg-[#1a1d26] border border-white/5 rounded-xl p-3 shadow-xl space-y-2">
      {/* Visualizer Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse"></span>
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-white">
              DUAL REAL-TIME INSTRUMENTATION
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-[#00ff9d] font-mono border border-white/5">
            f₀: {Math.round(fundamentalHz)} Hz
          </span>
        </div>
      </div>

      {/* Dual Canvases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Oscilloscope Panel */}
        <div className="flex flex-col bg-black rounded-xl border border-white/5 p-2.5 relative overflow-hidden group">
          {/* Dot grid texture */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#00ff9d 0.5px, transparent 0.5px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="flex items-center justify-between mb-1.5 z-10 relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold text-[#00ff9d] uppercase tracking-wider">
                OSCILLOSCOPE (TIME)
              </span>
            </div>
            <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
              {isScrambled ? 'SIGNAL MASKED' : 'VECTOR PHOSPHOR TRACE'}
            </span>
          </div>

          <div className="relative w-full aspect-[16/9] max-h-[180px] bg-black rounded-lg overflow-hidden border border-white/5">
            <canvas
              ref={scopeCanvasRef}
              width={640}
              height={320}
              className="w-full h-full block drop-shadow-[0_0_5px_#00ff9d]"
            />
          </div>
        </div>

        {/* Spectrum Analyzer Panel */}
        <div className="flex flex-col bg-black rounded-xl border border-white/5 p-2.5 relative overflow-hidden group">
          {/* Dot grid texture */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#00e5ff 0.5px, transparent 0.5px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="flex items-center justify-between mb-1.5 z-10 relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold text-[#00e5ff] uppercase tracking-wider">
                SPECTRUM (FREQ)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-[#00e5ff]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]"></span> Odd
              </span>
              <span className="flex items-center gap-1 text-[#f59e0b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span> Even
              </span>
            </div>
          </div>

          <div className="relative w-full aspect-[16/9] max-h-[180px] bg-black rounded-lg overflow-hidden border border-white/5">
            <canvas
              ref={spectrumCanvasRef}
              width={640}
              height={320}
              className="w-full h-full block drop-shadow-[0_0_5px_#00e5ff]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

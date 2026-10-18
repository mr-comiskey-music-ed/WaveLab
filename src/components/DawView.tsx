import { useEffect, useRef } from 'react';

export interface DawLane {
  name: string;
  color: string;
  /** When this mic's copy of the drum hit starts, in ms. */
  startMs: number;
  /** Polarity flipped (wave upside down). */
  flip?: boolean;
}

export const DRUM_HZ = 200; // a snare's main tone

/** One note or hit as one mic hears it: a quick attack and a ring that fades. */
export function hit(tSec: number, freq = DRUM_HZ, decayMs = 9) {
  if (tSec < 0) return 0;
  const env = (1 - Math.exp(-tSec / 0.0006)) * Math.exp(-tSec / (decayMs / 1000));
  return env * Math.sin(2 * Math.PI * freq * tSec);
}

const C = { bg: '#f4f6fa', lane: '#ffffff', grid: '#e3e8f0', text: '#4a5874', ink: '#17233a' };

function resolve(c: string) {
  const m = c.match(/^var\((--[\w-]+)\)$/);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#17233a' : c;
}

/**
 * A simple DAW-style view: each mic is a track with an audio region,
 * plus a mix track showing what you hear when they're added together.
 */
export function DawView({ lanes, windowMs = 20, label, freq = DRUM_HZ, decayMs = 9 }: { lanes: DawLane[]; windowMs?: number; label: string; freq?: number; decayMs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const LANE_H = 58;
  const RULER = 20;
  const NAME_W = 92;
  const H = RULER + LANE_H * (lanes.length + 1) + 4;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      const plotW = W - NAME_W - 6;
      const xOf = (ms: number) => NAME_W + (ms / windowMs) * plotW;
      ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';

      // ruler
      ctx.fillStyle = C.text;
      ctx.textBaseline = 'middle';
      ctx.fillText('time', 8, RULER / 2);
      const tick = windowMs > 30 ? 5 : 2;
      for (let ms = 0; ms <= windowMs; ms += tick) {
        const x = Math.round(xOf(ms)) + 0.5;
        ctx.strokeStyle = C.grid;
        ctx.beginPath();
        ctx.moveTo(x, RULER);
        ctx.lineTo(x, H);
        ctx.stroke();
        if (ms % (tick * 2) === 0) {
          const t = `${ms} ms`;
          const tw = ctx.measureText(t).width;
          ctx.fillText(t, Math.min(x - tw / 2, W - tw - 2), RULER / 2);
        }
      }

      const all: (DawLane & { mix?: boolean })[] = [...lanes, { name: 'Mix (what you hear)', color: C.ink, startMs: 0, mix: true }];
      all.forEach((lane, i) => {
        const top = RULER + i * LANE_H + 2;
        const mid = top + LANE_H / 2 - 2;
        const amp = (LANE_H / 2 - 8) / (lane.mix ? 2 : 1.15);
        // lane background + name
        ctx.fillStyle = C.lane;
        ctx.fillRect(NAME_W, top, plotW, LANE_H - 4);
        ctx.fillStyle = lane.mix ? C.ink : resolve(lane.color);
        ctx.font = 'bold 12px "Atkinson Hyperlegible", system-ui, sans-serif';
        const words = lane.name.split(' ');
        const firstLine = words.slice(0, 2).join(' ');
        const rest = words.slice(2).join(' ');
        ctx.fillText(firstLine, 8, mid - (rest ? 8 : 0));
        if (rest) {
          ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
          ctx.fillText(rest, 8, mid + 8);
        }
        ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';

        // audio region box
        if (!lane.mix) {
          const x0 = Math.max(NAME_W, xOf(lane.startMs - 1));
          const color = resolve(lane.color);
          ctx.fillStyle = color + '22';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(x0, top + 3, NAME_W + plotW - x0 - 2, LANE_H - 10, 5);
          ctx.fill();
          ctx.stroke();
          if (lane.flip) {
            ctx.fillStyle = color;
            ctx.fillText('Ø flipped', Math.min(x0 + 6, NAME_W + plotW - 70), top + 14);
          }
        }
        // centre line
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(NAME_W, Math.round(mid) + 0.5);
        ctx.lineTo(NAME_W + plotW, Math.round(mid) + 0.5);
        ctx.stroke();
        // wave
        ctx.strokeStyle = lane.mix ? C.ink : resolve(lane.color);
        ctx.lineWidth = lane.mix ? 2.4 : 2;
        ctx.beginPath();
        const steps = Math.round(plotW * 1.5);
        for (let k = 0; k <= steps; k++) {
          const ms = (k / steps) * windowMs;
          const v = lane.mix
            ? lanes.reduce((sum, l) => sum + (l.flip ? -1 : 1) * hit((ms - l.startMs) / 1000, freq, decayMs), 0)
            : (lane.flip ? -1 : 1) * hit((ms - lane.startMs) / 1000, freq, decayMs);
          const x = xOf(ms);
          const y = mid - v * amp;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [lanes, windowMs, H, freq, decayMs]);

  return <canvas ref={ref} className="daw" style={{ height: H }} role="img" aria-label={label} />;
}

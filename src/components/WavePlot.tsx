import { useEffect, useRef } from 'react';

export interface Trace {
  /** Value at time t (seconds). Roughly -1..1. */
  fn: (t: number) => number;
  color: string;
  width?: number;
  dashed?: boolean;
}

interface Props {
  traces: Trace[];
  /** Seconds shown across the graph. */
  duration: number;
  yMax?: number;
  height?: number;
  /** Show millisecond labels along the bottom. */
  timeAxis?: boolean;
  /** Show displacement numbers (−1 … 1) up the left side. */
  yLabels?: boolean;
  markers?: { t: number; color: string }[];
  /** If given, a vertical line follows ref.current (0..1 across) every frame. */
  playheadRef?: React.MutableRefObject<number | null>;
  label: string;
  tag?: string;
}

const C = {
  paper: '#ffffff',
  minor: '#e6ebf3',
  major: '#cdd6e4',
  axis: '#8f9cb3',
  text: '#5b6880',
};

/** Canvas can't read CSS variables, so look them up. */
function resolveColor(c: string) {
  const m = c.match(/^var\((--[\w-]+)\)$/);
  if (!m) return c;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#17233a';
}

function niceStep(ms: number) {
  const target = ms / 5;
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  return steps.find((s) => s >= target) ?? 1000;
}

export function WavePlot({ traces, duration, yMax = 1.15, height = 170, timeAxis, yLabels, markers, playheadRef, label, tag }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ traces, duration, yMax, timeAxis, yLabels, markers });
  propsRef.current = { traces, duration, yMax, timeAxis, yLabels, markers };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0;

    const draw = () => {
      const { traces, duration, yMax, timeAxis, yLabels, markers } = propsRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      if (cssW !== w || canvas.height !== Math.round(height * dpr)) {
        w = cssW;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const H = height;
      const bottom = timeAxis ? 22 : 0;
      const plotH = H - bottom;
      const mid = plotH / 2;
      ctx.fillStyle = C.paper;
      ctx.fillRect(0, 0, cssW, H);

      // graph paper
      const cell = 12;
      ctx.lineWidth = 1;
      for (let x = 0.5, i = 0; x < cssW; x += cell, i++) {
        ctx.strokeStyle = i % 5 === 0 ? C.major : C.minor;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
        ctx.stroke();
      }
      for (let k = 0; mid + k * cell < plotH; k++) {
        for (const y of k === 0 ? [mid] : [mid - k * cell, mid + k * cell]) {
          ctx.strokeStyle = k % 5 === 0 ? C.major : C.minor;
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(cssW, Math.round(y) + 0.5);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = C.axis;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(mid) + 0.5);
      ctx.lineTo(cssW, Math.round(mid) + 0.5);
      ctx.stroke();

      if (timeAxis) {
        const inSeconds = duration >= 0.5;
        const ms = inSeconds ? duration : duration * 1000;
        const step = inSeconds ? (duration > 2 ? 0.5 : 0.25) : niceStep(ms);
        ctx.fillStyle = C.text;
        ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
        ctx.textBaseline = 'top';
        for (let v = 0; v <= ms + 1e-6; v += step) {
          const x = (v / ms) * (cssW - 1);
          ctx.strokeStyle = C.axis;
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, plotH);
          ctx.lineTo(Math.round(x) + 0.5, plotH + 5);
          ctx.stroke();
          const text = `${Number(v.toFixed(2))} ${inSeconds ? 's' : 'ms'}`;
          const tw = ctx.measureText(text).width;
          ctx.fillText(text, Math.min(Math.max(0, x - tw / 2), cssW - tw), plotH + 7);
        }
      }

      const scaleY = (plotH / 2 - 6) / yMax;
      for (const tr of traces) {
        ctx.strokeStyle = resolveColor(tr.color);
        ctx.lineWidth = tr.width ?? 2.5;
        ctx.lineJoin = 'round';
        ctx.setLineDash(tr.dashed ? [6, 5] : []);
        ctx.beginPath();
        const steps = Math.max(200, Math.round(cssW * 1.5));
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * cssW;
          const y = mid - tr.fn((i / steps) * duration) * scaleY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      if (yLabels) {
        ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        for (const v of [1, 0.5, 0, -0.5, -1]) {
          const y = mid - v * scaleY;
          const text = v === 0 ? '0' : v.toString();
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(2, y - 8, tw + 8, 16);
          ctx.textAlign = 'left';
          ctx.fillStyle = C.text;
          ctx.fillText(text, 6, y);
        }
      }

      for (const m of markers ?? []) {
        const x = (m.t / duration) * cssW;
        const y = mid - (traces[0]?.fn(m.t) ?? 0) * scaleY;
        ctx.strokeStyle = resolveColor(m.color);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = resolveColor(m.color);
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const ph = playheadRef?.current;
      if (ph != null) {
        const x = ph * cssW;
        ctx.strokeStyle = '#17233a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
        ctx.stroke();
        const y = mid - (traces[0]?.fn(ph * duration) ?? 0) * scaleY;
        ctx.fillStyle = resolveColor(traces[0]?.color ?? '#17233a');
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    if (playheadRef) loop();
    else draw();

    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [traces, duration, yMax, height, timeAxis, yLabels, markers, playheadRef]);

  return (
    <figure className="plot">
      {tag && <span className="plot-tag">{tag}</span>}
      <canvas ref={canvasRef} style={{ height }} role="img" aria-label={label} />
    </figure>
  );
}

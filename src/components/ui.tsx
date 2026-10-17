import { ReactNode, useEffect, useRef, useState } from 'react';
import { StationResult } from '../lib/stations';

/** Steps through a fixed set of rounds; reports scores once when all are done. */
export function useRounds(total: number, done: StationResult | undefined, onComplete: (r: StationResult) => void) {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const reported = useRef(!!done);
  const current = scores[index] ?? null;
  const finished = !!done || scores.length === total;

  const answer = (score: number) => {
    if (scores[index] !== undefined || done) return;
    const next = [...scores];
    next[index] = Math.max(0, Math.min(100, Math.round(score)));
    setScores(next);
    if (next.length === total && !reported.current) {
      reported.current = true;
      onComplete({ rounds: next });
    }
  };
  const next = () => setIndex((i) => Math.min(total - 1, i + 1));
  return { index, current, answered: current !== null, answer, next, finished, scores: done?.rounds ?? scores, isLast: index === total - 1 };
}

export function StationHeader({ title, pudding, goal }: { title: string; pudding: string; goal: string }) {
  return (
    <header className="station-head">
      <h2>{title}</h2>
      <p className="goal">{goal}</p>
      <p className="read-first">
        Read first in The Pudding: <strong>{pudding}</strong>
      </p>
    </header>
  );
}

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {note && <p className="panel-note">{note}</p>}
      {children}
    </section>
  );
}

export function RoundBar({ index, total, scores }: { index: number; total: number; scores: number[] }) {
  return (
    <div className="round-bar" aria-label={`Round ${index + 1} of ${total}`}>
      <span>
        Round {index + 1} of {total}
      </span>
      <ol>
        {Array.from({ length: total }, (_, i) => {
          const s = scores[i];
          const cls = s === undefined ? (i === index ? 'now' : '') : s >= 70 ? 'good' : s > 0 ? 'part' : 'miss';
          return <li key={i} className={cls} />;
        })}
      </ol>
    </div>
  );
}

export interface ChoiceOption {
  id: string;
  label: ReactNode;
}

/** One-try multiple choice. The right answer is revealed after picking. */
export function Choices({
  options,
  correct,
  picked,
  onPick,
  columns = 2,
}: {
  options: ChoiceOption[];
  correct: string;
  picked: string | null;
  onPick: (id: string) => void;
  columns?: number;
}) {
  return (
    <div className="choices" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        let cls = 'choice';
        if (picked) {
          if (o.id === correct) cls += ' right';
          else if (o.id === picked) cls += ' wrong';
          else cls += ' dim';
        }
        return (
          <button key={o.id} className={cls} disabled={!!picked} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Feedback({ ok, children }: { ok: boolean | 'partial'; children: ReactNode }) {
  const cls = ok === true ? 'good' : ok === 'partial' ? 'part' : 'miss';
  const head = ok === true ? 'Yes.' : ok === 'partial' ? 'Close.' : 'Not this time.';
  return (
    <div className={`feedback ${cls}`} role="status">
      <strong>{head}</strong> {children}
    </div>
  );
}

export function NextButton({ isLast, onNext, onFinish }: { isLast: boolean; onNext: () => void; onFinish?: () => void }) {
  return isLast ? (
    onFinish ? (
      <button className="btn primary" onClick={onFinish}>
        See your results
      </button>
    ) : null
  ) : (
    <button className="btn primary" onClick={onNext}>
      Next round
    </button>
  );
}

export function StationDone({ scores, labels, onNext, nextLabel }: { scores: number[]; labels?: string[]; onNext?: () => void; nextLabel?: string }) {
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
  return (
    <section className="panel done">
      <h3>Station complete</h3>
      <p className="done-score">
        <span>{avg}%</span> on this station
      </p>
      <ul className="done-list">
        {scores.map((s, i) => (
          <li key={i} className={s >= 70 ? 'good' : s > 0 ? 'part' : 'miss'}>
            {labels?.[i] ?? `Round ${i + 1}`}: {s}%
          </li>
        ))}
      </ul>
      <p className="muted">Your answers are locked in. You can still play with the tools above.</p>
      {onNext && (
        <button className="btn primary" onClick={onNext}>
          {nextLabel ?? 'Go to the next station'}
        </button>
      )}
    </section>
  );
}

export function PlayButton({ onClick, children, kind = 'secondary', disabled }: { onClick: () => void; children: ReactNode; kind?: 'primary' | 'secondary'; disabled?: boolean }) {
  return (
    <button className={`btn ${kind} play`} onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
      </svg>
      {children}
    </button>
  );
}

/** Briefly flags that a sound is playing (for buttons that trigger audio). */
export function usePlayingFlag(): [boolean, (ms: number) => void] {
  const [on, setOn] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return [
    on,
    (ms: number) => {
      setOn(true);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setOn(false), ms);
    },
  ];
}

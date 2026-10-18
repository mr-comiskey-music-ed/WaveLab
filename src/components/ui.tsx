import { ReactNode, useEffect, useRef, useState } from 'react';
import { roundTone, roundWord, sectionLink, SITE_NAME, StationInfo, StationResult } from '../lib/stations';
import { useSaved } from '../lib/persist';
import { openSite } from './SplitHelp';

/** Steps through a fixed set of rounds (saved across reloads); reports scores once when all are done. */
export function useRounds(key: string, total: number, done: StationResult | undefined, onComplete: (r: StationResult) => void) {
  const [index, setIndex] = useSaved<number>(`${key}:index`, 0);
  const [scores, setScores] = useSaved<number[]>(`${key}:scores`, []);
  const reported = useRef(!!done);
  const current = scores[index] ?? null;
  const finished = !!done || scores.filter((x) => x !== undefined && x !== null).length === total;

  const answer = (score: number) => {
    if (scores[index] !== undefined && scores[index] !== null) return;
    const next = [...scores];
    next[index] = Math.max(0, Math.min(100, Math.round(score)));
    setScores(next);
    if (next.filter((x) => x !== undefined && x !== null).length === total && !reported.current) {
      reported.current = true;
      onComplete({ rounds: next });
    }
  };
  const next = () => setIndex((i) => Math.min(total - 1, i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));
  return { index, current, answered: current !== null, answer, next, prev, finished, scores: done?.rounds ?? scores, isLast: index === total - 1 };
}

export function StationHeader({ info }: { info: StationInfo }) {
  return (
    <header className="station-head">
      <h2>{info.title}</h2>
      <p className="goal">{info.goal}</p>
      <p className="read-first">
        <span>
          Read first on {SITE_NAME}: <strong>{info.section}</strong>
        </span>
        <button className="link" onClick={() => openSite(sectionLink(info))}>
          Jump there
        </button>
      </p>
    </header>
  );
}

/** Shown the first time a student opens a station: which section to read, with a jump link. */
export function ReadFirstModal({ info, onClose }: { info: StationInfo; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="readfirst-title">
      <h2 id="readfirst-title">Before “{info.title}”</h2>
      <p>Read and play with this part of {SITE_NAME} first:</p>
      <p className="readfirst-section">{info.section}</p>
      <div className="btn-row">
        <button className="btn secondary" onClick={() => openSite(sectionLink(info))}>
          Take me to that section
        </button>
      </div>
      <p className="muted small">
        This opens {SITE_NAME} on the left and tries to scroll to that heading. If it lands at the top instead, click on the Waveforms site, press{' '}
        <span className="keys">
          <kbd>Ctrl</kbd> + <kbd>F</kbd>
        </span>{' '}
        and type <strong>{info.findText}</strong> to jump there.
      </p>
      <div className="modal-actions">
        <button className="btn primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </dialog>
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
          const cls = s === undefined || s === null ? (i === index ? 'now' : '') : roundTone(s);
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
  const head = ok === true ? 'Yes!' : ok === 'partial' ? 'Close.' : 'Not quite.';
  return (
    <div className={`feedback ${cls}`} role="status">
      <strong>{head}</strong> {children}
    </div>
  );
}

/** Keeps the space for feedback reserved so the page doesn't jump when an answer appears. */
export function FeedbackSlot({ children, waiting = 'Your answer and an explanation will show up here.', tall }: { children?: ReactNode; waiting?: string; tall?: boolean }) {
  return <div className={`feedback-slot${tall ? ' tall' : ''}`}>{children || <div className="feedback waiting">{waiting}</div>}</div>;
}

export function NextButton({
  index,
  onPrev,
  answered,
  isLast,
  onNext,
  onFinish,
}: {
  index: number;
  onPrev: () => void;
  answered: boolean;
  isLast: boolean;
  onNext: () => void;
  onFinish?: () => void;
}) {
  return (
    <div className="next-row">
      <button className="btn quiet" disabled={index === 0} onClick={onPrev}>
        ← Prev round
      </button>
      <button className="btn primary" disabled={!answered} onClick={isLast ? onFinish : onNext}>
        {isLast ? 'Finish this station' : 'Next round →'}
      </button>
    </div>
  );
}

export function StationDone({
  scores,
  labels,
  kinds,
  onNext,
  nextLabel,
}: {
  scores: number[];
  labels: string[];
  kinds: ('mc' | 'skill')[];
  onNext?: () => void;
  nextLabel?: string;
}) {
  const mcCount = kinds.filter((k) => k === 'mc').length;
  const mcRight = scores.filter((s, i) => kinds[i] === 'mc' && s >= 100).length;
  return (
    <section className="panel done">
      <h3>Station complete</h3>
      {mcCount > 0 && (
        <p className="done-score">
          <span>
            {mcRight} of {mcCount}
          </span>{' '}
          questions right on the first try
        </p>
      )}
      <ul className="done-list">
        {scores.map((s, i) => (
          <li key={i} className={roundTone(s)}>
            {labels[i]}: <strong>{roundWord(s, kinds[i])}</strong>
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

/** A play/stop toggle that keeps the same width whichever state it's in. */
export function LoopButton({ on, onToggle, playLabel, stopLabel = 'Stop' }: { on: boolean; onToggle: () => void; playLabel: string; stopLabel?: string }) {
  return (
    <button className={`btn loop-btn ${on ? 'stop' : 'secondary'}`} aria-pressed={on} onClick={onToggle}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {on ? <rect x="3" y="3" width="10" height="10" fill="currentColor" /> : <path d="M4 2.5v11l9-5.5z" fill="currentColor" />}
      </svg>
      <span className="loop-label">
        <span className={on ? 'hidden-label' : ''}>{playLabel}</span>
        <span className={on ? '' : 'hidden-label'}>{stopLabel}</span>
      </span>
    </button>
  );
}

export function useToggle(initial = false): [boolean, () => void, (v: boolean) => void] {
  const [v, setV] = useState(initial);
  return [v, () => setV((x) => !x), setV];
}

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { audio } from '../lib/audio';
import { roundTone, roundWord, sectionLink, SITE_NAME, StationInfo, StationResult } from '../lib/stations';
import { useSaved } from '../lib/persist';
import { openSite } from './SplitHelp';

const CLEARED = null as unknown as number;

/**
 * Steps through a fixed set of rounds (saved across reloads); reports scores once when all are done.
 * A finished station can also retry some of its rounds (`startRetry`): those rounds are cleared and redone,
 * only they are visited, and the better of the old and new score is kept.
 */
export function useRounds(
  key: string,
  total: number,
  done: StationResult | undefined,
  onComplete: (r: StationResult) => void,
  onRevise?: (r: StationResult) => void
) {
  const [index, setIndex] = useSaved<number>(`${key}:index`, 0);
  const [scores, setScores] = useSaved<number[]>(`${key}:scores`, []);
  const [retry, setRetry] = useSaved<{ idx: number[]; before: number[] } | null>(`${key}:retry`, null);
  const [retried, setRetried] = useSaved<boolean>(`${key}:retried`, false);
  const reported = useRef(!!done);
  const current = scores[index] ?? null;
  const finished = !!done || scores.filter((x) => x !== undefined && x !== null).length === total;

  const answer = (score: number) => {
    if (scores[index] !== undefined && scores[index] !== null) return;
    const next = [...scores];
    next[index] = Math.max(0, Math.min(100, Math.round(score)));
    if (retry) {
      if (retry.idx.every((i) => next[i] !== undefined && next[i] !== null)) {
        const merged = Array.from({ length: total }, (_, i) => (retry.idx.includes(i) ? Math.max(retry.before[i] ?? 0, next[i]) : next[i]));
        setScores(merged);
        onRevise?.({ rounds: merged });
      } else setScores(next);
      return;
    }
    setScores(next);
    if (next.filter((x) => x !== undefined && x !== null).length === total && !reported.current) {
      reported.current = true;
      onComplete({ rounds: next });
    }
  };
  const next = () => setIndex((i) => (retry ? retry.idx.find((x) => x > i) ?? i : Math.min(total - 1, i + 1)));
  const prev = () => setIndex((i) => (retry ? [...retry.idx].reverse().find((x) => x < i) ?? i : Math.max(0, i - 1)));
  const startRetry = (idx: number[]) => {
    const before = [...(done?.rounds ?? scores)];
    setRetry({ idx, before });
    setScores(before.map((s, i) => (idx.includes(i) ? CLEARED : s)));
    setIndex(idx[0]);
    setRetried(true);
  };
  const finishRetry = () => setRetry(null);
  return {
    index,
    current,
    answered: current !== null,
    answer,
    next,
    prev,
    finished,
    scores: retry ? scores : done?.rounds ?? scores,
    isLast: retry ? index === retry.idx[retry.idx.length - 1] : index === total - 1,
    isFirst: retry ? index === retry.idx[0] : index === 0,
    retrying: !!retry,
    retried,
    startRetry,
    finishRetry,
  };
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
  isFirst,
  onNext,
  onFinish,
}: {
  index: number;
  onPrev: () => void;
  answered: boolean;
  isLast: boolean;
  /** Defaults to the first round; pass it when only some rounds are being visited. */
  isFirst?: boolean;
  onNext: () => void;
  onFinish?: () => void;
}) {
  return (
    <div className="next-row">
      <button className="btn quiet" disabled={isFirst ?? index === 0} onClick={onPrev}>
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
  onRetry,
  retryLabel,
  retried,
}: {
  scores: number[];
  labels: string[];
  kinds: ('mc' | 'skill')[];
  onNext?: () => void;
  nextLabel?: string;
  /** Lets a student redo some rounds (the ear-training ones). */
  onRetry?: () => void;
  retryLabel?: string;
  /** Some rounds were retried, so the scores are the best of each student's tries. */
  retried?: boolean;
}) {
  const right = scores.filter((s) => s >= 95).length;
  return (
    <section className="panel done">
      <h3>Station complete</h3>
      {scores.length > 0 && (
        <p className="done-score">
          <span>
            {right} of {scores.length}
          </span>{' '}
          {retried ? 'questions right (your best tries)' : 'questions right on the first try'}
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
      <div className="btn-row">
        {onRetry && (
          <button className="btn secondary" onClick={onRetry}>
            {retryLabel ?? 'Try the ear training questions again'}
          </button>
        )}
        {onNext && (
          <button className="btn primary" onClick={onNext}>
            {nextLabel ?? 'Go to the next station'}
          </button>
        )}
      </div>
    </section>
  );
}

export function PlayButton({ onClick, children, kind = 'secondary', disabled }: { onClick: () => void; children: ReactNode; kind?: 'primary' | 'secondary'; disabled?: boolean }) {
  const id = useId();
  return (
    <button
      className={`btn ${kind} play`}
      onClick={() => {
        audio.claim(id); // starting this sound stops whatever else was playing
        onClick();
      }}
      disabled={disabled}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
      </svg>
      {children}
    </button>
  );
}

/** A play/stop toggle that keeps the same width whichever state it's in. */
export function LoopButton({ on, onToggle, playLabel, stopLabel = 'Stop' }: { on: boolean; onToggle: () => void; playLabel: string; stopLabel?: string }) {
  const id = useId();
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  useEffect(() => {
    // Turning on claims the speakers (which switches any other loop off); turning off lets go.
    if (on) audio.claim(id, () => toggleRef.current());
    else audio.release(id);
  }, [on, id]);
  useEffect(() => () => audio.release(id), [id]);
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

/** Asks before turning in when some stations aren't finished. */
export function ConfirmTurnIn({ done, total, missing, onKeepWorking, onTurnIn }: { done: number; total: number; missing: string[]; onKeepWorking: () => void; onTurnIn: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onKeepWorking();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [onKeepWorking]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="turnin-title">
      <h2 id="turnin-title">Turn it in already?</h2>
      <p>
        Are you sure you want to turn it in? You’ve only done{' '}
        <strong>
          {done} of {total}
        </strong>{' '}
        stations.
      </p>
      {missing.length > 0 && <p className="muted small">Not finished yet: {missing.join(', ')}.</p>}
      <p className="muted small">Your progress is saved on this device, so you can also keep working and turn it in later.</p>
      <div className="modal-actions split-actions">
        <button className="btn quiet" onClick={onTurnIn}>
          Turn in anyway
        </button>
        <button className="btn primary" onClick={onKeepWorking}>
          Keep working
        </button>
      </div>
    </dialog>
  );
}

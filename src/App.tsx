import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './lib/audio';
import { AUTO_STATIONS, Capstone, CAPSTONE_BRIEFS, Results, StationId, StationResult, STATIONS } from './lib/stations';
import { capstoneComplete, emptyCapstone } from './lib/capstone';
import { shuffle } from './lib/waves';
import { openPudding, SplitHelp } from './components/SplitHelp';
import { Finish } from './components/Finish';
import { TeacherGrader } from './components/TeacherGrader';
import { S1Reading } from './stations/S1Reading';
import { S2Sound } from './stations/S2Sound';
import { S3Harmonics } from './stations/S3Harmonics';
import { S4Additive } from './stations/S4Additive';
import { S5Phase } from './stations/S5Phase';
import { S6Chords } from './stations/S6Chords';
import { S7Make } from './stations/S7Make';
import type { StationProps } from './stations/types';

const QUIZ_COMPONENTS: Record<Exclude<StationId, 'make'>, (p: StationProps) => ReactElement> = {
  read: S1Reading,
  sound: S2Sound,
  harm: S3Harmonics,
  add: S4Additive,
  phase: S5Phase,
  chord: S6Chords,
};

const HELP_SEEN_KEY = 'wavelab-split-help-seen';
const readHelpSeen = () => {
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

type View = { kind: 'station'; index: number } | { kind: 'finish' } | { kind: 'teacher' };

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 24" aria-hidden="true">
      <path d="M1 12 C 5 1, 9 1, 13 12 S 21 23, 25 12 S 33 1, 39 12" fill="none" stroke="var(--trace-a)" strokeWidth="3" strokeLinecap="round" />
      <path d="M1 12 C 4 6, 7 6, 10 12 S 16 18, 19 12 S 25 6, 28 12 S 34 18, 39 12" fill="none" stroke="var(--trace-b)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => (new URLSearchParams(window.location.search).has('teacher') ? { kind: 'teacher' } : { kind: 'station', index: 0 }));
  const [results, setResults] = useState<Results>({});
  const [briefChoices] = useState(() => shuffle(CAPSTONE_BRIEFS.map((_, i) => i)).slice(0, 3));
  const [capstone, setCapstone] = useState<Capstone>(() => emptyCapstone(-1));
  const [startedAt] = useState(() => Date.now());
  const [showHelp, setShowHelp] = useState(() => view.kind !== 'teacher' && !readHelpSeen());
  const [wideTip, setWideTip] = useState(false);
  const copiedRef = useRef(false);

  // Stop sound whenever the view changes.
  useEffect(() => {
    audio.stopAll();
    window.scrollTo({ top: 0 });
  }, [view]);

  // Suggest split screen if the window is very wide.
  useEffect(() => {
    const check = () => setWideTip(window.innerWidth > 1150);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Warn before leaving with unsaved work (nothing is stored anywhere).
  const hasWork = Object.keys(results).length > 0 || capstone.why.trim().length > 0;
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (hasWork && !copiedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [hasWork]);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
    try {
      localStorage.setItem(HELP_SEEN_KEY, '1');
    } catch {
      /* private window: fine */
    }
  }, []);

  const complete = (id: StationId) => (r: StationResult) => {
    copiedRef.current = false;
    setResults((prev) => (prev[id] ? prev : { ...prev, [id]: r }));
  };

  const goStation = (index: number) => setView({ kind: 'station', index });
  const doneCount = AUTO_STATIONS.filter((s) => results[s.id]).length;
  const isDone = (id: StationId) => (id === 'make' ? capstoneComplete(capstone) : !!results[id]);

  if (view.kind === 'teacher') {
    return (
      <div className="app">
        <header className="top">
          <div className="brand">
            <Logo />
            <span className="wordmark">WaveLab</span>
            <span className="tagline">Teacher grading</span>
          </div>
        </header>
        <main className="page">
          <TeacherGrader onBack={() => goStation(0)} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Logo />
          <span className="wordmark">WaveLab</span>
          <span className="tagline">A lab companion to The Pudding's waveforms guide</span>
        </div>
        <div className="top-actions">
          <button className="btn secondary small" onClick={openPudding}>
            Open The Pudding
          </button>
          <button className="btn quiet small" onClick={() => setShowHelp(true)}>
            Split-screen help
          </button>
        </div>
      </header>

      {wideTip && (
        <div className="tip">
          WaveLab is made to sit next to The Pudding.{' '}
          <button className="link" onClick={() => setShowHelp(true)}>
            Set up split screen
          </button>
        </div>
      )}

      <nav className="steps" aria-label="Stations">
        <ol>
          {STATIONS.map((s, i) => {
            const active = view.kind === 'station' && view.index === i;
            return (
              <li key={s.id} className={`${active ? 'active' : ''} ${isDone(s.id) ? 'done' : ''}`}>
                <button onClick={() => goStation(i)} aria-current={active ? 'step' : undefined} title={s.title}>
                  <span className="dot">{isDone(s.id) ? '✓' : i + 1}</span>
                  <span className="step-name">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="page">
        {STATIONS.map((s, i) => {
          const hidden = !(view.kind === 'station' && view.index === i);
          const next = i < STATIONS.length - 1 ? () => goStation(i + 1) : undefined;
          return (
            <div key={s.id} hidden={hidden}>
              {s.id === 'make' ? (
                <S7Make info={s} capstone={capstone} choices={briefChoices} onChange={(c) => {
                  copiedRef.current = false;
                  setCapstone(c);
                }} onFinish={() => setView({ kind: 'finish' })} />
              ) : (
                (() => {
                  const Comp = QUIZ_COMPONENTS[s.id];
                  return <Comp info={s} done={results[s.id]} onComplete={complete(s.id)} onNext={next} />;
                })()
              )}
            </div>
          );
        })}
        {view.kind === 'finish' && (
          <Finish
            results={results}
            capstone={capstone}
            startedAt={startedAt}
            onGoTo={goStation}
            onCopied={() => {
              copiedRef.current = true;
            }}
          />
        )}
      </main>

      <footer className="bottom">
        <span className="progress">
          {doneCount} of {AUTO_STATIONS.length} stations done{capstoneComplete(capstone) ? ', sound made' : ''}
        </span>
        <button className="btn primary" onClick={() => setView({ kind: 'finish' })}>
          Get my code
        </button>
      </footer>
      <p className="teacher-link">
        <a href="?teacher">Teacher: grade codes</a>
      </p>

      {showHelp && <SplitHelp onClose={closeHelp} />}
    </div>
  );
}

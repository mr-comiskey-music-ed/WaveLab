import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './lib/audio';
import { assignedFromUrl, Capstone, CAPSTONE_BRIEFS, Results, StationId, StationResult, STATIONS } from './lib/stations';
import { capstoneComplete, emptyCapstone } from './lib/capstone';
import { clearProgress, initProgress, useSaved } from './lib/persist';
import { shuffle } from './lib/waves';
import { openSite, SplitHelp } from './components/SplitHelp';
import { Finish } from './components/Finish';
import { TeacherGrader } from './components/TeacherGrader';
import { ReadFirstModal } from './components/ui';
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

// Which sections this link assigns, and the matching save slot on this device.
const ASSIGNED = assignedFromUrl(window.location.search);
const MY_STATIONS = STATIONS.filter((s) => ASSIGNED.includes(s.id));
const IS_TEACHER = new URLSearchParams(window.location.search).has('teacher');
initProgress(ASSIGNED.join(','));

// Per-device conveniences (not student work).
const HELP_SEEN_KEY = 'wavelab-split-help-seen';
const VOLUME_TIP_KEY = 'wavelab-volume-tip-dismissed';
const getFlag = (k: string) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const setFlag = (k: string) => {
  try {
    localStorage.setItem(k, '1');
  } catch {
    /* fine */
  }
};

type View = { kind: 'station'; id: StationId } | { kind: 'finish' } | { kind: 'teacher' };

// Logo: a slow pink wave, a fast blue wave, and the W they make together.
function wavePath(f: (t: number) => number, cy: number, amp: number) {
  const n = 64;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d += `${i ? 'L' : 'M'}${(10 + 44 * t).toFixed(1)} ${(cy - amp * f(t)).toFixed(1)}`;
  }
  return d;
}
const logoBlue = (t: number) => Math.cos(4 * Math.PI * t);
const logoPink = (t: number) => 0.5 * Math.cos(2 * Math.PI * t);
const LOGO_PINK = wavePath(logoPink, 14, 10);
const LOGO_BLUE = wavePath(logoBlue, 54, 7);
const LOGO_W = wavePath((t) => logoBlue(t) + logoPink(t), 35.25, 13);

function Logo() {
  const stroke = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="13.5" fill="#eef3fb" stroke="#17233a" strokeOpacity="0.18" strokeWidth="1.5" />
      <path d={LOGO_PINK} stroke="#e91e63" strokeWidth="4.5" {...stroke} />
      <path d={LOGO_BLUE} stroke="#0380f4" strokeWidth="4.5" {...stroke} />
      <path d={LOGO_W} stroke="#17233a" strokeWidth="6.5" opacity="0.9" {...stroke} />
    </svg>
  );
}

function VolumeControl() {
  const [v, setV] = useState(audio.volume);
  return (
    <label className="volume">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
        <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Volume</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={v}
        onChange={(e) => {
          setV(+e.target.value);
          audio.setVolume(+e.target.value);
        }}
      />
    </label>
  );
}

export default function App() {
  const [savedView, setSavedView] = useSaved<View>('view', { kind: 'station', id: MY_STATIONS[0].id });
  const view: View = IS_TEACHER ? { kind: 'teacher' } : savedView.kind === 'station' && !ASSIGNED.includes(savedView.id) ? { kind: 'station', id: MY_STATIONS[0].id } : savedView;
  const setView = (v: View) => {
    if (IS_TEACHER && v.kind !== 'teacher') {
      window.location.href = window.location.pathname;
      return;
    }
    setSavedView(v);
  };
  const [results, setResults] = useSaved<Results>('results', {});
  const [briefChoices] = useSaved('briefChoices', () => shuffle(CAPSTONE_BRIEFS.map((_, i) => i)).slice(0, 3));
  const [capstone, setCapstone] = useSaved<Capstone>('capstone', () => emptyCapstone(-1));
  const [startedAt] = useSaved('startedAt', () => Date.now());
  const [seen, setSeen] = useSaved<StationId[]>('readFirstSeen', []);
  const [showHelp, setShowHelp] = useState(() => !IS_TEACHER && !getFlag(HELP_SEEN_KEY));
  const [volumeTip, setVolumeTip] = useState(() => !getFlag(VOLUME_TIP_KEY));
  const [wideTip, setWideTip] = useState(false);
  const copiedRef = useRef(false);

  useEffect(() => {
    audio.stopAll();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind, view.kind === 'station' ? view.id : '']);

  useEffect(() => {
    const check = () => setWideTip(window.innerWidth > 1150);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
    setFlag(HELP_SEEN_KEY);
  }, []);

  const complete = (id: StationId) => (r: StationResult) => {
    copiedRef.current = false;
    setResults((prev) => (prev[id] ? prev : { ...prev, [id]: r }));
  };

  const goStation = (id: StationId) => setView({ kind: 'station', id });
  const isDone = (id: StationId) => (id === 'make' ? capstoneComplete(capstone) : !!results[id]);
  const doneCount = MY_STATIONS.filter((s) => isDone(s.id)).length;
  const allDone = doneCount === MY_STATIONS.length;
  const currentInfo = view.kind === 'station' ? MY_STATIONS.find((s) => s.id === view.id)! : null;
  const showReadFirst = !!currentInfo && !showHelp && !seen.includes(currentInfo.id);
  const closeReadFirst = useCallback(() => {
    if (currentInfo) setSeen((s) => (s.includes(currentInfo.id) ? s : [...s, currentInfo.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInfo?.id]);

  if (view.kind === 'teacher') {
    return (
      <div className="app">
        <header className="top">
          <div className="brand">
            <Logo />
            <span className="wordmark">WaveLab</span>
            <span className="tagline">Teacher tools</span>
          </div>
          <div className="top-actions">
            <VolumeControl />
          </div>
        </header>
        <main className="page">
          <TeacherGrader onBack={() => (window.location.href = window.location.pathname)} />
        </main>
      </div>
    );
  }

  const index = currentInfo ? MY_STATIONS.indexOf(currentInfo) : -1;
  const nextStation = index >= 0 && index < MY_STATIONS.length - 1 ? MY_STATIONS[index + 1] : null;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Logo />
          <span className="wordmark">WaveLab</span>
          <span className="tagline">A lab companion to The Pudding’s interactive Waveforms site</span>
        </div>
        <div className="top-actions">
          <VolumeControl />
          <button className="btn secondary small" onClick={() => openSite()}>
            Open the Waveforms site
          </button>
          <button className="btn quiet small" onClick={() => setShowHelp(true)}>
            Split-screen help
          </button>
        </div>
      </header>

      {volumeTip && (
        <div className="tip volume-tip">
          <span>
            🔊 Before you start, turn your Chromebook’s volume to about <strong>halfway</strong>. Some sounds are high-pitched.
          </span>
          <button
            className="link"
            onClick={() => {
              setVolumeTip(false);
              setFlag(VOLUME_TIP_KEY);
            }}
          >
            Done
          </button>
        </div>
      )}
      {wideTip && (
        <div className="tip">
          WaveLab is made to sit next to the Waveforms site.{' '}
          <button className="link" onClick={() => setShowHelp(true)}>
            Set up split screen
          </button>
        </div>
      )}

      {MY_STATIONS.length > 1 && (
        <nav className="steps" aria-label="Stations">
          <ol style={{ gridTemplateColumns: `repeat(${MY_STATIONS.length}, minmax(56px, 1fr))`, maxWidth: Math.max(240, MY_STATIONS.length * 104) }}>
            {MY_STATIONS.map((s) => {
              const n = STATIONS.indexOf(s) + 1;
              const active = view.kind === 'station' && view.id === s.id;
              return (
                <li key={s.id} className={`${active ? 'active' : ''} ${isDone(s.id) ? 'done' : ''}`}>
                  <button onClick={() => goStation(s.id)} aria-current={active ? 'step' : undefined} title={s.title}>
                    <span className="dot">{isDone(s.id) ? '✓' : n}</span>
                    <span className="step-name">{s.short}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <main className="page">
        {currentInfo &&
          (currentInfo.id === 'make' ? (
            <S7Make
              key="make"
              info={currentInfo}
              capstone={capstone}
              choices={briefChoices}
              onChange={(c) => {
                copiedRef.current = false;
                setCapstone(c);
              }}
              onFinish={() => setView({ kind: 'finish' })}
            />
          ) : (
            (() => {
              const Comp = QUIZ_COMPONENTS[currentInfo.id];
              return (
                <Comp
                  key={currentInfo.id}
                  info={currentInfo}
                  done={results[currentInfo.id]}
                  onComplete={complete(currentInfo.id)}
                  onNext={nextStation ? () => goStation(nextStation.id) : () => setView({ kind: 'finish' })}
                />
              );
            })()
          ))}
        {view.kind === 'finish' && (
          <Finish
            results={results}
            capstone={capstone}
            startedAt={startedAt}
            assigned={ASSIGNED}
            onGoTo={goStation}
            onCopied={() => {
              copiedRef.current = true;
            }}
            onStartOver={() => {
              clearProgress();
              window.location.reload();
            }}
          />
        )}
      </main>

      <footer className="bottom">
        <span className="progress">
          {doneCount} of {MY_STATIONS.length} {MY_STATIONS.length === 1 ? 'station' : 'stations'} done. Your progress saves automatically.
        </span>
        <button className={`btn ${allDone ? 'primary' : 'quiet'}`} onClick={() => setView({ kind: 'finish' })}>
          {allDone ? 'Get my code' : 'Turn in / get code'}
        </button>
      </footer>
      <p className="teacher-link">
        <a href="?teacher">Teacher tools</a>
      </p>

      {showHelp && <SplitHelp onClose={closeHelp} />}
      {showReadFirst && currentInfo && <ReadFirstModal key={currentInfo.id} info={currentInfo} onClose={closeReadFirst} />}
    </div>
  );
}

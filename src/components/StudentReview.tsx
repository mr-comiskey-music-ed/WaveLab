import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { audio, ClipPart } from '../lib/audio';
import { Submission } from '../lib/codec';
import { busShiftOf, busWave, overheadGapOf, phaseParts, PhaseKind, PhaseSetup, solvedSetup, bassOffsetOf } from '../lib/phase';
import { Rec, roundTitle } from '../lib/review';
import { attemptGrade, describe, harmonicNotes, setupOf } from '../lib/reviewText';
import { roundTone, stationScore, StationId, STATIONS } from '../lib/stations';
import { matchScore } from '../stations/S4Additive';
import { harmonicValue, midiToFreq, peakOf } from '../lib/waves';
import { DawLane, DawView } from './DawView';
import { HarmonicBars } from './HarmonicBars';
import { KitView } from './KitView';
import { SnareSideView } from './PhaseScenes';
import { LoopButton, PlayButton } from './ui';
import { WavePlot } from './WavePlot';

const AUTO = STATIONS.filter((s) => s.auto);
const FULL = 95; // the same line the students' "Nailed it" / "Correct" uses

/** Plays a mix of the recorded clips on a loop (the teacher's version of the phase station's play button). */
function ClipLoop({ parts, label }: { parts: () => ClipPart[]; label: string }) {
  const [on, setOn] = useState(false);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  useEffect(() => {
    if (!on) return;
    const p = audio.playClips(partsRef.current());
    p.ready.catch(() => setOn(false));
    return () => p.stop();
  }, [on]);
  return <LoopButton on={on} onToggle={() => setOn((v) => !v)} playLabel={label} />;
}

const shapeOf = (amps: number[]) => {
  const p = peakOf(amps) || 1;
  return (t: number) => (0.95 * harmonicValue(amps, t)) / p;
};

/** One round. Rounds that didn't earn full credit start open; the rest are one line you can open. */
function Round({ id, index, score, rec }: { id: StationId; index: number; score: number; rec: Rec | null }) {
  const title = roundTitle(id, index, rec);
  const tone = roundTone(score);
  const grade = rec ? attemptGrade(rec) : null;
  const isPhase = rec?.k === 'bass' || rec?.k === 'snare' || rec?.k === 'overhead' || rec?.k === 'train';
  // A retried round keeps the better score, so the card (their latest try) can be lower than the score.
  const note =
    rec && grade !== null && Math.abs(grade - score) > 1
      ? isPhase
        ? 'The controls shown may have moved after they locked this round in, so they might not match the score exactly. The score is what counts.'
        : `This card shows their latest try (${grade}). They retried, and the best try is what’s scored.`
      : null;

  const d = rec ? describe(rec) : null;
  const answeredRight = rec && 'p' in rec && rec.p === rec.c;
  const summaryAnswer = d && answeredRight ? d.yours : null;

  return (
    <li className={`rv-round ${tone}`}>
      <details open={score < FULL}>
        <summary>
          <span className={`rv-score ${tone}`}>{score}</span>
          <span className="rv-title">{title}</span>
          {summaryAnswer && <span className="rv-brief">{summaryAnswer}</span>}
        </summary>
        <div className="rv-body">
          {!rec && <p className="muted small">No answer detail for this round.</p>}
          {d && (
            <>
              <p className="rv-ask">{d.ask}</p>
              {d.bars && (
                <div className="rv-bars">
                  <HarmonicBars amps={d.bars} count={12} rootHz={1} color="var(--trace-b)" label="The harmonics they were shown" />
                </div>
              )}
              <p className="rv-line">
                <span className="rv-lab">They answered</span>
                <strong className={answeredRight ? 'good' : 'miss'}>{d.yours}</strong>
              </p>
              {!answeredRight && (
                <p className="rv-line">
                  <span className="rv-lab">Right answer</span>
                  <strong>{d.right}</strong>
                </p>
              )}
              {!answeredRight && d.hint && <p className="rv-hint">{d.hint}</p>}
            </>
          )}
          {rec?.k === 'match' && <MatchCard rec={rec} />}
          {isPhase && <PhaseCard rec={rec as Extract<Rec, { k: PhaseKind }>} />}
          {note && <p className="rv-note">{note}</p>}
        </div>
      </details>
    </li>
  );
}

/** The by-ear matching rounds: their faders next to the mystery recipe, plus both sounds. */
function MatchCard({ rec }: { rec: Extract<Rec, { k: 'match' }> }) {
  const raw = matchScore(rec.m, rec.t);
  const notes = harmonicNotes(rec.m, rec.t);
  const mineFn = useMemo(() => shapeOf(rec.m), [rec.m]);
  const targetFn = useMemo(() => shapeOf(rec.t), [rec.t]);
  const play = (h: number[], delay = 0) => audio.play({ freq: midiToFreq(rec.midi), harmonics: h, level: 0.55, duration: 1.3, delay });
  const hasSound = Math.max(...rec.m) > 0;
  return (
    <>
      <p className="rv-line">
        <span className="rv-lab">Matched</span>
        <strong>{raw}%</strong>
        <span className="muted small"> (80% or more counts as a full match)</span>
      </p>
      {(rec.peek || rec.hint) && (
        <p className="rv-badges">
          {rec.hint && <span className="rv-badge">Used the hint</span>}
          {rec.peek && <span className="rv-badge warn-badge">Peeked at the mystery shape (credit is capped)</span>}
        </p>
      )}
      <div className="split">
        <figure className="compare">
          <figcaption>Mystery recipe{rec.cl ? ` (start of a ${rec.cl} wave)` : ''}</figcaption>
          <HarmonicBars amps={rec.t} count={rec.t.length} color="var(--trace-b)" label="The mystery sound's harmonics" />
        </figure>
        <figure className="compare">
          <figcaption>Their recipe</figcaption>
          <HarmonicBars amps={rec.m} count={rec.m.length} label="Their harmonics" />
        </figure>
      </div>
      {notes.length > 0 ? (
        <ul className="rv-diffs">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Every harmonic is within a notch of the mystery recipe.</p>
      )}
      <WavePlot
        traces={[
          { fn: (t: number) => targetFn(t * 2), color: 'var(--trace-b)', dashed: true, width: 2 },
          { fn: (t: number) => mineFn(t * 2), color: 'var(--trace-a)' },
        ]}
        duration={1}
        height={110}
        label="Their wave shape against the mystery shape"
      />
      <p className="legend">
        <span className="key a" /> Their wave <span className="key b dashed" /> Mystery wave
      </p>
      <div className="btn-row">
        <PlayButton kind="primary" onClick={() => play(rec.t)}>
          Mystery sound
        </PlayButton>
        <PlayButton onClick={() => hasSound && play(rec.m)}>Their sound</PlayButton>
        <PlayButton
          onClick={() => {
            play(rec.t);
            if (hasSound) play(rec.m, 1.6);
          }}
        >
          Mystery, then theirs
        </PlayButton>
      </div>
    </>
  );
}

/** The phase rounds: where they left the controls, and a way to hear it next to the solved version. */
function PhaseCard({ rec }: { rec: Extract<Rec, { k: PhaseKind }> }) {
  const setup: PhaseSetup = useMemo(() => setupOf(rec), [rec]);
  const solved = useMemo(() => solvedSetup(setup), [setup]);
  const lanes = useMemo<DawLane[]>(
    () => [
      { name: 'Bass DI', color: 'var(--trace-a)', startMs: 3 },
      { name: 'Bass amp mic', color: 'var(--trace-b)', startMs: 3 + bassOffsetOf(setup) },
    ],
    [setup]
  );

  let facts: ReactNode = null;
  let visual: ReactNode = null;
  switch (rec.k) {
    case 'bass': {
      const off = bassOffsetOf(setup);
      facts =
        Math.abs(off) <= 0.5
          ? 'They lined the amp mic up with the DI (within 0.5 ms counts as lined up).'
          : `The amp mic ended up ${Math.abs(off).toFixed(1)} ms ${off > 0 ? 'late' : 'early'}. (Within 0.5 ms counts as lined up.)`;
      visual = <DawView lanes={lanes} windowMs={30} freq={82.4} decayMs={30} label="Where they left the bass DI and amp mic tracks, and their mix" />;
      break;
    }
    case 'snare':
      facts = rec.flip ? 'They flipped the bottom mic’s polarity, so the two mics add up.' : 'They left the bottom mic’s polarity alone, so the two mics cancel each other and the snare sounds thin.';
      visual = <SnareSideView flipped={rec.flip} />;
      break;
    case 'overhead': {
      const gap = overheadGapOf(setup);
      facts = `The two overheads ended up ${gap.toFixed(1)} cm different in distance from the snare. (Under 4 cm counts as in phase, 4 to 8 cm is close.)`;
      visual = <KitView leftX={rec.lx} rightX={rec.rx} />;
      break;
    }
    case 'train': {
      const off = Math.abs(rec.delay - rec.tgt);
      facts = (
        <>
          Polarity {rec.flip ? 'flipped' : <strong className="miss">not flipped</strong>}. Delay set to {rec.delay.toFixed(2)} ms; the headphones needed {rec.tgt.toFixed(2)} ms ({off.toFixed(2)} ms off).
          {!rec.flip && ' Without the flip, the headphones add to the rumble instead of cancelling it.'}
        </>
      );
      const shift = busShiftOf(setup);
      const sign = rec.flip ? -1 : 1;
      visual = (
        <WavePlot
          tag="What reaches the ear (the low rumble)"
          traces={[{ fn: (t: number) => busWave(t) + sign * busWave(t, shift), color: 'var(--ink)', width: 3 }]}
          duration={0.04}
          yMax={1.8}
          height={110}
          label="The rumble with their headphone settings"
        />
      );
      break;
    }
  }

  return (
    <>
      <p className="rv-line">{facts}</p>
      <div className="rv-visual">{visual}</div>
      <div className="btn-row">
        <ClipLoop parts={() => phaseParts(rec.k, setup)} label="Hear their setting" />
        <ClipLoop parts={() => phaseParts(rec.k, solved)} label="Hear it solved" />
      </div>
    </>
  );
}

/** Dots like the ones students see: one per round, coloured by how it went. */
function Dots({ scores }: { scores: number[] }) {
  return (
    <span className="rv-dots" aria-hidden="true">
      {scores.map((s, i) => (
        <i key={i} className={roundTone(s)} />
      ))}
    </span>
  );
}

/** A student's full picture: every question, what they answered, and what to look at first. */
export function StudentReview({ sub }: { sub: Submission }) {
  const stations = AUTO.filter((s) => sub.assigned.includes(s.id));
  const hasDetail = !!sub.review && Object.keys(sub.review).length > 0;

  // Everything that didn't earn full credit, for a quick "where to look" list.
  const lookAt: { station: string; round: number; title: string; score: number }[] = [];
  for (const s of stations) {
    const r = sub.results[s.id];
    r?.rounds.forEach((score, i) => {
      if (score < FULL) lookAt.push({ station: s.title, round: i + 1, title: roundTitle(s.id, i, sub.review?.[s.id]?.[i]), score });
    });
  }
  const notDone = stations.filter((s) => !sub.results[s.id]);

  return (
    <div className="rv">
      {!hasDetail && (
        <p className="rv-banner">
          This code only has scores, so the questions below are the general ones each round asks, not this student’s exact numbers or answers. To see their answers, have them open the assignment on their Chromebook, press “Get my code” again and turn in the new code.
        </p>
      )}

      <div className="rv-look">
        <h4>Where to look</h4>
        {lookAt.length === 0 && notDone.length === 0 ? (
          <p className="good">Full credit on every round.</p>
        ) : (
          <ul>
            {lookAt.map((x, i) => (
              <li key={i}>
                <span className={`rv-score ${roundTone(x.score)}`}>{x.score}</span> {x.station}, round {x.round}: {x.title}
              </li>
            ))}
            {notDone.map((s) => (
              <li key={s.id}>
                <span className="rv-score miss">0</span> {s.title}: not done
              </li>
            ))}
          </ul>
        )}
      </div>

      {stations.map((s) => {
        const r = sub.results[s.id];
        if (!r) {
          return (
            <div key={s.id} className="rv-station empty">
              <span className="rv-st-title">{s.title}</span> <span className="muted">not done</span>
            </div>
          );
        }
        const avg = stationScore(r) ?? 0;
        const below = r.rounds.filter((x) => x < FULL).length;
        const recs = sub.review?.[s.id];
        return (
          <details key={s.id} className="rv-station" open={below > 0}>
            <summary>
              <span className="rv-st-title">{s.title}</span>
              <span className={`rv-st-score ${roundTone(avg)}`}>{avg}</span>
              <Dots scores={r.rounds} />
              <span className="muted small">{below === 0 ? 'full credit' : `${below} below full credit`}</span>
            </summary>
            <ol className="rv-rounds">
              {r.rounds.map((score, i) => (
                <Round key={i} id={s.id} index={i} score={score} rec={recs?.[i] ?? null} />
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { decodeSubmission, LOOKS_LIKE_CODE, Submission } from '../lib/codec';
import { CAPSTONE_BRIEFS, CAPSTONE_PITCHES, overallScore, stationScore, StationId, STATIONS } from '../lib/stations';
import { capstoneAmps, capstoneComplete, playCapstoneNote, riffRange, startRiff } from '../lib/capstone';
import { copyText } from '../lib/copyText';
import { HarmonicBars } from './HarmonicBars';
import { Piano } from './Piano';
import { LoopButton, PlayButton } from './ui';

const AUTO = STATIONS.filter((s) => s.auto);

interface Entry {
  id: number;
  sub: Submission;
  overall: number | null;
  duplicateName: boolean;
}

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const fmtMinutes = (a: number, b: number) => {
  if (!a || !b || b <= a) return '';
  const m = Math.round((b - a) / 60000);
  return m < 1 ? 'under a minute' : m >= 120 ? `${Math.round(m / 60)} hours` : `${m} min`;
};

async function parse(text: string) {
  const seen = new Set<string>();
  const jobs: { token: string; label: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.split(/[\s,;"'|]+/).filter(Boolean);
    const codes = tokens.filter((t) => LOOKS_LIKE_CODE.test(t));
    const label = tokens
      .filter((t) => !codes.includes(t))
      .join(' ')
      .slice(0, 40)
      .replace(/[.\s]+$/, '');
    for (const token of codes) {
      if (seen.has(token)) continue;
      seen.add(token);
      jobs.push({ token, label });
    }
  }
  const decoded = await Promise.all(jobs.map((j) => decodeSubmission(j.token)));
  const entries: Entry[] = [];
  const unreadable: string[] = [];
  decoded.forEach((d, i) => {
    if (!d) unreadable.push(jobs[i].label || `code starting ${jobs[i].token.slice(0, 10)}…`);
    else entries.push({ id: entries.length, sub: d, overall: overallScore(d.results, d.assigned), duplicateName: false });
  });
  const counts = new Map<string, number>();
  const key = (e: Entry) => e.sub.name.trim().toLowerCase();
  entries.forEach((e) => counts.set(key(e), (counts.get(key(e)) ?? 0) + 1));
  entries.forEach((e) => (e.duplicateName = (counts.get(key(e)) ?? 0) > 1));
  entries.sort((a, b) => a.sub.name.localeCompare(b.sub.name));
  return { entries, unreadable };
}

function downloadCsv(entries: Entry[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Student', 'Submitted', 'Time spent', 'Sections assigned', ...AUTO.map((s) => s.title), 'Auto-graded total', 'Make a sound: done', 'Sound name', 'Brief', 'Explanation'];
  const rows = entries.map((e) => {
    const c = e.sub.capstone;
    return [
      e.sub.name,
      e.sub.submittedAt ? new Date(e.sub.submittedAt).toISOString().slice(0, 16).replace('T', ' ') : '',
      fmtMinutes(e.sub.startedAt, e.sub.submittedAt),
      e.sub.assigned.length === STATIONS.length ? 'all' : e.sub.assigned.map((id) => STATIONS.find((s) => s.id === id)!.short).join(' + '),
      ...AUTO.map((s) => (e.sub.assigned.includes(s.id) ? stationScore(e.sub.results[s.id]) ?? 0 : 'not assigned')),
      e.overall ?? '',
      e.sub.assigned.includes('make') ? (capstoneComplete(c) ? 'yes' : 'no') : 'not assigned',
      c?.name ?? '',
      c && c.brief >= 0 ? CAPSTONE_BRIEFS[c.brief] : '',
      c?.why ?? '',
    ]
      .map(esc)
      .join(',');
  });
  const blob = new Blob([[header.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wavelab-grades-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const cell = (n: number | null) => (n === null ? <span className="muted">–</span> : <span className={n >= 90 ? 'good' : n >= 70 ? 'part' : 'miss'}>{n}</span>);

/** Pick sections and get a link for Google Classroom. */
function AssignmentBuilder() {
  const [chosen, setChosen] = useState<StationId[]>(STATIONS.map((s) => s.id));
  const [copied, setCopied] = useState(false);
  const base = `${window.location.origin}${window.location.pathname}`;
  const link = chosen.length === STATIONS.length || chosen.length === 0 ? base : `${base}?s=${chosen.join(',')}`;
  const toggle = (id: StationId) => {
    setCopied(false);
    setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : STATIONS.filter((s) => s.id === id || chosen.includes(s.id)).map((s) => s.id));
  };
  return (
    <section className="panel">
      <h3>Make an assignment link</h3>
      <p className="panel-note">Pick the sections to assign. Students who open the link only see those stations, and their codes are graded on just those.</p>
      <div className="checks">
        {STATIONS.map((s, i) => (
          <label key={s.id} className="check">
            <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => toggle(s.id)} />
            <span>
              {i + 1}. {s.title} <span className="muted small">({s.section})</span>
            </span>
          </label>
        ))}
      </div>
      <input className="link-box" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Assignment link" />
      <div className="btn-row">
        <button
          className="btn primary"
          disabled={!chosen.length}
          onClick={async () => {
            setCopied(await copyText(link));
          }}
        >
          Copy link
        </button>
        {copied && <span className="ok-line">Copied. Paste it into the Classroom assignment.</span>}
      </div>
    </section>
  );
}

function CapstonePlayer({ sub }: { sub: Submission }) {
  const c = sub.capstone!;
  const [on, setOn] = useState(false);
  const [lit, setLit] = useState<number[]>([]);
  const ref = useRef(c);
  ref.current = c;
  useEffect(() => {
    if (!on) return;
    return startRiff(() => ref.current, setLit);
  }, [on]);
  useEffect(() => () => setOn(false), [sub]);
  const [lo, hi] = riffRange(c);
  return (
    <div className="capstone-review">
      <h4>Make a sound: “{c.name || 'untitled'}”</h4>
      <p>
        <strong>Brief:</strong> {c.brief >= 0 ? CAPSTONE_BRIEFS[c.brief] : 'none picked'}
      </p>
      <p>
        <strong>Explanation:</strong> {c.why || <span className="muted">none</span>}
      </p>
      <p className="muted small">
        {CAPSTONE_PITCHES[c.pitch]?.label} pitch, {c.punchy ? 'fast/punchy' : 'slow/soft'} attack
      </p>
      <HarmonicBars amps={capstoneAmps(c)} count={8} label="The student's harmonic recipe" />
      <div className="btn-row">
        <LoopButton on={on} onToggle={() => setOn(!on)} playLabel="Play their loop" stopLabel="Stop" />
        <PlayButton onClick={() => playCapstoneNote(c)}>Play one note</PlayButton>
      </div>
      <Piano lo={lo} hi={hi} lit={lit} label="Notes playing" showNames={false} />
    </div>
  );
}

export function TeacherGrader({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  const read = async () => {
    const res = await parse(text);
    setEntries(res.entries);
    setUnreadable(res.unreadable);
    setOpen(res.entries.length === 1 ? 0 : null);
  };

  const avg = (fn: (e: Entry) => number | null) => {
    const vals = (entries ?? []).map(fn).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const scoreFor = (e: Entry, id: StationId) => (e.sub.assigned.includes(id) ? stationScore(e.sub.results[id]) ?? 0 : null);
  const sel = entries?.find((e) => e.id === open);

  return (
    <div className="teacher">
      <header className="station-head">
        <h2>Teacher tools</h2>
        <p className="goal">Make assignment links and grade student codes. Nothing is saved or sent anywhere.</p>
      </header>

      <AssignmentBuilder />

      <section className="panel">
        <h3>Grade codes</h3>
        <p className="panel-note">Paste one code or a whole class of them (a column copied from Classroom or a spreadsheet works).</p>
        <textarea className="code" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste codes here, one per line. Names on the same line are fine." aria-label="Student codes" />
        <div className="btn-row">
          <button className="btn primary" disabled={!text.trim()} onClick={read}>
            Read codes
          </button>
          {entries && entries.length > 0 && (
            <button className="btn secondary" onClick={() => downloadCsv(entries)}>
              Download CSV
            </button>
          )}
          <button className="btn quiet" onClick={onBack}>
            Back to the stations
          </button>
        </div>
        {unreadable.length > 0 && (
          <p className="warn">
            Couldn’t read {unreadable.length} code{unreadable.length > 1 ? 's' : ''} (incomplete, mistyped or edited): {unreadable.join(', ')}. Ask those students to copy their code again.
          </p>
        )}
      </section>

      {entries && entries.length > 0 && (
        <section className="panel wide">
          <h3>
            {entries.length} student{entries.length > 1 ? 's' : ''}
          </h3>
          <div className="table-scroll">
            <table className="grades">
              <thead>
                <tr>
                  <th>Student</th>
                  {AUTO.map((s) => (
                    <th key={s.id}>{s.short}</th>
                  ))}
                  <th>Total</th>
                  <th>Make</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={open === e.id ? 'open' : ''} onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <th scope="row">
                      <button className="link">{e.sub.name || '(no name)'}</button>
                      {e.duplicateName && (
                        <span className="flag" title="This name appears on more than one code">
                          {' '}
                          2+ codes
                        </span>
                      )}
                    </th>
                    {AUTO.map((s) => (
                      <td key={s.id}>{cell(scoreFor(e, s.id))}</td>
                    ))}
                    <td className="strong">{e.overall ?? '–'}</td>
                    <td>{!e.sub.assigned.includes('make') ? <span className="muted">–</span> : capstoneComplete(e.sub.capstone) ? '✓' : <span className="miss">not done</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Class average</th>
                  {AUTO.map((s) => (
                    <td key={s.id}>{cell(avg((e) => scoreFor(e, s.id)))}</td>
                  ))}
                  <td className="strong">{avg((e) => e.overall) ?? '–'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small">“–” means that section wasn’t assigned. Click a student to see their rounds and hear their sound.</p>
        </section>
      )}

      {sel && (
        <section className="panel">
          <h3>{sel.sub.name}</h3>
          <p className="muted">
            Turned in {fmtDate(sel.sub.submittedAt)}
            {fmtMinutes(sel.sub.startedAt, sel.sub.submittedAt) && `, ${fmtMinutes(sel.sub.startedAt, sel.sub.submittedAt)} after starting`}
          </p>
          <table className="tally">
            <tbody>
              {AUTO.filter((s) => sel.sub.assigned.includes(s.id)).map((s) => {
                const r = sel.sub.results[s.id];
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.title}</th>
                    <td>{r ? r.rounds.join(', ') : <span className="muted">not done</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sel.sub.assigned.includes('make') && (sel.sub.capstone ? <CapstonePlayer key={sel.id} sub={sel.sub} /> : <p className="muted">No sound made yet.</p>)}
        </section>
      )}
    </div>
  );
}

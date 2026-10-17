import { useState } from 'react';
import { decodeSubmission, LOOKS_LIKE_CODE, Submission } from '../lib/codec';
import { AUTO_STATIONS, CAPSTONE_BRIEFS, CAPSTONE_PITCHES, overallScore, stationScore } from '../lib/stations';
import { capstoneAmps, capstoneComplete, playCapstone } from '../lib/capstone';
import { HarmonicBars } from './HarmonicBars';
import { PlayButton } from './ui';

interface Entry {
  id: number;
  sub: Submission;
  overall: number;
  duplicateName: boolean;
}

const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const fmtMinutes = (a: number, b: number) => {
  if (!a || !b || b <= a) return '';
  const m = Math.round((b - a) / 60000);
  return m < 1 ? 'under a minute' : `${m} min`;
};

async function parse(text: string) {
  const seen = new Set<string>();
  const jobs: { token: string; label: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.split(/[\s,;"'|]+/).filter(Boolean);
    const codes = tokens.filter((t) => LOOKS_LIKE_CODE.test(t));
    const label = tokens.filter((t) => !codes.includes(t)).join(' ').slice(0, 40).replace(/[.\s]+$/, '');
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
    else entries.push({ id: entries.length, sub: d, overall: overallScore(d.results), duplicateName: false });
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
  const header = ['Student', 'Submitted', 'Time spent', ...AUTO_STATIONS.map((s) => s.title), 'Auto-graded total', 'Make a sound: done', 'Sound name', 'Brief', 'Explanation'];
  const rows = entries.map((e) => {
    const c = e.sub.capstone;
    return [
      e.sub.name,
      e.sub.submittedAt ? new Date(e.sub.submittedAt).toISOString().slice(0, 16).replace('T', ' ') : '',
      fmtMinutes(e.sub.startedAt, e.sub.submittedAt),
      ...AUTO_STATIONS.map((s) => stationScore(e.sub.results[s.id]) ?? ''),
      e.overall,
      capstoneComplete(c) ? 'yes' : 'no',
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

const cell = (n: number | null) => (n === null ? <span className="muted">–</span> : <span className={n >= 70 ? 'good' : n >= 40 ? 'part' : 'miss'}>{n}</span>);

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
  const sel = entries?.find((e) => e.id === open);

  return (
    <div className="teacher">
      <header className="station-head">
        <h2>Grade codes</h2>
        <p className="goal">Paste one code or a whole class of them (a column copied from Classroom or a spreadsheet works). Nothing is saved or sent anywhere.</p>
      </header>
      <section className="panel">
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
            Couldn't read {unreadable.length} code{unreadable.length > 1 ? 's' : ''} (incomplete, mistyped or edited): {unreadable.join(', ')}. Ask those students to copy their code again.
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
                  {AUTO_STATIONS.map((s) => (
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
                      {e.duplicateName && <span className="flag" title="This name appears on more than one code"> 2+ codes</span>}
                    </th>
                    {AUTO_STATIONS.map((s) => (
                      <td key={s.id}>{cell(stationScore(e.sub.results[s.id]))}</td>
                    ))}
                    <td className="strong">{e.overall}</td>
                    <td>{capstoneComplete(e.sub.capstone) ? '✓' : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Class average</th>
                  {AUTO_STATIONS.map((s) => (
                    <td key={s.id}>{cell(avg((e) => stationScore(e.sub.results[s.id])))}</td>
                  ))}
                  <td className="strong">{avg((e) => e.overall)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small">Click a student to see their rounds and hear their sound. Unfinished stations count as 0 in the total.</p>
        </section>
      )}

      {sel && (
        <section className="panel">
          <h3>{sel.sub.name}</h3>
          <p className="muted">
            Turned in {fmtDate(sel.sub.submittedAt)}
            {fmtMinutes(sel.sub.startedAt, sel.sub.submittedAt) && `, after ${fmtMinutes(sel.sub.startedAt, sel.sub.submittedAt)} of work`}
          </p>
          <table className="tally">
            <tbody>
              {AUTO_STATIONS.map((s) => {
                const r = sel.sub.results[s.id];
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.title}</th>
                    <td>{r ? r.rounds.map((x) => `${x}%`).join(', ') : <span className="muted">not done</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sel.sub.capstone ? (
            <div className="capstone-review">
              <h4>Make a sound: “{sel.sub.capstone.name || 'untitled'}”</h4>
              <p>
                <strong>Brief:</strong> {sel.sub.capstone.brief >= 0 ? CAPSTONE_BRIEFS[sel.sub.capstone.brief] : 'none picked'}
              </p>
              <p>
                <strong>Explanation:</strong> {sel.sub.capstone.why || <span className="muted">none</span>}
              </p>
              <p className="muted small">
                {CAPSTONE_PITCHES[sel.sub.capstone.pitch]?.label} pitch, {sel.sub.capstone.punchy ? 'punchy' : 'soft'} start
              </p>
              <HarmonicBars amps={capstoneAmps(sel.sub.capstone)} count={8} label="The student's harmonic recipe" />
              <div className="btn-row">
                <PlayButton kind="primary" onClick={() => playCapstone(sel.sub.capstone!)}>
                  Play a note
                </PlayButton>
                <PlayButton onClick={() => playCapstone(sel.sub.capstone!, true)}>Play a riff</PlayButton>
              </div>
            </div>
          ) : (
            <p className="muted">No sound made yet.</p>
          )}
        </section>
      )}
    </div>
  );
}

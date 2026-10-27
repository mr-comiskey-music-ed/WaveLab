import { Submission } from '../lib/codec';
import { roundTitle, titlesFor } from '../lib/review';
import { roundTone, StationId, STATIONS } from '../lib/stations';

const AUTO = STATIONS.filter((s) => s.auto);
const FULL = 95;

interface Row {
  title: string;
  order: number;
  answers: number;
  full: number;
}

/**
 * Question by question across the whole class: what share of the answers earned full credit.
 * Students get different random numbers, so rows group the same kind of question (all the "name it by ear" rounds together, say).
 * Only students who finished a section count toward it.
 */
export function ClassQuestions({ subs }: { subs: Submission[] }) {
  const byStation = new Map<StationId, Map<string, Row>>();
  for (const sub of subs) {
    for (const s of AUTO) {
      const r = sub.results[s.id];
      if (!sub.assigned.includes(s.id) || !r) continue;
      const rows = byStation.get(s.id) ?? new Map<string, Row>();
      r.rounds.forEach((score, i) => {
        const title = roundTitle(s.id, i, sub.review?.[s.id]?.[i]);
        const row = rows.get(title) ?? { title, order: Math.max(0, titlesFor(s.id).indexOf(title)) || i, answers: 0, full: 0 };
        row.answers += 1;
        if (score >= FULL) row.full += 1;
        rows.set(title, row);
      });
      byStation.set(s.id, rows);
    }
  }
  if (byStation.size === 0) return null;

  const pct = (r: Row) => Math.round((100 * r.full) / r.answers);
  const all = [...byStation.entries()].flatMap(([id, rows]) => [...rows.values()].map((r) => ({ id, ...r })));
  const hardest = all
    .filter((r) => r.full < r.answers)
    .sort((a, b) => pct(a) - pct(b) || b.answers - a.answers)
    .slice(0, 3);

  return (
    <section className="panel wide">
      <h3>Question by question</h3>
      <p className="panel-note">
        The share of answers that earned full credit, for the whole class. Students get different random numbers, so similar questions are grouped (every “name it by ear” round together, for example).
        Only students who finished a section count toward it.
      </p>
      {hardest.length > 0 && (
        <p className="rv-hardest">
          <strong>Toughest for the class:</strong>{' '}
          {hardest.map((r, i) => (
            <span key={r.id + r.title}>
              {i > 0 && '; '}
              {r.title} ({pct(r)}%)
            </span>
          ))}
        </p>
      )}
      {AUTO.filter((s) => byStation.has(s.id)).map((s) => {
        const rows = [...byStation.get(s.id)!.values()].sort((a, b) => a.order - b.order);
        return (
          <details key={s.id} className="rv-station" open>
            <summary>
              <span className="rv-st-title">{s.title}</span>
            </summary>
            <div className="table-scroll">
              <table className="qstats">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.title}>
                      <th scope="row">{r.title}</th>
                      <td className="q-meter">
                        <span className="meter" aria-hidden="true">
                          <i className={roundTone(pct(r))} style={{ width: `${pct(r)}%` }} />
                        </span>
                      </td>
                      <td className={`q-pct ${roundTone(pct(r))}`}>{pct(r)}%</td>
                      <td className="muted small q-count">
                        {r.full} of {r.answers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </section>
  );
}

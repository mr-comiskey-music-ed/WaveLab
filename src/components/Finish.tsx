import { useState } from 'react';
import { Capstone, Results, StationId, STATIONS } from '../lib/stations';
import { capstoneComplete } from '../lib/capstone';
import { encodeSubmission } from '../lib/codec';
import { copyText } from '../lib/copyText';

interface Props {
  results: Results;
  capstone: Capstone;
  startedAt: number;
  assigned: StationId[];
  onGoTo: (id: StationId) => void;
  onCopied: () => void;
  onStartOver: () => void;
}

export function Finish({ results, capstone, startedAt, assigned, onGoTo, onCopied, onStartOver }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const stations = STATIONS.filter((s) => assigned.includes(s.id));
  const isDone = (id: StationId) => (id === 'make' ? capstoneComplete(capstone) : !!results[id]);
  const missing = stations.filter((s) => !isDone(s.id));
  const includeCapstone = assigned.includes('make') && (capstoneComplete(capstone) || capstone.why.trim() || capstone.name.trim());

  const make = async () => {
    const c = await encodeSubmission({
      name,
      startedAt,
      submittedAt: Date.now(),
      results: Object.fromEntries(Object.entries(results).filter(([id]) => assigned.includes(id as StationId))),
      capstone: includeCapstone ? capstone : undefined,
      assigned,
    });
    setCode(c);
    setCopied(null);
  };

  const copy = async () => {
    const ok = await copyText(code);
    setCopied(ok ? 'yes' : 'no');
    if (ok) onCopied();
  };

  return (
    <div className="station">
      <header className="station-head">
        <h2>Turn in your work</h2>
        <p className="goal">Make a code and paste it into the assignment in Google Classroom.</p>
      </header>

      <section className="panel">
        <h3>Your stations</h3>
        <table className="tally">
          <tbody>
            {stations.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  <button className="link" onClick={() => onGoTo(s.id)}>
                    {s.title}
                  </button>
                </th>
                <td>{isDone(s.id) ? <span className="good">✓ Done</span> : <span className="muted">Not finished</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {missing.length > 0 ? (
          <p className="warn">
            {missing.length === 1 ? 'One station isn’t' : `${missing.length} stations aren’t`} finished yet. Your progress is saved on this Chromebook, so you can come back and finish. Only make a code now if
            your teacher asked you to turn in what you have.
          </p>
        ) : (
          <p className="ok-line">Everything’s done. Nice work!</p>
        )}
      </section>

      <section className="panel">
        <h3>Make your code</h3>
        <label className="field">
          <span>First name and last initial</span>
          <input type="text" maxLength={30} value={name} placeholder="e.g. Jordan M." onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!name.trim()} onClick={make}>
          {code ? 'Make a new code' : 'Make my code'}
        </button>
        {code && (
          <>
            <textarea className="code" readOnly value={code} rows={4} onFocus={(e) => e.target.select()} aria-label="Your code" />
            <div className="btn-row">
              <button className="btn primary" onClick={copy}>
                Copy code
              </button>
              {copied === 'yes' && <span className="ok-line">Copied. Paste it into Google Classroom.</span>}
              {copied === 'no' && <span className="warn">Couldn’t copy automatically. Click in the box, press Ctrl + A, then Ctrl + C.</span>}
            </div>
            <p className="muted small">If you finish more later, make a new code and turn that one in instead.</p>
          </>
        )}
      </section>

      <p className="start-over">
        <button
          className="link quiet-link"
          onClick={() => {
            if (window.confirm('Start over? This erases all your answers on this Chromebook.')) onStartOver();
          }}
        >
          Start over from scratch
        </button>
      </p>
    </div>
  );
}

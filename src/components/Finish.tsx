import { useState } from 'react';
import { AUTO_STATIONS, Capstone, overallScore, Results, stationScore } from '../lib/stations';
import { capstoneComplete } from '../lib/capstone';
import { encodeSubmission } from '../lib/codec';
import { copyText } from '../lib/copyText';

interface Props {
  results: Results;
  capstone: Capstone;
  startedAt: number;
  onGoTo: (index: number) => void;
  onCopied: () => void;
}

export function Finish({ results, capstone, startedAt, onGoTo, onCopied }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const missing = AUTO_STATIONS.filter((s) => !results[s.id]);
  const makeDone = capstoneComplete(capstone);

  const make = async () => {
    const c = await encodeSubmission({
      name,
      startedAt,
      submittedAt: Date.now(),
      results,
      capstone: makeDone || capstone.why.trim() || capstone.name.trim() ? capstone : undefined,
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
            {AUTO_STATIONS.map((s, i) => {
              const sc = stationScore(results[s.id]);
              return (
                <tr key={s.id}>
                  <th scope="row">
                    <button className="link" onClick={() => onGoTo(i)}>
                      {s.title}
                    </button>
                  </th>
                  <td>{sc === null ? <span className="muted">not done</span> : `${sc}%`}</td>
                </tr>
              );
            })}
            <tr className="sum">
              <th scope="row">Auto-graded total</th>
              <td>{overallScore(results)}%</td>
            </tr>
            <tr>
              <th scope="row">
                <button className="link" onClick={() => onGoTo(6)}>
                  Make a sound
                </button>
              </th>
              <td>{makeDone ? 'ready for your teacher' : <span className="muted">not finished</span>}</td>
            </tr>
          </tbody>
        </table>
        {(missing.length > 0 || !makeDone) && (
          <p className="warn">You can still turn in a code now, but unfinished stations count as zero. You can come back, finish them, and make a new code.</p>
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
              {copied === 'no' && <span className="warn">Couldn't copy automatically. Click in the box, press Ctrl + A, then Ctrl + C.</span>}
            </div>
            <p className="muted small">If you finish more stations later, make a new code and turn that one in instead.</p>
          </>
        )}
      </section>
    </div>
  );
}

import { useEffect, useRef } from 'react';

export const PUDDING_URL = 'https://pudding.cool/2018/02/waveforms/';

/** Opens The Pudding in its own window, sized to the left half of the screen. */
export function openPudding() {
  const w = Math.round((window.screen.availWidth || 1366) / 2);
  const h = window.screen.availHeight || 768;
  const win = window.open(PUDDING_URL, 'pudding-waveforms', `popup,width=${w},height=${h},left=0,top=0`);
  if (!win) window.open(PUDDING_URL, '_blank', 'noopener');
}

export function SplitHelp({ onClose }: { onClose: () => void }) {
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
    <dialog ref={ref} className="modal" aria-labelledby="split-title">
      <h2 id="split-title">Set up your screen</h2>
      <p>You'll read The Pudding on one side and do the WaveLab stations on the other.</p>
      <svg className="split-diagram" viewBox="0 0 320 150" role="img" aria-label="Screen split in half: The Pudding on the left, WaveLab on the right">
        <rect x="1" y="1" width="318" height="148" rx="10" fill="var(--sheet)" stroke="var(--grid-strong)" strokeWidth="2" />
        <rect x="12" y="12" width="142" height="126" rx="6" fill="#fdf1f5" stroke="var(--trace-b)" strokeWidth="2" />
        <rect x="166" y="12" width="142" height="126" rx="6" fill="#eef2fd" stroke="var(--trace-a)" strokeWidth="2" />
        <text x="83" y="70" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">The Pudding</text>
        <text x="83" y="92" textAnchor="middle" fontSize="13" fill="var(--ink-soft)">read and play</text>
        <text x="237" y="70" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">WaveLab</text>
        <text x="237" y="92" textAnchor="middle" fontSize="13" fill="var(--ink-soft)">check yourself</text>
      </svg>
      <ol className="setup-steps">
        <li>
          <button className="btn primary" onClick={openPudding}>
            Open The Pudding
          </button>
          <span>It opens in its own window on the left.</span>
        </li>
        <li>
          If it isn't on the left half yet, click on it and press <span className="keys"><kbd>Alt</kbd> + <kbd>[</kbd></span>
        </li>
        <li>
          In The Pudding, press <kbd>M</kbd> to turn its sound on (it starts muted). The number keys <kbd>1</kbd>–<kbd>9</kbd> set the volume.
        </li>
        <li>
          Click back on this WaveLab window and press <span className="keys"><kbd>Alt</kbd> + <kbd>]</kbd></span> to snap it to the right half.
        </li>
      </ol>
      <p className="muted small">
        Not on a Chromebook? On Windows use <span className="keys"><kbd>Win</kbd> + <kbd>←</kbd></span> and <span className="keys"><kbd>Win</kbd> + <kbd>→</kbd></span>. On a Mac, hold the mouse on the green button at the top-left of a window and choose to tile it
        left or right.
      </p>
      <div className="modal-actions">
        <button className="btn primary" onClick={onClose}>
          I'm set up
        </button>
      </div>
    </dialog>
  );
}

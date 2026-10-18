import { Dispatch, SetStateAction, useEffect, useState } from 'react';

/**
 * Saves a student's progress in this browser only (localStorage), so they can close
 * the tab and pick up where they left off. Nothing is sent anywhere and no name is
 * saved: the name is typed only when they make their code.
 *
 * Each assignment link (set of sections) gets its own save slot.
 */

let slot = 'wavelab-progress';
let data: Record<string, unknown> = {};
let timer: number | undefined;

export function initProgress(assignmentKey: string) {
  slot = `wavelab-progress:${assignmentKey || 'all'}`;
  try {
    data = JSON.parse(localStorage.getItem(slot) || '{}') || {};
  } catch {
    data = {};
  }
}

function save() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      localStorage.setItem(slot, JSON.stringify(data));
    } catch {
      /* private window or storage full: progress just won't survive a refresh */
    }
  }, 150);
}

export function readSaved<T>(key: string): T | undefined {
  return data[key] as T | undefined;
}

export function writeSaved(key: string, value: unknown) {
  data[key] = value;
  save();
}

export function clearProgress() {
  data = {};
  try {
    localStorage.removeItem(slot);
  } catch {
    /* fine */
  }
}

/** Like useState, but remembered across page reloads. */
export function useSaved<T>(key: string, init: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const saved = readSaved<T>(key);
    if (saved !== undefined) return saved;
    return typeof init === 'function' ? (init as () => T)() : init;
  });
  useEffect(() => {
    writeSaved(key, value);
  }, [key, value]);
  return [value, setValue];
}

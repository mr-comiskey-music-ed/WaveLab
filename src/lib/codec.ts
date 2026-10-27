import { cleanReview, Review } from './review';
import { Capstone, Results, StationId, STATIONS } from './stations';

const ALL_IDS = STATIONS.map((s) => s.id);

/**
 * Submission codes, same shape as SynthLab's:  <compressed>.<checksum>
 * The work is packed into short JSON, compressed with the browser's built-in
 * deflate, and base64url-encoded. Nothing ever leaves the browser.
 */

export interface Submission {
  name: string;
  startedAt: number; // ms
  submittedAt: number; // ms
  results: Results;
  capstone?: Capstone;
  /** Sections the teacher's link assigned. */
  assigned: StationId[];
  /** What the student saw and answered in each round. Codes made before this existed don't have it. */
  review?: Review;
}

const SALT = 'WAVELAB_PUDDING_COMPANION_2026';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

async function compress(text: string) {
  return toBase64Url(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
}

async function decompress(code: string) {
  try {
    return new TextDecoder().decode(await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw')));
  } catch {
    return null;
  }
}

function checksum(text: string): string {
  let h = 0x811c9dc5;
  const str = text + SALT;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export async function encodeSubmission(s: Submission): Promise<string> {
  const packed: Record<string, unknown> = {
    v: 2,
    n: s.name.trim(),
    a: Math.floor(s.startedAt / 1000),
    t: Math.floor(s.submittedAt / 1000),
    r: Object.fromEntries(
      Object.entries(s.results).map(([id, r]) => [id, r!.rounds.map((x) => Math.round(x))])
    ),
  };
  if (s.assigned.length && s.assigned.length < ALL_IDS.length) packed.x = s.assigned.join(',');
  // Optional extra: older teacher pages ignore it and still read the scores.
  if (s.review && Object.keys(s.review).length) packed.d = s.review;
  if (s.capstone) {
    const c = s.capstone;
    packed.c = { b: c.brief, n: c.name, w: c.why, h: c.bars, p: c.pitch, k: c.punchy ? 1 : 0 };
  }
  const json = JSON.stringify(packed);
  return `${await compress(json)}.${checksum(json)}`;
}

const VALID_IDS = new Set<string>(STATIONS.map((s) => s.id));

/** Returns the work, or null if the code is incomplete, mistyped or edited. */
export async function decodeSubmission(code: string): Promise<Submission | null> {
  const raw = code.trim().replace(/\s+/g, '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const json = await decompress(raw.slice(0, dot));
  if (!json || checksum(json) !== raw.slice(dot + 1)) return null;
  try {
    const d = JSON.parse(json);
    if (!d || d.v !== 2 || typeof d.n !== 'string' || typeof d.r !== 'object') return null;
    const results: Results = {};
    for (const [id, rounds] of Object.entries(d.r as Record<string, number[]>)) {
      if (VALID_IDS.has(id) && Array.isArray(rounds)) results[id as StationId] = { rounds: rounds.map(Number) };
    }
    let capstone: Capstone | undefined;
    if (d.c) {
      capstone = {
        brief: Number(d.c.b) || 0,
        name: String(d.c.n ?? ''),
        why: String(d.c.w ?? ''),
        bars: Array.isArray(d.c.h) ? d.c.h.map(Number) : [],
        pitch: Number(d.c.p) || 0,
        punchy: !!d.c.k,
      };
    }
    const assigned = typeof d.x === 'string' ? (d.x.split(',').filter((id: string) => VALID_IDS.has(id)) as StationId[]) : [...ALL_IDS];
    return {
      name: d.n,
      startedAt: d.a * 1000,
      submittedAt: d.t * 1000,
      results,
      capstone,
      assigned: assigned.length ? assigned : [...ALL_IDS],
      review: cleanReview(d.d),
    };
  } catch {
    return null;
  }
}

/** Codes look like  <letters/numbers/-/_>.<short checksum> */
export const LOOKS_LIKE_CODE = /^[A-Za-z0-9_-]{20,}\.[a-z0-9]{1,8}$/;

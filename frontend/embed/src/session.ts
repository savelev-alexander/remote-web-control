
import type { SessionPersistence } from './types';

const KEY_PREFIX = 'qrremote.session.';

function safeOrigin(): string {
  if (typeof window === 'undefined') return 'about:blank';
  try { return window.location.origin; } catch { return 'about:blank'; }
}

export function storageKey(): string {
  return KEY_PREFIX + safeOrigin();
}

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function pickStorage(mode: SessionPersistence): Storage | null {
  if (mode === 'none') return null;
  if (typeof window === 'undefined') return null;
  try {
    return mode === 'origin' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export async function obtainSession(baseUrl: string, mode: SessionPersistence = 'tab'): Promise<string> {
  const storage = pickStorage(mode);
  const key = storageKey();
  const cached = readCache(storage, key);
  if (cached) return cached;

  const fresh = await postJson<{ session_id: string }>(`${baseUrl}/api/session`, {});
  if (!fresh || typeof fresh.session_id !== 'string' || !fresh.session_id) {
    throw new Error('QRRemote: server returned invalid /api/session response');
  }
  writeCache(storage, key, fresh.session_id);
  return fresh.session_id;
}

export function clearSession(mode: SessionPersistence = 'tab'): void {
  const storage = pickStorage(mode);
  if (!storage) return;
  try { storage.removeItem(storageKey()); } catch {}
}

function readCache(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try { return storage.getItem(key); } catch { return null; }
}

function writeCache(storage: Storage | null, key: string, value: string): void {
  if (!storage) return;
  try { storage.setItem(key, value); } catch {}
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

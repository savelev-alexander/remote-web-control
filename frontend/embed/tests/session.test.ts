import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { obtainSession, clearSession, storageKey } from '../src/session';

describe('session — default tab persistence (sessionStorage)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('hits POST /api/session when no cache', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'fresh-123' }), { status: 200 }));
    const sid = await obtainSession('http://x');
    expect(sid).toBe('fresh-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(storageKey())).toBe('fresh-123');
    expect(localStorage.getItem(storageKey())).toBeNull();
  });

  it('reuses cached session from sessionStorage', async () => {
    sessionStorage.setItem(storageKey(), 'cached-456');
    const sid = await obtainSession('http://x');
    expect(sid).toBe('cached-456');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clearSession removes from sessionStorage only', () => {
    sessionStorage.setItem(storageKey(), 'tab-gone');
    localStorage.setItem(storageKey(), 'origin-stay');
    clearSession();
    expect(sessionStorage.getItem(storageKey())).toBeNull();
    expect(localStorage.getItem(storageKey())).toBe('origin-stay');
  });

  it('throws when server returns invalid /api/session payload', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await expect(obtainSession('http://x')).rejects.toThrow(/invalid \/api\/session/);
  });
});

describe('session — origin persistence (localStorage)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('writes to localStorage when persistSession=origin', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'origin-1' }), { status: 200 }));
    const sid = await obtainSession('http://x', 'origin');
    expect(sid).toBe('origin-1');
    expect(localStorage.getItem(storageKey())).toBe('origin-1');
    expect(sessionStorage.getItem(storageKey())).toBeNull();
  });

  it('reads from localStorage when persistSession=origin', async () => {
    localStorage.setItem(storageKey(), 'origin-cached');
    const sid = await obtainSession('http://x', 'origin');
    expect(sid).toBe('origin-cached');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clearSession(origin) removes from localStorage only', () => {
    sessionStorage.setItem(storageKey(), 'tab-stay');
    localStorage.setItem(storageKey(), 'origin-gone');
    clearSession('origin');
    expect(localStorage.getItem(storageKey())).toBeNull();
    expect(sessionStorage.getItem(storageKey())).toBe('tab-stay');
  });
});

describe('session — none persistence (no cache)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('always fetches new session when persistSession=none', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'one' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'two' }), { status: 200 }));

    const sid1 = await obtainSession('http://x', 'none');
    const sid2 = await obtainSession('http://x', 'none');

    expect(sid1).toBe('one');
    expect(sid2).toBe('two');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(storageKey())).toBeNull();
    expect(localStorage.getItem(storageKey())).toBeNull();
  });
});

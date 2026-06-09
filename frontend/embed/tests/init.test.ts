import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init } from '../src/index';

function mockServer(): ReturnType<typeof vi.fn> {
  let sessionCount = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/session')) {
      sessionCount++;
      return new Response(JSON.stringify({ session_id: `sid-${sessionCount}` }), { status: 200 });
    }
    if (url.includes('/api/registry/')) {
      return new Response(JSON.stringify({ status: 'ok', version: 1 }), { status: 200 });
    }
    if (url.includes('/api/poll')) {
      return new Response(JSON.stringify({ commands: [] }), { status: 200 });
    }
    if (url.endsWith('/api/server-ip')) {
      return new Response(JSON.stringify({ ip: '127.0.0.1' }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('QRRemote.init', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves with a stable sessionId', async () => {
    mockServer();
    const handle = await init({ baseUrl: 'http://localhost' });
    expect(handle.sessionId).toMatch(/^sid-/);
    handle.destroy();
  });

  it('throws on invalid id', async () => {
    mockServer();
    const handle = await init({ baseUrl: 'http://localhost' });
    expect(() => handle.register('has spaces', { kind: 'button', label: 'X', onAction: () => {} }))
      .toThrow(/invalid id/);
    handle.destroy();
  });

  it('throws on slider without min<max', async () => {
    mockServer();
    const handle = await init({ baseUrl: 'http://localhost' });
    expect(() => handle.register('v', { kind: 'slider', label: 'V', min: 10, max: 5, onAction: () => {} }))
      .toThrow(/min<max/);
    handle.destroy();
  });

  it('throws on select without options', async () => {
    mockServer();
    const handle = await init({ baseUrl: 'http://localhost' });
    expect(() => handle.register('s', { kind: 'select', label: 'S', onAction: () => {} }))
      .toThrow(/non-empty options/);
    handle.destroy();
  });

  it('throws on missing onAction', async () => {
    mockServer();
    const handle = await init({ baseUrl: 'http://localhost' });
    expect(() => handle.register('b', { kind: 'button', label: 'B' } as never))
      .toThrow(/missing onAction/);
    handle.destroy();
  });

  it('rejects negative pollMinMs', async () => {
    await expect(init({ baseUrl: 'http://localhost', pollMinMs: -1 }))
      .rejects.toThrow(/out of allowed range/);
  });

  it('rejects non-finite numeric options', async () => {
    await expect(init({ baseUrl: 'http://localhost', pollMinMs: NaN }))
      .rejects.toThrow(/must be a finite number/);
  });

  it('rejects pollMaxMs < pollMinMs', async () => {
    await expect(init({ baseUrl: 'http://localhost', pollMinMs: 5000, pollMaxMs: 1000 }))
      .rejects.toThrow(/out of allowed range/);
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetchMock = mockServer();
    const handle = await init({ baseUrl: 'http://localhost/' });
    expect(handle.sessionId).toBeDefined();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('http://localhost/api/session');
    handle.destroy();
  });

  it('after destroy ignores further register/unregister', async () => {
    mockServer();
    const handle = await init({ baseUrl: 'http://localhost' });
    handle.destroy();
    handle.register('btn', { kind: 'button', label: 'X', onAction: () => {} });
    handle.unregister('btn');
    expect(true).toBe(true);
  });
});

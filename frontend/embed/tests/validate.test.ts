import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init } from '../src/index';

function mockServer() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/session'))     return new Response(JSON.stringify({ session_id: 'sid' }), { status: 200 });
    if (url.includes('/api/registry/'))   return new Response(JSON.stringify({ status: 'ok', version: 1 }), { status: 200 });
    if (url.includes('/api/poll'))        return new Response(JSON.stringify({ commands: [] }), { status: 200 });
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('validateRegister — server-limit parity', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); mockServer(); });
  afterEach(()  => vi.unstubAllGlobals());

  it('rejects label > 200 chars', async () => {
    const h = await init({ baseUrl: 'http://x' });
    expect(() => h.register('a', { kind: 'button', label: 'x'.repeat(201), onAction: () => {} }))
      .toThrow(/exceeds 200/);
    h.destroy();
  });

  it('rejects group > 100 chars', async () => {
    const h = await init({ baseUrl: 'http://x' });
    expect(() => h.register('a', { kind: 'button', label: 'X', group: 'g'.repeat(101), onAction: () => {} }))
      .toThrow(/exceeds 100/);
    h.destroy();
  });

  it('rejects select with > 32 options', async () => {
    const h = await init({ baseUrl: 'http://x' });
    const options = Array.from({ length: 33 }, (_, i) => `opt-${i}`);
    expect(() => h.register('s', { kind: 'select', label: 'S', options, onAction: () => {} }))
      .toThrow(/up to 32 options/);
    h.destroy();
  });

  it('rejects select option > 100 chars', async () => {
    const h = await init({ baseUrl: 'http://x' });
    expect(() => h.register('s', { kind: 'select', label: 'S', options: ['x'.repeat(101)], onAction: () => {} }))
      .toThrow(/invalid option/);
    h.destroy();
  });

  it('rejects select option = empty string', async () => {
    const h = await init({ baseUrl: 'http://x' });
    expect(() => h.register('s', { kind: 'select', label: 'S', options: [''], onAction: () => {} }))
      .toThrow(/invalid option/);
    h.destroy();
  });

  it('rejects slider with NaN bounds', async () => {
    const h = await init({ baseUrl: 'http://x' });
    expect(() => h.register('v', { kind: 'slider', label: 'V', min: NaN, max: 1, onAction: () => {} }))
      .toThrow(/finite min<max/);
    h.destroy();
  });
});

describe('persistSession option', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); mockServer(); });
  afterEach(()  => vi.unstubAllGlobals());

  it('rejects unknown persistSession value', async () => {
    await expect(init({ baseUrl: 'http://x', persistSession: 'forever' as never }))
      .rejects.toThrow(/persistSession must be/);
  });

  it("accepts 'tab', 'origin', 'none'", async () => {
    for (const p of ['tab', 'origin', 'none'] as const) {
      const h = await init({ baseUrl: 'http://x', persistSession: p });
      expect(h.sessionId).toBeDefined();
      h.destroy();
    }
  });
});

describe('ESM no side-effect', () => {
  it('importing init does NOT register window.QRRemote', async () => {
    const win = window as unknown as { QRRemote?: unknown };
    delete win.QRRemote;
    expect(win.QRRemote).toBeUndefined();
  });
});

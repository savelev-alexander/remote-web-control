import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init } from '../src/index';

interface ServerState {
  sessionCount: number;
  pollReturns: 'normal' | '404';
  sessionDelay: Promise<void> | null;
  registryCalls: { sid: string; body: unknown }[];
}

function setupServer(state: ServerState) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, opts?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.endsWith('/api/session')) {
      if (state.sessionDelay) await state.sessionDelay;
      state.sessionCount++;
      return new Response(JSON.stringify({ session_id: `sid-${state.sessionCount}` }), { status: 200 });
    }

    if (url.includes('/api/registry/')) {
      const sid = url.split('/').pop() ?? '';
      state.registryCalls.push({ sid, body: opts?.body ? JSON.parse(opts.body as string) : null });
      return new Response(JSON.stringify({ status: 'ok', version: 1 }), { status: 200 });
    }

    if (url.includes('/api/poll')) {
      if (state.pollReturns === '404') return new Response('not found', { status: 404 });
      return new Response(JSON.stringify({ commands: [] }), { status: 200 });
    }

    return new Response('na', { status: 404 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('re-init buffering', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('register() during re-init is replayed into the new registry', async () => {
    let releaseSession: (() => void) | null = null;
    const state: ServerState = {
      sessionCount: 0,
      pollReturns: 'normal',
      sessionDelay: null,
      registryCalls: [],
    };
    setupServer(state);

    const handle = await init({
      baseUrl: 'http://x',
      pollMinMs: 250,
      pollMaxMs: 250,
      registryFlushMs: 50,
      persistSession: 'none',
    });
    expect(handle.sessionId).toBe('sid-1');

    handle.register('btn-pre', { kind: 'button', label: 'Pre', onAction: () => {} });
    await new Promise(r => setTimeout(r, 80));

    state.pollReturns = '404';
    state.sessionDelay = new Promise(r => { releaseSession = r; });

    await new Promise(r => setTimeout(r, 400));
    state.pollReturns = 'normal';

    handle.register('btn-mid', { kind: 'button', label: 'Mid', onAction: () => {} });

    releaseSession!();
    state.sessionDelay = null;
    await new Promise(r => setTimeout(r, 200));

    expect(handle.sessionId).toBe('sid-2');

    const lastCallForNewSid = [...state.registryCalls].reverse()
      .find(c => c.sid === 'sid-2');
    expect(lastCallForNewSid).toBeDefined();
    const body = lastCallForNewSid!.body as { elements: { id: string }[] };
    const ids = body.elements.map(e => e.id).sort();
    expect(ids).toContain('btn-pre');
    expect(ids).toContain('btn-mid');

    handle.destroy();
  }, 10_000);

  it('destroy() during re-init discards buffered ops', async () => {
    let releaseSession: (() => void) | null = null;
    const state: ServerState = {
      sessionCount: 0,
      pollReturns: 'normal',
      sessionDelay: null,
      registryCalls: [],
    };
    setupServer(state);

    const handle = await init({
      baseUrl: 'http://x',
      pollMinMs: 250,
      pollMaxMs: 250,
      registryFlushMs: 50,
      persistSession: 'none',
    });

    state.pollReturns = '404';
    state.sessionDelay = new Promise(r => { releaseSession = r; });

    await new Promise(r => setTimeout(r, 400));
    handle.register('btn-late', { kind: 'button', label: 'Late', onAction: () => {} });

    handle.destroy();
    releaseSession!();
    state.pollReturns = 'normal';
    state.sessionDelay = null;
    await new Promise(r => setTimeout(r, 200));

    const sawLate = state.registryCalls.some(c => {
      const body = c.body as { elements?: { id: string }[] };
      return body.elements?.some(e => e.id === 'btn-late') ?? false;
    });
    expect(sawLate).toBe(false);
  }, 10_000);
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApiClient,
  parseCommand,
  formatNumber,
  buildClickCmd,
  buildInputCmd,
  buildSelectCmd,
  buildToggleCmd,
  buildSlideCmd,
} from '@shared/api';

describe('parseCommand', () => {
  it('splits on first colon only', () => {
    expect(parseCommand('INPUT:greeting:hello: world')).toEqual({ type: 'INPUT', payload: 'greeting:hello: world' });
  });
  it('uppercases the type', () => {
    expect(parseCommand('click:btn')).toEqual({ type: 'CLICK', payload: 'btn' });
  });
});

describe('command builders', () => {
  it('builds CLICK', () => expect(buildClickCmd('btn-buy')).toBe('CLICK:btn-buy'));
  it('builds INPUT', () => expect(buildInputCmd('name', 'Alice')).toBe('INPUT:name:Alice'));
  it('builds SELECT', () => expect(buildSelectCmd('size', 'M')).toBe('SELECT:size:M'));
  it('builds TOGGLE true', () => expect(buildToggleCmd('dark', true)).toBe('TOGGLE:dark:true'));
  it('builds TOGGLE false', () => expect(buildToggleCmd('dark', false)).toBe('TOGGLE:dark:false'));
  it('builds SLIDE', () => expect(buildSlideCmd('vol', 42)).toBe('SLIDE:vol:42'));
  it('builds SLIDE for tiny values without exponent', () =>
    expect(buildSlideCmd('vol', 0.0000001)).toBe('SLIDE:vol:0.0000001'));
  it('builds SLIDE for huge values without exponent', () =>
    expect(buildSlideCmd('vol', 1e21)).toBe('SLIDE:vol:1000000000000000000000'));
});

describe('formatNumber', () => {
  const NumberRx = /^-?\d+(\.\d+)?$/;
  it('passes through ordinary numbers', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(-3.5)).toBe('-3.5');
  });
  it('expands exponential notation to a server-valid decimal', () => {
    for (const n of [1e-7, 1e21, -1e-9, 12345678901234567890]) {
      expect(NumberRx.test(formatNumber(n))).toBe(true);
    }
  });
});

describe('ApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('createSession POSTs /api/session', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'abc' }), { status: 200 }));
    const c = new ApiClient('http://x');
    const r = await c.createSession();
    expect(r.session_id).toBe('abc');
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/session', expect.objectContaining({ method: 'POST' }));
  });

  it('throws on HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 503 }));
    const c = new ApiClient('http://x');
    await expect(c.execute({ session_id: 's', steps: ['CLICK:a'] })).rejects.toThrow(/HTTP 503/);
  });

  it('getRegistry GETs /api/registry/{sid}', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ version: 3, elements: [] }), { status: 200 }));
    const c = new ApiClient('http://x');
    const r = await c.getRegistry('sid-1');
    expect(r.version).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/registry/sid-1');
  });

  it('putRegistry PUTs with version and elements', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', version: 5 }), { status: 200 }));
    const c = new ApiClient('http://x');
    await c.putRegistry('sid-1', { version: 5, elements: [] });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('PUT');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.version).toBe(5);
  });
});

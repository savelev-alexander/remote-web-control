import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../src/registry';

const sid = 'sess-abc';

describe('Registry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('register/unregister updates internal map', () => {
    const r = new Registry('http://x', sid, 50);
    r.register('a', { kind: 'button', label: 'A', onAction: () => {} });
    expect(r.has('a')).toBe(true);
    r.unregister('a');
    expect(r.has('a')).toBe(false);
  });

  it('debounces flush to server', async () => {
    const r = new Registry('http://x', sid, 100);
    r.register('a', { kind: 'button', label: 'A', onAction: () => {} });
    r.register('b', { kind: 'button', label: 'B', onAction: () => {} });
    r.register('c', { kind: 'button', label: 'C', onAction: () => {} });

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.elements).toHaveLength(3);
    expect(body.version).toBe(1);
  });

  it('strips onAction from the wire payload', async () => {
    const r = new Registry('http://x', sid, 50);
    r.register('a', { kind: 'button', label: 'A', onAction: vi.fn() });
    await vi.advanceTimersByTimeAsync(50);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.elements[0]).not.toHaveProperty('onAction');
    expect(body.elements[0].label).toBe('A');
  });

  it('bumps version on each flush', async () => {
    const r = new Registry('http://x', sid, 30);
    r.register('a', { kind: 'button', label: 'A', onAction: () => {} });
    await vi.advanceTimersByTimeAsync(30);
    r.register('b', { kind: 'button', label: 'B', onAction: () => {} });
    await vi.advanceTimersByTimeAsync(30);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const v1 = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).version;
    const v2 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).version;
    expect(v2).toBeGreaterThan(v1);
  });
});

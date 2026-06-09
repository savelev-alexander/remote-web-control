import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../src/registry';

describe('Registry.snapshot', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('snapshot includes all currently-registered descriptors', () => {
    const r = new Registry('http://x', 'sid', 50);
    const onA = vi.fn();
    const onB = vi.fn();
    r.register('a', { kind: 'button', label: 'A', onAction: onA });
    r.register('b', { kind: 'input',  label: 'B', onAction: onB });

    const snap = r.snapshot();
    expect(snap.size).toBe(2);
    expect(snap.get('a')?.onAction).toBe(onA);
    expect(snap.get('b')?.onAction).toBe(onB);
  });

  it('snapshot is a copy — mutations do not leak back', () => {
    const r = new Registry('http://x', 'sid', 50);
    r.register('a', { kind: 'button', label: 'A', onAction: () => {} });
    const snap = r.snapshot();
    snap.delete('a');
    expect(r.has('a')).toBe(true);
  });

  it('destroy cancels both flush timer and retry timer', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', fetchMock);

    const r = new Registry('http://x', 'sid', 30);
    r.register('a', { kind: 'button', label: 'A', onAction: () => {} });
    await vi.advanceTimersByTimeAsync(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    r.destroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('successful flush cancels pending retry timer', async () => {
    let attempt = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) throw new Error('network');
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = new Registry('http://x', 'sid', 30);
    r.register('a', { kind: 'button', label: 'A', onAction: () => {} });
    await vi.advanceTimersByTimeAsync(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    r.register('b', { kind: 'button', label: 'B', onAction: () => {} });
    await vi.advanceTimersByTimeAsync(30);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serialize strips fields irrelevant to kind', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = new Registry('http://x', 'sid', 10);
    r.register('btn', {
      kind: 'button', label: 'Buy', onAction: () => {},
      // @ts-expect-error: пытаемся передать поля, которые validateRegister не пропустил бы,
      options: ['oops'], min: 0, max: 10, step: 1,
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const wire = body.elements[0];
    expect(wire.id).toBe('btn');
    expect(wire.kind).toBe('button');
    expect(wire.label).toBe('Buy');
    expect(wire.options).toBeUndefined();
    expect(wire.min).toBeUndefined();
    expect(wire.max).toBeUndefined();
    expect(wire.step).toBeUndefined();
  });

  it('serialize keeps slider step only when defined', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = new Registry('http://x', 'sid', 10);
    r.register('s1', { kind: 'slider', label: 'A', min: 0, max: 10, onAction: () => {} });
    r.register('s2', { kind: 'slider', label: 'B', min: 0, max: 10, step: 2, onAction: () => {} });

    await vi.advanceTimersByTimeAsync(10);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const [s1, s2] = body.elements;
    expect(s1.step).toBeUndefined();
    expect(s2.step).toBe(2);
  });
});

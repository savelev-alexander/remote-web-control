import { describe, it, expect, vi } from 'vitest';
import { parseCommand, dispatch } from '../src/dispatch';
import { Registry } from '../src/registry';

function regWith(handlers: Record<string, ReturnType<typeof vi.fn>>) {
  const r = new Registry('http://localhost', 'sid', 100);
  for (const [id, fn] of Object.entries(handlers)) {
    r.register(id, { kind: 'button', label: id, onAction: fn });
  }
  return r;
}

describe('parseCommand', () => {
  it('splits on first colon', () => {
    expect(parseCommand('INPUT:name:Alice Bob')).toEqual({ type: 'INPUT', payload: 'name:Alice Bob' });
  });
  it('handles no payload', () => {
    expect(parseCommand('HEALTHCHECK')).toEqual({ type: 'HEALTHCHECK', payload: '' });
  });
});

describe('dispatch', () => {
  it('routes CLICK to registered handler without arg', async () => {
    const fn = vi.fn();
    const r = regWith({ btn: fn });
    await dispatch(r, 'CLICK:btn');
    expect(fn).toHaveBeenCalledWith();
  });

  it('routes INPUT with value string', async () => {
    const fn = vi.fn();
    const r = regWith({ name: fn });
    await dispatch(r, 'INPUT:name:Alice Bob');
    expect(fn).toHaveBeenCalledWith('Alice Bob');
  });

  it('routes TOGGLE with boolean', async () => {
    const fn = vi.fn();
    const r = regWith({ dark: fn });
    await dispatch(r, 'TOGGLE:dark:true');
    expect(fn).toHaveBeenCalledWith(true);
    await dispatch(r, 'TOGGLE:dark:false');
    expect(fn).toHaveBeenCalledWith(false);
  });

  it('routes SLIDE with number', async () => {
    const fn = vi.fn();
    const r = regWith({ vol: fn });
    await dispatch(r, 'SLIDE:vol:42.5');
    expect(fn).toHaveBeenCalledWith(42.5);
  });

  it('routes SELECT with value string', async () => {
    const fn = vi.fn();
    const r = regWith({ size: fn });
    await dispatch(r, 'SELECT:size:Medium');
    expect(fn).toHaveBeenCalledWith('Medium');
  });

  it('warns and skips for unknown id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = regWith({});
    await dispatch(r, 'CLICK:missing');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores demo feedback commands silently when no onMessage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = regWith({});
    await dispatch(r, 'SHOW_MSG:hello');
    await dispatch(r, 'ALERT:info:warn');
    await dispatch(r, 'PLAY_SOUND:ok');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('delivers addressless commands to onMessage', async () => {
    const onMessage = vi.fn();
    const r = regWith({});
    await dispatch(r, 'SHOW_MSG:hello world', onMessage);
    await dispatch(r, 'ALERT:critical:disk full:now', onMessage);
    await dispatch(r, 'PLAY_SOUND:alarm', onMessage);
    expect(onMessage).toHaveBeenNthCalledWith(1, { type: 'SHOW_MSG', text: 'hello world' });
    expect(onMessage).toHaveBeenNthCalledWith(2, { type: 'ALERT', level: 'critical', text: 'disk full:now' });
    expect(onMessage).toHaveBeenNthCalledWith(3, { type: 'PLAY_SOUND', sound: 'alarm' });
  });

  it('isolates a throwing onMessage from the poll loop', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onMessage = vi.fn(() => { throw new Error('boom'); });
    const r = regWith({});
    await expect(dispatch(r, 'SHOW_MSG:hi', onMessage)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('awaits an async onMessage before resolving', async () => {
    const order: string[] = [];
    const onMessage = vi.fn(async () => {
      await Promise.resolve();
      order.push('onMessage done');
    });
    const r = regWith({});
    await dispatch(r, 'SHOW_MSG:hi', onMessage);
    order.push('dispatch returned');
    expect(order).toEqual(['onMessage done', 'dispatch returned']);
  });

  it('isolates a rejecting async onMessage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onMessage = vi.fn(async () => { throw new Error('async boom'); });
    const r = regWith({});
    await expect(dispatch(r, 'PLAY_SOUND:ok', onMessage)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

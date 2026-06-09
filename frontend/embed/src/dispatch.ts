
import type { Registry } from './registry';
import type { HostMessage } from './types';

export interface ParsedCommand {
  type: string;
  payload: string;
}

export function parseCommand(raw: string): ParsedCommand {
  const idx = raw.indexOf(':');
  if (idx < 0) return { type: raw.trim().toUpperCase(), payload: '' };
  return {
    type: raw.substring(0, idx).trim().toUpperCase(),
    payload: raw.substring(idx + 1),
  };
}

export async function dispatch(
  registry: Registry,
  raw: string,
  onMessage?: (msg: HostMessage) => void | Promise<void>,
): Promise<void> {
  const { type, payload } = parseCommand(raw);

  switch (type) {
    case 'CLICK': {
      const d = registry.get(payload);
      if (!d) return warnUnknown(payload);
      try { await d.onAction(); }
      catch (e) { console.warn(`[qr-remote] onAction('${payload}') threw:`, e); }
      return;
    }
    case 'INPUT':
    case 'SELECT': {
      const [id, value] = splitOnce(payload, ':');
      const d = registry.get(id);
      if (!d) return warnUnknown(id);
      await safeCall(d.onAction, value, id);
      return;
    }
    case 'TOGGLE': {
      const [id, value] = splitOnce(payload, ':');
      const d = registry.get(id);
      if (!d) return warnUnknown(id);
      if (value !== 'true' && value !== 'false') {
        console.warn('[qr-remote] TOGGLE payload not true|false:', value);
        return;
      }
      await safeCall(d.onAction, value === 'true', id);
      return;
    }
    case 'SLIDE': {
      const [id, value] = splitOnce(payload, ':');
      const d = registry.get(id);
      if (!d) return warnUnknown(id);
      const num = Number(value);
      if (!Number.isFinite(num)) {
        console.warn('[qr-remote] SLIDE non-numeric value:', value);
        return;
      }
      await safeCall(d.onAction, num, id);
      return;
    }
    case 'SHOW_MSG':
      await safeMessage(onMessage, { type: 'SHOW_MSG', text: payload });
      return;
    case 'ALERT': {
      const [level, text] = splitOnce(payload, ':');
      await safeMessage(onMessage, { type: 'ALERT', level, text });
      return;
    }
    case 'PLAY_SOUND':
      await safeMessage(onMessage, { type: 'PLAY_SOUND', sound: payload });
      return;
    default:
      console.warn('[qr-remote] unknown command type:', type, raw);
  }
}

function splitOnce(s: string, sep: string): [string, string] {
  const idx = s.indexOf(sep);
  return idx < 0 ? [s, ''] : [s.substring(0, idx), s.substring(idx + 1)];
}

async function safeCall<T>(
  fn: (v?: T) => void | Promise<void>,
  arg: T | undefined,
  id: string,
): Promise<void> {
  try {
    await fn(arg);
  } catch (e) {
    console.warn(`[qr-remote] onAction('${id}') threw:`, e);
  }
}

function warnUnknown(id: string): void {
  console.warn('[qr-remote] no descriptor registered for id:', id);
}

async function safeMessage(
  onMessage: ((msg: HostMessage) => void | Promise<void>) | undefined,
  msg: HostMessage,
): Promise<void> {
  if (!onMessage) return;
  try { await onMessage(msg); }
  catch (e) { console.warn(`[qr-remote] onMessage(${msg.type}) threw:`, e); }
}

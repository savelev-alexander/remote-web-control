
import './styles.css';
import { obtainSession, clearSession } from './session';
import { Registry } from './registry';
import { Poller } from './poller';
import { QrOverlay } from './overlay';
import type {
  QRRemoteHandle, QRRemoteInitOpts, RegistryDescriptor,
  ResolvedOpts, SessionPersistence,
} from './types';

interface Core {
  sessionId: string;
  registry: Registry;
  poller: Poller;
  overlay: QrOverlay;
}

const MIN_POLL_MS  = 250;
const MAX_POLL_MS  = 5 * 60_000;
const MIN_FLUSH_MS = 0;
const MAX_FLUSH_MS = 60_000;

const ID_RX            = /^[a-zA-Z0-9_\-:.]{1,64}$/;
const MAX_LABEL_LEN    = 200;
const MAX_GROUP_LEN    = 100;
const MAX_OPTIONS      = 32;
const MAX_OPTION_LEN   = 100;

function resolveOpts(opts: QRRemoteInitOpts): ResolvedOpts {
  const baseUrl = opts.baseUrl
    ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (!baseUrl) {
    throw new Error('QRRemote.init: baseUrl is required when not running in a browser');
  }
  const minMs   = clampInt('pollMinMs',       opts.pollMinMs       ?? 1000,  MIN_POLL_MS,  MAX_POLL_MS);
  const maxMs   = clampInt('pollMaxMs',       opts.pollMaxMs       ?? Math.max(10_000, minMs), minMs, MAX_POLL_MS);
  const flushMs = clampInt('registryFlushMs', opts.registryFlushMs ?? 200,   MIN_FLUSH_MS, MAX_FLUSH_MS);
  const persistSession = resolvePersistence(opts.persistSession);
  if (opts.onMessage != null && typeof opts.onMessage !== 'function') {
    throw new Error('QRRemote.init: onMessage must be a function');
  }
  return {
    baseUrl: stripTrailingSlash(baseUrl),
    pollMinMs: minMs,
    pollMaxMs: maxMs,
    registryFlushMs: flushMs,
    persistSession,
    onMessage: opts.onMessage,
  };
}

function resolvePersistence(v: SessionPersistence | undefined): SessionPersistence {
  if (v == null) return 'tab';
  if (v !== 'tab' && v !== 'origin' && v !== 'none') {
    throw new Error(`QRRemote.init: persistSession must be 'tab' | 'origin' | 'none', got '${String(v)}'`);
  }
  return v;
}

function clampInt(name: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new Error(`QRRemote.init: ${name} must be a finite number`);
  if (value < min || value > max) {
    throw new Error(`QRRemote.init: ${name}=${value} out of allowed range [${min}, ${max}]`);
  }
  return Math.floor(value);
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

type BufferedOp =
  | { kind: 'register'; id: string; d: RegistryDescriptor }
  | { kind: 'unregister'; id: string };

async function init(rawOpts: QRRemoteInitOpts = {}): Promise<QRRemoteHandle> {
  const opts = resolveOpts(rawOpts);
  let destroyed = false;
  let reinitInProgress = false;
  const buffer: BufferedOp[] = [];

  const core: Core = await buildCore(opts,  null, () => void handleSessionLost());

  const handle: QRRemoteHandle = {
    get sessionId() { return core.sessionId; },
    register(id, d) {
      if (destroyed) return;
      validateRegister(id, d);
      if (reinitInProgress) { buffer.push({ kind: 'register', id, d }); return; }
      core.registry.register(id, d);
    },
    unregister(id) {
      if (destroyed) return;
      if (reinitInProgress) { buffer.push({ kind: 'unregister', id }); return; }
      core.registry.unregister(id);
    },
    showQR(target) {
      if (destroyed) return;
      void core.overlay.show(target);
    },
    hideQR() {
      if (destroyed) return;
      core.overlay.hide();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      buffer.length = 0;
      tearDown(core);
    },
  };

  async function handleSessionLost(): Promise<void> {
    if (destroyed || reinitInProgress) return;
    reinitInProgress = true;
    try {
      console.warn('[qr-remote] session lost on server — reinitialising');
      clearSession(opts.persistSession);
      const survivedDescriptors = core.registry.snapshot();
      const next = await buildCore(opts, survivedDescriptors, () => void handleSessionLost());
      if (destroyed) {
        tearDown(next);
        return;
      }
      const old: Core = { ...core };
      Object.assign(core, next);
      tearDown(old);
      for (const op of buffer) {
        if (op.kind === 'register') core.registry.register(op.id, op.d);
        else                        core.registry.unregister(op.id);
      }
      buffer.length = 0;
    } catch (err) {
      console.warn('[qr-remote] re-init failed:', err);
    } finally {
      reinitInProgress = false;
    }
  }

  return handle;
}

async function buildCore(
  opts: ResolvedOpts,
  carryDescriptors: ReadonlyMap<string, RegistryDescriptor> | null,
  onSessionLost: () => void,
): Promise<Core> {
  const sessionId = await obtainSession(opts.baseUrl, opts.persistSession);

  const registry = new Registry(opts.baseUrl, sessionId, opts.registryFlushMs);
  if (carryDescriptors) {
    for (const [id, d] of carryDescriptors) registry.register(id, d);
  }

  const overlay = new QrOverlay(opts.baseUrl, sessionId);

  const poller = new Poller({
    baseUrl:    opts.baseUrl,
    sessionId,
    registry,
    minMs:      opts.pollMinMs,
    maxMs:      opts.pollMaxMs,
    onSessionLost,
    onMessage:  opts.onMessage,
  });
  poller.start();

  return { sessionId, registry, poller, overlay };
}

function tearDown(core: Core): void {
  core.poller.stop();
  core.registry.destroy();
  core.overlay.hide();
}

function validateRegister(id: string, d: RegistryDescriptor): void {
  if (typeof id !== 'string' || !ID_RX.test(id)) {
    throw new Error(`QRRemote.register: invalid id '${id}' (must match [a-zA-Z0-9_\\-:.]{1,64})`);
  }
  if (!d || typeof d !== 'object')                throw new Error('QRRemote.register: descriptor is required');
  if (typeof d.onAction !== 'function')           throw new Error(`QRRemote.register: ${id} missing onAction`);
  if (typeof d.label !== 'string' || !d.label)    throw new Error(`QRRemote.register: ${id} missing label`);
  if (d.label.length > MAX_LABEL_LEN)
    throw new Error(`QRRemote.register: ${id} label exceeds ${MAX_LABEL_LEN} chars`);
  if (d.group != null) {
    if (typeof d.group !== 'string')              throw new Error(`QRRemote.register: ${id} group must be a string`);
    if (d.group.length > MAX_GROUP_LEN)           throw new Error(`QRRemote.register: ${id} group exceeds ${MAX_GROUP_LEN} chars`);
  }
  switch (d.kind) {
    case 'button': case 'input': case 'toggle': break;
    case 'select':
      if (!Array.isArray(d.options) || d.options.length === 0)
        throw new Error(`QRRemote.register: ${id} kind=select requires non-empty options[]`);
      if (d.options.length > MAX_OPTIONS)
        throw new Error(`QRRemote.register: ${id} kind=select supports up to ${MAX_OPTIONS} options`);
      for (const o of d.options) {
        if (typeof o !== 'string' || o.length === 0 || o.length > MAX_OPTION_LEN)
          throw new Error(`QRRemote.register: ${id} kind=select has invalid option (1..${MAX_OPTION_LEN} chars expected)`);
      }
      break;
    case 'slider':
      if (typeof d.min !== 'number' || typeof d.max !== 'number' || !Number.isFinite(d.min) || !Number.isFinite(d.max) || d.min >= d.max)
        throw new Error(`QRRemote.register: ${id} kind=slider requires finite min<max`);
      if (d.step != null && (!Number.isFinite(d.step) || d.step <= 0))
        throw new Error(`QRRemote.register: ${id} kind=slider step must be > 0`);
      break;
    default:
      throw new Error(`QRRemote.register: ${id} kind='${(d as RegistryDescriptor).kind}' is not supported`);
  }
}

export { init };
export type {
  QRRemoteHandle, QRRemoteInitOpts, RegistryDescriptor, RegistryKind, SessionPersistence, HostMessage,
} from './types';


import type { Registry } from './registry';
import type { HostMessage } from './types';
import { dispatch } from './dispatch';

export interface PollerOpts {
  baseUrl: string;
  sessionId: string;
  registry: Registry;
  minMs: number;
  maxMs: number;
  onSessionLost: () => void;
  onMessage?: (msg: HostMessage) => void | Promise<void>;
}

export class Poller {
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: AbortController | null = null;
  private delay: number;

  constructor(private readonly o: PollerOpts) {
    this.delay = o.minMs;
  }

  start(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), this.delay);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.inFlight) { try { this.inFlight.abort(); } catch {} this.inFlight = null; }
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    this.timer = null;
    this.inFlight = new AbortController();
    try {
      const url = `${this.o.baseUrl}/api/poll?session_id=${encodeURIComponent(this.o.sessionId)}`;
      const res = await fetch(url, { signal: this.inFlight.signal });
      if (this.stopped) return;
      if (res.status === 404) { this.o.onSessionLost(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const body = await res.json() as { commands: string[] };
      this.delay = this.o.minMs;
      for (const cmd of body.commands) {
        if (this.stopped) return;
        await dispatch(this.o.registry, cmd, this.o.onMessage);
      }
    } catch (e) {
      if (this.stopped || this.inFlight?.signal.aborted) return;
      this.delay = Math.min(this.delay * 2, this.o.maxMs);
      console.warn(`[qr-remote] poll failed, retry in ${this.delay}ms:`, e);
    } finally {
      this.inFlight = null;
      if (!this.stopped) this.timer = setTimeout(() => void this.tick(), this.delay);
    }
  }
}

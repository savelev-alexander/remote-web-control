
import type { RegistryDescriptor, RegistryElementWire } from './types';

export class Registry {
  private readonly items = new Map<string, RegistryDescriptor>();
  private version = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPending = false;
  private destroyed = false;

  constructor(
    private readonly baseUrl: string,
    private readonly sessionId: string,
    private readonly flushMs = 200,
  ) {}

  has(id: string): boolean { return this.items.has(id); }
  get(id: string): RegistryDescriptor | undefined { return this.items.get(id); }
  size(): number { return this.items.size; }
  currentVersion(): number { return this.version; }

  snapshot(): Map<string, RegistryDescriptor> {
    return new Map(this.items);
  }

  register(id: string, d: RegistryDescriptor): void {
    if (this.destroyed) return;
    this.items.set(id, d);
    this.scheduleFlush();
  }

  unregister(id: string): void {
    if (this.destroyed) return;
    if (this.items.delete(id)) this.scheduleFlush();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  async flushNow(): Promise<void> {
    if (this.destroyed) return;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    await this.doFlush();
  }

  private scheduleFlush(): void {
    if (this.destroyed) return;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.doFlush();
    }, this.flushMs);
  }

  private async doFlush(): Promise<void> {
    if (this.destroyed) return;
    if (this.flushPending) { this.scheduleFlush(); return; }
    this.flushPending = true;
    let nextVersion: number | null = null;
    try {
      nextVersion = this.version + 1;
      const wire = this.serialize();
      await this.put(nextVersion, wire);
      this.version = nextVersion;
      if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    } catch (err) {
      console.warn('[qr-remote] registry flush failed:', err);
      if (!this.destroyed && !this.retryTimer) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          if (!this.destroyed) void this.doFlush();
        }, 2000);
      }
    } finally {
      this.flushPending = false;
    }
  }

  private serialize(): RegistryElementWire[] {
    const list: RegistryElementWire[] = [];
    for (const [id, d] of this.items) {
      const wire: RegistryElementWire = { id, kind: d.kind, label: d.label };
      if (d.group != null) wire.group = d.group;
      if (d.kind === 'select') {
        wire.options = d.options;
      } else if (d.kind === 'slider') {
        wire.min = d.min;
        wire.max = d.max;
        if (d.step != null) wire.step = d.step;
      }
      list.push(wire);
    }
    return list;
  }

  private async put(version: number, elements: RegistryElementWire[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/registry/${encodeURIComponent(this.sessionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, elements }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
}

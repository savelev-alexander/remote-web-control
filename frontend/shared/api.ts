
import type {
  SessionResponse,
  ExecuteRequest,
  ExecuteResponse,
  PollResponse,
  RegistryResponse,
  PutRegistryRequest,
  PutRegistryResponse,
} from './types';

export class ApiClient {
  constructor(private baseUrl: string = typeof window !== 'undefined' ? window.location.origin : '') {}

  async createSession(): Promise<SessionResponse> {
    return this.post<SessionResponse>('/api/session', {});
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    return this.post<ExecuteResponse>('/api/execute', req);
  }

  async poll(sessionId: string): Promise<PollResponse> {
    return this.get<PollResponse>(`/api/poll?session_id=${encodeURIComponent(sessionId)}`);
  }

  async getServerIp(): Promise<string> {
    const r = await this.get<{ ip: string }>('/api/server-ip');
    return r.ip;
  }

  async getRegistry(sessionId: string): Promise<RegistryResponse> {
    return this.get<RegistryResponse>(`/api/registry/${encodeURIComponent(sessionId)}`);
  }

  async putRegistry(sessionId: string, body: PutRegistryRequest): Promise<PutRegistryResponse> {
    return this.put<PutRegistryResponse>(`/api/registry/${encodeURIComponent(sessionId)}`, body);
  }

  private async post<T>(path: string, body: unknown): Promise<T> { return this.send<T>('POST', path, body); }
  private async put<T>(path: string, body: unknown): Promise<T>  { return this.send<T>('PUT',  path, body); }

  private async send<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(this.baseUrl + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

export function parseCommand(raw: string): { type: string; payload: string } {
  const idx = raw.indexOf(':');
  if (idx < 0) return { type: raw.trim().toUpperCase(), payload: '' };
  return {
    type: raw.substring(0, idx).trim().toUpperCase(),
    payload: raw.substring(idx + 1),
  };
}

const plainNumberFmt = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  maximumFractionDigits: 20,
});

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const s = String(n);
  if (!s.includes('e') && !s.includes('E')) return s;
  return plainNumberFmt.format(n);
}

export const buildClickCmd  = (id: string)                  => `CLICK:${id}`;
export const buildInputCmd  = (id: string, value: string)   => `INPUT:${id}:${value}`;
export const buildSelectCmd = (id: string, value: string)   => `SELECT:${id}:${value}`;
export const buildToggleCmd = (id: string, value: boolean)  => `TOGGLE:${id}:${value ? 'true' : 'false'}`;
export const buildSlideCmd  = (id: string, value: number)   => `SLIDE:${id}:${formatNumber(value)}`;

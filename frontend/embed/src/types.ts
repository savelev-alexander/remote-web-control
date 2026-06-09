export type RegistryKind = 'button' | 'input' | 'select' | 'toggle' | 'slider';

export interface RegistryDescriptor {
  kind: RegistryKind;
  label: string;
  group?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  onAction: (value?: string | number | boolean) => void | Promise<void>;
}

export type HostMessage =
  | { type: 'SHOW_MSG';   text: string }
  | { type: 'ALERT';      level: string; text: string }
  | { type: 'PLAY_SOUND'; sound: string };

export interface QRRemoteHandle {
  register(id: string, d: RegistryDescriptor): void;
  unregister(id: string): void;
  showQR(target?: HTMLElement): void;
  hideQR(): void;
  destroy(): void;
  readonly sessionId: string;
}

export type SessionPersistence = 'tab' | 'origin' | 'none';

export interface QRRemoteInitOpts {
  baseUrl?: string;
  pollMinMs?: number;
  pollMaxMs?: number;
  registryFlushMs?: number;
  persistSession?: SessionPersistence;
  onMessage?: (msg: HostMessage) => void | Promise<void>;
}

export interface ResolvedOpts {
  baseUrl: string;
  pollMinMs: number;
  pollMaxMs: number;
  registryFlushMs: number;
  persistSession: SessionPersistence;
  onMessage?: (msg: HostMessage) => void | Promise<void>;
}

export interface RegistryElementWire {
  id: string;
  kind: RegistryKind;
  label: string;
  group?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

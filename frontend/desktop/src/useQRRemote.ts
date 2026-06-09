
import { useEffect, useRef, useState, useCallback } from 'react';

type RegistryKind = 'button' | 'input' | 'select' | 'toggle' | 'slider';

interface RegistryDescriptor {
  kind: RegistryKind;
  label: string;
  group?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  onAction: (value?: string | number | boolean) => void;
}

interface QRRemoteHandle {
  register(id: string, d: RegistryDescriptor): void;
  unregister(id: string): void;
  showQR(target?: HTMLElement): void;
  hideQR(): void;
  destroy(): void;
  readonly sessionId: string;
}

interface QRRemoteApi {
  init(opts?: { baseUrl?: string }): Promise<QRRemoteHandle>;
}

declare global {
  interface Window { QRRemote: QRRemoteApi; }
}

export interface UseQRRemoteResult {
  ready: boolean;
  sessionId: string | null;
  register: (id: string, d: RegistryDescriptor) => void;
  unregister: (id: string) => void;
  showQR: (target?: HTMLElement) => void;
  hideQR: () => void;
}

export function useQRRemote(): UseQRRemoteResult {
  const handleRef = useRef<QRRemoteHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.QRRemote.init().then(handle => {
      if (cancelled) { handle.destroy(); return; }
      handleRef.current = handle;
      setSessionId(handle.sessionId);
      setReady(true);
    }).catch(err => {
      console.error('[demo] QRRemote.init failed:', err);
    });
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  const register   = useCallback((id: string, d: RegistryDescriptor) => handleRef.current?.register(id, d), []);
  const unregister = useCallback((id: string) => handleRef.current?.unregister(id), []);
  const showQR     = useCallback((target?: HTMLElement) => handleRef.current?.showQR(target), []);
  const hideQR     = useCallback(() => handleRef.current?.hideQR(), []);

  return { ready, sessionId, register, unregister, showQR, hideQR };
}

export function useRegister(
  remote: UseQRRemoteResult,
  id: string,
  descriptor: RegistryDescriptor,
): void {
  const latest = useRef(descriptor);
  latest.current = descriptor;

  useEffect(() => {
    if (!remote.ready) return;
    remote.register(id, {
      ...descriptor,
      onAction: (v) => latest.current.onAction(v),
    });
    return () => remote.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote.ready, id, descriptor.kind, descriptor.label, descriptor.group,
      descriptor.options?.join('|'), descriptor.min, descriptor.max, descriptor.step]);
}

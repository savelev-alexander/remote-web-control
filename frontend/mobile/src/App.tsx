
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiClient,
  buildClickCmd, buildInputCmd, buildSelectCmd, buildToggleCmd, buildSlideCmd,
} from '@shared/api';
import type { RegistryElement } from '@shared/types';
import ButtonWidget from './widgets/ButtonWidget';
import InputWidget from './widgets/InputWidget';
import SelectWidget from './widgets/SelectWidget';
import ToggleWidget from './widgets/ToggleWidget';
import SliderWidget from './widgets/SliderWidget';
import './App.css';

const STORAGE_KEY = 'qrremote.session';
const REGISTRY_POLL_MS = 5000;
const api = new ApiClient();

type Status = { kind: 'info' | 'success' | 'error'; text: string };

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryElement[]>([]);
  const [knownVersion, setKnownVersion] = useState(-1);
  const [status, setStatus] = useState<Status>({ kind: 'info', text: 'Подключение…' });
  const stoppedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('sid');
    let sid: string | null = fromUrl;
    if (fromUrl) {
      try { localStorage.setItem(STORAGE_KEY, fromUrl); } catch {  }
    } else {
      try { sid = localStorage.getItem(STORAGE_KEY); } catch { sid = null; }
    }
    if (!sid) {
      setStatus({ kind: 'error', text: 'Сессия не найдена. Сканируйте QR-код на десктопе.' });
      return;
    }
    setSessionId(sid);
    setStatus({ kind: 'success', text: `Подключено · ${sid.substring(0, 8)}…` });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    stoppedRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stoppedRef.current) return;
      try {
        const resp = await api.getRegistry(sessionId);
        if (stoppedRef.current) return;
        if (resp.version !== knownVersion) {
          setRegistry(resp.elements);
          setKnownVersion(resp.version);
        }
      } catch (e) {
        if (stoppedRef.current) return;
        const msg = (e as Error).message;
        if (msg.includes('404')) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {  }
          setSessionId(null);
          setStatus({ kind: 'error', text: 'Сессия истекла. Пересканируйте QR-код.' });
          return;
        }
        console.warn('[mobile] registry poll failed:', e);
      } finally {
        if (!stoppedRef.current) timer = setTimeout(tick, REGISTRY_POLL_MS);
      }
    };
    tick();
    return () => { stoppedRef.current = true; if (timer) clearTimeout(timer); };
  }, [sessionId, knownVersion]);

  const submit = useCallback(async (cmd: string) => {
    if (!sessionId) return;
    try {
      await api.execute({ session_id: sessionId, steps: [cmd] });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('404')) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {  }
        setSessionId(null);
        setStatus({ kind: 'error', text: 'Сессия истекла. Пересканируйте QR-код.' });
        return;
      }
      setStatus({ kind: 'error', text: `Ошибка: ${msg}` });
    }
  }, [sessionId]);

  function handleReset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {  }
    window.location.search = '';
  }

  const grouped = groupBy(registry, el => el.group ?? 'Прочее');

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">QR-Embed Remote</div>
        <button className="reset" onClick={handleReset} aria-label="Сброс сессии">↻</button>
      </header>

      <div className={`status status-${status.kind}`} data-testid="status">{status.text}</div>

      <main className="content">
        {registry.length === 0 && sessionId && (
          <div className="empty">Host-страница ещё не зарегистрировала элементы. Откройте десктоп.</div>
        )}

        {Object.entries(grouped).map(([groupName, items]) => (
          <fieldset key={groupName} className="group" data-testid={`group-${groupName}`}>
            <legend>{groupName}</legend>
            {items.map(el => (
              <Widget key={el.id} element={el} onSubmit={submit} />
            ))}
          </fieldset>
        ))}
      </main>
    </div>
  );
}

function Widget({ element, onSubmit }: { element: RegistryElement; onSubmit: (cmd: string) => void }) {
  switch (element.kind) {
    case 'button': return <ButtonWidget element={element} onSubmit={onSubmit} buildCmd={buildClickCmd} />;
    case 'input':  return <InputWidget  element={element} onSubmit={onSubmit} buildCmd={buildInputCmd} />;
    case 'select': return <SelectWidget element={element} onSubmit={onSubmit} buildCmd={buildSelectCmd} />;
    case 'toggle': return <ToggleWidget element={element} onSubmit={onSubmit} buildCmd={buildToggleCmd} />;
    case 'slider': return <SliderWidget element={element} onSubmit={onSubmit} buildCmd={buildSlideCmd} />;
    default:       return null;
  }
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Record<string, T[]> {
  const acc: Record<string, T[]> = {};
  for (const item of items) {
    const k = keyOf(item);
    (acc[k] ??= []).push(item);
  }
  return Object.fromEntries(Object.entries(acc).sort(([a], [b]) => a.localeCompare(b, 'ru')));
}

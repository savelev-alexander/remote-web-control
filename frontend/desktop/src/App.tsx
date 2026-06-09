
import { useState, useRef } from 'react';
import { useQRRemote, useRegister } from './useQRRemote';
import './App.css';

interface Toast { id: number; level: 'info' | 'warning' | 'critical'; text: string; }

export default function App() {
  const remote = useQRRemote();
  const [dark, setDark] = useState(false);
  const [size, setSize] = useState('Medium');
  const [color, setColor] = useState('Чёрный');
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [volume, setVolume] = useState(40);
  const [purchases, setPurchases] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const qrSlotRef = useRef<HTMLDivElement>(null);

  function addToast(level: Toast['level'], text: string, ttl = 4000) {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, level, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ttl);
  }

  useRegister(remote, 'toggle-dark', {
    kind: 'toggle', label: 'Тёмная тема', group: 'Внешний вид',
    onAction: v => setDark(Boolean(v)),
  });
  useRegister(remote, 'btn-show-qr', {
    kind: 'button', label: 'Показать QR-код', group: 'Внешний вид',
    onAction: () => remote.showQR(),
  });

  useRegister(remote, 'btn-buy', {
    kind: 'button', label: 'Купить сейчас', group: 'Призыв к действию',
    onAction: () => {
      setPurchases(p => p + 1);
      addToast('info', `Покупка №${purchases + 1} оформлена`);
    },
  });
  useRegister(remote, 'btn-subscribe', {
    kind: 'button', label: 'Подписаться на рассылку', group: 'Призыв к действию',
    onAction: () => {
      setSubscribed(true);
      addToast('info', 'Подписка активна');
    },
  });

  useRegister(remote, 'sel-size', {
    kind: 'select', label: 'Размер', group: 'Конфигуратор',
    options: ['Small', 'Medium', 'Large'],
    onAction: v => setSize(String(v ?? 'Medium')),
  });
  useRegister(remote, 'sel-color', {
    kind: 'select', label: 'Цвет', group: 'Конфигуратор',
    options: ['Чёрный', 'Белый', 'Синий', 'Красный'],
    onAction: v => setColor(String(v ?? 'Чёрный')),
  });
  useRegister(remote, 'sld-qty', {
    kind: 'slider', label: 'Количество', group: 'Конфигуратор',
    min: 1, max: 10, step: 1,
    onAction: v => setQuantity(Number(v ?? 1)),
  });

  useRegister(remote, 'inp-name', {
    kind: 'input', label: 'Имя', group: 'Форма обратной связи',
    onAction: v => setName(String(v ?? '')),
  });
  useRegister(remote, 'inp-email', {
    kind: 'input', label: 'Email', group: 'Форма обратной связи',
    onAction: v => setEmail(String(v ?? '')),
  });
  useRegister(remote, 'inp-message', {
    kind: 'input', label: 'Сообщение', group: 'Форма обратной связи',
    onAction: v => setMessage(String(v ?? '')),
  });

  useRegister(remote, 'sld-volume', {
    kind: 'slider', label: 'Громкость', group: 'Аудио',
    min: 0, max: 100, step: 5,
    onAction: v => setVolume(Number(v ?? 40)),
  });
  useRegister(remote, 'btn-test-alert', {
    kind: 'button', label: 'Показать тест-уведомление', group: 'Аудио',
    onAction: () => addToast('warning', 'Тестовое уведомление получено с телефона', 5000),
  });

  return (
    <div className={`app ${dark ? 'theme-dark' : 'theme-light'}`}>
      <header className="topbar">
        <div className="brand">
          <span className="logo">▮▮</span>
          <span>Acme Demo</span>
        </div>
        <div className="topbar-right">
          <span className={`status ${remote.ready ? 'ok' : 'pending'}`}>
            {remote.ready ? `Готово · ${remote.sessionId?.substring(0, 8)}…` : 'Инициализация…'}
          </span>
          <button className="btn-secondary" onClick={() => remote.showQR(qrSlotRef.current ?? undefined)}>
            QR-парный пульт
          </button>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <h1>QR-Embed Remote — демонстратор</h1>
          <p className="lead">
            Эта страница — обычный React-сайт. Подключение библиотеки <code>qr-remote.js</code> и
            регистрация элементов через хук <code>useRegister</code> делают её управляемой с телефона —
            без переделок самой страницы. Сканируйте QR справа, чтобы протестировать.
          </p>
          <div className="cta-row">
            <button className="btn-primary" onClick={() => { setPurchases(p => p + 1); addToast('info', `Покупка №${purchases + 1} оформлена`); }}>
              Купить сейчас
            </button>
            <button className={`btn-outline ${subscribed ? 'is-on' : ''}`} onClick={() => { setSubscribed(true); addToast('info', 'Подписка активна'); }}>
              {subscribed ? 'Подписан ✓' : 'Подписаться'}
            </button>
            <div className="kpi" aria-live="polite">
              Покупок: <strong data-testid="purchases">{purchases}</strong>
            </div>
          </div>
        </section>

        <div ref={qrSlotRef} className="qr-slot" aria-label="QR код для парного телефона" />

        <section className="grid">
          <div className="card">
            <h2>Конфигуратор</h2>
            <div className="field">
              <label>Размер</label>
              <select value={size} onChange={e => setSize(e.target.value)}>
                {['Small', 'Medium', 'Large'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Цвет</label>
              <select value={color} onChange={e => setColor(e.target.value)}>
                {['Чёрный', 'Белый', 'Синий', 'Красный'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Количество: <span data-testid="quantity-display">{quantity}</span></label>
              <input type="range" min={1} max={10} step={1} value={quantity}
                     onChange={e => setQuantity(Number(e.target.value))} />
            </div>
            <div className="config-summary">
              <span className="pill">{size}</span>
              <span className="pill">{color}</span>
              <span className="pill">× {quantity}</span>
            </div>
          </div>

          <div className="card">
            <h2>Форма обратной связи</h2>
            <div className="field">
              <label htmlFor="f-name">Имя</label>
              <input id="f-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Анна" />
            </div>
            <div className="field">
              <label htmlFor="f-email">Email</label>
              <input id="f-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="anna@example.com" />
            </div>
            <div className="field">
              <label htmlFor="f-msg">Сообщение</label>
              <textarea id="f-msg" rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Расскажите…" />
            </div>
            <div className="form-preview">
              <div><strong>{name || '—'}</strong> <span className="muted">({email || '—'})</span></div>
              <div className="muted">{message || 'Сообщение появится здесь'}</div>
            </div>
          </div>

          <div className="card">
            <h2>Аудио</h2>
            <div className="field">
              <label>Громкость: <span data-testid="volume-display">{volume}</span>%</label>
              <input type="range" min={0} max={100} step={5} value={volume}
                     onChange={e => setVolume(Number(e.target.value))} />
            </div>
            <div className="volume-meter">
              <div className="volume-bar" style={{ width: `${volume}%` }} />
            </div>
            <button className="btn-secondary" onClick={() => addToast('warning', 'Тестовое уведомление', 4000)}>
              Тест-уведомление
            </button>
          </div>
        </section>
      </main>

      <div className="toasts" role="status">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.level}`} data-testid="toast">{t.text}</div>
        ))}
      </div>
    </div>
  );
}

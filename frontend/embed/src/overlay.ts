
import { renderQrSvg, buildMobileUrl } from './qr';

const OVERLAY_ID = 'qr-remote-overlay';

export class QrOverlay {
  private container: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly sessionId: string,
  ) {}

  async show(target?: HTMLElement): Promise<void> {
    if (typeof document === 'undefined') return;
    this.hide();

    let url: string;
    try {
      url = await buildMobileUrl(this.baseUrl, this.sessionId);
    } catch (e) {
      console.warn('[qr-remote] failed to build mobile URL:', e);
      return;
    }

    const svg = renderQrSvg(url, 220);

    const wrap = document.createElement('div');
    wrap.id = OVERLAY_ID;
    wrap.className = target ? 'qr-remote-embedded' : 'qr-remote-floating';
    wrap.innerHTML = `
      <div class="qr-remote-card" role="dialog" aria-modal="true" aria-label="QR Remote pairing">
        <div class="qr-remote-title">Scan with your phone</div>
        <div class="qr-remote-svg" data-mobile-url="${escapeAttr(url)}">${svg}</div>
        <div class="qr-remote-url">${escapeHtml(url)}</div>
        <button class="qr-remote-close" type="button" aria-label="Close">✕</button>
      </div>
    `;

    const closeBtn = wrap.querySelector('.qr-remote-close');
    closeBtn?.addEventListener('click', () => this.hide());

    if (!target) {
      this.keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.hide(); };
      document.addEventListener('keydown', this.keyHandler);
      wrap.addEventListener('click', (e) => { if (e.target === wrap) this.hide(); });
    }

    (target ?? document.body).appendChild(wrap);
    this.container = wrap;
  }

  hide(): void {
    if (this.keyHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      return;
    }
    if (typeof document !== 'undefined') {
      const existing = document.getElementById(OVERLAY_ID);
      if (existing) existing.remove();
    }
  }
}

const ESC_HTML: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ESC_HTML[c] ?? c);
}
function escapeAttr(s: string): string { return escapeHtml(s); }

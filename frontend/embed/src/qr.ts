
import qrcode from 'qrcode-generator';

export function renderQrSvg(text: string, sizePx = 220): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  const cell = sizePx / modules;
  let path = '';
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (qr.isDark(y, x)) {
        path += `M${(x * cell).toFixed(2)},${(y * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

export async function buildMobileUrl(baseUrl: string, sessionId: string): Promise<string> {
  let host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  try {
    const res = await fetch(`${baseUrl}/api/server-ip`);
    if (res.ok) {
      const body = await res.json() as { ip?: unknown };
      if (typeof body.ip === 'string' && body.ip.length > 0) host = body.ip;
    }
  } catch {}

  const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
  return `${proto}//${host}${port}/mobile/?sid=${encodeURIComponent(sessionId)}`;
}

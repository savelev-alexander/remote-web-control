import { test, expect, request, devices } from '@playwright/test';

test.describe('QR pair + trigger', () => {

  test('paired tap on mobile flips desktop state', async ({ browser }) => {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const dPage = await desktop.newPage();

    await dPage.goto('/desktop/');
    await expect(dPage.locator('.status.ok')).toBeVisible({ timeout: 15_000 });

    await dPage.getByRole('button', { name: 'QR-парный пульт' }).click();
    const qrSvg = dPage.locator('.qr-remote-svg[data-mobile-url]');
    await expect(qrSvg).toBeVisible();
    const mobileUrlAbs = await qrSvg.getAttribute('data-mobile-url');
    expect(mobileUrlAbs).toBeTruthy();

    const mobile = await browser.newContext(devices['iPhone 13']);
    const mPage = await mobile.newPage();
    const url = new URL(mobileUrlAbs!);
    await mPage.goto(`${url.pathname}${url.search}`);

    const buyButton = mPage.getByTestId('widget-btn-buy');
    await expect(buyButton).toBeVisible({ timeout: 15_000 });

    const purchasesBefore = Number(await dPage.getByTestId('purchases').innerText());
    await buyButton.click();

    await expect.poll(
      async () => Number(await dPage.getByTestId('purchases').innerText()),
      { timeout: 10_000 }
    ).toBe(purchasesBefore + 1);
    await expect(dPage.getByTestId('toast').first()).toBeVisible();

    await mobile.close();
    await desktop.close();
  });

  test('slider on mobile updates volume on desktop', async ({ browser }) => {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const dPage = await desktop.newPage();
    await dPage.goto('/desktop/');
    await expect(dPage.locator('.status.ok')).toBeVisible({ timeout: 15_000 });
    await dPage.getByRole('button', { name: 'QR-парный пульт' }).click();
    const qrUrl = await dPage.locator('.qr-remote-svg[data-mobile-url]').getAttribute('data-mobile-url');

    const mobile = await browser.newContext(devices['iPhone 13']);
    const mPage = await mobile.newPage();
    const url = new URL(qrUrl!);
    await mPage.goto(`${url.pathname}${url.search}`);

    const slider = mPage.getByTestId('widget-sld-volume');
    await expect(slider).toBeVisible({ timeout: 15_000 });

    await slider.fill('80');
    await slider.dispatchEvent('pointerup');

    await expect.poll(
      async () => Number(await dPage.getByTestId('volume-display').innerText()),
      { timeout: 10_000 }
    ).toBe(80);

    await mobile.close();
    await desktop.close();
  });

});

test('health endpoints respond', async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const h = await ctx.get('/health');
  expect(h.status()).toBe(200);
  const r = await ctx.get('/ready');
  expect(r.status()).toBe(200);
  await ctx.dispose();
});

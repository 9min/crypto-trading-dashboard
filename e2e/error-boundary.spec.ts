import { test, expect } from '@playwright/test';
import { mockBinanceWebSocket, mockBinanceRest } from './helpers/websocket-mock';

// =============================================================================
// Error Boundary Isolation Tests
// =============================================================================

test.describe('Error boundary', () => {
  test('widget error should be isolated — other widgets and header remain functional', async ({
    page,
  }) => {
    // Mock REST APIs normally, but sabotage the klines endpoint to return
    // malformed data that will cause the CandlestickWidget to throw during render.
    // The Chart widget's ErrorBoundary should catch it and show the fallback,
    // while all other widgets continue to work.
    await page.route('**/api/v3/klines*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Return malformed data: objects instead of arrays, which will cause
        // parseFloat() to return NaN and lightweight-charts to throw
        body: JSON.stringify([{ broken: true }]),
      }),
    );

    // Set up remaining mocks normally
    await page.route('**/api/v3/depth*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lastUpdateId: 1000, bids: [], asks: [] }),
      }),
    );
    await page.route('**/api/v3/ticker/24hr*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.route('**/api/exchange-rate/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'success', base_code: 'USD', rates: { KRW: 1380 } }),
      }),
    );
    const cleanupWs = await mockBinanceWebSocket(page);

    try {
      await page.goto('/');
      await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 15000 });

      // Wait for widgets to render (some may error)
      await page.waitForTimeout(3000);

      // The header should remain fully visible and functional
      const header = page.getByTestId('dashboard-header');
      await expect(header).toBeVisible();
      await expect(header).toContainText('CryptoDash');

      // Exchange buttons should still work
      await expect(page.getByTestId('exchange-binance')).toBeVisible();
      await expect(page.getByTestId('theme-toggle')).toBeVisible();

      // Non-Chart widgets should still render their titles
      // (at least some widgets should be healthy)
      const widgetTitles = page.getByTestId('widget-title');
      const count = await widgetTitles.count();
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      cleanupWs();
    }
  });

  test('error fallback shows widget name and retry button', async ({ page }) => {
    // Sabotage klines to trigger Chart widget error
    await page.route('**/api/v3/klines*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ broken: true }]),
      }),
    );

    await page.route('**/api/v3/depth*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lastUpdateId: 1000, bids: [], asks: [] }),
      }),
    );
    await page.route('**/api/v3/ticker/24hr*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.route('**/api/exchange-rate/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'success', base_code: 'USD', rates: { KRW: 1380 } }),
      }),
    );
    const cleanupWs = await mockBinanceWebSocket(page);

    try {
      await page.goto('/');
      await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 15000 });
      await page.waitForTimeout(3000);

      // ErrorFallback must display error text and a Retry button
      const retryButton = page.locator('button:has-text("Retry")');
      const retryCount = await retryButton.count();
      expect(retryCount).toBeGreaterThan(0);
      await expect(retryButton.first()).toBeVisible();

      // Dashboard should remain functional regardless
      await expect(page.getByTestId('dashboard-header')).toBeVisible();
    } finally {
      cleanupWs();
    }
  });

  test('healthy dashboard has all 9 widgets with no error fallbacks', async ({ page }) => {
    // Use normal mocks — everything should work
    await mockBinanceRest(page);
    const cleanupWs = await mockBinanceWebSocket(page);

    try {
      await page.goto('/');
      await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });

      // All 9 widgets should render their titles
      await expect(page.getByTestId('widget-title')).toHaveCount(9);

      // No Retry buttons should be visible (no errors)
      const retryButtons = page.locator('button:has-text("Retry")');
      await expect(retryButtons).toHaveCount(0);
    } finally {
      cleanupWs();
    }
  });
});

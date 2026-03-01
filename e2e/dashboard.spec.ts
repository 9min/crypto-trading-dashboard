import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/websocket-mock';

// =============================================================================
// Dashboard Loading & Widget Rendering Tests
// =============================================================================

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    const cleanup = await setupMocks(page);
    await page.goto('/');
    // Wait for the dashboard grid to hydrate and render widgets
    await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });
    // Store cleanup for afterEach if needed (Playwright handles page close)
    void cleanup;
  });

  test('should load the page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Crypto Trading Dashboard');
  });

  test('should render the dashboard header', async ({ page }) => {
    const header = page.getByTestId('dashboard-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('CryptoDash');
  });

  test('should display the active symbol', async ({ page }) => {
    const header = page.getByTestId('dashboard-header');
    // Default symbol is BTC/USDT on Binance
    await expect(header).toContainText('BTC/USDT');
  });

  test('should render all 10 widgets', async ({ page }) => {
    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(10);

    const expectedTitles = [
      'Chart',
      'Order Book',
      'Trades',
      'Watchlist',
      'Kimchi Premium',
      'Depth Chart',
      'Performance',
      'Futures',
      'Trade',
      'Multi Chart',
    ];

    for (const title of expectedTitles) {
      await expect(
        page.getByTestId('widget-title').filter({ hasText: new RegExp(`^${title}$`) }),
      ).toBeVisible();
    }
  });

  test('should show connection status', async ({ page }) => {
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible();
    // With mocked WebSocket, connection state should indicate connected
    await expect(status).toContainText(/(Connected|Connecting)/);
  });

  test('should render canvas elements for canvas-based widgets with non-zero dimensions', async ({
    page,
  }) => {
    // OrderBook, Trades, Depth Chart, and Performance widgets use canvas rendering
    // Wait for canvases to appear (they may be created after component mount)
    await page.waitForTimeout(2000);

    const canvases = page.locator('canvas');
    const count = await canvases.count();

    // At least some canvas elements should exist for canvas-based widgets
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify each canvas has non-zero dimensions
    for (let i = 0; i < count; i++) {
      const canvas = canvases.nth(i);
      const box = await canvas.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
      }
    }
  });
});

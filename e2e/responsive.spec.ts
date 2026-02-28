import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/websocket-mock';

// =============================================================================
// Responsive Layout Tests
// =============================================================================

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('desktop (1400x900): all 9 widgets visible', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });

    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(9);

    // All widgets should be visible without scrolling
    const titles = [
      'Chart',
      'Order Book',
      'Trades',
      'Watchlist',
      'Kimchi Premium',
      'Depth Chart',
      'Performance',
      'Futures',
      'Trade',
    ];

    for (const title of titles) {
      await expect(
        page.getByTestId('widget-title').filter({ hasText: new RegExp(`^${title}$`) }),
      ).toBeVisible();
    }
  });

  test('tablet (768x1024): all 9 widgets present and visible', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });

    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(9);

    // Widgets should all be in the DOM
    for (const title of ['Chart', 'Order Book', 'Watchlist']) {
      await expect(
        page.getByTestId('widget-title').filter({ hasText: new RegExp(`^${title}$`) }),
      ).toBeAttached();
    }
  });

  test('mobile (480x800): tab-based layout with single active widget', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="mobile-header"]', { timeout: 15000 });

    // Mobile header and tab bar should be visible
    await expect(page.getByTestId('mobile-header')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // Default tab is "chart" — shows Chart + Watchlist in split view
    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(2);
    await expect(widgetTitles.first()).toHaveText('Chart');
    await expect(widgetTitles.nth(1)).toHaveText('Watchlist');
  });

  test('header remains visible across all viewports', async ({ page }) => {
    const viewports = [
      { width: 1400, height: 900, headerTestId: 'dashboard-header' },
      { width: 768, height: 1024, headerTestId: 'dashboard-header' },
      { width: 480, height: 800, headerTestId: 'mobile-header' },
    ];

    for (const { width, height, headerTestId } of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForSelector(`[data-testid="${headerTestId}"]`, { timeout: 15000 });

      const header = page.getByTestId(headerTestId);
      await expect(header).toBeVisible();
    }
  });
});

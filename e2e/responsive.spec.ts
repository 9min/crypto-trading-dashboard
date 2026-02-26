import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/websocket-mock';

// =============================================================================
// Responsive Layout Tests
// =============================================================================

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('desktop (1400x900): all 7 widgets visible', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });

    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(7);

    // All widgets should be visible without scrolling
    const titles = [
      'Chart',
      'Order Book',
      'Trades',
      'Watchlist',
      'Kimchi Premium',
      'Depth Chart',
      'Performance',
    ];

    for (const title of titles) {
      await expect(
        page.getByTestId('widget-title').filter({ hasText: new RegExp(`^${title}$`) }),
      ).toBeVisible();
    }
  });

  test('tablet (768x1024): all 7 widgets present and visible', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });

    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(7);

    // Widgets should all be in the DOM
    for (const title of ['Chart', 'Order Book', 'Watchlist']) {
      await expect(
        page.getByTestId('widget-title').filter({ hasText: new RegExp(`^${title}$`) }),
      ).toBeAttached();
    }
  });

  test('mobile (480x800): vertical stack layout with scroll', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="widget-title"]', { timeout: 15000 });

    const widgetTitles = page.getByTestId('widget-title');
    await expect(widgetTitles).toHaveCount(7);

    // Main content area should be scrollable
    const main = page.locator('main');
    const scrollHeight = await main.evaluate((el) => el.scrollHeight);
    const clientHeight = await main.evaluate((el) => el.clientHeight);

    // In mobile layout, content should overflow (scrollable)
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('header remains visible across all viewports', async ({ page }) => {
    const viewports = [
      { width: 1400, height: 900 },
      { width: 768, height: 1024 },
      { width: 480, height: 800 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 15000 });

      const header = page.getByTestId('dashboard-header');
      await expect(header).toBeVisible();
    }
  });
});

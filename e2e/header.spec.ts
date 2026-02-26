import { test, expect } from '@playwright/test';
import { setupMocks, mockUpbitApis } from './helpers/websocket-mock';

// =============================================================================
// Header Interaction Tests
// =============================================================================

test.describe('Header interactions', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await mockUpbitApis(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 15000 });
  });

  test('should toggle theme between dark and light', async ({ page }) => {
    const themeToggle = page.getByTestId('theme-toggle');
    await expect(themeToggle).toBeVisible();

    // Default theme is dark — html element should have data-theme="dark"
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Click to switch to light mode
    await themeToggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Click again to switch back to dark mode
    await themeToggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('should switch exchange to Upbit and update symbol display', async ({ page }) => {
    const header = page.getByTestId('dashboard-header');

    // Default: Binance is active, symbol shows BTC/USDT
    await expect(header).toContainText('BTC/USDT');

    // Click Upbit exchange button
    const upbitButton = page.getByTestId('exchange-upbit');
    await upbitButton.click();

    // Symbol should change to Upbit format (BTC/KRW)
    await expect(header).toContainText('BTC/KRW');

    // Switch back to Binance
    const binanceButton = page.getByTestId('exchange-binance');
    await binanceButton.click();
    await expect(header).toContainText('BTC/USDT');
  });

  test('should change kline interval', async ({ page }) => {
    // Default interval is 1m — should be active (aria-pressed)
    const interval1m = page.getByTestId('interval-1m');
    await expect(interval1m).toHaveAttribute('aria-pressed', 'true');

    // Click 5m interval
    const interval5m = page.getByTestId('interval-5m');
    await interval5m.click();

    // 5m should now be active, 1m should not
    await expect(interval5m).toHaveAttribute('aria-pressed', 'true');
    await expect(interval1m).toHaveAttribute('aria-pressed', 'false');
  });

  test('should display all interval options', async ({ page }) => {
    const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

    for (const interval of intervals) {
      const button = page.getByTestId(`interval-${interval}`);
      await expect(button).toBeVisible();
      await expect(button).toContainText(interval);
    }
  });

  test('should display both exchange buttons', async ({ page }) => {
    await expect(page.getByTestId('exchange-binance')).toBeVisible();
    await expect(page.getByTestId('exchange-upbit')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Settings Panel UI', () => {
  test('should expand to full side panel width and use an opaque background', async ({ page }) => {
    await page.goto('/');

    const settingsButton = page.getByRole('button', { name: 'Settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    const settingsPanel = page.locator('.settings-panel.open');
    const sidebar = page.locator('.sidebar');

    await expect(settingsPanel).toBeVisible();
    await expect(sidebar).toBeVisible();

    const layout = await page.evaluate(() => {
      const panel = document.querySelector('.settings-panel') as HTMLElement | null;
      const sidebarEl = document.querySelector('.sidebar') as HTMLElement | null;

      if (!panel || !sidebarEl) {
        return null;
      }

      const panelStyles = window.getComputedStyle(panel);
      const panelWidth = panel.getBoundingClientRect().width;
      const sidebarWidth = sidebarEl.getBoundingClientRect().width;
      const backgroundColor = panelStyles.backgroundColor;
      const alphaMatch = backgroundColor.match(/rgba?\([^,]+,\s*[^,]+,\s*[^,]+(?:,\s*([\d.]+))?\)/);
      const alpha = alphaMatch?.[1] ? Number(alphaMatch[1]) : 1;

      return {
        panelWidth,
        sidebarWidth,
        isOpaque: alpha >= 1,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.panelWidth).toBeCloseTo(layout!.sidebarWidth, 0);
    expect(layout!.isOpaque).toBe(true);
  });
});

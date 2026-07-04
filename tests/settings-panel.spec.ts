import { test, expect } from '@playwright/test';

test.describe('Settings Panel UI', () => {
  test('should expand to full side panel width and use an opaque background', async ({ page }) => {
    await page.goto('/');

    const settingsButton = page.getByRole('button', { name: 'Settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    const settingsPanel = page.locator('.settings-panel.open');
    const sidebar = page.locator('.sidebar');
    const miniSidebar = page.locator('.mini-sidebar');

    await expect(settingsPanel).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(miniSidebar).toBeVisible();

    const layout = await page.evaluate(() => {
      const panel = document.querySelector('.settings-panel.open') as HTMLElement | null;
      const sidebarEl = document.querySelector('.sidebar') as HTMLElement | null;
      const miniSidebarEl = document.querySelector('.mini-sidebar') as HTMLElement | null;

      if (!panel || !sidebarEl || !miniSidebarEl) {
        return null;
      }

      const panelStyles = window.getComputedStyle(panel);
      const panelWidth = panel.getBoundingClientRect().width;
      const sidebarWidth = sidebarEl.getBoundingClientRect().width;
      const miniSidebarWidth = miniSidebarEl.getBoundingClientRect().width;
      const miniRect = miniSidebarEl.getBoundingClientRect();
      const miniCenterX = miniRect.left + miniRect.width / 2;
      const miniCenterY = miniRect.top + miniRect.height / 2;
      const topElementAtMiniCenter = document.elementFromPoint(miniCenterX, miniCenterY);
      const backgroundColor = panelStyles.backgroundColor;
      const alphaMatch = backgroundColor.match(/rgba?\([^,]+,\s*[^,]+,\s*[^,]+(?:,\s*([\d.]+))?\)/);
      const alpha = alphaMatch?.[1] ? Number(alphaMatch[1]) : 1;

      return {
        panelWidth,
        expectedPanelWidth: sidebarWidth,
        miniSidebarUncovered: !!topElementAtMiniCenter && miniSidebarEl.contains(topElementAtMiniCenter),
        miniSidebarWidth,
        isOpaque: alpha >= 1,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.panelWidth).toBeCloseTo(layout!.expectedPanelWidth, 0);
    expect(layout!.miniSidebarWidth).toBeGreaterThan(0);
    expect(layout!.miniSidebarUncovered).toBe(true);
    expect(layout!.isOpaque).toBe(true);
  });
});

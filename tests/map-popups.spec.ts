import { test, expect } from '@playwright/test';

test.describe('Map Popups and Tooltips E2E Tests', () => {
  test('should display persistent tooltips on click and toggle them off on click-again or click-away', async ({ page }) => {
    // Go to the home page
    await page.goto('/');

    // Load NYC Demo Trip
    const loadDemoBtn = page.getByRole('button', { name: 'Load NYC Demo Trip' });
    await expect(loadDemoBtn).toBeVisible();
    await loadDemoBtn.click();

    // Wait for Leaflet map custom markers to render
    const marker = page.locator('.leaflet-custom-marker').first();
    await expect(marker).toBeVisible();

    // 1. Verify Hover Tooltip initially shows
    // Hover over the marker
    await marker.hover();

    const tooltip = page.locator('.leaflet-tooltip.map-tooltip').first();
    await expect(tooltip).toBeVisible();

    // Verify hover tooltip styles (font-weight: 400 and width: 15ch/approx 120px)
    const tooltipStyles = await tooltip.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontWeight: style.fontWeight,
        width: style.width,
        whiteSpace: style.whiteSpace,
      };
    });
    
    expect(tooltipStyles.fontWeight).toBe('400');
    expect(parseFloat(tooltipStyles.width)).toBeGreaterThan(80);
    expect(tooltipStyles.whiteSpace).toBe('normal');

    // Move mouse away to close tooltip
    await page.mouse.move(0, 0);
    await expect(tooltip).not.toBeVisible();

    // 2. Verify Click on marker makes the tooltip persistent (remains visible when mouse moves away)
    // Click the marker to make it active/selected
    await marker.click();

    // The tooltip should now be visible and persistent
    await expect(tooltip).toBeVisible();

    // Move mouse away
    await page.mouse.move(0, 0);

    // The tooltip should STILL be visible (persistent)
    await expect(tooltip).toBeVisible();

    // 3. Verify clicking the marker again makes it unpersistent and closes it when mouse is away
    await marker.click();
    await page.mouse.move(0, 0);

    // The tooltip should now be closed/not visible
    await expect(tooltip).not.toBeVisible();

    // 4. Verify Click again to make persistent, then Click Away to close
    await marker.click();
    await expect(tooltip).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeVisible();

    // Click on the map background to click away
    const mapContainer = page.locator('.leaflet-container');
    await mapContainer.click({ position: { x: 500, y: 500 }, force: true });

    // The tooltip should now be closed/not visible
    await expect(tooltip).not.toBeVisible();
  });
});

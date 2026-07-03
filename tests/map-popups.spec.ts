import { test, expect } from '@playwright/test';

test.describe('Map Popups and Tooltips E2E Tests', () => {
  test('should display tooltips and popups with identical sizes and manage tooltip visibility dynamically on popup events', async ({ page }) => {
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

    // 2. Verify Click Popup opens and disables tooltip
    // Click the marker to select it
    await marker.click();

    const popup = page.locator('.leaflet-popup.map-popup-bubble').first();
    await expect(popup).toBeVisible();

    const popupContent = page.locator('.leaflet-popup.map-popup-bubble .leaflet-popup-content').first();
    await expect(popupContent).toBeVisible();

    // Verify click popup content styles match tooltip exactly
    const popupContentStyles = await popupContent.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        width: style.width,
        whiteSpace: style.whiteSpace,
      };
    });

    const popupWrapperStyles = await page.locator('.leaflet-popup.map-popup-bubble .leaflet-popup-content-wrapper').first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontWeight: style.fontWeight,
      };
    });

    expect(popupWrapperStyles.fontWeight).toBe('400');
    expect(parseFloat(popupContentStyles.width)).toBeGreaterThan(80);
    expect(popupContentStyles.whiteSpace).toBe('normal');

    // Hover over the clicked (active) marker again
    await marker.hover();

    // The tooltip should NOT be visible because it is unbound for the active marker
    await expect(tooltip).not.toBeVisible();

    // Move mouse away
    await page.mouse.move(0, 0);

    // 3. Verify Tooltip Re-enables when Clicked Off (Popup Closed)
    // Click on the map background to close the popup
    const mapContainer = page.locator('.leaflet-container');
    await mapContainer.click({ position: { x: 500, y: 500 }, force: true });

    // The popup should be gone
    await expect(popup).not.toBeVisible();

    // Hover over the marker again
    await marker.hover();

    // The tooltip should show up again!
    await expect(tooltip).toBeVisible();
  });
});

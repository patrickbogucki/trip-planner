import { test, expect } from '@playwright/test';

test.describe('Global Route Preference Selector', () => {
  test('should toggle route preference and update active trip routing globally', async ({ page }) => {
    // Mock the Mapbox API to return two alternative routes:
    // Route 1 (duration-optimal): 2000m, 60s
    // Route 2 (distance-optimal): 1000m, 120s
    await page.route('https://api.mapbox.com/directions/v5/mapbox/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 2000,
              duration: 60,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-73.9990, 40.7246],
                  [-74.0062, 40.7420]
                ]
              }
            },
            {
              distance: 1000,
              duration: 120,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-73.9990, 40.7246],
                  [-74.0062, 40.7420]
                ]
              }
            }
          ]
        })
      });
    });

    // Go to the home page
    await page.goto('/');

    // Load NYC Demo Trip
    const loadDemoBtn = page.getByRole('button', { name: 'Load NYC Demo Trip' });
    await expect(loadDemoBtn).toBeVisible();
    await loadDemoBtn.click();

    // Switch to Day 3 where we will set the segment to driving
    const day3Tab = page.locator('.day-tab-btn').filter({ hasText: 'Day 3' });
    await expect(day3Tab).toBeVisible();
    await day3Tab.click();

    // Change commute mode of the segment to Driving
    const driveBtn = page.getByTitle('Drive');
    await expect(driveBtn).toBeVisible();
    await driveBtn.click();

    // Verify the global route preference selector is rendered next to the 'Fit Map' button
    const dropdown = page.locator('.route-preference-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toHaveValue('fastest');

    // By default, the preference is "fastest". The route stats should show the duration-optimal route (2.0 km, 1 min)
    const statsContainer = page.locator('.connection-stats');
    await expect(statsContainer).toBeVisible();
    await expect(statsContainer).toContainText('2.0 km');
    await expect(statsContainer).toContainText('1 min');

    // Change dropdown selection to 'Shortest Route'
    await dropdown.selectOption('shortest');
    await expect(dropdown).toHaveValue('shortest');

    // Verify that the route is recalculated and updates to the distance-optimal route (1.0 km, 2 min)
    await expect(statsContainer).toContainText('1.0 km');
    await expect(statsContainer).toContainText('2 min');
  });
});

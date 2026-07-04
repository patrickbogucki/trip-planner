import { test, expect, type Page, type Route } from '@playwright/test';

const loadDemoTrip = async (page: Page) => {
  const loadDemoBtn = page.getByRole('button', { name: 'Load NYC Demo Trip' });
  await expect(loadDemoBtn).toBeVisible();
  await loadDemoBtn.click();
};

const selectDay = async (page: Page, dayLabel: string) => {
  const tab = page.locator('.day-tab-btn').filter({ hasText: dayLabel }).first();
  await expect(tab).toBeVisible();
  await tab.click();
};

test.describe('Mapbox token handling and token-dependent routing', () => {
  test('should persist token override and use it for directions requests', async ({ page }) => {
    const directionUrls: string[] = [];

    await page.route('https://api.mapbox.com/directions/v5/mapbox/**', async (route: Route) => {
      directionUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 1200,
              duration: 300,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-73.999, 40.7246],
                  [-74.0062, 40.7420],
                ],
              },
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await loadDemoTrip(page);

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#dev-mapbox-token').fill('override-token-abc');
    await page.getByLabel('Close Settings').click();

    await selectDay(page, 'Day 3');
    await page.getByTitle('Drive').click();
    await expect(page.locator('.connection-stats')).toBeVisible();

    await page.reload();
    await selectDay(page, 'Day 3');
    await page.getByTitle('Drive').click();
    await expect(page.locator('.connection-stats')).toBeVisible();

    expect(directionUrls.length).toBeGreaterThan(0);
    expect(directionUrls.some((url) => url.includes('access_token=override-token-abc'))).toBe(true);
  });

  test('should gracefully fall back when token-dependent routing fails', async ({ page }) => {
    await page.route('https://api.mapbox.com/directions/v5/mapbox/**', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'routing unavailable' }),
      });
    });

    await page.goto('/');
    await loadDemoTrip(page);

    await selectDay(page, 'Day 3');
    await page.getByTitle('Drive').click();

    const stats = page.locator('.connection-stats').first();
    await expect(stats).toBeVisible();
    await expect(stats).not.toContainText('No route found');
  });
});

import { test, expect, type Page } from '@playwright/test';

const loadDemoTrip = async (page: Page) => {
  const loadDemoBtn = page.getByRole('button', { name: 'Load NYC Demo Trip' });
  await expect(loadDemoBtn).toBeVisible();
  await loadDemoBtn.click();
};

const openTripOptions = async (page: Page) => {
  await page.getByTitle('Trip options').click();
};

const activeTripName = (page: Page) => page.locator('.trip-dropdown-trigger .trip-name-text');

test.describe('Persistence and migration coverage', () => {
  test('should persist trip mutations across reload', async ({ page }) => {
    await page.goto('/');
    await loadDemoTrip(page);

    await openTripOptions(page);
    await page.getByRole('button', { name: 'New Trip' }).click();
    await page.getByPlaceholder('Trip name (e.g. Summer in Tokyo)').fill('Persisted Trip');
    await page.getByTitle('Create Trip').click();
    await expect(activeTripName(page)).toContainText('Persisted Trip');

    await page.reload();
    await expect(activeTripName(page)).toContainText('Persisted Trip');

    const localState = await page.evaluate(() => ({
      trips: localStorage.getItem('horizon_trips'),
      activeTripId: localStorage.getItem('horizon_active_trip_id'),
    }));
    expect(localState.trips).toContain('Persisted Trip');
    expect(localState.activeTripId).toBeTruthy();
  });

  test('should migrate legacy single-trip storage keys into horizon_trips', async ({ page }) => {
    await page.addInitScript(() => {
      const locId = 'legacy-loc-1';
      localStorage.setItem(
        'horizon_saved_locations',
        JSON.stringify([
          {
            id: locId,
            name: 'Legacy Cafe',
            displayName: '123 Legacy Ave',
            lat: 40.7128,
            lng: -74.006,
            category: 'coffee',
          },
        ])
      );
      localStorage.setItem(
        'horizon_itinerary',
        JSON.stringify([
          {
            id: 'legacy-itin-1',
            locationId: locId,
            durationHours: 1,
            durationMinutes: 0,
            commuteMode: 'walking',
          },
        ])
      );
      localStorage.removeItem('horizon_trips');
      localStorage.removeItem('horizon_active_trip_id');
    });

    await page.goto('/');
    await expect(activeTripName(page)).toContainText('My Saved Trip');
    await expect(page.locator('.itinerary-card-title').filter({ hasText: 'Legacy Cafe' })).toHaveCount(1);

    const migrationState = await page.evaluate(() => ({
      legacySaved: localStorage.getItem('horizon_saved_locations'),
      legacyItinerary: localStorage.getItem('horizon_itinerary'),
      trips: localStorage.getItem('horizon_trips'),
    }));
    expect(migrationState.legacySaved).toBeNull();
    expect(migrationState.legacyItinerary).toBeNull();
    expect(migrationState.trips).toContain('My Saved Trip');
    expect(migrationState.trips).toContain('Legacy Cafe');
  });

  test('should recover from malformed trips JSON without crashing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('horizon_trips', '{this-is-not-valid-json');
      localStorage.removeItem('horizon_active_trip_id');
    });

    await page.goto('/');
    await expect(page.locator('.trip-dropdown-trigger')).toBeVisible();
    await expect(activeTripName(page)).toContainText('My First Trip');
  });
});

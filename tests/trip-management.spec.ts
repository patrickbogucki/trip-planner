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

test.describe('Trip and day lifecycle mutations', () => {
  test('should create, rename, and delete trips with active-trip fallback', async ({ page }) => {
    await page.goto('/');
    await loadDemoTrip(page);

    await openTripOptions(page);
    await page.getByRole('button', { name: 'New Trip' }).click();
    await page.getByPlaceholder('Trip name (e.g. Summer in Tokyo)').fill('Tokyo Sprint');
    await page.getByTitle('Create Trip').click();
    await expect(activeTripName(page)).toContainText('Tokyo Sprint');

    await openTripOptions(page);
    await page.getByRole('button', { name: 'Rename' }).click();
    const renameInput = page.locator('.trip-action-form input').first();
    await renameInput.fill('Tokyo Renamed');
    await page.getByTitle('Save Name').click();
    await expect(activeTripName(page)).toContainText('Tokyo Renamed');

    await openTripOptions(page);
    await page.getByRole('button', { name: 'New Trip' }).click();
    await page.getByPlaceholder('Trip name (e.g. Summer in Tokyo)').fill('Backup Trip');
    await page.getByTitle('Create Trip').click();
    await expect(activeTripName(page)).toContainText('Backup Trip');

    page.once('dialog', (dialog) => dialog.accept());
    await openTripOptions(page);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(activeTripName(page)).toContainText('Tokyo Renamed');
  });

  test('should prevent deleting the last remaining trip', async ({ page }) => {
    await page.goto('/');

    await openTripOptions(page);
    const deleteBtn = page.getByRole('button', { name: 'Delete' });
    await expect(deleteBtn).toBeDisabled();
  });
});

import { test, expect, type Locator, type Page } from '@playwright/test';

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

const locationCard = (page: Page, name: string): Locator =>
  page.locator('.saved-item').filter({ hasText: name }).first();

test.describe('Itinerary and day mutation flows', () => {
  test('should assign a pinned location to a day and cascade removal when unpinned', async ({ page }) => {
    await page.goto('/');
    await loadDemoTrip(page);

    await page.getByLabel('Pinned Locations').click();

    const standardCard = locationCard(page, 'The Standard, High Line');
    await expect(standardCard).toBeVisible();
    await standardCard.locator('.saved-days-trigger-btn').click();
    await standardCard.getByText('Day 1').click();

    await page.getByLabel('Itinerary').click();
    await selectDay(page, 'Day 1');
    await expect(page.locator('.itinerary-card-title').filter({ hasText: 'The Standard, High Line' })).toHaveCount(1);

    await page.getByLabel('Pinned Locations').click();
    await standardCard.getByTitle('Unpin location').click();

    await page.getByLabel('Itinerary').click();
    await selectDay(page, 'Day 1');
    await expect(page.locator('.itinerary-card-title').filter({ hasText: 'The Standard, High Line' })).toHaveCount(0);
    await selectDay(page, 'Day 2');
    await expect(page.locator('.itinerary-card-title').filter({ hasText: 'The Standard, High Line' })).toHaveCount(0);
  });

  test('should add/remove days and mutate itinerary stops', async ({ page }) => {
    await page.goto('/');
    await loadDemoTrip(page);

    await page.getByTitle('Add a day to this trip').click();
    await expect(page.locator('.day-tab-btn').filter({ hasText: 'Day 4' })).toHaveCount(1);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTitle('Remove Day 2').click();
    await expect(page.locator('.day-tab-btn').filter({ hasText: 'Day 4' })).toHaveCount(0);
    await expect(page.locator('.day-tab-btn .day-tab-num')).toHaveText(['Day 1', 'Day 2', 'Day 3']);

    await selectDay(page, 'Day 1');
    await page.getByRole('button', { name: 'Add Destination' }).click();
    await page.locator('.add-dest-item').filter({ hasText: 'SoHo Shopping District' }).first().click();
    await expect(page.locator('.itinerary-card-title').filter({ hasText: 'SoHo Shopping District' })).toHaveCount(1);

    const firstCard = page.locator('.itinerary-card').first();
    await firstCard.getByTitle('More options').click();
    await page.getByRole('button', { name: 'Remove Stop' }).click();
    await expect(page.locator('.itinerary-card').filter({ hasText: 'Blue Bottle Coffee' })).toHaveCount(0);
  });
});

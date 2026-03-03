import { test, expect } from '@playwright/test';

test('landing loads and shows brand', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MongoArchitect/i);
  await expect(page.getByText('MongoArchitect')).toBeVisible();
});

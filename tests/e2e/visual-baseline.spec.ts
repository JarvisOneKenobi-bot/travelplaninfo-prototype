import { test, expect } from '@playwright/test';

[1280, 1440, 1920].forEach((width) => {
  test(`planner/[tripId] at ${width}w baseline screenshot`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const post = await context.request.post('/api/trips/', {
      data: { name: 'Visual test', destination: 'Cancún', budget: 'midrange' },
    });
    const trip = await post.json();
    await page.goto(`/planner/${trip.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`planner-tripId-${width}.png`, { fullPage: true });
  });
});

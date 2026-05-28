import { test, expect } from '@playwright/test';

test.describe('Planner trust + trigger governance', () => {
  test('Atlas does not auto-send for Surprise Me trip', async ({ page }) => {
    // Track all network requests to /api/assistant/chat
    const sseCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/assistant/chat')) {
        sseCalls.push(req.url());
      }
    });

    // Navigate to a planner page
    await page.goto('/planner/1', { waitUntil: 'domcontentloaded' });

    // Inject a mock trip context with Surprise Me destination into sessionStorage
    // This simulates what would happen after a Surprise Me trip is loaded
    await page.evaluate(() => {
      const mockContext = {
        tripId: '1',
        destination: 'Surprise Me',
        items: [],
        dates: null,
        flexibleWindow: null,
        tripLength: null,
      };
      sessionStorage.setItem('tpi_trip_context', JSON.stringify(mockContext));
    });

    // Wait for the auto-trigger window (800ms) plus some buffer
    await page.waitForTimeout(2000);

    // Verify no SSE call was made — the guard blocks auto-trigger for "Surprise Me"
    expect(sseCalls).toHaveLength(0);
  });
});

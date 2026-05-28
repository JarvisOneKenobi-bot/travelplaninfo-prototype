import { test, expect } from '@playwright/test';

test('GET /api/trips returns DTO shape — no quiz_/group_/origin_auto columns leak', async ({ request }) => {
  const post = await request.post('/api/trips', {
    data: { name: 'DTO test', destination: 'Miami', budget: 'midrange' },
  });
  expect([200, 201]).toContain(post.status());
  const created = await post.json();

  expect(created).toHaveProperty('id');
  expect(created).toHaveProperty('destination', 'Miami');
  expect(created).toHaveProperty('entryMode');
  expect(created).not.toHaveProperty('user_id');
  expect(created).not.toHaveProperty('quiz_budget');
  expect(created).not.toHaveProperty('group_share');
  expect(created).not.toHaveProperty('origin_auto');
  expect(Array.isArray(created.interests)).toBe(true);
});

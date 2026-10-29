import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('explore automated WCAG findings', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  for (const item of results.violations) {
    console.log(`${item.impact}: ${item.id} (${item.nodes.length}) — ${item.help}`);
  }
  console.log(`axe found ${results.violations.length} rule categories`);
  expect(Array.isArray(results.violations)).toBe(true);
});

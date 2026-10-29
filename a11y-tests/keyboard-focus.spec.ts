import { test, expect } from '@playwright/test';

test('explore keyboard focus path', async ({ page }) => {
  await page.goto('/');
  const reached: string[] = [];

  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press('Tab');
    const value = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const name = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '')
        .trim().replace(/\s+/g, ' ').slice(0, 60);
      return `${element.getAttribute('role') || element.tagName.toLowerCase()}: ${name || '(unnamed)'}`;
    });
    if (value) reached.push(value);
  }

  console.log(reached.map((item, index) => `${index + 1}. ${item}`).join('\n'));
  expect(reached.length).toBeGreaterThan(8);
});

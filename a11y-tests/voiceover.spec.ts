import pkg from '@guidepup/playwright';
import { expect } from '@playwright/test';
const { voiceOverTest: test } = pkg;

test.use({ headless: false });
// 基线 55 步止于 Territory 面板的 South 卡片；100 步覆盖进度条、Operations pulse 与 Recent activity。
const STEP_COUNT = 100;
// 超时按步数同比放大（基线 55 步 / 5 分钟 → 100 步 / 10 分钟，含余量）。
test.describe.configure({ timeout: 10 * 60_000, retries: 1 });

test('VoiceOver announces meaningful field operations content', async ({ page, voiceOver }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('header').waitFor();
  await voiceOver.navigateToWebContent();

  const spoken: string[] = [];
  for (let index = 0; index < STEP_COUNT; index += 1) {
    await voiceOver.next();
    spoken.push(await voiceOver.lastSpokenPhrase());
  }

  console.log(`VOICEOVER_TRANSCRIPT\n${spoken.join('\n')}`);
  expect(spoken.join(' ')).toMatch(/RelayOps|Field operations/i);
  expect(spoken.join(' ')).toMatch(/SLA risk increased 12\.6%/i);
});

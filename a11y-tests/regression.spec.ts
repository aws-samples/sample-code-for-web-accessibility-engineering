/**
 * Gate_Suite — `npm run test:a11y:gate` 的唯一入口。
 *
 * Feature: a11y-audit-remediation
 * 原有 4 个顶层用例名称保持不变（Req 15.1）；A / B / C 层新增用例按 design §2 用 `test.describe` 分组。
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  writeJson,
  runDate,
  getPhase,
  resetLog,
  appendLog,
  logHeader,
  screenshotPath,
  resolveSrcState,
  appendStateAssertion,
  STATE_ASSERTIONS_LOG,
  FORCED_COLORS_LOG,
  appendForcedColorCheck,
  evidencePath,
  type ForcedColorCheck,
  type SrcState,
  type StateAssertion,
} from './helpers/evidence';
import {
  APPROVED_TAB_ORDER,
  findNamedGenericElements,
  formatFocusStop,
  formatGenericViolations,
  matchesApprovedStop,
  normalizeName,
  parseAriaSnapshotRoot,
  readFocusStop,
  type ApprovedStop,
} from './helpers/a11y-tree';
import { CONTRAST_CASES, contrastRatio, parseColor, type RGB } from './helpers/contrast';

/** Axe_Scanner 完整标签集（Req 5.1、5.4：不缩减、不禁用规则、不排除选择器）。 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** "Next work orders" 面板：`section[aria-labelledby="jobs-heading"]` → region 角色。 */
const jobsPanel = (page: Page): Locator => page.getByRole('region', { name: 'Next work orders' });

/** SLA_Risk_Metric：summary strip 中标签为 `SLA risk` 的指标块。 */
const slaMetric = (page: Page): Locator =>
  page.locator('.summary-strip > *').filter({ has: page.locator('.metric-label', { hasText: /^SLA risk$/ }) });

/** 计算样式颜色统一转成 `#rrggbb`，便于与设计值比较。 */
const toHex = (css: string): string => {
  const { r, g, b } = parseColor(css);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

test('selected WCAG A/AA rules have no automated violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    nodeCount: v.nodes.length,
    targets: v.nodes.map((n) => n.target.map(String).join(' ')),
  }));
  const totalNodes = violations.reduce((sum, v) => sum + v.nodeCount, 0);

  // Req 5.2 / design §3：报告记录规则 id、impact、节点数与 target 选择器。
  writeJson('axe-report.json', {
    date: runDate(),
    phase: getPhase(),
    axeVersion: results.testEngine.version,
    tags: AXE_TAGS,
    url: results.url,
    ruleCount: violations.length,
    nodeCount: totalNodes,
    violations,
  });

  // Req 1.5 / 5.3：失败输出逐条列出规则 id、impact 与每个节点的 target。
  const message = [
    `axe violations: ${violations.length} rules / ${totalNodes} nodes`,
    ...violations.flatMap((v) => [
      `- ${v.id} (impact: ${v.impact ?? 'unknown'}, nodes: ${v.nodeCount})`,
      ...v.targets.map((t) => `    target: ${t}`),
    ]),
  ].join('\n');
  expect(results.violations.length, message).toBe(0);
});

test('hero controls follow the approved keyboard order', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search work orders' });
  const region = page.getByRole('combobox', { name: 'Region' });
  const schedule = page.getByRole('button', { name: /Schedule visit/ });
  await search.focus();
  await page.keyboard.press('Tab');
  await expect(region).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(schedule).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(region).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(search).toBeFocused();
});

test('SLA risk exposes direction in text', async ({ page }) => {
  await page.goto('/');
  // Req 10.1 / 10.5：恰好 1 个匹配且可见。
  const direction = page.getByText(/Increased 12\.6%/i);
  await expect(direction).toHaveCount(1);
  await expect(direction).toBeVisible();
});

test('territory cards expose valid group semantics', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('group', { name: /allocated/ })).toHaveCount(3);
});

test.describe('A: names and structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Req 1.1, 1.2, 1.6
  test('icon buttons have exact accessible names', async ({ page }) => {
    for (const name of ['More actions', 'Filter work orders']) {
      await expect
        .soft(page.getByRole('button', { name, exact: true }), `button "${name}" must resolve exactly once`)
        .toHaveCount(1);
    }
  });

  // Req 2.1, 2.5
  test('region combobox is labelled by a visible label', async ({ page }) => {
    const region = page.getByRole('combobox', { name: 'Region', exact: true });
    await expect(region).toHaveCount(1);

    // 名称不得仅来自隐藏属性：combobox 自身不带 aria-label，名称来自 aria-labelledby 指向的可见标签。
    await expect(region).not.toHaveAttribute('aria-label', /.*/);
    const labelledby = (await region.getAttribute('aria-labelledby')) ?? '';
    const ids = labelledby.split(/\s+/).filter(Boolean);
    expect(ids, 'combobox must reference its label via aria-labelledby').not.toHaveLength(0);

    const labels = ids.map((id) => page.locator(`[id="${id}"]`));
    const texts = await Promise.all(labels.map((l) => l.textContent()));
    const labelIndex = texts.findIndex((t) => (t ?? '').replace(/\s+/g, ' ').trim() === 'Region');
    expect(labelIndex, `aria-labelledby targets: ${JSON.stringify(texts)}`).toBeGreaterThanOrEqual(0);
    await expect(labels[labelIndex]).toBeVisible();

    // Req 2.5：与 Tab 序中 Search 之后、Schedule visit 之前的控件为同一节点。
    await page.getByRole('searchbox', { name: 'Search work orders' }).focus();
    await page.keyboard.press('Tab');
    await expect(region).toBeFocused();
  });

  // Req 3.1, 3.2
  test('work orders render as ul > li > button', async ({ page }) => {
    const panel = jobsPanel(page);
    await expect(panel).toHaveCount(1);

    const lists = panel.getByRole('list');
    await expect(lists).toHaveCount(1);
    const items = lists.getByRole('listitem');
    await expect(items).toHaveCount(3);

    // DOM 结构：唯一 ul，直接子元素全部为 li，每个 li 恰好 1 个 button。
    const ul = panel.locator('ul');
    await expect(ul).toHaveCount(1);
    const childTags = await ul.evaluate((el) => Array.from(el.children).map((c) => c.tagName.toLowerCase()));
    expect(childTags, 'direct children of the work orders ul').toEqual(['li', 'li', 'li']);

    const expectedOrder = ['WO-1842', 'WO-1847', 'WO-1851'];
    for (const [index, id] of expectedOrder.entries()) {
      const item = items.nth(index);
      await expect(item).toContainText(id);
      await expect(item.getByRole('button')).toHaveCount(1);
    }
  });

  // Feature: a11y-audit-remediation, Property 4: 工单列表结构与名称完整
  // Req 3.1, 3.3, 3.4：穷举 ul 每个直接子元素；收集全部问题后统一断言。
  test('every work order item has one complete button', async ({ page }) => {
    const EXPECTED_IDS = ['WO-1842', 'WO-1847', 'WO-1851'];
    const FOCUSABLE = 'a[href], input, select, textarea, button, [role="button"], [tabindex]:not([tabindex="-1"])';
    const problems: string[] = [];

    const ul = jobsPanel(page).locator('ul');
    await expect(ul).toHaveCount(1);

    // 结构检查在页面内一次性完成：tag、button 数、多余可聚焦后代、站点/任务文本。
    const items = await ul.evaluate((list, focusableSel) => {
      return Array.from(list.children).map((child) => {
        const buttons = Array.from(child.querySelectorAll('button'));
        const focusables = Array.from(child.querySelectorAll(focusableSel)).filter((el) => el !== buttons[0]);
        const extra = focusables.map((el) => {
          const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : '';
          return `${el.tagName.toLowerCase()}${cls}`;
        });
        return {
          tag: child.tagName.toLowerCase(),
          role: child.getAttribute('role'),
          selfFocusable: child.matches(focusableSel),
          buttonCount: buttons.length,
          extraFocusables: extra,
          site: (child.querySelector('.job-site')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          task: (child.querySelector('.job-task')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        };
      });
    }, FOCUSABLE);

    if (items.length !== EXPECTED_IDS.length) {
      problems.push(`ul must have ${EXPECTED_IDS.length} direct children, found ${items.length}`);
    }

    for (const [index, item] of items.entries()) {
      const label = `item ${index + 1}`;
      if (item.tag !== 'li') problems.push(`${label}: direct child is <${item.tag}>, expected <li>`);
      if (item.role) problems.push(`${label}: <${item.tag}> carries role="${item.role}" (must stay listitem)`);
      if (item.selfFocusable) problems.push(`${label}: list item itself is focusable / button-like`);
      if (item.buttonCount !== 1) problems.push(`${label}: expected exactly 1 <button>, found ${item.buttonCount}`);
      if (item.extraFocusables.length > 0) {
        problems.push(`${label}: extra focusable descendants: ${item.extraFocusables.join(', ')}`);
      }
      if (item.buttonCount < 1) continue;

      // 可访问名称以 ariaSnapshot 规范计算结果为准。
      const button = ul.locator(':scope > *').nth(index).locator('button').first();
      const parsed = parseAriaSnapshotRoot(await button.ariaSnapshot({ timeout: 2000 }));
      const name = normalizeName(parsed?.name ?? '');
      const missing: string[] = [];
      if (!item.site || !name.includes(item.site)) missing.push(`site "${item.site}"`);
      if (!item.task || !name.includes(item.task)) missing.push(`task "${item.task}"`);
      if (!/WO-\d{4}/.test(name)) missing.push('WO-\\d{4}');
      if (!/\d{2}:\d{2}/.test(name)) missing.push('\\d{2}:\\d{2}');
      if (missing.length > 0) problems.push(`${label}: button name "${name}" missing ${missing.join(', ')}`);
    }

    // Req 3.3：从 body 起穷举 Tab 序，工单按钮必须是连续停靠点 WO-1842 → WO-1847 → WO-1851。
    const MAX_STEPS = 40;
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const stops: Array<{ step: number; role: string; name: string }> = [];
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      await page.keyboard.press('Tab');
      const stop = await readFocusStop(page, step);
      if (!stop) break;
      if (stops.length > 0 && stop.name === stops[0].name && stop.role === stops[0].role) break;
      stops.push({ step: stop.step, role: stop.role, name: stop.name });
    }
    const woStops = stops
      .map((s, i) => ({ ...s, index: i, id: s.name.match(/WO-\d{4}/)?.[0] ?? null }))
      .filter((s) => s.id !== null && s.role === 'button');
    const woIds = woStops.map((s) => s.id);
    const consecutive = woStops.every((s, i) => i === 0 || s.index === woStops[i - 1].index + 1);
    if (JSON.stringify(woIds) !== JSON.stringify(EXPECTED_IDS) || !consecutive) {
      problems.push(
        `tab order: work order button stops ${JSON.stringify(
          woStops.map((s) => `step ${s.step} ${s.id}`),
        )}, expected consecutive ${JSON.stringify(EXPECTED_IDS)}`,
      );
    }

    expect(problems, [`work order list problems: ${problems.length}`, ...problems.map((p) => `- ${p}`)].join('\n')).toEqual([]);
  });

  // Feature: a11y-audit-remediation, Property 1: 可聚焦控件均有非空可访问名称
  // Req 1.4, 1.1, 1.2：从 body 起连续 Tab 穷举所有停靠点，直到焦点回到 body / 第一个元素或达到安全上限。
  test('every focusable control has a non-empty accessible name', async ({ page }) => {
    const MAX_STEPS = 40;
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const startsAtBody = await page.evaluate(() => document.activeElement === document.body);
    expect(startsAtBody, 'document.activeElement must be body before the first Tab').toBe(true);

    const stops: Array<{ step: number; role: string; name: string }> = [];
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      await page.keyboard.press('Tab');
      // 第 1 步记录首个停靠元素；之后焦点回到它即视为已绕回一圈。
      const wrapped = await page.evaluate((isFirst) => {
        const w = window as unknown as { __a11yFirstFocus?: Element | null };
        if (isFirst) {
          w.__a11yFirstFocus = document.activeElement;
          return false;
        }
        return document.activeElement === w.__a11yFirstFocus;
      }, step === 1);
      if (wrapped) break;
      const stop = await readFocusStop(page, step);
      if (!stop) break; // 焦点回到 body：已离开全部可聚焦控件
      stops.push({ step: stop.step, role: stop.role, name: stop.name });
    }

    expect(stops.length, 'page must expose at least one Tab stop').toBeGreaterThan(0);
    const unnamed = stops.filter((s) => s.name.trim().length < 1);
    const message = [
      `unnamed focus stops: ${unnamed.length} of ${stops.length}`,
      ...unnamed.map((s) => `- step ${s.step}: role=${s.role}`),
    ].join('\n');
    expect(unnamed, message).toEqual([]);
  });

  // Feature: a11y-audit-remediation, Property 2: generic 元素不携带命名属性
  // Req 2.2：计算角色为 generic 的元素不得携带 aria-label / aria-labelledby；失败消息列出全部违规元素。
  test('no generic element carries aria-label or aria-labelledby', async ({ page }) => {
    const violations = await findNamedGenericElements(page);
    expect(violations, formatGenericViolations(violations)).toEqual([]);
  });

  // Feature: a11y-audit-remediation, Property 3: 区域进度条唯一命名且数值一致
  // Req 2.3, 2.6, 2.7：对 North/Central/South 穷举；先收集全部区域的失败，再统一断言并列出失败区域名。
  test('territory progressbars are named and match visible percentages', async ({ page }) => {
    const REGIONS = ['North', 'Central', 'South'] as const;
    const panel = page.getByRole('region', { name: 'Territory load' });
    await expect(panel, 'Territory load panel must resolve exactly once').toHaveCount(1);

    const failures: Array<{ region: string; reason: string }> = [];
    const names = new Map<string, string>();

    for (const r of REGIONS) {
      const others = REGIONS.filter((o) => o !== r).join('|');
      // 区域行：Territory 面板内以 "<区域> <数字>%" 开头、只含本区域、且包含进度条的容器（不含上方的 territory-card）。
      const row = panel
        .locator('div, li')
        .filter({ hasText: new RegExp(`^\\s*${r}\\s*\\d+\\s*%`) })
        .filter({ hasNotText: new RegExp(`\\b(${others})\\b`) })
        .filter({ has: page.getByRole('progressbar') });
      const rowCount = await row.count();
      let visiblePct: string | null = null;
      if (rowCount < 1) {
        failures.push({ region: r, reason: 'region row with visible percentage and a progressbar not found in Territory panel' });
      } else {
        const text = normalizeName((await row.last().textContent()) ?? '');
        visiblePct = new RegExp(`^${r}\\s*(\\d+)\\s*%`).exec(text)?.[1] ?? null;
        if (visiblePct === null) failures.push({ region: r, reason: `cannot read visible percentage from row text ${JSON.stringify(text)}` });
      }

      const bars = page.getByRole('progressbar', { name: new RegExp(`^${r}`) });
      const barCount = await bars.count();
      if (barCount !== 1) {
        failures.push({ region: r, reason: `progressbar named /^${r}/: expected exactly 1, found ${barCount}` });
        continue;
      }
      const bar = bars.first();
      const accName = normalizeName((await bar.getAttribute('aria-label')) ?? (await bar.evaluate((el) => {
        const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
        return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
      })));
      names.set(r, accName);

      const valuenow = await bar.getAttribute('aria-valuenow');
      if (visiblePct !== null && valuenow !== visiblePct) {
        failures.push({ region: r, reason: `aria-valuenow=${valuenow ?? '(absent)'} but visible percentage is ${visiblePct}` });
      }
    }

    // 3 个名称两两不同。
    const seen = new Map<string, string>();
    for (const [r, n] of names) {
      const prev = seen.get(n);
      if (prev) failures.push({ region: r, reason: `accessible name ${JSON.stringify(n)} duplicates ${prev}` });
      else seen.set(n, r);
    }

    // Territory 面板中进度条总数为 3。
    const total = await panel.getByRole('progressbar').count();
    if (total !== 3) failures.push({ region: '(panel)', reason: `Territory panel progressbar count: expected 3, found ${total}` });

    const failedRegions = [...new Set(failures.map((f) => f.region))];
    const message = [
      `territory progressbar failures — regions: ${failedRegions.join(', ') || '(none)'}`,
      ...failures.map((f) => `- ${f.region}: ${f.reason}`),
    ].join('\n');
    expect(failures, message).toEqual([]);
  });
});

test.describe('A: contrast', () => {
  // Req 4.3：受保护背景与主色不得因对比度修复而改变。
  test('protected backgrounds and primary color are unchanged', async ({ page }) => {
    await page.goto('/');
    const checks: Array<[selector: string, expected: string, minCount: number]> = [
      ['body', '#f2ede4', 1],
      ['.topbar', '#fffaf2', 1],
      ['.panel', '#fffaf2', 3],
      ['.territory-card', '#fffaf2', 3],
      ['.territory-panel .MuiLinearProgress-bar', '#d6552d', 3],
    ];
    for (const [selector, expected, minCount] of checks) {
      const nodes = page.locator(selector);
      const count = await nodes.count();
      expect(count, `${selector} count`).toBeGreaterThanOrEqual(minCount);
      const actual = await nodes.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      expect.soft(actual.map(toHex), `${selector} background-color`).toEqual(Array(count).fill(expected));
    }
  });

  // Req 4.5, 4.6：contrastRatio 参考值（纯函数，不依赖页面）。
  test('contrastRatio matches WCAG reference values', () => {
    const black = parseColor('#000000');
    const white = parseColor('#ffffff');
    expect(contrastRatio(black, white), 'black on white').toBe(21);
    expect(contrastRatio(white, black), 'order-independent').toBe(21);
    expect(contrastRatio(white, white), 'same color').toBe(1);
    expect(contrastRatio(parseColor('#716d65'), parseColor('#f2ede4')), '#716d65 on #f2ede4').toBeCloseTo(4.42, 2);
    expect(contrastRatio(parseColor('rgb(113, 109, 101)'), parseColor('rgb(242, 237, 228)')), 'rgb() input').toBeCloseTo(4.42, 2);
  });

  // Feature: a11y-audit-remediation, Property 5: 受检文字对比度不低于阈值
  // Req 4.1, 4.2, 4.5, 4.6：穷举 CONTRAST_CASES × 每个可见文字元素；收集全部失败后统一断言。
  test('audited text meets contrast thresholds', async ({ page }) => {
    const LOG = 'contrast-assertions.log';
    resetLog(LOG, [
      ...logHeader(srcStateForLogs(), 'Audited text contrast (Property 5; Req 4.1, 4.2, 4.5, 4.6)'),
      '# columns: verdict | selector | #index | text | fg | bg | ratio | threshold [| note]',
    ]);
    await page.goto('/');

    type RGBA = RGB & { a: number };
    /** 计算样式颜色 → RGBA；支持 alpha（parseColor 只接受不透明色）。无法解析返回 null。 */
    const parseRgba = (css: string): RGBA | null => {
      const s = css.trim().toLowerCase();
      if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
      const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(s);
      if (m) {
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        return { r: +m[1], g: +m[2], b: +m[3], a };
      }
      try {
        return { ...parseColor(s), a: 1 };
      } catch {
        return null;
      }
    };
    /** source-over 合成：top（含 alpha）叠在不透明 bottom 上。 */
    const over = (top: RGBA, bottom: RGB): RGB => ({
      r: Math.round(top.r * top.a + bottom.r * (1 - top.a)),
      g: Math.round(top.g * top.a + bottom.g * (1 - top.a)),
      b: Math.round(top.b * top.a + bottom.b * (1 - top.a)),
    });
    const hex = ({ r, g, b }: RGB): string => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

    const failures: string[] = [];
    let passCount = 0;

    for (const { selector, expectedBackground, threshold } of CONTRAST_CASES) {
      // 浏览器内一次读出：可见性、文本、前景色、自身→根的背景色链、是否有背景图。
      const samples = await page.locator(selector).evaluateAll((els) =>
        els.map((el) => {
          const chain: Array<{ bg: string; image: boolean }> = [];
          for (let n: Element | null = el; n; n = n.parentElement) {
            const cs = getComputedStyle(n);
            chain.push({ bg: cs.backgroundColor, image: cs.backgroundImage !== 'none' });
          }
          const rect = el.getBoundingClientRect();
          const visible =
            (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ??
            (rect.width > 0 && rect.height > 0);
          return {
            text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
            visible: visible && rect.width > 0 && rect.height > 0,
            color: getComputedStyle(el).color,
            chain,
          };
        }),
      );
      const textEls = samples.filter((s) => s.visible && s.text.length > 0);
      if (textEls.length < 1) {
        const msg = `${selector}: matched ${samples.length} element(s), 0 visible text elements`;
        failures.push(msg);
        appendLog(LOG, `[FAIL] ${JSON.stringify(selector)} | no visible text element (matched ${samples.length})`);
        continue;
      }

      for (const [index, s] of textEls.entries()) {
        const notes: string[] = [];
        const snippet = s.text.length > 40 ? `${s.text.slice(0, 40)}…` : s.text;
        const tag = `${selector} #${index + 1} ${JSON.stringify(snippet)}`;

        // 背景：自下而上找最近的不透明层，再把其上的半透明层依次合成上去。
        const layers = s.chain.map((c) => ({ ...c, rgba: parseRgba(c.bg) }));
        const unparsable = layers.find((l) => l.rgba === null);
        if (unparsable) {
          failures.push(`${tag}: unparsable background-color ${JSON.stringify(unparsable.bg)}`);
          appendLog(LOG, `[FAIL] ${JSON.stringify(selector)} | #${index + 1} | ${JSON.stringify(snippet)} | unparsable bg ${JSON.stringify(unparsable.bg)}`);
          continue;
        }
        let opaqueAt = layers.findIndex((l) => l.rgba!.a >= 1);
        let bg: RGB;
        if (opaqueAt < 0) {
          bg = { r: 255, g: 255, b: 255 };
          opaqueAt = layers.length;
          notes.push('no opaque ancestor, assumed #ffffff canvas');
        } else {
          bg = layers[opaqueAt].rgba!;
        }
        for (let i = opaqueAt - 1; i >= 0; i -= 1) {
          const layer = layers[i].rgba!;
          if (layer.a > 0) {
            bg = over(layer, bg);
            notes.push(`composited translucent bg ${layers[i].bg}`);
          }
        }
        if (layers.slice(0, opaqueAt + 1).some((l) => l.image)) notes.push('background-image present on element/ancestor; color layer used');

        // 前景：半透明时合成到实际背景上。
        const fgRgba = parseRgba(s.color);
        if (!fgRgba) {
          failures.push(`${tag}: unparsable color ${JSON.stringify(s.color)}`);
          appendLog(LOG, `[FAIL] ${JSON.stringify(selector)} | #${index + 1} | ${JSON.stringify(snippet)} | unparsable fg ${JSON.stringify(s.color)}`);
          continue;
        }
        const fg = fgRgba.a >= 1 ? fgRgba : over(fgRgba, bg);
        if (fgRgba.a < 1) notes.push(`composited translucent fg ${s.color}`);

        const bgHex = hex(bg);
        if (bgHex !== expectedBackground.toLowerCase()) notes.push(`actual bg ${bgHex} ≠ expected ${expectedBackground}`);

        const ratio = contrastRatio(fg, bg);
        const pass = ratio >= threshold;
        if (pass) passCount += 1;
        else failures.push(`${tag}: ${hex(fg)} on ${bgHex} = ${ratio.toFixed(2)}:1 < ${threshold}:1`);
        appendLog(
          LOG,
          [
            `[${pass ? 'PASS' : 'FAIL'}] ${JSON.stringify(selector)}`,
            `#${index + 1}`,
            JSON.stringify(snippet),
            `fg ${hex(fg)}`,
            `bg ${bgHex}`,
            `ratio ${ratio.toFixed(2)}`,
            `threshold ${threshold}`,
            ...(notes.length ? [`note: ${notes.join('; ')}`] : []),
          ].join(' | '),
        );
      }
    }

    appendLog(LOG, `# summary: ${passCount} pass, ${failures.length} fail`);
    expect(failures, [`contrast failures: ${failures.length}`, ...failures.map((f) => `- ${f}`)].join('\n')).toEqual([]);
  });
});

test.describe('C: text evidence', () => {
  // Req 10.2：箭头为装饰性，不暴露任何可访问名称。
  test('SLA arrow is decorative', async ({ page }) => {
    await page.goto('/');
    const metric = slaMetric(page);
    await expect(metric).toHaveCount(1);

    const arrow = metric.locator('svg[data-testid="ArrowOutwardIcon"]');
    await expect(arrow).toHaveCount(1);
    await expect(arrow).toHaveAttribute('aria-hidden', 'true');
    for (const attr of ['aria-label', 'aria-labelledby', 'title', 'alt']) {
      await expect.soft(arrow, `arrow must not carry ${attr}`).not.toHaveAttribute(attr, /.*/);
    }
    await expect(arrow.locator('title')).toHaveCount(0);

    // 无障碍树中该指标块不出现图像类节点。
    const snapshot = await metric.ariaSnapshot();
    expect(snapshot, `SLA metric aria snapshot:\n${snapshot}`).not.toMatch(/^\s*-\s+(img|image|graphics-\w+)\b/m);
  });
});

// ---------------------------------------------------------------------------
// B 层：键盘与动态状态（Req 6、7、8）
// ---------------------------------------------------------------------------

/** 每次焦点 / 状态断言的上限（Req 6、7.1、8：1 秒 / 1000 ms）。 */
const STEP_TIMEOUT = 1000;

type AriaRole = Parameters<Page['getByRole']>[0];

/** 批准序列项 → Playwright 语义定位器（字符串名称精确匹配，正则名称按 test）。 */
const approvedLocator = (page: Page, [role, name]: ApprovedStop): Locator =>
  page.getByRole(role as AriaRole, typeof name === 'string' ? { name, exact: true } : { name });

/** 13 张焦点截图的 `<name>` 部分（与 APPROVED_TAB_ORDER 一一对应）。 */
const FOCUS_SCREENSHOT_NAMES = [
  'overview',
  'work-orders',
  'technicians',
  'assets',
  'more-actions',
  'search-work-orders',
  'region',
  'schedule-visit',
  'filter-work-orders',
  'wo-1842',
  'wo-1847',
  'wo-1851',
  'view-all-work-orders',
] as const;

const describeApproved = ([role, name]: ApprovedStop): string =>
  `${role}: ${typeof name === 'string' ? name : name.source}`;

/** 本次运行的 src/ 状态；非 git 仓库且未声明时用描述兜底（Req 15.5）。 */
const srcStateForLogs = (): SrcState =>
  resolveSrcState() ?? { kind: 'description', text: '未声明（非 git 仓库且未设置 EVIDENCE_SRC_STATE）' };

const regionCombobox = (page: Page): Locator => page.getByRole('combobox', { name: 'Region', exact: true });

/** 当前焦点元素的可读描述，用于 focus 类状态日志。 */
const describeFocus = async (page: Page): Promise<string> => {
  const stop = await readFocusStop(page, 0);
  return stop ? `${stop.role} "${stop.name || '(unnamed)'}"` : 'body';
};

/** combobox 的可访问值 = 其显示文本；定位不到时返回占位说明。 */
const comboboxValue = async (combobox: Locator): Promise<string> =>
  (await combobox.count()) === 1 ? normalizeName((await combobox.textContent()) ?? '') : '(combobox "Region" not found)';

const attrOrAbsent = async (locator: Locator, attr: string): Promise<string> =>
  (await locator.count()) === 1 ? ((await locator.getAttribute(attr)) ?? '(absent)') : '(element not found)';

/**
 * 执行一条状态断言并写入 state-assertions.log（Req 8.7：步骤名、按键序列、预期值、实际值）。
 * 默认断言失败即抛出（后续步骤依赖当前状态）；`soft: true` 时记录失败但继续执行。
 */
async function assertState(input: {
  step: string;
  keys: string[];
  kind: StateAssertion['kind'];
  expected: string;
  check: () => Promise<void>;
  actual: () => Promise<string>;
  soft?: boolean;
}): Promise<void> {
  let error: unknown = null;
  try {
    await input.check();
  } catch (e) {
    error = e;
  }
  const actual = await input.actual().catch(() => '(unavailable)');
  appendStateAssertion({
    step: input.step,
    keys: input.keys,
    kind: input.kind,
    expected: input.expected,
    actual,
    pass: error === null,
  });
  if (error === null) return;
  if (input.soft) {
    expect.soft(error === null, `${input.step}: expected ${input.expected}, actual ${actual}\n${String(error)}`).toBe(true);
    return;
  }
  throw error;
}

test.describe('B: keyboard', () => {
  // Req 6.5, 7.1, 7.7
  test('full page tab order matches the approved sequence', async ({ page }) => {
    const LOG = 'focus-path-forward.log';
    resetLog(LOG, [
      ...logHeader(srcStateForLogs(), 'Forward focus path — 13 × Tab from body (Req 6.5, 7.1, 7.7)'),
      `# viewport: ${JSON.stringify(page.viewportSize())}`,
      `# approved: ${APPROVED_TAB_ORDER.map(describeApproved).join(' → ')}`,
    ]);

    await page.goto('/');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const startsAtBody = await page.evaluate(() => document.activeElement === document.body);
    expect(startsAtBody, 'document.activeElement must be body before the first Tab').toBe(true);

    let unnamed = 0;
    for (const [index, expected] of APPROVED_TAB_ORDER.entries()) {
      const step = index + 1;
      await page.keyboard.press('Tab');
      const target = approvedLocator(page, expected);

      let focused = true;
      try {
        await expect(target).toBeFocused({ timeout: STEP_TIMEOUT });
      } catch {
        focused = false;
      }

      const stop = await readFocusStop(page, step);
      if (stop && !stop.name) unnamed += 1;
      const pass = focused && stop !== null && matchesApprovedStop(stop, expected);
      appendLog(
        LOG,
        `[${pass ? 'PASS' : 'FAIL'}] ${stop ? formatFocusStop(stop) : `${step}. body`} | expected ${describeApproved(expected)}`,
      );
      await page.screenshot({ path: screenshotPath(step, FOCUS_SCREENSHOT_NAMES[index]) });

      // 逐项 toBeFocused()；软断言让 13 步全部落入日志与截图后再整体判定失败。
      expect.soft(focused, `step ${step}: expected focus on ${describeApproved(expected)}, actual ${stop ? formatFocusStop(stop) : 'body'}`).toBe(true);
    }
    appendLog(LOG, `# unnamed stops: ${unnamed}`);
  });

  // Feature: a11y-audit-remediation, Property 6: Shift+Tab 序列是 Tab 序列的逆序
  // Req 6.1–6.4, 6.6, 6.7, 7.5：从末项 View all work orders 起连续 12 次 Shift+Tab，
  // 期望依次到达 APPROVED_TAB_ORDER 去掉末项后的反转（WO-1851 … Overview）。
  // 第 i 步的期望项 = 正向序列中当前焦点项的前一项，因此每对相邻 (cᵢ, cᵢ₊₁) 的逆向关系都由该序列体现。
  test('shift+tab order is the exact reverse of tab order', async ({ page }) => {
    const LOG = 'focus-path-reverse.log';
    const start = APPROVED_TAB_ORDER[APPROVED_TAB_ORDER.length - 1];
    const reversed = APPROVED_TAB_ORDER.slice(0, -1).reverse();
    resetLog(LOG, [
      ...logHeader(srcStateForLogs(), `Reverse focus path — ${reversed.length} × Shift+Tab from ${describeApproved(start)} (Req 6.1–6.4, 6.6, 6.7, 7.5)`),
      `# viewport: ${JSON.stringify(page.viewportSize())}`,
      `# expected: ${reversed.map(describeApproved).join(' → ')}`,
    ]);

    await page.goto('/');
    const startTarget = approvedLocator(page, start);
    await startTarget.focus({ timeout: STEP_TIMEOUT });
    await expect(startTarget, `start: focus must be on ${describeApproved(start)}`).toBeFocused({ timeout: STEP_TIMEOUT });
    appendLog(LOG, `# start: ${describeApproved(start)}`);

    let unnamed = 0;
    for (const [index, expected] of reversed.entries()) {
      const step = index + 1;
      await page.keyboard.press('Shift+Tab');
      const target = approvedLocator(page, expected);

      let focused = true;
      try {
        await expect(target).toBeFocused({ timeout: STEP_TIMEOUT });
      } catch {
        focused = false;
      }

      const stop = await readFocusStop(page, step);
      if (stop && !stop.name) unnamed += 1;
      const pass = focused && stop !== null && matchesApprovedStop(stop, expected);
      appendLog(
        LOG,
        `[${pass ? 'PASS' : 'FAIL'}] ${stop ? formatFocusStop(stop) : `${step}. body`} | expected ${describeApproved(expected)}`,
      );

      // 软断言：12 步全部落入日志后再整体判定失败。
      expect.soft(focused, `shift+tab step ${step}: expected focus on ${describeApproved(expected)}, actual ${stop ? formatFocusStop(stop) : 'body'}`).toBe(true);
    }
    appendLog(LOG, `# unnamed stops: ${unnamed}`);
  });

  // Feature: a11y-audit-remediation, Property 7: 无键盘陷阱
  // Req 7.2, 7.6：对批准序列每个控件（Region 下拉关闭时）单次 Tab / Shift+Tab 必须让焦点移到另一元素；
  // 两端：末项 Tab → body 或 Overview；首项 Shift+Tab → body。收集全部失败后统一断言。
  test('focus leaves the page at both ends without traps', async ({ page }) => {
    await page.goto('/');
    const failures: string[] = [];
    const listbox = page.getByRole('listbox');

    /** 当前焦点是否为 locator 指向的元素（定位不唯一时返回 false）。 */
    const isActive = async (locator: Locator): Promise<boolean> =>
      (await locator.count()) === 1 && (await locator.evaluate((el) => el === document.activeElement));

    /** 聚焦控件并在 window 上记下该元素；失败（定位不到 / 未获焦）时返回原因。 */
    const focusAndMark = async (stop: ApprovedStop): Promise<string | null> => {
      const target = approvedLocator(page, stop);
      const count = await target.count();
      if (count !== 1) return `cannot locate (found ${count})`;
      await target.focus({ timeout: STEP_TIMEOUT }).catch(() => undefined);
      if (!(await isActive(target))) return 'focus() did not move focus onto the control';
      if (await listbox.isVisible()) return 'Region listbox is open (precondition: closed)';
      await page.evaluate(() => {
        (window as unknown as { __a11yTrapRef?: Element | null }).__a11yTrapRef = document.activeElement;
      });
      return null;
    };

    const movedAway = (): Promise<boolean> =>
      page.evaluate(() => document.activeElement !== (window as unknown as { __a11yTrapRef?: Element | null }).__a11yTrapRef);

    // --- 每个控件：单次 Tab 与单次 Shift+Tab 都离开当前元素 ---------------------
    for (const stop of APPROVED_TAB_ORDER) {
      for (const key of ['Tab', 'Shift+Tab'] as const) {
        const problem = await focusAndMark(stop);
        if (problem) {
          failures.push(`${describeApproved(stop)} [${key}]: ${problem}`);
          continue;
        }
        await page.keyboard.press(key);
        let moved = false;
        try {
          await expect.poll(movedAway, { timeout: STEP_TIMEOUT }).toBe(true);
          moved = true;
        } catch {
          moved = false;
        }
        if (!moved) failures.push(`${describeApproved(stop)} [${key}]: focus stayed on the same element (keyboard trap)`);
      }
    }

    const first = APPROVED_TAB_ORDER[0];
    const last = APPROVED_TAB_ORDER[APPROVED_TAB_ORDER.length - 1];
    const activeIsBody = (): Promise<boolean> => page.evaluate(() => document.activeElement === document.body || document.activeElement === null);

    /** 当前焦点停留在哪个 Workbench 控件上（不在任何批准控件上返回 null）。 */
    const activeWorkbenchStop = async (): Promise<ApprovedStop | null> => {
      for (const stop of APPROVED_TAB_ORDER) {
        if (await isActive(approvedLocator(page, stop))) return stop;
      }
      return null;
    };

    // --- 末项：Tab → body 或 Overview（Req 7.2） -------------------------------
    {
      const problem = await focusAndMark(last);
      if (problem) {
        failures.push(`${describeApproved(last)} [Tab, end of sequence]: ${problem}`);
      } else {
        await page.keyboard.press('Tab');
        let ok = false;
        try {
          await expect
            .poll(async () => (await activeIsBody()) || (await isActive(approvedLocator(page, first))), { timeout: STEP_TIMEOUT })
            .toBe(true);
          ok = true;
        } catch {
          ok = false;
        }
        if (!ok) {
          const onStop = await activeWorkbenchStop();
          failures.push(
            `${describeApproved(last)} [Tab, end of sequence]: expected body or ${describeApproved(first)}, actual ${
              onStop ? `Workbench control ${describeApproved(onStop)}` : await describeFocus(page)
            }`,
          );
        }
      }
    }

    // --- 首项：Shift+Tab → body（焦点离开全部 Workbench 控件） ------------------
    {
      const problem = await focusAndMark(first);
      if (problem) {
        failures.push(`${describeApproved(first)} [Shift+Tab, start of sequence]: ${problem}`);
      } else {
        await page.keyboard.press('Shift+Tab');
        let ok = false;
        try {
          await expect.poll(activeIsBody, { timeout: STEP_TIMEOUT }).toBe(true);
          ok = true;
        } catch {
          ok = false;
        }
        if (!ok) {
          const onStop = await activeWorkbenchStop();
          failures.push(
            `${describeApproved(first)} [Shift+Tab, start of sequence]: expected body, actual ${
              onStop ? `Workbench control ${describeApproved(onStop)}` : await describeFocus(page)
            }`,
          );
        }
      }
    }

    expect(failures, [`keyboard trap / boundary failures: ${failures.length}`, ...failures.map((f) => `- ${f}`)].join('\n')).toEqual([]);
  });

  // Feature: a11y-audit-remediation, Property 8: 获焦控件可见、未遮挡、指示合格、尺寸达标
  // Req 7.3, 7.4：从 body 起连续 Tab（键盘获焦，使 :focus-visible 生效；不用 .focus()），
  // 对 APPROVED_TAB_ORDER 13 个控件逐个检查：
  //   - 控件框完全位于视口内、宽高 ≥ 24px、矩形中心 elementFromPoint 命中自身或后代；
  //   - 焦点指示载体之一满足 outline-width ≥ 2px、outline-style ≠ none、
  //     outline-color 与相邻背景（载体父元素起最近不透明祖先背景，outline-offset 外侧）对比度 ≥ 3:1。
  // MUI 输入类控件（searchbox / combobox）：获焦元素是 input / select div，指示载体允许是获焦元素本身、
  // 最近的 .MuiOutlinedInput-root / .MuiInputBase-root（outline），或其 .MuiOutlinedInput-notchedOutline（border ≥ 2px）；
  // 几何检查（视口 / 尺寸 / 遮挡）以该输入根为控件框（可点击目标即整个输入框）。
  // 收集全部失败后统一断言；基线定位不到 / Tab 到达不了的控件只记失败不崩溃。
  test('focused controls are visible, unobscured and large enough', async ({ page }) => {
    const MAX_TABS = 40;
    const MIN_SIZE = 24;
    const MIN_OUTLINE = 2;
    const MIN_RATIO = 3;
    const failures: string[] = [];

    await page.goto('/');

    // 标记批准控件（window 引用，不改 DOM）；定位不唯一时记失败。
    const located: boolean[] = [];
    await page.evaluate(() => {
      (window as unknown as { __p8?: (Element | null)[] }).__p8 = [];
    });
    for (const [index, stop] of APPROVED_TAB_ORDER.entries()) {
      const target = approvedLocator(page, stop);
      const count = await target.count();
      if (count !== 1) {
        failures.push(`${describeApproved(stop)}: cannot locate (found ${count})`);
        located.push(false);
        continue;
      }
      await target.evaluate((el, i) => {
        (window as unknown as { __p8: (Element | null)[] }).__p8[i] = el;
      }, index);
      located.push(true);
    }

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    type Carrier = { kind: string; width: number; style: string; color: string; bg: string } | null;
    type Measure = {
      box: string;
      rect: { x: number; y: number; width: number; height: number };
      viewport: { width: number; height: number };
      hit: string;
      hitInside: boolean;
      carriers: NonNullable<Carrier>[];
    };

    const measured = new Map<number, Measure>();
    for (let step = 1; step <= MAX_TABS && measured.size < located.filter(Boolean).length; step++) {
      await page.keyboard.press('Tab');
      // 等两帧，让焦点样式与 MUI focused 类生效、浏览器完成自动滚动。
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      const index = await page.evaluate(() => {
        const refs = (window as unknown as { __p8: (Element | null)[] }).__p8;
        return refs.findIndex((el) => el !== null && el !== undefined && el === document.activeElement);
      });
      if (index < 0) {
        const atBody = await page.evaluate(() => document.activeElement === document.body || document.activeElement === null);
        if (atBody && step > 1) break; // 焦点离开页面：序列结束
        continue;
      }
      if (measured.has(index)) continue;

      const m = await page.evaluate((): Measure => {
        const el = document.activeElement as HTMLElement;
        const describe = (n: Element | null): string =>
          n ? `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${n.classList.length ? `.${[...n.classList].slice(0, 2).join('.')}` : ''}` : 'null';

        type RGBA = { r: number; g: number; b: number; a: number };
        const parse = (css: string): RGBA | null => {
          const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(css.trim());
          if (!m) return null;
          const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
          return { r: +m[1], g: +m[2], b: +m[3], a };
        };
        const over = (top: RGBA, base: RGBA): RGBA => ({
          r: top.r * top.a + base.r * (1 - top.a),
          g: top.g * top.a + base.g * (1 - top.a),
          b: top.b * top.a + base.b * (1 - top.a),
          a: 1,
        });
        const css = (c: RGBA): string => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

        /** 从 start 起向上合成背景色，直到遇到不透明背景（缺省为白色画布）。 */
        const backdrop = (start: Element | null): RGBA => {
          const layers: RGBA[] = [];
          for (let n = start; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0) {
              layers.push(c);
              if (c.a >= 1) break;
            }
          }
          let result: RGBA = { r: 255, g: 255, b: 255, a: 1 };
          for (const layer of layers.reverse()) result = over(layer, result);
          return result;
        };

        const carriers: { kind: string; width: number; style: string; color: string; bg: string }[] = [];
        const outlineOf = (node: Element, kind: string) => {
          const s = getComputedStyle(node);
          const bg = backdrop(node.parentElement);
          const col = parse(s.outlineColor);
          carriers.push({
            kind,
            width: parseFloat(s.outlineWidth) || 0,
            style: s.outlineStyle,
            color: col ? css(over(col, bg)) : s.outlineColor,
            bg: css(bg),
          });
        };

        outlineOf(el, `outline on ${describe(el)}`);
        const inputRoot = el.closest('.MuiOutlinedInput-root, .MuiInputBase-root');
        if (inputRoot && inputRoot !== el) {
          outlineOf(inputRoot, `outline on ${describe(inputRoot)}`);
          const notched = inputRoot.querySelector(':scope > .MuiOutlinedInput-notchedOutline');
          if (notched) {
            const s = getComputedStyle(notched);
            const bg = backdrop(notched.parentElement);
            const col = parse(s.borderTopColor);
            carriers.push({
              kind: `border on ${describe(notched)}`,
              width: parseFloat(s.borderTopWidth) || 0,
              style: s.borderTopStyle,
              color: col ? css(over(col, bg)) : s.borderTopColor,
              bg: css(bg),
            });
          }
        }

        const box = (inputRoot ?? el) as HTMLElement;
        const r = box.getBoundingClientRect();
        const hitEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          box: describe(box),
          rect: { x: r.left, y: r.top, width: r.width, height: r.height },
          viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
          hit: describe(hitEl),
          hitInside: hitEl !== null && (hitEl === box || box.contains(hitEl)),
          carriers,
        };
      });
      measured.set(index, m);
    }

    const round = (n: number): number => Math.round(n * 100) / 100;
    for (const [index, stop] of APPROVED_TAB_ORDER.entries()) {
      if (!located[index]) continue;
      const label = describeApproved(stop);
      const m = measured.get(index);
      if (!m) {
        failures.push(`${label}: never received keyboard focus within ${MAX_TABS} Tab presses from body`);
        continue;
      }
      const unmet: string[] = [];
      const { x, y, width, height } = m.rect;
      const rectText = `rect=(${round(x)}, ${round(y)}, ${round(width)}×${round(height)}) viewport=${m.viewport.width}×${m.viewport.height}`;
      if (x < 0 || y < 0 || x + width > m.viewport.width || y + height > m.viewport.height) {
        unmet.push(`not fully inside viewport: ${rectText}`);
      }
      if (width < MIN_SIZE || height < MIN_SIZE) unmet.push(`size < ${MIN_SIZE}px: ${round(width)}×${round(height)}`);
      if (!m.hitInside) unmet.push(`obscured: elementFromPoint(center) = ${m.hit}, not ${m.box} or a descendant`);

      const evaluated = m.carriers.map((c) => {
        let ratio = 0;
        try {
          ratio = contrastRatio(parseColor(c.color), parseColor(c.bg));
        } catch {
          ratio = 0;
        }
        const ok = c.width >= MIN_OUTLINE && c.style !== 'none' && c.style !== 'hidden' && ratio >= MIN_RATIO;
        return { ...c, ratio, ok };
      });
      if (!evaluated.some((c) => c.ok)) {
        unmet.push(
          `no qualifying focus indicator (need width ≥ ${MIN_OUTLINE}px, style ≠ none, contrast ≥ ${MIN_RATIO}:1): ${evaluated
            .map((c) => `[${c.kind}: width=${c.width}px style=${c.style} color=${c.color} bg=${c.bg} ratio=${c.ratio}]`)
            .join(' ')}`,
        );
      }
      if (unmet.length) failures.push(`${label} (box ${m.box}): ${unmet.join('; ')}`);
    }

    expect(failures, [`focused control failures: ${failures.length}`, ...failures.map((f) => `- ${f}`)].join('\n')).toEqual([]);
  });

  // Req 6.8
  test('escape closes region listbox and returns focus', async ({ page }) => {
    await page.goto('/');
    const region = regionCombobox(page);
    await expect(region, 'combobox "Region" must resolve exactly once').toHaveCount(1, { timeout: STEP_TIMEOUT });
    await region.focus();
    await expect(region).toBeFocused({ timeout: STEP_TIMEOUT });

    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: STEP_TIMEOUT });
    // 用户批准 2026-10-29：仅改定位器（列表展开时 #root aria-hidden）
    const regionWhileOpen = page.getByRole('combobox', { name: 'Region', exact: true, includeHidden: true });
    await expect(regionWhileOpen).toHaveAttribute('aria-expanded', 'true', { timeout: STEP_TIMEOUT });

    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden({ timeout: STEP_TIMEOUT });
    await expect(region).toHaveAttribute('aria-expanded', 'false', { timeout: STEP_TIMEOUT });
    // 焦点回到 combobox，而非留在已收起的列表内或移到 Hero_Controls 之外。
    await expect(region).toBeFocused({ timeout: STEP_TIMEOUT });
  });
});

test.describe('B: state', () => {
  const NAV_ITEMS = ['Overview', 'Work orders', 'Technicians', 'Assets'] as const;

  // Req 8.1, 8.7。本 describe 的第一个用例负责重置 state-assertions.log，其余用例追加。
  test('only Overview is the current page', async ({ page }) => {
    resetLog(STATE_ASSERTIONS_LOG, logHeader(srcStateForLogs(), 'Dynamic state assertions (Req 8.1–8.4, 8.7)'));
    appendLog(STATE_ASSERTIONS_LOG, '## only Overview is the current page');
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    for (const item of NAV_ITEMS) {
      const button = nav.getByRole('button', { name: item, exact: true });
      const isCurrent = item === 'Overview';
      await assertState({
        step: `nav "${item}" aria-current`,
        keys: [],
        kind: 'aria-current',
        expected: isCurrent ? 'page' : '(absent)',
        check: () =>
          isCurrent
            ? expect(button).toHaveAttribute('aria-current', 'page', { timeout: STEP_TIMEOUT })
            : expect(button).not.toHaveAttribute('aria-current', /.*/, { timeout: STEP_TIMEOUT }),
        actual: () => attrOrAbsent(button, 'aria-current'),
        soft: true,
      });
    }
  });

  // Req 8.2, 8.3, 8.4, 8.7
  test('region combobox exposes value and expanded state', async ({ page }) => {
    appendLog(STATE_ASSERTIONS_LOG, '## region combobox exposes value and expanded state');
    await page.goto('/');
    const region = regionCombobox(page);
    const listbox = page.getByRole('listbox');

    // Req 8.2：初始值与收起状态。
    await assertState({
      step: 'initial value',
      keys: [],
      kind: 'value',
      expected: 'All regions',
      check: () => expect(region).toHaveText('All regions', { timeout: STEP_TIMEOUT }),
      actual: () => comboboxValue(region),
    });
    await assertState({
      step: 'initial aria-expanded',
      keys: [],
      kind: 'aria-expanded',
      expected: 'false',
      check: () => expect(region).toHaveAttribute('aria-expanded', 'false', { timeout: STEP_TIMEOUT }),
      actual: () => attrOrAbsent(region, 'aria-expanded'),
    });

    // Req 8.3：Enter 与 ArrowDown 均可打开；焦点落在与当前值同名的 option 上。
    for (const key of ['Enter', 'ArrowDown']) {
      const selected = await comboboxValue(region);
      await region.focus();
      await page.keyboard.press(key);
      // 用户批准 2026-10-29：仅改定位器（列表展开时 #root aria-hidden）
      const regionWhileOpen = page.getByRole('combobox', { name: 'Region', exact: true, includeHidden: true });
      await assertState({
        step: `${key} opens listbox`,
        keys: [key],
        kind: 'aria-expanded',
        expected: 'true',
        check: async () => {
          await expect(listbox).toBeVisible({ timeout: STEP_TIMEOUT });
          await expect(regionWhileOpen).toHaveAttribute('aria-expanded', 'true', { timeout: STEP_TIMEOUT });
        },
        actual: () => attrOrAbsent(regionWhileOpen, 'aria-expanded'),
      });
      for (const option of ['North', 'Central', 'South']) {
        await assertState({
          step: `${key}: listbox contains option "${option}"`,
          keys: [key],
          kind: 'value',
          expected: `option "${option}"`,
          check: () => expect(listbox.getByRole('option', { name: option, exact: true })).toHaveCount(1, { timeout: STEP_TIMEOUT }),
          actual: async () =>
            (await listbox.getByRole('option').allTextContents()).map((t) => `option "${normalizeName(t)}"`).join(', ') ||
            '(no options)',
        });
      }
      await assertState({
        step: `${key}: focus on selected option`,
        keys: [key],
        kind: 'focus',
        expected: `option "${selected}"`,
        check: () => expect(listbox.getByRole('option', { name: selected, exact: true })).toBeFocused({ timeout: STEP_TIMEOUT }),
        actual: () => describeFocus(page),
      });

      // 关闭以便下一轮从收起状态开始（Escape 行为本身由 6.8 / 8.5 用例判定）。
      await page.keyboard.press('Escape');
      await expect(listbox).toBeHidden({ timeout: STEP_TIMEOUT });
    }

    // Req 8.4：Enter → ArrowDown → Enter 选中 North，收起并回焦 combobox。
    const keys = ['Enter', 'ArrowDown', 'Enter'];
    await region.focus();
    await page.keyboard.press('Enter');
    await expect(listbox).toBeVisible({ timeout: STEP_TIMEOUT });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await assertState({
      step: 'select North: value',
      keys,
      kind: 'value',
      expected: 'North',
      check: () => expect(region).toHaveText('North', { timeout: STEP_TIMEOUT }),
      actual: () => comboboxValue(region),
    });
    await assertState({
      step: 'select North: aria-expanded',
      keys,
      kind: 'aria-expanded',
      expected: 'false',
      check: () => expect(region).toHaveAttribute('aria-expanded', 'false', { timeout: STEP_TIMEOUT }),
      actual: () => attrOrAbsent(region, 'aria-expanded'),
    });
    await assertState({
      step: 'select North: focus',
      keys,
      kind: 'focus',
      expected: 'combobox "Region"',
      check: () => expect(region).toBeFocused({ timeout: STEP_TIMEOUT }),
      actual: () => describeFocus(page),
    });
  });

  // Feature: a11y-audit-remediation, Property 9: 下拉"打开再取消"不改变选择
  // Req 8.5, 6.8：对起始值 v ∈ {All regions, North, Central, South} 穷举。
  // 每个 v：重新加载页面 → 键盘把 Region 设为 v → Enter 打开 → ArrowDown 移动高亮 → Escape；
  // 断言 listbox 关闭、aria-expanded="false"、焦点在 combobox、可访问值仍为 v。
  // 单个 v 的失败记为软失败后继续下一个 v；combobox 完全定位不到时只给出一条明确失败。
  test('escape restores any previously selected region', async ({ page }) => {
    const VALUES = ['All regions', 'North', 'Central', 'South'] as const;
    const MAX_MOVES = VALUES.length + 1;
    appendLog(STATE_ASSERTIONS_LOG, '## escape restores any previously selected region');

    await page.goto('/');
    await assertState({
      step: 'precondition: combobox "Region" resolves',
      keys: [],
      kind: 'value',
      expected: 'exactly 1 combobox "Region"',
      check: () => expect(regionCombobox(page)).toHaveCount(1, { timeout: STEP_TIMEOUT }),
      actual: async () => `${await regionCombobox(page).count()} match(es)`,
    });

    /** 当前获焦 option 的可访问名称；焦点不在 option 上返回 null。 */
    const focusedOption = async (): Promise<string | null> => {
      const stop = await readFocusStop(page, 0);
      return stop && stop.role === 'option' ? stop.name : null;
    };

    for (const v of VALUES) {
      await page.goto('/');
      const region = regionCombobox(page);
      const listbox = page.getByRole('listbox');

      // --- 步骤 1：用键盘把 Region 设为 v -------------------------------------
      const setupKeys: string[] = ['Enter'];
      try {
        await region.focus({ timeout: STEP_TIMEOUT });
        await page.keyboard.press('Enter');
        await expect(listbox).toBeVisible({ timeout: STEP_TIMEOUT });
        await expect(listbox.getByRole('option').first()).toBeVisible({ timeout: STEP_TIMEOUT });
        const order = (await listbox.getByRole('option').allTextContents()).map(normalizeName);
        const target = order.indexOf(v);
        for (let i = 0; i < MAX_MOVES; i += 1) {
          const current = await focusedOption();
          if (current === v) break;
          const from = current === null ? -1 : order.indexOf(current);
          const key = from > target ? 'ArrowUp' : 'ArrowDown';
          setupKeys.push(key);
          await page.keyboard.press(key);
        }
        setupKeys.push('Enter');
        await page.keyboard.press('Enter');
        await assertState({
          step: `[v=${v}] setup: value`,
          keys: setupKeys,
          kind: 'value',
          expected: v,
          check: () => expect(region).toHaveText(v, { timeout: STEP_TIMEOUT }),
          actual: () => comboboxValue(region),
        });
        await expect(listbox).toBeHidden({ timeout: STEP_TIMEOUT });
      } catch (e) {
        appendStateAssertion({
          step: `[v=${v}] setup aborted`,
          keys: setupKeys,
          kind: 'value',
          expected: v,
          actual: await comboboxValue(region).catch(() => '(unavailable)'),
          pass: false,
        });
        expect.soft(false, `[v=${v}] could not set Region to "${v}" via keyboard\n${String(e)}`).toBe(true);
        continue;
      }

      // --- 步骤 2：打开 → 移动高亮 → Escape ------------------------------------
      const keys = ['Enter', 'ArrowDown', 'Escape'];
      await region.focus({ timeout: STEP_TIMEOUT }).catch(() => undefined);
      await page.keyboard.press('Enter');
      // 列表打开时 MUI 对页面其余部分加 aria-hidden，需 includeHidden 才能读到 combobox 的 aria-expanded。
      const regionWhileOpen = page.getByRole('combobox', { name: 'Region', exact: true, includeHidden: true });
      await assertState({
        step: `[v=${v}] Enter opens listbox`,
        keys: ['Enter'],
        kind: 'aria-expanded',
        expected: 'true',
        check: async () => {
          await expect(listbox).toBeVisible({ timeout: STEP_TIMEOUT });
          await expect(regionWhileOpen).toHaveAttribute('aria-expanded', 'true', { timeout: STEP_TIMEOUT });
        },
        actual: () => attrOrAbsent(regionWhileOpen, 'aria-expanded'),
        soft: true,
      });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');

      await assertState({
        step: `[v=${v}] escape: listbox hidden`,
        keys,
        kind: 'aria-expanded',
        expected: 'listbox hidden',
        check: () => expect(listbox).toBeHidden({ timeout: STEP_TIMEOUT }),
        actual: async () => ((await listbox.isVisible()) ? 'listbox visible' : 'listbox hidden'),
        soft: true,
      });
      await assertState({
        step: `[v=${v}] escape: aria-expanded`,
        keys,
        kind: 'aria-expanded',
        expected: 'false',
        check: () => expect(region).toHaveAttribute('aria-expanded', 'false', { timeout: STEP_TIMEOUT }),
        actual: () => attrOrAbsent(region, 'aria-expanded'),
        soft: true,
      });
      await assertState({
        step: `[v=${v}] escape: focus`,
        keys,
        kind: 'focus',
        expected: 'combobox "Region"',
        check: () => expect(region).toBeFocused({ timeout: STEP_TIMEOUT }),
        actual: () => describeFocus(page),
        soft: true,
      });
      await assertState({
        step: `[v=${v}] escape: value unchanged`,
        keys,
        kind: 'value',
        expected: v,
        check: () => expect(region).toHaveText(v, { timeout: STEP_TIMEOUT }),
        actual: () => comboboxValue(region),
        soft: true,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// B 层：强制颜色（Req 9）
// ---------------------------------------------------------------------------

/** 单个元素在浏览器中读取到的计算样式快照。 */
type StyleSnap = {
  found: boolean;
  visible: boolean;
  text: string;
  borderWidths: string[];
  borderStyles: string[];
  outlineWidth: string;
  outlineStyle: string;
  color: string;
  fill: string;
  backgroundColor: string;
  /** 最近非透明祖先的 background-color（`fromSelf` 时含元素自身）。 */
  effectiveBg: string;
};

const MISSING_SNAP: StyleSnap = {
  found: false,
  visible: false,
  text: '',
  borderWidths: [],
  borderStyles: [],
  outlineWidth: '(n/a)',
  outlineStyle: '(n/a)',
  color: '(n/a)',
  fill: '(n/a)',
  backgroundColor: '(n/a)',
  effectiveBg: '(n/a)',
};

/** 读取计算样式；元素不存在或不唯一时返回 `found: false`，不抛错（软判定）。 */
async function snapStyles(locator: Locator, fromSelf: boolean): Promise<StyleSnap> {
  if ((await locator.count()) !== 1) return MISSING_SNAP;
  const visible = await locator.isVisible();
  const raw = await locator.evaluate((el, self) => {
    const cs = getComputedStyle(el);
    const transparent = (c: string) => c === 'transparent' || /^rgba\(.*,\s*0(?:\.0+)?\)$/.test(c);
    let node: Element | null = self ? el : el.parentElement;
    let effectiveBg = 'rgba(0, 0, 0, 0)';
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (!transparent(bg)) {
        effectiveBg = bg;
        break;
      }
      node = node.parentElement;
    }
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    return {
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      borderWidths: sides.map((s) => cs.getPropertyValue(`border-${s.toLowerCase()}-width`)),
      borderStyles: sides.map((s) => cs.getPropertyValue(`border-${s.toLowerCase()}-style`)),
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
      color: cs.color,
      fill: cs.fill,
      backgroundColor: cs.backgroundColor,
      effectiveBg,
    };
  }, fromSelf);
  return { found: true, visible, ...raw };
}

/** 计算值颜色比较：可解析时按 RGB 比较，否则按原字符串比较。 */
const sameColor = (a: string, b: string): boolean => {
  try {
    const x = parseColor(a);
    const y = parseColor(b);
    return x.r === y.r && x.g === y.g && x.b === y.b;
  } catch {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
};

const px = (w: string): number => parseFloat(w) || 0;

/** Req 9 "可见边界"：四边 border ≥ 1px 且样式非 none，或 outline ≥ 1px 且样式非 none。返回未满足项（空 = 满足）。 */
const boundaryUnmet = (s: StyleSnap): string[] => {
  if (!s.found) return ['element not found (count !== 1)'];
  const border = s.borderWidths.length === 4 && s.borderWidths.every((w) => px(w) >= 1) && s.borderStyles.every((st) => st !== 'none');
  const outline = px(s.outlineWidth) >= 1 && s.outlineStyle !== 'none';
  return border || outline
    ? []
    : [
        `visible-boundary: border-width=[${s.borderWidths.join(' ')}] border-style=[${s.borderStyles.join(' ')}] ` +
          `outline-width=${s.outlineWidth} outline-style=${s.outlineStyle} — need all 4 borders ≥1px & not none, or outline ≥1px & not none`,
      ];
};

/** Req 9 "可见文字"：toBeVisible、文本非空、color ≠ 最近非透明祖先 background-color。 */
const textUnmet = (s: StyleSnap): string[] => {
  if (!s.found) return ['element not found (count !== 1)'];
  const unmet: string[] = [];
  if (!s.visible) unmet.push('visible-text: element not visible');
  if (s.text === '') unmet.push('visible-text: text content empty');
  if (sameColor(s.color, s.effectiveBg)) unmet.push(`visible-text: color ${s.color} equals ancestor background-color ${s.effectiveBg}`);
  return unmet;
};

/** 图标：svg 可见，且 color（或 fill）≠ 宿主背景。 */
const iconUnmet = (svg: StyleSnap, hostBg: string): string[] => {
  if (!svg.found) return ['svg not found (count !== 1)'];
  const unmet: string[] = [];
  if (!svg.visible) unmet.push('visible-icon: svg not visible');
  if (sameColor(svg.color, hostBg) && sameColor(svg.fill, hostBg)) {
    unmet.push(`visible-icon: svg color ${svg.color} / fill ${svg.fill} equals host background-color ${hostBg}`);
  }
  return unmet;
};

test.describe('B: forced colors', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
  });

  // Feature: a11y-audit-remediation, Property 10: 强制颜色下信息不丢失
  // Req 9.1–9.6：每个受检元素按 Req 9 判定定义逐项判定，全部写入断言日志；截图在 finally 中保存。
  test('controls, icons and status remain distinguishable', async ({ page }) => {
    resetLog(FORCED_COLORS_LOG, [
      ...logHeader(srcStateForLogs(), 'Forced colors assertions (Req 9.1–9.6, Property 10)'),
      `# emulateMedia: forcedColors=active; viewport: ${JSON.stringify(page.viewportSize())}`,
      '# 判定定义见 requirements Req 9；"=> SUBJECT" 行为该受检对象的最终结论，其上为各探针读数',
    ]);
    const failures: string[] = [];

    /** 记录一个探针（单个元素的一次判定）。 */
    const record = (selector: string, criterion: ForcedColorCheck['criterion'], s: StyleSnap, unmet: string[], extra?: string) => {
      appendForcedColorCheck({
        selector,
        borderWidth: s.borderWidths.length ? s.borderWidths.join(' ') : '(n/a)',
        outlineWidth: s.outlineWidth,
        color: s.color,
        backgroundColor: s.backgroundColor,
        criterion,
        pass: unmet.length === 0,
      });
      if (extra) appendLog(FORCED_COLORS_LOG, `    ${extra}`);
      for (const u of unmet) appendLog(FORCED_COLORS_LOG, `    unmet: ${u}`);
    };

    /** 记录受检对象的最终结论；失败时收集选择器、未满足判定项与计算值（Req 9.6）。 */
    const conclude = (subject: string, pass: boolean, detail: string[]) => {
      appendLog(FORCED_COLORS_LOG, `=> SUBJECT [${pass ? 'PASS' : 'FAIL'}] ${subject}`);
      if (!pass) failures.push(`${subject}\n      ${detail.join('\n      ')}`);
    };

    /** Req 9.1：可见边界 或 可见文字（任一探针满足任一项即通过）。 */
    const boundaryOrText = async (subject: string, probes: Array<[selector: string, locator: Locator]>) => {
      const detail: string[] = [];
      let pass = false;
      for (const [selector, locator] of probes) {
        const s = await snapStyles(locator, false);
        const b = boundaryUnmet(s);
        const t = textUnmet(s);
        record(selector, 'visible-boundary', s, b);
        record(selector, 'visible-text', s, t, `text=${JSON.stringify(s.text)} ancestor-background-color=${JSON.stringify(s.effectiveBg)}`);
        if (b.length === 0 || t.length === 0) pass = true;
        detail.push(
          `${selector}: ${[...b, ...t].join('; ') || 'ok'} (border-width=[${s.borderWidths.join(' ')}] outline-width=${s.outlineWidth} color=${s.color} background-color=${s.backgroundColor})`,
        );
      }
      conclude(subject, pass, detail);
    };

    try {
      // --- Req 9.1：Hero 三控件 -------------------------------------------------
      const hero = page.locator('.hero-actions');
      const search = hero.locator('input[type="search"]');
      const searchOutline = hero.locator('.MuiOutlinedInput-root:has(input[type="search"]) > .MuiOutlinedInput-notchedOutline');
      await boundaryOrText('Hero: Search work orders', [
        ['.hero-actions input[type="search"]', search],
        ['.hero-actions .MuiOutlinedInput-root:has(input[type="search"]) > .MuiOutlinedInput-notchedOutline', searchOutline],
      ]);
      const region = hero.locator('[role="combobox"]');
      const regionOutline = hero.locator('.MuiOutlinedInput-root:has([role="combobox"]) > .MuiOutlinedInput-notchedOutline');
      await boundaryOrText('Hero: Region', [
        ['.hero-actions [role="combobox"]', region],
        ['.hero-actions .MuiOutlinedInput-root:has([role="combobox"]) > .MuiOutlinedInput-notchedOutline', regionOutline],
      ]);
      await boundaryOrText('Hero: Schedule visit', [
        ['.hero-actions button:has-text("Schedule visit")', hero.locator('button', { hasText: 'Schedule visit' })],
      ]);

      // --- Req 9.1：3 条 Job_Row + View all work orders ------------------------
      const rows = page.locator('.job-row');
      const rowCount = await rows.count();
      if (rowCount !== 3) conclude('Job_Row count', false, [`.job-row: expected 3, found ${rowCount}`]);
      for (let i = 0; i < Math.min(rowCount, 3); i += 1) {
        await boundaryOrText(`Job_Row #${i + 1}`, [[`.job-row >> nth=${i}`, rows.nth(i)]]);
      }
      await boundaryOrText('View all work orders', [['.view-all', page.locator('.view-all')]]);

      // --- Req 9.2：2 个 Icon_Button（可见边界）及其 svg ------------------------
      const iconButtons: Array<[label: string, testId: string, expectedName: string]> = [
        ['More actions', 'MoreHorizIcon', 'More actions'],
        ['Filter work orders', 'FilterAltIcon', 'Filter work orders'],
      ];
      for (const [label, testId, expectedName] of iconButtons) {
        const selector = `.MuiIconButton-root:has(svg[data-testid="${testId}"])`;
        const button = page.locator(selector);
        const svg = button.locator(`svg[data-testid="${testId}"]`);
        const bs = await snapStyles(button, true);
        const b = boundaryUnmet(bs);
        const name = bs.found ? ((await button.getAttribute('aria-label')) ?? '(no aria-label)') : '(n/a)';
        record(selector, 'visible-boundary', bs, b, `info: aria-label=${JSON.stringify(name)} (expected ${JSON.stringify(expectedName)}; name is gated by A layer)`);
        const hostBg = bs.found ? bs.effectiveBg : '(n/a)';
        const ss = await snapStyles(svg, false);
        const ic = iconUnmet(ss, hostBg);
        record(`${selector} > svg`, 'visible-icon', ss, ic, `fill=${JSON.stringify(ss.fill)} button-background-color=${JSON.stringify(hostBg)}`);
        conclude(`Icon_Button: ${label}`, b.length === 0 && ic.length === 0, [
          `${selector}: ${b.join('; ') || 'boundary ok'} (border-width=[${bs.borderWidths.join(' ')}] outline-width=${bs.outlineWidth} background-color=${bs.backgroundColor})`,
          `${selector} > svg: ${ic.join('; ') || 'icon ok'} (color=${ss.color} fill=${ss.fill})`,
        ]);
      }

      // --- Req 9.3：3 条 Territory_Progress ------------------------------------
      const tracks = page.locator('.territory-panel .MuiLinearProgress-root');
      const trackCount = await tracks.count();
      if (trackCount !== 3) conclude('Territory_Progress count', false, [`.territory-panel .MuiLinearProgress-root: expected 3, found ${trackCount}`]);
      for (let i = 0; i < Math.min(trackCount, 3); i += 1) {
        const selector = `.territory-panel .MuiLinearProgress-root >> nth=${i}`;
        const track = await snapStyles(tracks.nth(i), true);
        const bar = await snapStyles(tracks.nth(i).locator('.MuiLinearProgress-bar').first(), true);
        const unmet: string[] = [];
        if (!track.visible) unmet.push('distinguishable-bar: progress track not visible');
        if (!bar.found) unmet.push('distinguishable-bar: .MuiLinearProgress-bar not found');
        const bgDiffers = bar.found && !sameColor(bar.backgroundColor, track.backgroundColor);
        const barBoundary = bar.found && boundaryUnmet(bar).length === 0;
        if (bar.found && !bgDiffers && !barBoundary) {
          unmet.push(
            `distinguishable-bar: bar background-color ${bar.backgroundColor} equals track background-color ${track.backgroundColor} ` +
              `and bar has no visible boundary (border-width=[${bar.borderWidths.join(' ')}] outline-width=${bar.outlineWidth})`,
          );
        }
        record(`${selector} > .MuiLinearProgress-bar`, 'distinguishable-bar', bar, unmet, `track background-color=${JSON.stringify(track.backgroundColor)} track border-width=[${track.borderWidths.join(' ')}]`);
        conclude(`Territory_Progress #${i + 1}`, unmet.length === 0, [`${selector}: ${unmet.join('; ')}`]);
      }

      // --- Req 9.4：SLA 方向文字 ------------------------------------------------
      const direction = page.getByText(/Increased 12\.6%/i);
      const dirCount = await direction.count();
      if (dirCount !== 1) {
        record('getByText(/Increased 12\\.6%/i)', 'visible-text', MISSING_SNAP, [`expected exactly 1 match, found ${dirCount}`]);
        conclude('SLA_Risk_Metric: Increased 12.6%', false, [`getByText(/Increased 12\\.6%/i): expected exactly 1 match, found ${dirCount}`]);
      } else {
        await boundaryOrText('SLA_Risk_Metric: Increased 12.6%', [['getByText(/Increased 12\\.6%/i)', direction]]);
      }

      // --- Req 9.4：pulse 卡片状态文字与图标 -------------------------------------
      const pulses: Array<[cls: string, text: string]> = [
        ['warning', '4 visits at SLA risk'],
        ['success', '12 jobs closed'],
      ];
      for (const [cls, text] of pulses) {
        const cardSel = `.pulse-card.${cls}`;
        const card = page.locator(cardSel);
        const cs = await snapStyles(card, true);
        const label = card.getByText(text, { exact: true });
        const ts = await snapStyles(label, false);
        const tu = textUnmet(ts);
        record(`${cardSel} >> text="${text}"`, 'visible-text', ts, tu, `text=${JSON.stringify(ts.text)} ancestor-background-color=${JSON.stringify(ts.effectiveBg)}`);
        conclude(`pulse card: ${text} (text)`, tu.length === 0, [
          `${cardSel} >> text="${text}": ${tu.join('; ')} (color=${ts.color} background-color=${ts.backgroundColor})`,
        ]);
        const cardBg = cs.found ? cs.effectiveBg : '(n/a)';
        const ss = await snapStyles(card.locator(':scope > svg'), false);
        const iu = iconUnmet(ss, cardBg);
        record(`${cardSel} > svg`, 'visible-icon', ss, iu, `fill=${JSON.stringify(ss.fill)} card-background-color=${JSON.stringify(cardBg)}`);
        conclude(`pulse card: ${text} (icon)`, iu.length === 0, [`${cardSel} > svg: ${iu.join('; ')} (color=${ss.color} fill=${ss.fill})`]);
      }
    } finally {
      // Req 9.5：无论判定结果如何都保存整页截图与日志尾部汇总。
      await page.screenshot({ path: evidencePath('forced-colors-fullpage.png'), fullPage: true });
      appendLog(FORCED_COLORS_LOG, `# failed subjects: ${failures.length}`);
    }

    // Req 9.6：任一受检元素未满足 → 失败，并输出选择器、未满足判定项与计算值。
    expect(failures, `forced-colors failures (${failures.length}):\n  - ${failures.join('\n  - ')}`).toEqual([]);
  });
});

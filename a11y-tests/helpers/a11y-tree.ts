/**
 * a11y-tree helpers — 读取焦点元素的角色 / 可访问名称，并枚举 generic 元素上的命名属性。
 *
 * Feature: a11y-audit-remediation
 * Validates: Requirements 1.4, 2.2, 6.5, 7.1
 *
 * 非 `.spec.ts` 模块：Playwright `testDir` 不会把它当测试执行。
 * 不 import `src/` 任何模块，所有信息从真实 DOM / Playwright 无障碍树读取。
 */
import type { Locator, Page } from '@playwright/test';

/** 与 DOMRect 同形但可序列化的矩形（page.evaluate 无法直接回传 DOMRect）。 */
export type DOMRectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** 焦点路径中的一个停靠点（Req 6 / 7）。step 从 1 开始。 */
export type FocusStop = { step: number; role: string; name: string; rect: DOMRectLike };

/** 批准序列中的一项：[role, name]；name 为字符串时精确匹配，为正则时做 test。 */
export type ApprovedStop = readonly [role: string, name: string | RegExp];

/**
 * 产品团队批准的整页 Tab 顺序（requirements “已确认澄清项” 1；Req 6.5、7.1），共 13 项。
 */
export const APPROVED_TAB_ORDER = [
  ['button', 'Overview'],
  ['button', 'Work orders'],
  ['button', 'Technicians'],
  ['button', 'Assets'],
  ['button', 'More actions'],
  ['searchbox', 'Search work orders'],
  ['combobox', 'Region'],
  ['button', 'Schedule visit'],
  ['button', 'Filter work orders'],
  ['button', /WO-1842/],
  ['button', /WO-1847/],
  ['button', /WO-1851/],
  ['button', 'View all work orders'],
] as const satisfies readonly ApprovedStop[];

/** 规范化可访问名称：折叠空白并去除首尾空白。 */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** 判断一个焦点停靠点是否与批准项匹配（role 精确相等；name 精确或正则）。 */
export function matchesApprovedStop(stop: Pick<FocusStop, 'role' | 'name'>, expected: ApprovedStop): boolean {
  const [role, name] = expected;
  if (stop.role !== role) return false;
  const actual = normalizeName(stop.name);
  return typeof name === 'string' ? actual === name : name.test(actual);
}

/** 用于日志的单行描述，格式与 keyboard-focus.spec.ts 保持一致：`role: name` / `(unnamed)`。 */
export function formatFocusStop(stop: FocusStop): string {
  return `${stop.step}. ${stop.role}: ${stop.name || '(unnamed)'}`;
}

// ---------------------------------------------------------------------------
// ariaSnapshot 解析
// ---------------------------------------------------------------------------

/**
 * 解析 `locator.ariaSnapshot()` 首行，例如：
 *   `- button "More actions"`、`- combobox "Region": All regions`、`- searchbox "Search work orders"`。
 * 只关心根节点的 role 与 name；无名称时 name 为空串。无法解析时返回 null。
 */
export function parseAriaSnapshotRoot(snapshot: string): { role: string; name: string } | null {
  const firstLine = snapshot.split('\n').find((line) => line.trim().length > 0);
  if (!firstLine) return null;
  const match = /^\s*-\s+([a-z][\w-]*)(?:\s+("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'))?/i.exec(firstLine);
  if (!match) return null;
  const role = match[1];
  const quoted = match[2];
  let name = '';
  if (quoted?.startsWith('"')) {
    try {
      name = JSON.parse(quoted) as string;
    } catch {
      name = quoted.slice(1, -1);
    }
  } else if (quoted?.startsWith("'")) {
    name = quoted.slice(1, -1).replace(/''/g, "'");
  }
  return { role, name: normalizeName(name) };
}

// ---------------------------------------------------------------------------
// 焦点元素读取
// ---------------------------------------------------------------------------

type EvaluatedFocus = { isBody: boolean; role: string; name: string; rect: DOMRectLike };

/**
 * 在浏览器中读取 document.activeElement 的回退角色 / 名称与矩形。
 * 角色：显式 role 首个 token，否则按常见 HTML 隐式角色映射，最后退回 tagName（与 keyboard-focus.spec.ts 一致）。
 * 名称：aria-labelledby → aria-label → 关联 <label> → 文本内容 → placeholder → title。
 */
async function evaluateActiveElement(page: Page): Promise<EvaluatedFocus | null> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    const r = element.getBoundingClientRect();
    const rect = {
      x: r.x, y: r.y, width: r.width, height: r.height,
      top: r.top, right: r.right, bottom: r.bottom, left: r.left,
    };
    if (element === document.body || element === document.documentElement) {
      return { isBody: true, role: 'body', name: '', rect };
    }

    const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    const tag = element.tagName.toLowerCase();
    const explicitRole = clean(element.getAttribute('role')).split(' ')[0];

    const implicitRole = (): string => {
      if (tag === 'button') return 'button';
      if (tag === 'a') return element.hasAttribute('href') ? 'link' : tag;
      if (tag === 'select') {
        const sel = element as HTMLSelectElement;
        return sel.multiple || sel.size > 1 ? 'listbox' : 'combobox';
      }
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') {
        const type = clean(element.getAttribute('type')).toLowerCase() || 'text';
        const hasList = element.hasAttribute('list');
        switch (type) {
          case 'button': case 'submit': case 'reset': case 'image': return 'button';
          case 'checkbox': return 'checkbox';
          case 'radio': return 'radio';
          case 'range': return 'slider';
          case 'number': return 'spinbutton';
          case 'search': return hasList ? 'combobox' : 'searchbox';
          case 'email': case 'tel': case 'text': case 'url': return hasList ? 'combobox' : 'textbox';
          default: return 'textbox';
        }
      }
      if (tag === 'summary') return 'button';
      return tag;
    };

    const role = explicitRole || implicitRole();

    const textOf = (id: string) => clean(document.getElementById(id)?.textContent);
    let name = '';
    const labelledby = clean(element.getAttribute('aria-labelledby'));
    if (labelledby) name = clean(labelledby.split(' ').map(textOf).join(' '));
    if (!name) name = clean(element.getAttribute('aria-label'));
    if (!name && 'labels' in element) {
      const labels = (element as HTMLInputElement).labels;
      if (labels && labels.length) name = clean(Array.from(labels).map((l) => l.textContent).join(' '));
    }
    if (!name && !['input', 'textarea', 'select'].includes(tag)) name = clean(element.textContent);
    if (!name) name = clean(element.getAttribute('placeholder'));
    if (!name) name = clean(element.getAttribute('title'));

    return { isBody: false, role, name, rect };
  });
}

/**
 * 读取当前焦点元素的 FocusStop。
 * 优先使用 Playwright 无障碍树（`locator(':focus').ariaSnapshot()`，按 Accessible Name 规范计算），
 * 若快照为空或无法解析则回退到 page.evaluate 的启发式结果。
 * 焦点在 body（或文档外）时返回 null —— 对应 Req 7.2 “焦点离开全部 Workbench 控件”。
 */
export async function readFocusStop(page: Page, step: number): Promise<FocusStop | null> {
  const evaluated = await evaluateActiveElement(page);
  if (!evaluated || evaluated.isBody) return null;

  let role = evaluated.role;
  let name = evaluated.name;
  const focused: Locator = page.locator(':focus');
  try {
    if ((await focused.count()) === 1) {
      const parsed = parseAriaSnapshotRoot(await focused.ariaSnapshot({ timeout: 1000 }));
      if (parsed) {
        role = parsed.role;
        // 以规范计算的名称为准：快照无名称即视为 unnamed，不用启发式文本“补”名称。
        name = parsed.name;
      }
    }
  } catch {
    // ariaSnapshot 失败（元素在读取期间失焦等）时沿用 evaluate 结果。
  }

  return { step, role, name: normalizeName(name), rect: evaluated.rect };
}

/**
 * 从当前焦点位置连续按 `key` `count` 次，记录每次到达的 FocusStop（焦点回到 body 时记录为 null）。
 * step 从 1 开始，与 keyboard-focus.spec.ts 的编号方式一致。
 */
export async function walkFocus(
  page: Page,
  count: number,
  key: 'Tab' | 'Shift+Tab' = 'Tab',
): Promise<Array<FocusStop | null>> {
  const stops: Array<FocusStop | null> = [];
  for (let step = 1; step <= count; step += 1) {
    await page.keyboard.press(key);
    stops.push(await readFocusStop(page, step));
  }
  return stops;
}

// ---------------------------------------------------------------------------
// generic 元素命名属性检查（Property 2 / Req 2.2）
// ---------------------------------------------------------------------------

/** 一个“计算角色为 generic 却携带 aria-label / aria-labelledby”的违规元素。 */
export type GenericNamingViolation = {
  /** 便于定位的简易 CSS 路径，例如 `div.territory-card.zone-1` 或 `main > section > div:nth-of-type(2)`。 */
  selector: string;
  tag: string;
  /** 显式 role（若为 `generic`）或空串表示无显式 role。 */
  explicitRole: string;
  ariaLabel: string | null;
  ariaLabelledby: string | null;
};

/**
 * 枚举页面（或 `root` 选择器下）所有“无显式 role 且无隐式 ARIA 角色（即 generic）”的元素，
 * 返回其中携带 `aria-label` 或 `aria-labelledby` 的元素。显式 `role="generic"` 同样计入。
 * 合规时返回空数组。
 *
 * 隐式角色判定依据 HTML-AAM 常用映射；仅 `div`、`span` 等无语义元素，以及
 * 条件不满足时的 `a`（无 href）、`header`/`footer`（位于 sectioning 内容内）等被视为 generic。
 */
export async function findNamedGenericElements(page: Page, root = 'body'): Promise<GenericNamingViolation[]> {
  return page.evaluate((rootSelector) => {
    const scope = document.querySelector(rootSelector) ?? document.body;

    // 无条件拥有隐式角色（非 generic）的元素。
    const roleful = new Set([
      'article', 'aside', 'button', 'datalist', 'details', 'dialog', 'dd', 'dfn', 'dt', 'fieldset',
      'figure', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'main', 'math', 'menu', 'meter',
      'nav', 'ol', 'optgroup', 'option', 'output', 'progress', 'select', 'summary', 'table', 'tbody',
      'td', 'textarea', 'tfoot', 'th', 'thead', 'tr', 'ul', 'address', 'blockquote', 'caption', 'code',
      'del', 'em', 'ins', 'mark', 'p', 'search', 'strong', 'sub', 'sup', 'time', 'html', 'body',
      'input', 'svg', 'legend', 'label', 'dl', 'menuitem',
    ]);
    // 非渲染 / 无无障碍节点的元素，不参与 generic 判定。
    const ignored = new Set(['script', 'style', 'template', 'noscript', 'meta', 'link', 'head', 'title', 'br', 'wbr']);
    const sectioning = 'article, aside, main, nav, section';

    const hasImplicitRole = (el: Element): boolean => {
      const tag = el.tagName.toLowerCase();
      if (roleful.has(tag)) return true;
      if (tag === 'a' || tag === 'area') return el.hasAttribute('href');
      if (tag === 'img') return el.getAttribute('alt') !== '' || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
      if (tag === 'header' || tag === 'footer') return !el.parentElement?.closest(sectioning);
      // section 有可访问名称时为 region；无名称时为 generic（此时它本身没有命名属性，不会进入违规）。
      if (tag === 'section') return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.hasAttribute('title');
      if (tag.includes('-')) return false; // 自定义元素默认 generic
      return false; // div、span、b、i、u、s、small、bdi、bdo、data、pre 等
    };

    const cssPath = (el: Element): string => {
      const parts: string[] = [];
      let node: Element | null = el;
      while (node && node !== document.body && parts.length < 4) {
        const tag = node.tagName.toLowerCase();
        if (node.id) {
          parts.unshift(`${tag}#${CSS.escape(node.id)}`);
          break;
        }
        // 跳过 emotion 生成的哈希类（css-xxxx），让选择器在不同构建间稳定可读。
        const classes = Array.from(node.classList).filter((c) => !c.startsWith('css-')).slice(0, 3).map((c) => `.${CSS.escape(c)}`).join('');
        let part = tag + classes;
        const parent: Element | null = node.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        node = parent;
      }
      return parts.join(' > ');
    };

    const violations: Array<{
      selector: string; tag: string; explicitRole: string; ariaLabel: string | null; ariaLabelledby: string | null;
    }> = [];

    const candidates = scope.querySelectorAll('[aria-label], [aria-labelledby]');
    const all = scope.matches('[aria-label], [aria-labelledby]') ? [scope, ...Array.from(candidates)] : Array.from(candidates);

    for (const el of all) {
      const tag = el.tagName.toLowerCase();
      if (ignored.has(tag)) continue;
      const explicitRole = (el.getAttribute('role') ?? '').trim().split(/\s+/)[0].toLowerCase();
      const isGeneric = explicitRole ? explicitRole === 'generic' : !hasImplicitRole(el);
      if (!isGeneric) continue;
      violations.push({
        selector: cssPath(el),
        tag,
        explicitRole,
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
      });
    }
    return violations;
  }, root);
}

/** 违规列表的可读格式，用于断言失败消息与证据日志。 */
export function formatGenericViolations(violations: GenericNamingViolation[]): string {
  if (violations.length === 0) return 'generic elements with aria-label/aria-labelledby: 0';
  return [
    `generic elements with aria-label/aria-labelledby: ${violations.length}`,
    ...violations.map(
      (v, i) =>
        `${i + 1}. ${v.selector}${v.explicitRole ? ` [role=${v.explicitRole}]` : ''}` +
        `${v.ariaLabel !== null ? ` aria-label="${v.ariaLabel}"` : ''}` +
        `${v.ariaLabelledby !== null ? ` aria-labelledby="${v.ariaLabelledby}"` : ''}`,
    ),
  ].join('\n');
}

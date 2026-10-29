# Implementation Plan: a11y-audit-remediation

## Overview

本计划把 design.md 的五段交付拆成可由编码代理执行的任务，实现语言为 TypeScript（React 19 + MUI 7 + Playwright）。顶层顺序固定：① 基线复现 → ② 候选修复 → ③ 自动回归 → ④ 人工验证 → ⑤ 知识回填，末尾为最终检查点。

关键约定：

- **先失败、后通过可追溯**：全部新增回归用例（含 helpers）在 ① 中、修复之前写入 `a11y-tests/regression.spec.ts`，并在未改动的 `src/` 上运行一次，失败输出存入 `evidence/baseline/gate.log`；③ 在修复后对同一文件再运行，输出存入 `evidence/after/gate.log`（Req 1.6、14.3）。
- **门禁唯一入口**：`npm run test:a11y:gate` 只运行 `a11y-tests/regression.spec.ts`，所有门禁用例都写进该文件；工具函数放在 `a11y-tests/helpers/`（非 `.spec.ts`）。
- **证据阶段切换**：`helpers/evidence.ts` 读取环境变量 `EVIDENCE_PHASE`（`baseline` / `after`，默认 `after`）决定写入 `evidence/baseline/` 或 `evidence/after/`；以命令行环境变量传入（如 `EVIDENCE_PHASE=baseline npm run test:a11y:gate`），不修改 `package.json`。
- **禁止路径**：不得修改 `package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`playwright.config.ts`、`reference/`、`src/main.tsx`（Req 14.1、14.5）。产品侧只改 `src/App.tsx`、`src/styles.css`、`src/theme.ts`，对照 `reference/solved/` 逐处修改，不整文件覆盖（Req 14.2）。
- **人工字段**：C 层所有判断/裁定字段由具名人员人工填写，AI 只生成模板并保持"待复核 / 待裁定"，不得代填（Req 12.5、16.3）。
- Evidence_Dir = `.kiro/specs/a11y-audit-remediation/evidence/`。每份 `.meta.md` 统一字段：运行日期（YYYY-MM-DD）、操作系统、Node 版本、Git 提交短哈希（≥7 位）或"`src/` 与 `reference/baseline/` 逐文件一致"声明、命令、退出码。

## Tasks

- [x] 1. ① 基线复现（修复前；本段准出前禁止改动 `src/`）
  - [x] 1.1 确认 `src/` 与 `reference/baseline/` 逐文件一致并记录状态
    - 对 `App.tsx`、`main.tsx`、`styles.css`、`theme.ts` 四个文件逐一与 `reference/baseline/` 同名文件比对（`diff` / `cmp`），任一不一致则停止并报告
    - 记录 `git rev-parse --short HEAD`、`git status --short src/`、操作系统、`node -v`，写入 `evidence/baseline/src-state.meta.md`（非 git 仓库，已用逐文件一致声明）🔄 2026-10-29 同步（Git使用diff）
    - _Requirements: 13.4, 13.7_

  - [x] 1.2 实现 `a11y-tests/helpers/contrast.ts`
    - 导出 `RGB` 类型与 `parseColor`（支持 `#rrggbb`、`rgb()`、`rgba()` 且 alpha=1）、`relativeLuminance`（WCAG 2.x sRGB 线性化）、`contrastRatio`（≥1，保留两位小数）
    - 导出 `ContrastCase` 类型与 design 颜色表对应的受检表常量（选择器、期望背景、阈值 3 或 4.5）
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [x] 1.3 实现 `a11y-tests/helpers/a11y-tree.ts`
    - 提供读取当前焦点元素角色与可访问名称的函数（基于 `page.evaluate` / `locator.ariaSnapshot()`），返回 `FocusStop`（step、role、name、rect）
    - 提供枚举页面中"无显式 role 且无隐式角色"元素并检查 `aria-label` / `aria-labelledby` 的函数
    - 导出 design 中的 `APPROVED_TAB_ORDER` 常量（13 项）
    - _Requirements: 1.4, 2.2, 6.5, 7.1_

  - [x] 1.4 实现 `a11y-tests/helpers/evidence.ts`
    - 按 `EVIDENCE_PHASE` 解析输出目录（`baseline/` 或 `after/`），自动创建目录
    - 提供 `writeJson`、`appendLog`、`writeMeta`（统一 `.meta.md` 字段）、`screenshotPath(step, name)` 等函数
    - 定义 `StateAssertion`、`ForcedColorCheck` 日志行格式，供状态与强制颜色用例写日志
    - _Requirements: 5.2, 8.7, 9.5, 13.4, 15.5_

  - [x] 1.5 在 `a11y-tests/regression.spec.ts` 写入 A 层与 C 层文本门禁用例（必需，修复前写入）
    - 保留原 4 个用例名称不变；增强原 axe 用例：通过 `evidence.ts` 写 `axe-report.json`（规则 id、impact、节点数、target），失败消息逐条输出 id、impact、每个节点 target；保持完整标签集，不禁用规则、不排除选择器
    - 增强原 `SLA risk exposes direction in text`：`getByText(/Increased 12\.6%/i)` 加 `toHaveCount(1)` 与可见断言
    - 新增 `describe('A: names and structure')`：`icon buttons have exact accessible names`（`More actions`、`Filter work orders` 各恰好 1 个 button）、`region combobox is labelled by a visible label`（`getByRole('combobox', { name: 'Region' })` 恰好 1 个，名称来自可见标签）、`work orders render as ul > li > button`（面板内 1 个 list、3 个 listitem，顺序 WO-1842/1847/1851）
    - 新增 `describe('A: contrast')`：`protected backgrounds and primary color are unchanged`（`body` `#f2ede4`、`.topbar`/`.panel`/`.territory-card` `#fffaf2`、进度条主色 `#d6552d`）
    - 新增 `describe('C: text evidence')`：`SLA arrow is decorative`（箭头 `aria-hidden="true"`，无 `aria-label`/`title`/`alt`）
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 2.1, 2.4, 2.5, 3.1, 3.2, 3.7, 4.3, 4.4, 5.1, 5.3, 5.4, 10.1, 10.2, 10.5_

  - [x] 1.6 在 `regression.spec.ts` 写入 B 层键盘与状态门禁用例（必需，修复前写入）
    - 新增 `describe('B: keyboard')`：`full page tab order matches the approved sequence`（从 `body` 连续 13 次 Tab，逐项 `toBeFocused()`，超时 1s，写 `focus-path-forward.log`，并为 13 个控件按 `NN-<name>.png` 保存焦点截图）、`escape closes region listbox and returns focus`
    - 新增 `describe('B: state')`：`only Overview is the current page`、`region combobox exposes value and expanded state`（初值 `All regions`、`aria-expanded=false`；Enter/ArrowDown 打开 listbox 含 North/Central/South 且焦点在当前选中项；Enter→ArrowDown→Enter 后值为 `North`、焦点回 combobox），每条断言写 `state-assertions.log`
    - _Requirements: 6.5, 6.8, 7.1, 7.7, 8.1, 8.2, 8.3, 8.4, 8.6, 8.7_

  - [x] 1.7 在 `regression.spec.ts` 写入 B 层强制颜色门禁用例（必需，修复前写入）
    - 新增 `describe('B: forced colors')`：`beforeEach` 先 `page.emulateMedia({ forcedColors: 'active' })` 再 `goto('/')`
    - 用例 `controls, icons and status remain distinguishable`：按 Req 9"可见边界 / 可见文字"判定定义检查 Hero 三控件、3 条 Job_Row、`View all work orders`、2 个 Icon_Button 及其 svg、3 条进度条（填充与轨道背景不同或填充有可见边界）、`Increased 12.6%`、pulse 卡片状态文字与图标；失败时输出选择器、未满足判定项与计算值
    - 用例结束保存 `forced-colors-fullpage.png`（`fullPage: true`）与 `forced-colors-assertions.log`
    - 用例注释标注 `Feature: a11y-audit-remediation, Property 10: 强制颜色下信息不丢失`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 1.8 为 `contrastRatio` 写参考值单元测试
    - 放在 `regression.spec.ts` 的 `A: contrast` 分组：黑/白 21:1、同色 1:1、`#716d65` on `#f2ede4` ≈ 4.42
    - _Requirements: 4.5, 4.6_

  - [x] 1.9 写属性测试：可聚焦控件均有非空可访问名称
    - 用例 `every focusable control has a non-empty accessible name`，注释 `Feature: a11y-audit-remediation, Property 1`；对整页 Tab 可达元素穷举
    - **Property 1: 可聚焦控件均有非空可访问名称**
    - **Validates: Requirements 1.4, 1.1, 1.2**

  - [x] 1.10 写属性测试：generic 元素不携带命名属性
    - 用例 `no generic element carries aria-label or aria-labelledby`，注释 `Feature: a11y-audit-remediation, Property 2`
    - **Property 2: generic 元素不携带命名属性**
    - **Validates: Requirements 2.2**

  - [x] 1.11 写属性测试：区域进度条唯一命名且数值一致
    - 用例 `territory progressbars are named and match visible percentages`，注释 `Feature: a11y-audit-remediation, Property 3`；对 North/Central/South 穷举，失败消息列出区域名
    - **Property 3: 区域进度条唯一命名且数值一致**
    - **Validates: Requirements 2.3, 2.6, 2.7**

  - [x] 1.12 写属性测试：工单列表结构与名称完整
    - 在 `work orders render as ul > li > button` 同组新增穷举断言，注释 `Feature: a11y-audit-remediation, Property 4`；每个 `li` 恰 1 个 button、无其他可聚焦后代，名称含站点、任务、`WO-\d{4}`、`\d{2}:\d{2}`
    - **Property 4: 工单列表结构与名称完整**
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [x] 1.13 写属性测试：受检文字对比度不低于阈值
    - 用例 `audited text meets contrast thresholds`，注释 `Feature: a11y-audit-remediation, Property 5`；读计算样式前景与最近非透明祖先背景，写 `contrast-assertions.log`
    - **Property 5: 受检文字对比度不低于阈值**
    - **Validates: Requirements 4.1, 4.2, 4.5, 4.6**

  - [x] 1.14 写属性测试：Shift+Tab 序列是 Tab 序列的逆序
    - 用例 `shift+tab order is the exact reverse of tab order`，注释 `Feature: a11y-audit-remediation, Property 6`；从 `View all work orders` 连续 12 次 Shift+Tab，写 `focus-path-reverse.log`
    - **Property 6: Shift+Tab 序列是 Tab 序列的逆序**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 7.5**

  - [x] 1.15 写属性测试：无键盘陷阱
    - 用例 `focus leaves the page at both ends without traps`，注释 `Feature: a11y-audit-remediation, Property 7`
    - **Property 7: 无键盘陷阱**
    - **Validates: Requirements 7.2, 7.6**

  - [x] 1.16 写属性测试：获焦控件可见、未遮挡、指示合格、尺寸达标
    - 用例 `focused controls are visible, unobscured and large enough`，注释 `Feature: a11y-audit-remediation, Property 8`；断言视口内、宽高 ≥24px、`elementFromPoint` 命中自身或后代、`outline-width` ≥2px 且焦点色与相邻背景 ≥3:1
    - **Property 8: 获焦控件可见、未遮挡、指示合格、尺寸达标**
    - **Validates: Requirements 7.3, 7.4**

  - [x] 1.17 写属性测试：下拉"打开再取消"不改变选择
    - 用例 `escape restores any previously selected region`，注释 `Feature: a11y-audit-remediation, Property 9`；对 All regions/North/Central/South 穷举
    - **Property 9: 下拉"打开再取消"不改变选择**
    - **Validates: Requirements 8.5, 6.8**

  - [x] 1.18 运行基线探索套件并保存证据
    - 运行 `npm run test:a11y`，完整输出存 `evidence/baseline/explore.log`，写 `explore.meta.md`
    - 核对：含 `axe found 6 rule categories`、6 条规则节点数之和 27；Exploration_Suite 按 Tab 24 次；记录 23 条焦点条目（焦点离开页面的 1 步不记录）；2 个不同的无名控件（顶栏更多操作、工单筛选），因循环各记录 2 次，共 4 次 `(unnamed)`；不满足则停止 🔄 2026-10-29 同步（方案A）
    - 同时保存 `evidence/baseline/protected-files.sha256`（`shasum -a 256` 快照：`package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`playwright.config.ts`、`src/main.tsx` 与 `reference/` 下全部文件）与 `evidence/baseline/steering-a11y.md.orig`（`.kiro/steering/a11y.md` 原样副本），供 2.8、5.2 的 diff 校验使用 🔄 2026-10-29 同步（Git使用diff）
    - _Requirements: 13.1, 13.4, 13.7_

  - [x] 1.19 运行基线门禁并保存失败记录
    - 运行 `EVIDENCE_PHASE=baseline npm run test:a11y:gate`，完整输出存 `evidence/baseline/gate.log`，并生成 `baseline/axe-report.json` 与 `axe-report.meta.md`（日期、axe 4.13、标签集、src 状态=等价 `reference/baseline/`）
    - 写 `baseline/gate-failures.md`：原 4 个用例完整名称各标"失败"并附第一条断言失败信息、通过数 0；另列出 1.5–1.17 新增用例在基线上的结果，A 层新增用例必须为失败
    - 核对 `axe-report.json`：6 条规则、27 个节点，逐规则列 id、impact、节点数
    - _Requirements: 1.6, 5.2, 5.5, 13.2, 13.4, 13.7, 14.3_

  - [x] 1.20 运行基线构建并保存日志
    - 运行 `npm run build`，输出存 `evidence/baseline/build.log`，写 `build.meta.md`；核对退出码 0 且含 Vite 模块转换数量
    - _Requirements: 13.4, 13.5_

  - [x] 1.21 运行基线 VoiceOver 并保存转录或阻塞记录
    - 运行 `npm run test:voiceover`，含 `VOICEOVER_TRANSCRIPT` 的原文存 `evidence/baseline/voiceover-baseline.log`，写 `voiceover-baseline.meta.md`
    - 核对：转录中存在匹配 `/SLA RISK 12\.6%/i` 的播报行，或相邻两行（如 `SLA RISK` 与 `12.6%`）以单个空格拼接后匹配；该播报（单行或拼接的两行）及其前后各 1 行不匹配 `/increased|decreased|up|down/i`；用例结果为失败 🔄 2026-10-29 同步（相邻两行拼接）
    - IF 因辅助功能权限、VoiceOver 未启动或超时无法运行：写 `baseline/voiceover-blocked.md`（原因、日期、原始错误输出、解除步骤），停止并请项目负责人处理，不进入 ②
    - _Requirements: 13.3, 13.4, 13.6_

  - [x] 1.22 检查点：基线准出
    - 核对 `baseline/` 含 explore、gate、build、voiceover 四类产物及 `.meta.md`，数值满足 6 类/27 节点、按 Tab 24 次记录 23 条/2 个不同无名控件共 4 次 `(unnamed)`（🔄 2026-10-29 同步（方案A））、Gate 原 4 用例 4/4 失败、SLA 无方向词、构建退出码 0；任一不满足则禁止进入 ②
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 13.7_

- [x] 2. ② 候选修复（只改 `src/App.tsx`、`src/styles.css`、`src/theme.ts`，对照 `reference/solved/` 逐处修改）
  - [x] 2.1 修复图标按钮名称与 Region 名称绑定（A1、A2、A3，`src/App.tsx`）
    - 顶栏 `IconButton` 加 `aria-label="More actions"`；工单面板 `IconButton` 加 `aria-label="Filter work orders"`
    - Region `TextField select` 删除根上 `aria-label`，改为 `label="Region"`，使可见 `InputLabel` 经 `aria-labelledby` 绑定到 `combobox`；若名称或焦点顺序异常，回退为 `slotProps.select` 传 `aria-labelledby` 并保持标签可见
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 2.5_

  - [x] 2.2 调整 Region 浮动标签样式（A4，`src/styles.css`）
    - 新增 `.hero-actions .MuiInputLabel-root { color: #25372f; background: #fffdf8; padding: 0 4px; border-radius: 4px; }`，不触碰 Req 4.3 受保护背景
    - _Requirements: 2.1, 4.3, 4.4_

  - [x] 2.3 修复进度条名称、工单列表结构与区域卡片分组（A5、A6、A7，`src/App.tsx`）
    - `LinearProgress` 加 `aria-label={`${item.name} allocation`}`，保持 `value={item.load}`
    - 工单列表改为 `ul > Box component="li"（listStyle: none） > Button fullWidth className="job-row"`，保持按钮内无其他可聚焦元素与原有可见文本
    - Territory_Card 增加 `role="group"`，保留 `aria-label={`${name}: ${load}% allocated`}`
    - _Requirements: 2.2, 2.3, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 2.4 调整文字颜色达到 AA（A8，`src/styles.css`、`src/theme.ts`）
    - 按 design 颜色表修改：`.hero-title` 显式 `#fffaf2`；`.metric-label`、`.panel-subtitle`、`.territory-card span`、`.activity-row > span` 改 `#5f5b54`；`.job-meta` 改 `#5a564f`；`.pulse-card span` 改 `#4f4b45`；theme `text.secondary` 改 `#5f5b54`
    - 保持 `body`、`.topbar`、`.panel`、`.territory-card` 背景、`primary.main` 与 `.MuiLinearProgress-bar` 主色 `#d6552d` 不变；新灰色保持暖灰（R>G>B）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.5 添加焦点指示与强制颜色样式（B1、B2，`src/styles.css`）
    - `*:focus-visible { outline: 3px solid #1f4d3a; outline-offset: 3px; }`；`.hero *:focus-visible { outline-color: #f0b84b; }`
    - `@media (forced-colors: active)`：焦点 `outline-color: Highlight`；`.MuiIconButton-root` 加 `1px solid ButtonText` 边框；`.territory-panel .MuiLinearProgress-root` 加 `1px solid CanvasText` 边框；`.territory-panel .MuiLinearProgress-bar` 设 `forced-color-adjust: none; background: Highlight`
    - 不调整 DOM 顺序（B3），保留 MUI Select 默认键盘行为与 `aria-current="page"`（B4）
    - _Requirements: 6.1, 6.5, 7.3, 7.4, 8.1, 9.1, 9.2, 9.3_

  - [x] 2.6 SLA risk 方向用可见文字表达（C1，`src/App.tsx`）
    - 箭头改为 `<ArrowOutward aria-hidden="true" fontSize="small" />`，不带 `aria-label`/`title`
    - 数值改为 DOM 文本 `Increased 12.6%`（`Typography className="metric-value"`），紧随 `SLA risk` 标签，不用视觉隐藏、CSS 生成内容或 `aria-label`
    - 候选问题 C-1/C-2/C-3 不改 DOM（待人工裁定）
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 12.6_

  - [x] 2.7 产出 `evidence/color-contrast-table.md`
    - 以 `baseline/axe-report.json` 的 19 个 `color-contrast` 节点为行，逐行写选择器、前景、背景、修复前比值、修复后比值（用 `helpers/contrast.ts` 计算）、阈值；未落在 design 颜色表的节点按同一规则补行
    - 核对每行修复后比值 ≥ 阈值，不满足则回到 2.4 取更深暖灰
    - _Requirements: 4.6_

  - [x] 2.8 产出 `evidence/hunk-map.md` 与范围检查
    - 运行 `diff -rq reference/baseline/ src/` 并对每个文件运行 `diff -u reference/baseline/<file> src/<file>` 统计增删行数，汇总存 `evidence/after/diff-stat.txt`，确认 `src/` 下有差异的只有三文件、`src/main.tsx` 未变；禁止路径检查改为 `shasum -a 256 -c evidence/baseline/protected-files.sha256`，全部 OK 即无越界改动 🔄 2026-10-29 同步（Git使用diff）
    - 用 `cmp` 确认三文件均不与 `reference/solved/` 同名文件逐字节相同
    - 对每个文件运行 `diff -U0 reference/baseline/<file> src/<file>`，对其中每个 hunk 写一行 🔄 2026-10-29 同步（Git使用diff）（file、hunk header、Requirement 1–12、摘要），不得有无法对应需求的 hunk
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

- [x] 3. ③ 自动回归（对修复后的同一 `src/` 状态运行；回归用例已在 ① 写入并在基线上记录失败）
  - [x] 3.1 修复后运行门禁并保存证据
    - 运行 `EVIDENCE_PHASE=after npm run test:a11y:gate`，完整输出存 `evidence/after/gate.log`；确认 `after/` 下生成 `axe-report.json`（0 违规）、`focus-path-forward.log`、`focus-path-reverse.log`（若 1.14 已实现）、`focus-screenshots/` 13 张、`state-assertions.log`、`forced-colors-fullpage.png`、`forced-colors-assertions.log`、`contrast-assertions.log`（若 1.13 已实现）
    - 若有失败，回到 ② 修复，不得修改断言迁就实现
    - _Requirements: 5.1, 5.2, 5.5, 7.7, 8.7, 9.5, 14.3, 15.1_

  - [x] 3.2 修复后运行构建
    - 运行 `npm run build`，输出存 `evidence/after/build.log`；核对退出码 0、`tsc --noEmit` 无错误、`vite build` 完成
    - _Requirements: 15.2_

  - [x] 3.3 修复后运行探索套件
    - 运行 `npm run test:a11y`，输出存 `evidence/after/explore.log`；核对 `axe found 0 rule categories`、按 Tab 24 次的焦点日志 0 个 `(unnamed)`（🔄 2026-10-29 同步（方案A））且前 13 条与批准顺序一致
    - _Requirements: 1.3, 1.4, 7.7, 15.3_

  - [x] 3.4 写 `after/` 元数据并对照"先失败后通过"
    - 为 gate、build、explore、axe-report 写 `.meta.md`（日期、提交或 src 状态、命令、退出码）
    - 在 `after/gate.meta.md` 中对照 `baseline/gate-failures.md`，逐条列出 A 层新增用例"基线失败 → 修复后通过"
    - 若后续 `src/` 再改动，必须重跑 3.1、3.2 并替换日志
    - _Requirements: 1.6, 14.3, 15.4, 15.5, 15.6_

  - [x] 3.5 检查点：自动回归门槛
    - `npm run test:a11y:gate` 全部通过（0 失败、0 跳过）、`npm run build` 退出码 0、`npm run test:a11y` 0 违规 / 0 unnamed，三份日志已存 `after/`；未满足不得进入 ④
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 4. ④ 人工验证（③ 准出后开始；AI 只生成模板与原始转录，判断由具名人员填写）
  - [x] 4.1 小改 `a11y-tests/voiceover.spec.ts` 覆盖范围
    - 将遍历步数从 55 调整到足以覆盖 Territory 面板、工单行与 pulse 卡片（候选 90，以实际转录长度为准），逐行打印播报
    - 保留断言 `/SLA risk increased 12\.6%/i`；不加入门禁
    - _Requirements: 10.4, 11.1, 11.2, 12.7_

  - [x] 4.2 修复后运行 VoiceOver 并保存原始转录
    - 运行 `npm run test:voiceover`，自 `VOICEOVER_TRANSCRIPT` 标记行起至最后一行完整保存为 `evidence/after/voiceover-after.log`（与基线转录不同文件），记录日期、通过/失败、src 状态
    - IF 无法产出完整转录：写 `evidence/voiceover-blocked.md`（原因、日期、原始输出、解除步骤），Spec 保持未完成，不得用基线转录、Gate 文本断言或探索日志替代
    - _Requirements: 10.4, 11.1, 11.2, 16.1, 16.4_

  - [x] 4.3 生成 `evidence/voiceover-record.md` 模板（独立 VoiceOver_Record）
    - 按 design §5 骨架生成：首部声明"自动化测试通过不等于满足全部无障碍要求"；粘贴 4.2 转录原文（逐行完整，不删改）
    - 逐项判断表 ≥9 项（SLA_Risk_Metric、3 张 Territory_Card、3 条 Territory_Progress、2 个 Icon_Button），预填"引用转录行"，结论列一律"待复核"
    - Req 10 判断问题、Req 11 判断问题（是否被误解为告警或阈值）原文写入，结论留"待复核"
    - 候选问题 C-1/C-2/C-3 写可观察事实、WCAG、转录引用与是否出现 `urgent`/`warning`/`success`，裁定列一律"待裁定"
    - 复核人、复核日期、评审人、裁定人字段留空并注明"须为具名人员，不得填写工具或 AI 名称"；AI 不得预填任何结论
    - _Requirements: 10.6, 10.7, 11.3, 11.4, 11.5, 11.6, 12.1, 12.2, 12.3, 12.5, 12.7, 16.1, 16.2, 16.3_

  - [x] 4.4 生成 `evidence/forced-colors-review.md` 模板
    - 引用 `after/forced-colors-fullpage.png` 与 `after/forced-colors-assertions.log`；对 Req 9 三组对象逐项留"符合 / 不符合 / 需讨论：待复核"与理由、复核人、复核日期字段，AI 不得代填
    - _Requirements: 16.5_

  - [x] 4.5 等待具名人员完成人工判断（暂停点）
    - 通知项目负责人：请具名复核人在 `voiceover-record.md` 与 `forced-colors-review.md` 中填写全部判断、裁定、理由、姓名与日期；AI 在此暂停，不代填
    - 填写完成后核对字段完整性（≥9 项判断、Req 10 结论为"足以"、Req 11 六条结论、C-1/C-2/C-3 裁定、声明、复核人与日期）；任一缺失或 Req 10 为"不足以"、Req 11 有"不符合/需讨论"则 Spec 保持未完成
    - _Requirements: 10.6, 10.7, 11.3, 11.6, 12.5, 16.2, 16.3, 16.5, 16.6_

  - [x] 4.6 处理人工裁定为"采纳"的候选问题（条件任务）
    - 仅当 C-1/C-2/C-3 中有"采纳"时执行：在 `regression.spec.ts` 先写针对该问题的回归断言并在当前 `src/` 上确认失败，再在 `src/` 三文件中修复并确认通过，更新 `hunk-map.md`；随后重跑 3.1、3.2 替换 `after/` 日志
    - "不采纳 / 延后"项保持 DOM、角色与样式不变
    - _Requirements: 12.4, 12.6, 14.3, 15.6_

- [x] 5. ⑤ 知识回填（③ 准出后）
  - [x] 5.1 向 `.kiro/steering/a11y.md` 追加"## 5. 组件规则"
    - 只在文件末尾追加 4 条列表项：下拉选择框（MUI `TextField select`）名称需绑定到 `combobox` 节点（用 `label` 或 `slotProps.select`），不要把 `aria-label` 放在根 `div`（axe `aria-input-field-name`）；MUI `LinearProgress` 必须提供 `aria-label` 或 `aria-labelledby`（axe `aria-progressbar-name`）；`IconButton` 必须提供 `aria-label`（axe `button-name`）；表达趋势方向的图标设 `aria-hidden="true"`，方向以可见文字（如"上升 / 下降"）表达
    - 原四章标题与列表项保持不变
    - _Requirements: 17.1, 17.2, 17.3, 17.5_

  - [x] 5.2 校验回填并保存 `after/steering.diff`
    - 运行 `diff -u evidence/baseline/steering-a11y.md.orig .kiro/steering/a11y.md` 存 `evidence/after/steering.diff`，首部标注回填日期与 src 状态 🔄 2026-10-29 同步（Git使用diff）
    - 检查 diff 只有新增行（无 `-` 行），且新增行不含 `Hero`、`SLA risk`、`Region`、`12.6%`、`RelayOps`；不满足则修正后重新生成
    - _Requirements: 17.4, 17.5, 17.6, 17.7_

- [x] 6. 最终检查点
  - `npm run test:a11y:gate` 全部通过、`npm run build` 退出码 0（若 ④/⑤ 后 `src/` 有改动须重跑并替换 `after/` 日志）
  - `evidence/voiceover-record.md` 独立保存、含修复后完整转录与声明，人工字段已由具名人员填写；`forced-colors-review.md` 人工复核完成；`after/steering.diff` 已保存
  - 确认未修改 `package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`playwright.config.ts`、`reference/`、`src/main.tsx`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 标 `*` 的子任务为可选（属性测试与单元测试），可跳过以加快进度；若跳过，对应验收标准（如 Req 7.3–7.5 的逆序、遮挡、尺寸）只剩探索日志与人工检查支撑，建议实现。门禁必需用例（1.5、1.6、1.7）不可跳过。
- 所有可选属性用例同样在 ① 中、修复前写入并在基线上运行，保证"先失败后通过"可追溯；B 层用例在基线上若因其他原因通过，在 `gate-failures.md` 中如实记录即可，Req 14.3 的"修复前必须失败"仅约束 A 层断言。
- 由于不能引入 PBT 库（Req 14），属性测试以 Playwright 对有限域穷举实现。
- 自动化测试通过不等于满足全部无障碍要求；C 层结论只能来自具名人员的人工判断。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5"] },
    { "id": 3, "tasks": ["1.6"] },
    { "id": 4, "tasks": ["1.7"] },
    { "id": 5, "tasks": ["1.8"] },
    { "id": 6, "tasks": ["1.9"] },
    { "id": 7, "tasks": ["1.10"] },
    { "id": 8, "tasks": ["1.11"] },
    { "id": 9, "tasks": ["1.12"] },
    { "id": 10, "tasks": ["1.13"] },
    { "id": 11, "tasks": ["1.14"] },
    { "id": 12, "tasks": ["1.15"] },
    { "id": 13, "tasks": ["1.16"] },
    { "id": 14, "tasks": ["1.17"] },
    { "id": 15, "tasks": ["1.18"] },
    { "id": 16, "tasks": ["1.19"] },
    { "id": 17, "tasks": ["1.20"] },
    { "id": 18, "tasks": ["1.21"] },
    { "id": 19, "tasks": ["1.22"] },
    { "id": 20, "tasks": ["2.1", "2.4"] },
    { "id": 21, "tasks": ["2.2", "2.3"] },
    { "id": 22, "tasks": ["2.5", "2.6"] },
    { "id": 23, "tasks": ["2.7"] },
    { "id": 24, "tasks": ["2.8"] },
    { "id": 25, "tasks": ["3.1"] },
    { "id": 26, "tasks": ["3.2"] },
    { "id": 27, "tasks": ["3.3"] },
    { "id": 28, "tasks": ["3.4"] },
    { "id": 29, "tasks": ["3.5"] },
    { "id": 30, "tasks": ["4.1", "4.4"] },
    { "id": 31, "tasks": ["4.2"] },
    { "id": 32, "tasks": ["4.3"] },
    { "id": 33, "tasks": ["4.5"] },
    { "id": 34, "tasks": ["4.6"] },
    { "id": 35, "tasks": ["5.1"] },
    { "id": 36, "tasks": ["5.2"] }
  ]
}
```

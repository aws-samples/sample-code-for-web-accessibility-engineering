# Requirements Document

## Introduction

本 Spec 为 RelayOps 现场服务运营工作台（React 19 + MUI 7，单页 `src/App.tsx`）建立 Web 无障碍审计与修复需求，目标 WCAG 2.2 AA。需求遵循工作区 `.kiro/steering/a11y.md` 的三层划分：

- **A 层 通用规则**：对错由标准或工具判定，用 axe-core、语义查询、静态检查验证；证据为扫描报告与修复后回归结果。
- **B 层 页面行为**：正确结果由产品团队提供，先确认页面预期再写 Playwright 行为测试；证据为真实浏览器中 Tab/Shift+Tab、焦点进入与恢复、键盘陷阱、动态状态、强制颜色模式的验证记录。
- **C 层 真实体验**：正确性依赖业务语境，AI 只能提出候选判断；证据为 VoiceOver 实际播报记录与人工判断，不得用自动化绿灯替代。

### 基线审计结果（2026 年实测，`src/` 当前状态）

| 项目 | 结果 |
| --- | --- |
| `npm run test:a11y`（axe 探索） | 6 类规则、27 个节点：`button-name` 2（critical）、`color-contrast` 19、`aria-input-field-name` 1、`aria-progressbar-name` 3、`aria-prohibited-attr` 1、`list` 1（均 serious） |
| `npm run test:a11y`（键盘探索） | Exploration_Suite 按 Tab 24 次；记录 23 条焦点条目（焦点离开页面的 1 步不记录）；2 个不同的无名控件（顶栏更多操作、工单筛选），因循环各记录 2 次，共 4 次 `(unnamed)`　🔄 2026-10-29 同步（方案A） |
| `npm run test:a11y:gate` | 原有 4 项用例 4/4 失败；扩展后共 24 项：20 failed / 4 passed。失败覆盖 axe 非空、`combobox "Region"` 不存在、`Increased 12.6%` 文本不存在、`group /allocated/` 0 个及新增A/B层断言 |
| `npm run test:voiceover`（reference 记录） | 播报 `SLA RISK 12.6%`（VoiceOver 可将其拆为相邻两条播报 `SLA RISK` 与 `12.6%`，以单个空格拼接后等价），无方向含义　🔄 2026-10-29 同步（相邻两行拼接） |

### 已确认的澄清项（用户于本次会话确认，接受全部默认建议）

1. Hero 区正式焦点顺序为 `Search work orders → Region → Schedule visit`，Shift+Tab 反向对称；整页 Tab 顺序按 DOM 顺序：主导航 4 项 → 顶栏更多操作 → Hero 三控件 → 工单筛选 → 3 条工单 → View all work orders。
2. 本次范围内没有对话框；`Schedule visit`、`View all work orders`、筛选按钮不要求实现行为。若后续新增对话框，必须先确认初始焦点再实现。
3. SLA risk 的箭头表示"风险上升"，上升对运营是坏消息；可见与可读文案统一为 `Increased 12.6%`，不区分"占比"与"变化量"。区域卡片与进度条仅表达技师分配负载，无阈值或告警含义。
4. 范围为桌面 Chromium、视口宽度大于 1050px；强制颜色模式作为 B 层 Playwright 用例纳入；真实读屏仅做 macOS VoiceOver + Chromium，用 `npm run test:voiceover` 产出转录。
5. 允许调整辅助文字灰色与 Hero 标题颜色以满足对比度，保持暖色风格；两个无名图标按钮命名为 `More actions` 与 `Filter work orders`。

## Glossary

- **Workbench**：RelayOps 现场服务运营工作台页面，由 `src/App.tsx`、`src/styles.css`、`src/theme.ts` 渲染。
- **Hero_Controls**：Hero 区的三个交互控件：搜索框 `Search work orders`、区域下拉 `Region`、按钮 `Schedule visit`。
- **Summary_Strip**：四项运营摘要区（Open today、Technicians active、First-time fix、SLA risk）。
- **SLA_Risk_Metric**：Summary_Strip 中的 SLA risk 指标，含方向箭头与数值 `12.6%`。
- **Territory_Card**：Territory load 面板画布中三张区域卡片（North、Central、South）。
- **Territory_Progress**：Territory load 面板中三条 `LinearProgress` 进度条。
- **Job_Row**：Next work orders 面板中可点击的工单行（WO-1842、WO-1847、WO-1851）。
- **Icon_Button**：仅含图标、无可见文字的按钮，当前为顶栏 `MoreHoriz` 与工单面板 `FilterAlt`。
- **Axe_Scanner**：`@axe-core/playwright` 4.13，标签集 `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`。
- **Exploration_Suite**：`npm run test:a11y`，运行 `a11y-tests/axe.spec.ts` 与 `a11y-tests/keyboard-focus.spec.ts`，输出探索日志、不断言结果。
- **Gate_Suite**：`npm run test:a11y:gate`，运行 `a11y-tests/regression.spec.ts`，是完成门槛之一。
- **VoiceOver_Suite**：`npm run test:voiceover`，用 `@guidepup/playwright` 驱动真实 macOS VoiceOver 并打印 `VOICEOVER_TRANSCRIPT`。
- **Build_Command**：`npm run build`（`tsc --noEmit && vite build`）。
- **Evidence_Dir**：`.kiro/specs/a11y-audit-remediation/evidence/`，保存基线与修复后的全部验证产物。
- **VoiceOver_Record**：Evidence_Dir 下独立的 Markdown 文件，包含 VoiceOver 原始转录与人工判断结论。
- **Steering_File**：`.kiro/steering/a11y.md`，项目无障碍工程基线，知识回填目标。
- **Forced_Colors_Mode**：Chromium 以 `forced-colors: active` 媒体特性模拟的高对比模式（对应 Windows 高对比）。
- **Accessible_Name**：按 Accessible Name and Description Computation 规范计算出的可访问名称。

## Requirements

### Requirement 1: [A 层] 图标按钮具备可访问名称

**User Story:** As a 键盘或读屏用户, I want 每个仅含图标的按钮都有可读名称, so that 我能知道按下按钮会发生什么。

- **WCAG 2.2**：4.1.2 Name, Role, Value（A）；2.4.6 Headings and Labels（AA）
- **验证方式**：axe `button-name` 规则；Playwright `getByRole('button', { name, exact: true })` 语义查询；键盘探索日志（Exploration_Suite 自页面加载后连续按 Tab 24 次所记录的焦点列表；焦点离开页面的步骤不记录）🔄 2026-10-29 同步（方案A）
- **完成证据**：修复后 Exploration_Suite 日志中 `button-name` 为 0、焦点列表中 `(unnamed)` 为 0；Gate_Suite axe 用例通过；Gate_Suite 语义查询用例对 `More actions` 与 `Filter work orders` 各命中恰好 1 个 button
- **范围**：仅覆盖 Workbench 初始渲染完成后 DOM 中存在的 Icon_Button；不要求提供可见文本标签或工具提示

#### Acceptance Criteria

1. WHEN Workbench 初始渲染完成时, THE Workbench SHALL 使顶栏 `MoreHoriz` Icon_Button 的 Accessible_Name 计算结果与 `More actions` 完全相等（精确匹配，不区分首尾空白），且 `getByRole('button', { name: 'More actions', exact: true })` 在整个 Workbench 中恰好命中 1 个元素。
2. WHEN Workbench 初始渲染完成时, THE Workbench SHALL 使工单面板 `FilterAlt` Icon_Button 的 Accessible_Name 计算结果与 `Filter work orders` 完全相等（精确匹配，不区分首尾空白），且 `getByRole('button', { name: 'Filter work orders', exact: true })` 在整个 Workbench 中恰好命中 1 个元素。
3. WHEN Axe_Scanner 在 Workbench 初始渲染完成后对整个文档执行扫描时, THE Workbench SHALL 产生 0 个 `button-name` 违规节点（违规节点数以扫描报告中该规则下 `nodes` 的数量计）。
4. WHEN Exploration_Suite 自页面加载后从 `document.body` 起连续按 Tab 24 次并记录每个到达的焦点元素时, THE Workbench SHALL 使每个到达的 button 角色元素（含 `<button>` 与 `role="button"`）报告长度 ≥ 1 的非空白 Accessible_Name，即日志中 `(unnamed)` 出现次数为 0。
5. IF Workbench 中任一 Icon_Button 的 Accessible_Name 为空或仅由空白字符组成, THEN THE Gate_Suite SHALL 将该 Icon_Button 所在的 axe 用例判定为失败，并在失败输出中列出该节点的选择器与所违反的规则 `button-name`。
6. THE Gate_Suite SHALL 包含一条回归用例，断言 Criteria 1 与 2 所述两个 Accessible_Name 各自在 Workbench 中恰好命中 1 个 button 角色元素；该用例在修复前运行结果为失败、修复后为通过。

### Requirement 2: [A 层] 表单控件与进度条具备正确的名称绑定

**User Story:** As a 读屏用户, I want 区域下拉和进度条的名称绑定在正确的角色节点上, so that 辅助技术能把名称和控件对应起来。

- **WCAG 2.2**：4.1.2 Name, Role, Value（A）；1.3.1 Info and Relationships（A）；3.3.2 Labels or Instructions（A）
- **验证方式**：axe `aria-input-field-name`、`aria-prohibited-attr`、`aria-progressbar-name` 规则；Playwright `getByRole('combobox', { name: 'Region' })`、`getByRole('progressbar', { name })`；检查 `aria-valuenow` 与可见百分比文本一致
- **完成证据**：修复后 axe 报告中上述三条规则均为 0；Gate_Suite 中 Region 定位器恰好解析 1 个节点；3 条 Territory_Progress 各自可按区域名称唯一定位
- **验证前置状态**：页面完成首次渲染、区域下拉处于关闭状态且当前值为 `All regions`、未进行任何用户交互

#### Acceptance Criteria

1. THE Workbench SHALL 使区域下拉的 `combobox` 角色节点本身计算出的 Accessible_Name 精确等于 `Region`（区分大小写、无前后空白），且该名称来源于一个在页面中可见、并与该控件程序化关联的标签文本，而非仅由隐藏属性提供。
2. THE Workbench SHALL 在整个页面 DOM 中不存在任何同时满足「无显式 role 且无隐式 ARIA 角色（即 `generic`）」与「携带 `aria-label` 或 `aria-labelledby` 属性」两个条件的元素（允许数量为 0）。
3. THE Workbench SHALL 为 `regions` 数据中的每个区域（当前为 North、Central、South 共 3 条）渲染恰好 1 个 `progressbar` 角色节点作为 Territory_Progress，其 Accessible_Name 以该区域名称开头（例如 `North load 82%` 或 `North allocation`），且 3 个 Accessible_Name 两两不同。
4. WHEN Axe_Scanner 在验证前置状态下扫描 Workbench 时, THE Workbench SHALL 产生 0 个 `aria-input-field-name`、`aria-prohibited-attr`、`aria-progressbar-name` 违规节点。
5. WHEN Gate_Suite 执行 `getByRole('combobox', { name: 'Region' })` 时, THE Workbench SHALL 使该定位器恰好解析到 1 个节点，且该节点与 Tab 键序中位于 `Search work orders` 搜索框之后、`Schedule visit` 按钮之前的可聚焦元素为同一节点。
6. WHEN Gate_Suite 对每个区域名称执行 `getByRole('progressbar', { name: /<区域名称>/ })` 时, THE Workbench SHALL 使该定位器恰好解析到 1 个节点，且该节点的 `aria-valuenow` 值等于同一区域行中可见的百分比数字（例如 North 为 82）。
7. IF 任一 Territory_Progress 的 `progressbar` 角色节点缺失 Accessible_Name 或 Accessible_Name 不包含其对应区域名称, THEN THE Gate_Suite SHALL 将 Requirement 2 判定为失败，并在报告中列出失败的区域名称。

### Requirement 3: [A 层] 列表与分组结构语义合法

**User Story:** As a 读屏用户, I want 工单列表和区域卡片使用合法的结构语义, so that 辅助技术能报出列表项数量与分组边界。

- **WCAG 2.2**：1.3.1 Info and Relationships（A）；4.1.2 Name, Role, Value（A）
- **验证方式**：axe `list`、`listitem` 规则；Playwright `getByRole('list')`、`getByRole('listitem')`、`getByRole('group', { name: /allocated/ })`；Playwright 键盘 Tab 遍历
- **完成证据**：修复后 axe `list` 与 `listitem` 均为 0；Gate_Suite `territory cards expose valid group semantics` 通过；工单列表 `getByRole('listitem')` 计数为 3 的断言通过

#### Acceptance Criteria

1. THE Workbench SHALL 在 "Next work orders" 面板内渲染恰好 1 个 `ul` 元素，该 `ul` 的直接子元素全部为 `li`（直接子元素数量 = `li` 数量 = 3），且每个 `li` 恰好包含 1 个代表 Job_Row 的 `button` 元素。
2. THE Workbench SHALL 使 "Next work orders" 面板内 `getByRole('list')` 返回恰好 1 个元素、`getByRole('listitem')` 返回恰好 3 个元素，且 3 个 `li` 的文档顺序与工单顺序 WO-1842、WO-1847、WO-1851 一致。
3. THE Workbench SHALL 保持每个 Job_Row 的按钮为 Tab 顺序中的 1 个独立焦点停留点（3 个 Job_Row 共 3 个连续停留点，顺序为 WO-1842、WO-1847、WO-1851），且按钮内部不包含其他可获焦元素。
4. THE Workbench SHALL 使每个 Job_Row 按钮的 Accessible_Name 同时包含该工单的站点名称、任务描述、工单号（`WO-1842`、`WO-1847`、`WO-1851` 之一）与 `HH:MM` 格式的时间 4 项文本，缺少任一项即判定为不通过。
5. THE Workbench SHALL 为每张 Territory_Card 提供 `group` 角色，且 Accessible_Name 完全匹配正则 `^(North|Central|South): (100|[1-9]?[0-9])% allocated$`，其中区域名与卡片内可见区域名一致，负载为 0 到 100 的整数。
6. WHEN Playwright 查询 `getByRole('group', { name: /allocated/ })` 时, THE Workbench SHALL 返回恰好 3 个元素，且 3 个元素的 Accessible_Name 分别以 `North:`、`Central:`、`South:` 开头，各出现恰好 1 次。
7. WHEN Axe_Scanner 扫描 Workbench 时, THE Workbench SHALL 产生 0 个 `list` 违规节点与 0 个 `listitem` 违规节点。

### Requirement 4: [A 层] 文本对比度达到 AA

**User Story:** As a 低视力用户, I want 页面所有文字与背景的对比度达到 AA, so that 我能在正常光线下读清辅助文字与标题。

- **WCAG 2.2**：1.4.3 Contrast (Minimum)（AA）
- **验证方式**：axe `color-contrast` 规则（桌面 Chromium，视口宽度大于 1050px，使用 Playwright 默认 1280×720 视口）；静态检查 `src/styles.css` 与 `src/theme.ts` 中的颜色值；对每个受影响选择器读取渲染后的计算样式（computed style）前景色与实际背景色并按 WCAG 相对亮度公式计算对比度
- **完成证据**：修复后 axe 报告 `color-contrast` 为 0；Evidence_Dir 中保存修复前后的颜色对照表（选择器、前景、背景、修复前对比度、修复后对比度、适用阈值 3:1 或 4.5:1），该表覆盖基线报告中的全部 19 个 `color-contrast` 节点

#### Acceptance Criteria

1. THE Workbench SHALL 使 Hero 标题（`.hero-title`，MUI `h3` 变体，计算字号 ≥ 24px，属于大文本）渲染后的计算前景色在 `#25372f` 背景上的对比度至少为 3:1，且该前景色不得被 Paper 容器的默认文字颜色（`#20201d`）覆盖。
2. THE Workbench SHALL 使以下每个选择器的文字（计算字号均小于 24px，适用 4.5:1 阈值）渲染后的计算前景色在其实际背景上的对比度至少为 4.5:1：`.metric-label` 在 `#f2ede4` 上；`.panel-subtitle`、`.territory-card span`、`.activity-row > span` 在 `#fffaf2` 上；`.job-task`、`.job-meta` 在 `#fffdf9` 上；`.pulse-card span` 在 `#fae0d5`（warning 卡）与 `#e1eee4`（success 卡）上。
3. THE Workbench SHALL 仅通过修改 `.hero-title` 与辅助文字（灰色）的前景色值完成对比度修复，并保持 `body` 背景 `#f2ede4`、`.topbar` / `.panel` / `.territory-card` 背景 `#fffaf2`、theme `primary.main` 与 `.MuiLinearProgress-bar` 主色 `#d6552d` 的值与修复前完全一致。
4. WHEN Axe_Scanner 在桌面 Chromium、视口宽度大于 1050px 条件下扫描 Workbench 时, THE Workbench SHALL 产生 0 个 `color-contrast` 违规节点。
5. THE Workbench SHALL 使以 theme `text.secondary`（当前 `#716d65`）为前景色的任何文字仅出现在对比度至少 4.5:1 的背景上；IF `#716d65` 出现在 `#f2ede4`（约 4.42:1）、`#fae0d5`（约 4.09:1）或 `#e1eee4` 背景上, THEN THE Workbench SHALL 将该处前景色替换为对比度至少 4.5:1 的更深灰色。
6. THE Evidence_Dir SHALL 保存一份颜色对照表，逐行列出基线 19 个 `color-contrast` 节点的选择器、前景色、背景色、修复前对比度、修复后对比度与适用阈值，且每一行的修复后对比度均不低于该行适用阈值。

### Requirement 5: [A 层] 自动扫描零违规

**User Story:** As a 工程负责人, I want 自动扫描在所选 WCAG 标签下零违规, so that 通用规则类问题能被持续门禁拦住。

- **WCAG 2.2**：覆盖 Axe_Scanner 标签集内的全部 A/AA 条款
- **验证方式**：Gate_Suite 用例 `selected WCAG A/AA rules have no automated violations`
- **完成证据**：Evidence_Dir 中保存基线 axe 报告（6 类/27 节点）与修复后报告（0 违规）；Gate_Suite 该用例通过
- **基线组成**：6 类违规规则为 `button-name`、`aria-input-field-name`、`aria-prohibited-attr`、`aria-progressbar-name`、`list`、`color-contrast`，合计 27 个违规节点（与 Requirement 1–4 一一对应）

#### Acceptance Criteria

1. WHEN Gate_Suite 运行用例 `selected WCAG A/AA rules have no automated violations` 并以标签集 `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` 扫描加载完成的 Workbench 根路径页面时, THE Workbench SHALL 使 `results.violations` 为长度为 0 的数组。
2. THE Evidence_Dir SHALL 同时保存基线扫描报告与修复后扫描报告，且每份报告均标注：运行日期（`YYYY-MM-DD`）、所扫描 `src/` 对应的状态标识（基线报告标注等价于 `reference/baseline/`，修复后报告标注修复提交标识）、Axe_Scanner 版本与所用标签集。
3. IF 任一 axe 规则在修复后仍有 1 个或以上违规节点, THEN THE Gate_Suite SHALL 使该用例失败、以非零退出码结束，并在输出中逐条列出每个违规规则的 id、影响级别（`minor`/`moderate`/`serious`/`critical`）与每个违规节点的目标选择器。
4. THE Gate_Suite SHALL 以完整的 Axe_Scanner 标签集扫描，且不通过禁用规则、排除选择器或缩减标签集的方式使违规数归零。
5. THE Evidence_Dir 中的基线扫描报告 SHALL 逐规则列出 id、影响级别与违规节点数，且规则总数为 6、节点总数为 27；修复后扫描报告 SHALL 显示违规规则总数为 0。

### Requirement 6: [B 层] Hero 区键盘焦点顺序

**User Story:** As a 键盘用户, I want Hero 区控件按产品批准的顺序获得焦点并可对称返回, so that 我能快速在搜索、区域和排班之间切换。

- **WCAG 2.2**：2.4.3 Focus Order（A）；2.1.1 Keyboard（A）；2.1.2 No Keyboard Trap（A）
- **验证方式**：Playwright 真实浏览器 Tab/Shift+Tab 行为测试（Gate_Suite `hero controls follow the approved keyboard order`）；测试前置状态为页面首次加载完成、无弹层或下拉列表展开、使用 playwright.config.ts 所配置的桌面视口；每次焦点断言以 `toBeFocused()` 判定，超时上限 1 秒
- **完成证据**：Gate_Suite 该用例通过；Exploration_Suite 焦点路径日志保存至 Evidence_Dir，日志逐行记录从 `button "More actions"` 起连续按 Tab 直至 `button "Filter work orders"` 的每个焦点停靠点的 role 与可访问名称，并包含反向 Shift+Tab 的同等记录

#### Acceptance Criteria

1. WHEN `searchbox "Search work orders"` 持有焦点且用户按下 Tab 时, THE Workbench SHALL 在 1 秒内将焦点移至 `combobox "Region"`。
2. WHEN `combobox "Region"` 持有焦点且用户按下 Tab 时, THE Workbench SHALL 在 1 秒内将焦点移至 `button "Schedule visit"`。
3. WHEN `button "Schedule visit"` 持有焦点且用户按下 Shift+Tab 时, THE Workbench SHALL 在 1 秒内将焦点移至 `combobox "Region"`。
4. WHEN `combobox "Region"` 持有焦点且用户按下 Shift+Tab 时, THE Workbench SHALL 在 1 秒内将焦点移至 `searchbox "Search work orders"`。
5. THE Workbench SHALL 使 Hero_Controls 在 Tab 序列中紧邻位于顶栏 `button "More actions"` 之后、`button "Filter work orders"` 之前，即：从 `button "More actions"` 按下 Tab 的下一个焦点停靠点为 `searchbox "Search work orders"`，从 `button "Schedule visit"` 按下 Tab 的下一个焦点停靠点为 `button "Filter work orders"`，且 `button "More actions"` 与 `button "Filter work orders"` 之间除 Hero_Controls 三个控件外不存在任何其他焦点停靠点。
6. WHEN `searchbox "Search work orders"` 持有焦点且用户按下 Shift+Tab 时, THE Workbench SHALL 在 1 秒内将焦点移至顶栏 `button "More actions"`。
7. WHEN `button "Filter work orders"` 持有焦点且用户按下 Shift+Tab 时, THE Workbench SHALL 在 1 秒内将焦点移至 `button "Schedule visit"`。
8. WHILE `combobox "Region"` 的选项列表处于展开状态, WHEN 用户按下 Escape 时, THE Workbench SHALL 在 1 秒内收起选项列表并将焦点返回 `combobox "Region"`，不得将焦点留在已收起的列表内或移至 Hero_Controls 之外的元素。

### Requirement 7: [B 层] 整页键盘可达且无陷阱

**User Story:** As a 键盘用户, I want 整页所有交互控件都能用 Tab 到达并离开, so that 我不需要鼠标就能完成全部操作。

- **WCAG 2.2**：2.1.1 Keyboard（A）；2.1.2 No Keyboard Trap（A）；2.4.3 Focus Order（A）；2.4.7 Focus Visible（AA）；2.4.11 Focus Not Obscured (Minimum)（AA）；1.4.11 Non-text Contrast（AA，焦点指示对比度）；2.5.8 Target Size (Minimum)（AA）
- **验证方式**：Playwright 键盘探索日志（Exploration_Suite）与新增 Playwright 行为断言（Tab / Shift+Tab 全程遍历、`document.activeElement` 与 `getBoundingClientRect()` 断言）；真实桌面 Chromium（视口宽度大于 1050 CSS 像素）中焦点样式截图
- **完成证据**：Evidence_Dir 中保存修复后按 Tab 24 次的焦点日志（0 个 `(unnamed)`，前 13 条记录与验收标准 1 的顺序完全一致）、Shift+Tab 反向遍历日志，以及 13 个控件各一张按步序号命名的焦点可见性截图　🔄 2026-10-29 同步（方案A）

#### Acceptance Criteria

1. WHILE Workbench 以桌面 Chromium、视口宽度大于 1050 CSS 像素呈现, WHEN 页面加载完成、`document.activeElement` 为 `body` 且用户连续按下 13 次 Tab 时, THE Workbench SHALL 使每次按键后的焦点依次且仅依次落在以下 13 个控件上：`Overview`、`Work orders`、`Technicians`、`Assets`、`More actions`、`Search work orders`、`Region`、`Schedule visit`、`Filter work orders`、Job_Row `WO-1842`、Job_Row `WO-1847`、Job_Row `WO-1851`、`View all work orders`，期间不落在任何其他元素（包括品牌标识、头像、面板标题与装饰元素）上。
2. WHEN `View all work orders` 持有焦点且用户按下 Tab 时, THE Workbench SHALL 使 `document.activeElement` 变为 `body` 或主导航第一项 `Overview`，且不停留在 `View all work orders` 或任何其他 Workbench 控件上；WHEN `Overview` 持有焦点且用户按下 Shift+Tab 时, THE Workbench SHALL 同样使焦点离开全部 Workbench 控件（`document.activeElement` 为 `body`）。
3. WHILE 验收标准 1 所列任一控件持有键盘焦点时, THE Workbench SHALL 渲染宽度至少 2 CSS 像素、与相邻背景对比度至少 3:1 的焦点指示（轮廓或等效边框/阴影），且该控件的 `getBoundingClientRect()` 完整位于视口内，并且在该矩形中心点调用 `document.elementFromPoint()` 返回的元素为该控件本身或其后代，不被任何 `position: fixed` / `position: sticky` 元素覆盖。
4. THE Workbench SHALL 使验收标准 1 所列 13 个控件中每一个的 `getBoundingClientRect()` 宽度与高度均至少为 24 CSS 像素。
5. WHEN `View all work orders` 持有焦点且用户连续按下 12 次 Shift+Tab 时, THE Workbench SHALL 使焦点按验收标准 1 的完全相反顺序依次到达 `WO-1851`、`WO-1847`、`WO-1842`、`Filter work orders`、`Schedule visit`、`Region`、`Search work orders`、`More actions`、`Assets`、`Technicians`、`Work orders`、`Overview`。
6. WHILE 验收标准 1 所列任一控件持有键盘焦点且 `Region` 的下拉列表处于关闭状态时, THE Workbench SHALL 在用户单次按下 Tab 或 Shift+Tab 后，将 `document.activeElement` 移至另一元素，且不要求 Escape、方向键或任何其他按键才能离开该控件。
7. WHEN Exploration_Suite 在修复后运行时, THE Workbench SHALL 使按 Tab 24 次的焦点日志中 `(unnamed)` 记录为 0 条，前 13 条记录的角色与 Accessible_Name 与验收标准 1 的控件顺序逐条一致，且该日志与验收标准 3 所述 13 张焦点截图一并保存至 Evidence_Dir。🔄 2026-10-29 同步（方案A）

### Requirement 8: [B 层] 动态状态可被辅助技术感知

**User Story:** As a 读屏用户, I want 当前页面、下拉选中值等状态能被辅助技术读出, so that 我知道自己在哪里以及选择了什么。

- **WCAG 2.2**：4.1.2 Name, Role, Value（A）；1.3.1 Info and Relationships（A）
- **验证方式**：Playwright 查询 `aria-current`、`combobox` 的值与 `aria-expanded`；键盘操作下拉（Enter/ArrowDown/Escape）；每一步状态断言使用 Playwright 默认等待，上限 1000 ms
- **完成证据**：新增 Playwright 行为用例通过；Evidence_Dir 中保存状态断言日志

#### Acceptance Criteria

1. THE Workbench SHALL 在主导航的 4 个导航项（`Overview`、`Work orders`、`Technicians`、`Assets`）中，仅为当前页 `Overview` 设置 `aria-current="page"`，其余 3 个导航项上不存在 `aria-current` 属性。
2. WHEN 页面初始加载完成时, THE Workbench SHALL 使 `combobox "Region"` 的可访问值（即其显示文本）为 `All regions`，且 `aria-expanded` 为 `false`。
3. WHEN `combobox "Region"` 持有焦点且用户按下 Enter 或 ArrowDown 时, THE Workbench SHALL 在 1000 ms 内打开下拉 `listbox`，使 `combobox "Region"` 的 `aria-expanded` 为 `true`，`listbox` 中包含 `option` `North`、`Central`、`South`，且键盘焦点位于与当前选中值同名的 `option` 上。
4. WHEN `combobox "Region"` 持有焦点且用户依次按下 Enter、ArrowDown、Enter 时, THE Workbench SHALL 在 1000 ms 内使 `combobox "Region"` 的可访问值更新为 `North`，使 `aria-expanded` 恢复为 `false`，并把键盘焦点保留在 `combobox "Region"` 上。
5. WHILE `combobox "Region"` 的下拉 `listbox` 处于打开状态, WHEN 用户按下 Escape 时, THE Workbench SHALL 在 1000 ms 内关闭 `listbox`，使 `aria-expanded` 为 `false`，把键盘焦点恢复到 `combobox "Region"`，且可访问值与打开前完全相同（选择不被改变）。
6. WHERE 后续新增对话框, THE Workbench SHALL 在实现前由产品团队确认对话框打开后的初始焦点与关闭后的焦点恢复目标（本次范围内 Workbench 不存在对话框，此条不产生测试用例）。
7. THE Evidence_Dir SHALL 保存 Requirement 8 的状态断言日志，日志中每条断言记录步骤名、按键序列、预期值与实际值，并至少覆盖 `aria-current`、`aria-expanded`、`combobox "Region"` 可访问值与焦点所在元素四类状态。

### Requirement 9: [B 层] 强制颜色模式下信息完整

**User Story:** As a 使用 Windows 高对比模式的用户, I want 控件边界、图标和状态在强制颜色模式下仍可辨认, so that 页面在系统覆盖配色后不会丢失信息。

- **WCAG 2.2**：1.4.11 Non-text Contrast（AA）；1.4.1 Use of Color（A）
- **验证方式**：Playwright `page.emulateMedia({ forcedColors: 'active' })` 下截图与可见性断言（桌面 Chromium）；对每个受检元素读取计算样式并断言
- **完成证据**：Evidence_Dir 中保存强制颜色模式整页截图与断言日志
- **判定定义**：本需求中"可见边界"指元素计算样式四边 `border-width` 均 ≥ 1px 且 `border-style` 不为 `none`，或 `outline-width` ≥ 1px 且 `outline-style` 不为 `none`；"可见文字"指元素通过 Playwright `toBeVisible()` 断言、文本内容非空，且文字计算 `color` 与其最近非透明祖先的计算 `background-color` 不相等

#### Acceptance Criteria

1. WHILE Forced_Colors_Mode 生效时, THE Workbench SHALL 使 Hero_Controls 的三个控件、三条 Job_Row 以及 `View all work orders` 按钮各自至少满足"可见边界"或"可见文字"之一。
2. WHILE Forced_Colors_Mode 生效时, THE Workbench SHALL 使每个 Icon_Button 同时满足"可见边界"，且其内部 `svg` 图标通过 `toBeVisible()` 断言并使图标计算 `color`（或 `fill`）与所在按钮的计算 `background-color` 不相等。
3. WHILE Forced_Colors_Mode 生效时, THE Workbench SHALL 使三条 Territory_Progress 的已填充部分（`.MuiLinearProgress-bar`）与轨道（`.MuiLinearProgress-root`）满足以下至少一项：两者计算 `background-color` 不相等；或已填充部分满足"可见边界"；且三条进度条均通过 `toBeVisible()` 断言。
4. WHILE Forced_Colors_Mode 生效时, THE Workbench SHALL 使 SLA_Risk_Metric 的方向文字 `Increased 12.6%`、两张 pulse 卡片的状态文字（`4 visits at SLA risk`、`12 jobs closed`）及其各自的状态图标（`svg`）均满足"可见文字"或通过 `toBeVisible()` 断言且计算 `color` 与卡片计算 `background-color` 不相等。
5. WHEN 强制颜色模式验证用例运行完成时, THE Evidence_Dir SHALL 保存 1 张 `fullPage: true` 的整页截图，以及 1 份断言日志，日志逐行列出本需求每个受检元素的选择器、读取到的 `border-width`/`outline-width`/`color`/`background-color` 计算值与通过/失败结果。
6. IF 本需求任一受检元素未满足对应判定条件, THEN THE 强制颜色模式验证用例 SHALL 以失败状态结束，并在输出中给出该元素的选择器、未满足的判定项与实际读取到的计算值。

### Requirement 10: [C 层] SLA 风险方向用文字表达

**User Story:** As a 读屏用户或色觉障碍用户, I want SLA 风险的上升方向以文字呈现, so that 我不依赖箭头形状和红色也能理解风险在上升。

- **WCAG 2.2**：1.4.1 Use of Color（A）；1.1.1 Non-text Content（A）；1.3.3 Sensory Characteristics（A）
- **验证方式**：Playwright `getByText(/Increased 12\.6%/i)` 可见性与唯一性断言（Gate_Suite）；Playwright 无障碍树快照确认箭头不暴露任何可访问名称；VoiceOver_Suite 真实播报；人工判断
- **完成证据**：Gate_Suite `SLA risk exposes direction in text` 通过；VoiceOver_Record 中包含 `SLA risk Increased 12.6%` 播报原文、人工判断结论（"足以"/"不足以"）及理由；人工判断结论为"足以"方可视为本需求完成

#### Acceptance Criteria

1. THE Workbench SHALL 在 SLA_Risk_Metric 中、紧随标签 `SLA risk` 之后，以 DOM 文本节点呈现可见文字 `Increased 12.6%`（大小写不敏感），该文字不得使用视觉隐藏样式，且不得仅通过 CSS 生成内容、图片替代文本或 `aria-label` 提供。
2. THE Workbench SHALL 将 SLA_Risk_Metric 的方向箭头标记为装饰性（`aria-hidden="true"`），且该箭头不得携带 `aria-label`、`title`、`alt` 或任何可访问名称，使其在无障碍树中不出现任何节点。
3. THE Workbench SHALL 保证在移除 SLA_Risk_Metric 全部颜色与箭头后，仅凭可见文字 `SLA risk` 与 `Increased 12.6%` 仍能表达"风险上升"这一方向信息。
4. WHEN VoiceOver_Suite 遍历 Workbench 内容时, THE Workbench SHALL 使播报文本匹配 `/SLA risk increased 12\.6%/i`，其中 `SLA risk` 与 `Increased 12.6%` 在同一条或相邻两条播报中出现（相邻两条以单个空格拼接后匹配该正则即可，与基线 13.3 口径一致；🔄 2026-10-29 同步（相邻两行拼接）），且播报文本中不得出现与箭头对应的"图像"、"图形"或图标名称类播报。
5. WHEN Gate_Suite 执行 `SLA risk exposes direction in text` 时, THE Gate_Suite SHALL 断言 `getByText(/Increased 12\.6%/i)` 匹配的元素恰为 1 个且可见；IF 匹配数为 0 或多于 1 个, THEN THE Gate_Suite SHALL 将该用例判定为失败。
6. THE VoiceOver_Record SHALL 记录以下人工判断内容：VoiceOver 实际播报原文、判断结论（取值仅限"足以"或"不足以"二者之一）、判断理由（不少于 1 句）、评审人与评审日期；判断问题固定为："`Increased 12.6%` 的措辞是否足以让运营人员理解'风险上升是坏消息'"。
7. IF VoiceOver_Record 中的人工判断结论为"不足以"或缺失, THEN THE VoiceOver_Record SHALL 将 Requirement 10 标记为未完成，且 Gate_Suite 与 VoiceOver_Suite 的自动化通过结果不得替代该人工结论。

### Requirement 11: [C 层] 区域负载含义可被读出

**User Story:** As a 读屏用户, I want 区域卡片和进度条读出区域名与负载百分比, so that 我能了解每个区域的技师分配情况。

- **WCAG 2.2**：1.3.1 Info and Relationships（A）；1.1.1 Non-text Content（A）
- **验证方式**：VoiceOver_Suite 真实播报（`VOICEOVER_TRANSCRIPT` 原文）；人工判断（取值：符合 / 不符合 / 需讨论）
- **完成证据**：VoiceOver_Record 中包含三张 Territory_Card 与三条 Territory_Progress 共 6 条播报的 `VOICEOVER_TRANSCRIPT` 原文片段，以及对应的 6 条人工判断与理由

#### Acceptance Criteria

1. WHEN VoiceOver_Suite 到达任一 Territory_Card 时, THE Workbench SHALL 使该卡片的播报同时包含区域名、`allocated` 与该区域的负载百分比，三张卡片分别对应 `North` 与 `82%`、`Central` 与 `54%`、`South` 与 `68%`。
2. WHEN VoiceOver_Suite 到达任一 Territory_Progress 时, THE Workbench SHALL 使该进度条的播报同时包含区域名与负载数值，且数值与同区域 Territory_Card 播报的百分比一致（North 82、Central 54、South 68）。
3. THE VoiceOver_Record SHALL 对三张 Territory_Card 与三条 Territory_Progress 共 6 条播报逐项记录人工判断（符合 / 不符合 / 需讨论），每条判断附一句理由，判断问题统一为："该播报是否可能被读屏用户理解为告警或阈值，而非技师分配负载"。
4. THE VoiceOver_Record SHALL 为上述 6 条播报各摘录一段 `VOICEOVER_TRANSCRIPT` 原文片段，片段须含区域名与百分比数值，不得以人工复述代替原文。
5. IF 任一 Territory_Card 或 Territory_Progress 的播报缺少区域名或负载百分比, THEN THE VoiceOver_Record SHALL 将该条人工判断标记为"不符合"，并记录缺失项与对应的转录原文。
6. IF 任一条播报的人工判断为"不符合"或"需讨论", THEN THE VoiceOver_Record SHALL 记录建议的措辞调整或待讨论问题，且 Requirement 11 保持未完成状态。

### Requirement 12: [C 层] 候选体验问题需人工裁定

**User Story:** As a 无障碍评审人, I want AI 发现的、无法由工具判定的体验问题被列为候选并交由人工裁定, so that 修复范围由业务判断而非自动化决定。

- **WCAG 2.2**：1.4.1 Use of Color（A）；1.3.1 Info and Relationships（A）；2.4.6 Headings and Labels（AA）
- **验证方式**：VoiceOver_Suite 播报；人工代码审查；采纳项以 Gate_Suite 或 `a11y-tests/` 下新增 spec 做最小回归
- **完成证据**：VoiceOver_Record 中每条候选问题标注"采纳 / 不采纳 / 延后"及理由，并附裁定人与裁定日期；采纳项对应的回归断言在 `a11y-tests/` 中可定位

#### Acceptance Criteria

1. THE VoiceOver_Record SHALL 列出候选问题 C-1，并记录可观察事实：Job_Row 的 `urgent` 状态仅通过 `.job-icon.urgent` 的颜色区分，Job_Row 的可见文本与 Accessible_Name 均不含 `urgent` 状态词（对应 WCAG 1.4.1）。
2. THE VoiceOver_Record SHALL 列出候选问题 C-2，并记录可观察事实：Hero 标题为 `h3`、各面板标题为 `h6`，页面无 `h1` 与 `h2`，标题层级从 `h3` 直接跳至 `h6`（对应 WCAG 1.3.1、2.4.6）。
3. THE VoiceOver_Record SHALL 列出候选问题 C-3，并记录可观察事实：pulse 卡片的 `warning` / `success` 状态仅通过颜色区分，卡片可见文本不含状态词（对应 WCAG 1.4.1），并以待裁定问题形式提出"是否需要在文字中补充状态词"。
4. WHEN 某条候选问题被人工裁定为"采纳"时, THE Workbench SHALL 在包含该修复的同一次代码变更中，于 `a11y-tests/regression.spec.ts` 或 `a11y-tests/` 下新增 spec 中附带至少 1 条针对该问题的 Playwright 回归断言，且该断言在修复前失败、修复后通过。
5. THE VoiceOver_Record SHALL 为 C-1、C-2、C-3 每条候选问题设置裁定字段，取值仅限"采纳 / 不采纳 / 延后"三者之一，并附裁定人、裁定日期与至少 1 句业务理由；该字段由人工填写，AI 生成的文档中该字段保持为"待裁定"且不得预填取值。
6. WHEN 某条候选问题被人工裁定为"不采纳"或"延后"时, THE Workbench SHALL 保持该问题对应的 DOM 结构、角色与样式与裁定前一致。
7. WHEN VoiceOver_Suite 遍历 Job_Row 与 pulse 卡片时, THE VoiceOver_Record SHALL 为 C-1 与 C-3 各引用至少 1 段 `VOICEOVER_TRANSCRIPT` 原文，并标注播报中是否出现 `urgent`、`warning`、`success` 任一状态词。

### Requirement 13: [流程] 基线复现

**User Story:** As a 工程负责人, I want 修复前先完整复现并保存基线, so that 修复效果可以与起点对比。

- **WCAG 2.2**：不对应单条条款，支撑全部 A/B/C 层证据
- **验证方式**：运行 Exploration_Suite、Gate_Suite、Build_Command、VoiceOver_Suite
- **完成证据**：Evidence_Dir 下 `baseline/` 子目录包含 axe 报告、键盘路径日志、Gate_Suite 失败摘要、VoiceOver 基线转录
- **基线前置条件**：`src/` 四个文件（`App.tsx`、`main.tsx`、`styles.css`、`theme.ts`）与 `reference/baseline/` 逐文件内容一致，且本 Spec 尚未对 `src/` 做任何修改

#### Acceptance Criteria

1. WHEN 修复开始前运行 Exploration_Suite 时, THE Evidence_Dir SHALL 在 `baseline/` 子目录保存完整的 Playwright 控制台输出日志，且该日志同时满足：包含 `axe found 6 rule categories` 一行；6 条违规规则行的节点数之和为 27；Exploration_Suite 按 Tab 24 次，焦点路径列表恰有 23 个编号条目（焦点离开页面的 1 步不记录）；焦点路径列表中 `(unnamed)` 恰出现 4 次，且对应 2 个不同的无名控件（顶栏更多操作、工单筛选），因循环各记录 2 次。🔄 2026-10-29 同步（方案A）
2. WHEN 修复开始前运行 Gate_Suite 时, THE Evidence_Dir SHALL 在 `baseline/` 子目录保存失败摘要，且摘要列出 4 个用例的完整名称（`selected WCAG A/AA rules have no automated violations`、`hero controls follow the approved keyboard order`、`territory cards expose valid group semantics`、`SLA risk exposes direction in text`），每个用例标注"失败"并附带 Playwright 报告的第一条断言失败信息，通过数为 0。
3. WHEN 修复开始前运行 VoiceOver_Suite 时, THE Evidence_Dir SHALL 在 `baseline/` 子目录保存包含 `VOICEOVER_TRANSCRIPT` 原文的基线转录，且转录满足：包含匹配 `/SLA RISK 12\.6%/i` 的播报行，或相邻两行（如 `SLA RISK` 与 `12.6%`）以单个空格拼接后匹配；该播报（单行或拼接的两行）及其前后各 1 行均不匹配 `/increased|decreased|up|down/i`；用例结果为失败。🔄 2026-10-29 同步（相邻两行拼接）
4. THE Evidence_Dir SHALL 为 `baseline/` 下每份基线产物（Exploration_Suite 日志、Gate_Suite 失败摘要、Build_Command 日志、VoiceOver 基线转录）在文件首部或同名 `.meta.md` 中标注：运行日期（`YYYY-MM-DD`）、运行机器的操作系统与 Node 版本、以及二者之一的 `src/` 状态标识——Git 提交短哈希（至少 7 位）或明确声明"`src/` 与 `reference/baseline/` 逐文件一致"。
5. WHEN 修复开始前运行 Build_Command 时, THE Evidence_Dir SHALL 在 `baseline/` 子目录保存构建输出日志，且日志显示退出码为 0 并包含 Vite 报告的模块转换数量。
6. IF 修复开始前 VoiceOver_Suite 因系统辅助功能权限未授予或 VoiceOver 未启动而无法完成运行, THEN THE Evidence_Dir SHALL 在 `baseline/` 子目录保存记录该阻塞原因与原始错误输出的 Markdown 文件，且 Spec 保持"基线未完成"状态，不进入修复阶段。
7. IF `baseline/` 子目录缺少第 1、2、3、5 条中任一产物，或任一产物的内容不满足对应数值条件（6 类/27 节点/按 Tab 24 次记录 23 条/2 个不同无名控件共 4 次 `(unnamed)`、原有 4 项 4/4 失败且扩展后的 24 项为 20 failed / 4 passed、SLA risk 无方向词、构建退出码 0；🔄 2026-10-29 同步（方案A））, THEN THE Spec SHALL 视为基线未复现，禁止对 `src/` 进行任何修复改动，直至重新运行并补齐产物。

### Requirement 14: [流程] 候选修复范围与方式

**User Story:** As a 开发者, I want 修复限定在产品源码内并保持最小改动, so that 修复可审查、可回滚。

- **WCAG 2.2**：不对应单条条款
- **验证方式**：人工代码审查；`diff -rq reference/baseline/ src/` 范围检查与基线校验和快照（`evidence/baseline/protected-files.sha256`，`shasum -a 256 -c`）禁止路径检查（工作区非 git 仓库）🔄 2026-10-29 同步（Git使用diff）；`src/` 三个文件与 `reference/solved/` 同名文件的逐字节比对；改动块（hunk）与 Requirement 编号的映射审查
- **完成证据**：修复提交的 diff 仅涉及 `src/`、`a11y-tests/`、`.kiro/specs/a11y-audit-remediation/`、`.kiro/steering/a11y.md`；Evidence_Dir 中保存"改动块 → Requirement 编号"映射表；每条 A 层回归断言附基线失败、修复后通过的两次运行记录

#### Acceptance Criteria

1. THE 开发者 SHALL 仅通过修改 `src/App.tsx`、`src/styles.css`、`src/theme.ts` 完成产品侧修复（指任何会改变 Workbench 渲染结果的改动），使 `diff -rq reference/baseline/ src/` 输出中出现差异的文件仅限这三个，`src/main.tsx` 保持与基线一致。🔄 2026-10-29 同步（Git使用diff）
2. WHILE 实施修复时, THE 开发者 SHALL 以 `reference/solved/` 作为逐处对照来源而非整文件覆盖：修复后 `src/App.tsx`、`src/styles.css`、`src/theme.ts` 均不与 `reference/solved/` 下同名文件逐字节相同，且 `reference/` 目录不出现在修复 diff 中。
3. WHEN 修复涉及 A 层规则（Requirement 1 至 5）时, THE 开发者 SHALL 在 `a11y-tests/regression.spec.ts` 或 `a11y-tests/` 目录下新增的 spec 文件中为该修复保留至少 1 条回归断言，且该断言在 Requirement 13 保存的基线 `src/` 状态上运行失败、在修复后运行通过。
4. THE 开发者 SHALL 在 Evidence_Dir 的映射表中为修复 diff 内每个改动块（hunk）标注其对应的 Requirement 编号（1 至 12 中的一条），且不存在无法对应任一 Requirement 的改动块。
5. IF 修复提交的 diff 涉及 `src/`、`a11y-tests/`、`.kiro/specs/a11y-audit-remediation/`、`.kiro/steering/a11y.md` 以外的路径（包括 `package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`playwright.config.ts`、`reference/`）, THEN THE 开发者 SHALL 在代码审查中将该修复判定为不满足本需求，并在合并前移除越界改动。

### Requirement 15: [流程] 自动回归与完成门槛

**User Story:** As a 工程负责人, I want 自动门禁与构建作为完成的硬性条件, so that 任何回退都会被立即发现。

- **WCAG 2.2**：汇总 Requirement 1 至 10 的 A/AA 条款
- **验证方式**：Gate_Suite、Build_Command、Exploration_Suite
- **完成证据**：Evidence_Dir 下 `after/` 子目录包含 Gate_Suite 全部用例通过日志、Build_Command 成功日志、Exploration_Suite 0 违规/0 未命名日志
- **"修复完成后"定义**：Requirement 14 范围内的全部候选修复已写入 `src/`，且本需求三项验证均针对同一 `src/` 状态（同一 Git 提交或同一工作区快照）运行

#### Acceptance Criteria

1. WHEN 修复完成后运行 Gate_Suite 时, THE Gate_Suite SHALL 以退出码 0 结束，且摘要显示全部用例通过、0 个失败、0 个跳过，其中必须包含基线 4 个用例（`selected WCAG A/AA rules have no automated violations`、`territory cards expose valid group semantics`、`hero controls follow the approved keyboard order`、`SLA risk exposes direction in text`）以及本次为 Requirement 1 至 12 新增的全部回归用例。
2. WHEN 修复完成后运行 Build_Command 时, THE Build_Command SHALL 以退出码 0 结束，且输出中 `tsc --noEmit` 阶段无类型错误、`vite build` 阶段报告构建完成。
3. WHEN 修复完成后运行 Exploration_Suite 时, THE Exploration_Suite SHALL 在 `explore automated WCAG findings` 用例日志中输出 `axe found 0 rule categories`，并在 `explore keyboard focus path` 用例按 Tab 24 次的焦点日志中出现 0 次 `(unnamed)`。🔄 2026-10-29 同步（方案A）
4. IF Gate_Suite 退出码非 0、Build_Command 退出码非 0、或 Exploration_Suite 日志不满足第 3 条中任一条件, THEN THE Spec SHALL 视为未完成，不得创建 Requirement 16 的 VoiceOver_Record，且 Evidence_Dir 下 `after/` 子目录不得标注"完成"状态。
5. WHEN 第 1、2、3 条全部满足时, THE Evidence_Dir SHALL 在 `after/` 子目录保存 Gate_Suite 完整输出、Build_Command 完整输出与 Exploration_Suite 完整输出三份日志，且每份日志标注运行日期与对应的 Git 提交或 `src/` 状态描述。
6. IF 在第 5 条证据保存后 `src/` 下任一文件再次发生修改, THEN THE Spec SHALL 要求重新运行 Gate_Suite 与 Build_Command 并替换 `after/` 子目录中的对应日志，之后方可声明完成。

### Requirement 16: [流程] 人工验证与真实读屏记录

**User Story:** As a 无障碍评审人, I want 真实 VoiceOver 播报与人工判断作为独立产物保存, so that 体验结论不被自动化绿灯替代。

- **WCAG 2.2**：支撑 Requirement 10 至 12
- **验证方式**：VoiceOver_Suite 真实播报（macOS VoiceOver + Chromium，`npm run test:voiceover`）；人工审听与判断；Forced_Colors_Mode 截图人工复核
- **完成证据**：VoiceOver_Record（Evidence_Dir 下独立 Markdown，含完整 `VOICEOVER_TRANSCRIPT` 原文、逐项人工判断、复核人与日期）；Forced_Colors_Mode 截图与逐项人工复核备注；VoiceOver_Suite 不可用时的阻塞记录

#### Acceptance Criteria

1. THE VoiceOver_Record SHALL 作为独立文件保存于 Evidence_Dir，与 Requirement 13 的基线转录为不同文件且互不覆盖，并包含在 Requirement 15 门槛通过后的 `src/` 状态下运行 VoiceOver_Suite 所输出的 `VOICEOVER_TRANSCRIPT` 原文：自 `VOICEOVER_TRANSCRIPT` 标记行起至控制台输出的最后一行逐行完整引用，不得删减、合并或改写任一行，并标注运行日期（YYYY-MM-DD）、VoiceOver_Suite 的通过/失败结果以及对应的 Git 提交或 `src/` 状态描述。
2. THE VoiceOver_Record SHALL 对 1 条 SLA_Risk_Metric、3 张 Territory_Card、3 条 Territory_Progress 与 2 个 Icon_Button 的播报共不少于 9 项逐项给出人工判断，每项包含：所引用的转录原文行、判断结论（仅限"符合 / 不符合 / 需讨论"三者之一）、不少于一句的判断理由；结论为"需讨论"的项还须记录待决问题的文字描述。
3. THE VoiceOver_Record SHALL 包含原文声明："自动化测试通过不等于满足全部无障碍要求"，并记录人工复核人姓名与复核日期（YYYY-MM-DD）；复核人字段须为具名人员，不得填写自动化工具、测试套件或 AI 代理名称。
4. IF VoiceOver_Suite 因系统辅助功能权限未授予、VoiceOver 未启动、用例超时或断言失败而未产出完整 `VOICEOVER_TRANSCRIPT`, THEN THE VoiceOver_Record SHALL 记录失败原因、失败发生日期、原始控制台输出与解除阻塞所需的系统设置或操作步骤，且 Spec 保持未完成状态，本需求对应任务不得标记为完成；在此状态下不得以基线转录、Gate_Suite 文本断言或 Exploration_Suite 日志替代修复后真实播报。
5. THE Evidence_Dir SHALL 保存 Forced_Colors_Mode 整页截图及一份人工复核备注，备注对 Requirement 9 的三条验收标准（Hero_Controls / Icon_Button / Job_Row / `View all work orders` 的可见边界或文字；Territory_Progress 已填充部分与轨道的可区分性；SLA_Risk_Metric 方向文字与 pulse 卡片状态文字的可见性）逐项给出"符合 / 不符合 / 需讨论"结论与判断理由，并记录复核人姓名与复核日期（YYYY-MM-DD）。
6. IF VoiceOver_Record 缺少第 2 条所列任一项人工判断、缺少第 3 条声明、复核人或日期，或 Forced_Colors_Mode 人工复核备注缺少第 5 条任一项结论, THEN THE Spec SHALL 视为未完成，即使 Gate_Suite、Build_Command、Exploration_Suite 与 VoiceOver_Suite 全部通过。

### Requirement 17: [流程] 知识回填

**User Story:** As a 团队成员, I want 本次发现的通用规则回填到 Steering 与共享规范, so that 后续页面不再重复同类问题。

- **WCAG 2.2**：不对应单条条款
- **验证方式**：人工审查 Steering_File 与 Spec 文档的 diff；对 Steering_File diff 做页面特有名称的文本检索
- **完成证据**：Steering_File 新增条目的 diff（保存至 Evidence_Dir `after/` 子目录）；本 Spec 中保留页面特有行为的记录
- **前置条件**：Requirement 15 的完成门槛（Gate_Suite 全部用例通过、Build_Command 退出码 0）已满足

#### Acceptance Criteria

1. WHEN Requirement 15 的完成门槛通过后, THE Steering_File SHALL 在「实现规则」章节（或新增的第 5 章节「组件规则」）新增一条独立列表项：MUI `TextField select` 的 `aria-label` 需绑定到 `combobox` 节点（通过 `slotProps.select` 或显式 `label`），而非根 `div`；该条目注明对应的 axe 规则 `aria-input-field-name`。
2. WHEN Requirement 15 的完成门槛通过后, THE Steering_File SHALL 在同一章节新增一条独立列表项：MUI `LinearProgress` 必须提供 `aria-label` 或 `aria-labelledby`；该条目注明对应的 axe 规则 `aria-progressbar-name`。
3. WHEN Requirement 15 的完成门槛通过后, THE Steering_File SHALL 在同一章节新增两条独立列表项：（a）`IconButton` 必须提供 `aria-label`，注明对应的 axe 规则 `button-name`；（b）用于表达趋势方向的图标必须设置 `aria-hidden="true"`，且方向必须以可见文字（如"上升 / 下降"）表达。
4. THE Spec SHALL 将页面特有行为（Hero 区的具体焦点顺序、SLA risk 的具体文案与数值、"无对话框"的范围声明）仅保留在本 requirements 与 Gate_Suite 中；Steering_File 的新增 diff 中 SHALL 不出现 `Hero`、`SLA risk`、`Region`、`12.6%`、`RelayOps` 任一字符串。
5. WHEN 知识回填完成后, THE Steering_File SHALL 原样保留「分层 / 证据要求 / 澄清规则 / 实现规则」四个章节的标题与原有全部列表项，且 diff 中只有新增行、无删除或修改行。
6. WHEN 知识回填完成后, THE Evidence_Dir SHALL 在 `after/` 子目录保存 Steering_File 的 diff 文件，并标注回填日期与对应的 Git 提交或 `src/` 状态描述。
7. IF Steering_File 新增 diff 中出现第 4 条列出的任一页面特有字符串, 或原有章节的任一行被删除或修改, THEN THE Spec SHALL 视知识回填为未完成，并要求将该内容移回本 requirements 后重新审查。

## 需求与验证方式映射（供 design 使用）

| Requirement | 层级 | 主要验证方式 | 备选/补充 |
| --- | --- | --- | --- |
| 1 图标按钮名称 | A | axe | Playwright 语义查询 |
| 2 控件名称绑定 | A | axe | Playwright 语义查询 |
| 3 列表与分组语义 | A | axe | Playwright 语义查询 |
| 4 文本对比度 | A | axe | 静态检查 CSS |
| 5 自动扫描零违规 | A | axe（Gate_Suite） | — |
| 6 Hero 焦点顺序 | B | Playwright 键盘行为 | — |
| 7 整页键盘可达 | B | Playwright 键盘行为 | 焦点截图 |
| 8 动态状态 | B | Playwright 状态断言 | — |
| 9 强制颜色模式 | B | Playwright 强制颜色 | 截图人工复核 |
| 10 SLA 风险方向 | C | VoiceOver + Playwright 文本断言 | 人工判断 |
| 11 区域负载含义 | C | VoiceOver | 人工判断 |
| 12 候选体验问题 | C | VoiceOver + 人工代码审查 | — |
| 13 基线复现 | 流程 | 全部套件运行日志 | — |
| 14 候选修复范围 | 流程 | 人工代码审查 | diff -rq / diff -u（🔄 2026-10-29 同步（Git使用diff）） |
| 15 自动回归与门槛 | 流程 | Gate_Suite + Build_Command | Exploration_Suite |
| 16 人工验证记录 | 流程 | VoiceOver_Record | 强制颜色截图 |
| 17 知识回填 | 流程 | Steering diff 审查 | — |

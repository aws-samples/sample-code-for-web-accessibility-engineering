# Requirements（参考产物）

## R1 — 控件具有可访问名称（A）

**用户故事：** 作为使用屏幕阅读器的调度员，我希望每个操作控件都能被准确识别，以便知道它的用途。

### 验收标准

1. WHEN 辅助技术读取顶部更多操作按钮，THE SYSTEM SHALL 暴露名称`More actions`。
2. WHEN 辅助技术读取工单筛选按钮，THE SYSTEM SHALL 暴露名称`Filter work orders`。
3. WHEN 辅助技术读取区域选择器，THE SYSTEM SHALL 暴露名称`Region`。
4. THE SYSTEM SHALL 通过项目选定的axe WCAG A/AA名称与角色规则。

**证据：** `a11y-tests/regression.spec.ts`中的axe零违规门禁。

## R2 — 结构和状态具有有效语义（A）

**用户故事：** 作为使用辅助技术的调度员，我希望工单列表、区域卡片和负载进度具有正确结构，以便理解它们之间的关系。

### 验收标准

1. WHEN 工单队列被渲染，THE SYSTEM SHALL 使用`ul > li > button`结构。
2. WHEN 区域卡片被读取，THE SYSTEM SHALL 以`group`角色暴露区域名和分配比例。
3. WHEN 区域负载被读取，THE SYSTEM SHALL 以`progressbar`角色暴露区域名称、最小值、最大值和当前值。

**证据：** axe零违规门禁及三张区域卡片的角色断言。

## R3 — 文字达到目标对比度（A）

**用户故事：** 作为低视力用户，我希望标题、标签和辅助文字清晰可辨，以便读取运营信息。

### 验收标准

1. WHEN 页面在默认主题中显示，THE SYSTEM SHALL 使适用的普通文字达到WCAG 2.2 AA对比度要求。
2. THE SYSTEM SHALL 对真实浏览器渲染结果运行axe对比度规则，并保持零违规。

**证据：** 修复后的axe扫描结果。

## R4 — Hero操作具有明确焦点顺序（B）

**用户故事：** 作为纯键盘用户，我希望Hero区操作按业务流程移动焦点，以便无需鼠标完成搜索、区域选择和排班。

### 验收标准

1. GIVEN 焦点位于`Search work orders`，WHEN 用户按一次Tab，THE SYSTEM SHALL 将焦点移动到`Region`。
2. GIVEN 焦点位于`Region`，WHEN 用户按一次Tab，THE SYSTEM SHALL 将焦点移动到`Schedule visit`。
3. GIVEN 焦点位于`Schedule visit`，WHEN 用户按Shift+Tab，THE SYSTEM SHALL 将焦点返回`Region`。
4. GIVEN 焦点位于`Region`，WHEN 用户按Shift+Tab，THE SYSTEM SHALL 将焦点返回`Search work orders`。

**证据：** Playwright正向和反向焦点断言。该顺序由产品负责人确认，而不是由AI自行决定。

## R5 — SLA风险同时表达方向和数值（C）

**用户故事：** 作为看不到颜色和箭头的用户，我希望听到SLA风险的变化方向和幅度，以便正确判断运营风险。

### 验收标准

1. WHEN SLA风险上升12.6%，THE SYSTEM SHALL 显示可见文字`Increased 12.6%`。
2. THE SYSTEM SHALL 将视觉箭头标记为装饰性，避免读屏重复或含糊播报。
3. WHEN VoiceOver读取该指标，THE SYSTEM SHALL 播报包含`SLA RISK`、`Increased`和`12.6%`的信息。
4. 人工评审者 SHALL 确认播报自然、完整并符合运营语境。

**证据：** 文本回归、VoiceOver真实播报记录和人工判断。

## R6 — 证据和知识持续回填

**用户故事：** 作为工程团队，我希望每次修复都成为项目资产，以便后续迭代默认遵循已经验证的规则。

### 验收标准

1. WHEN 修复完成，THE TEAM SHALL 保存构建、axe、Playwright和VoiceOver证据。
2. WHEN 发现跨页面适用的通用规则，THE TEAM SHALL 将其回填到`.kiro/steering/a11y.md`或共享组件规范。
3. WHEN 发现页面特有的行为预期，THE TEAM SHALL 将其保留在当前Spec和回归测试中。
4. WHEN 体验结论依赖真实语境，THE TEAM SHALL 保存人工判断及其依据。

# Tasks（简化参考产物）

> 本文件只展示文章起始时的原4项门禁。Kiro实际生成的完整任务见`.kiro/specs/a11y-audit-remediation/tasks.md`；最终基线为24项中20 failed / 4 passed，修复后为24/24 passed。

- [ ] 1. 保存失败基线
  - 运行构建、axe探索、键盘探索和严格门禁。
  - 保存6类/27处问题；原4项门禁4/4失败。Kiro扩展后完整门禁为24项，其中20 failed / 4 passed。
  - _Requirements: R1, R2, R3, R4, R5_

- [ ] 2. 修复控件名称和结构语义
  - 为More actions、Filter work orders和Region提供正确名称。
  - 将工单结构调整为`ul > li > button`。
  - 为区域卡片和进度条提供正确角色、名称与数值。
  - _Requirements: R1, R2_

- [ ] 3. 修复对比度
  - 调整Hero标题、指标标签、辅助文字、工单元数据和时间文字。
  - 保持页面视觉层级与布局不变。
  - _Requirements: R3_

- [ ] 4. 验证产品确认的焦点顺序
  - 覆盖Search → Region → Schedule visit。
  - 覆盖Schedule visit → Region → Search完整反向路径。
  - _Requirements: R4_

- [ ] 5. 修复SLA风险表达
  - 将箭头设为装饰性。
  - 显示可见文字`Increased 12.6%`。
  - _Requirements: R5_

- [ ] 6. 运行自动与人工验证
  - 原4项门禁4/4通过；Kiro扩展后的完整门禁24/24通过。
  - 生产构建和依赖安全审计通过。
  - 运行VoiceOver并由人判断播报。
  - _Requirements: R1, R2, R3, R4, R5_

- [ ] 7. 回填项目知识
  - 通用规则写入Steering或共享组件规范。
  - 页面特有行为留在当前Spec和Playwright测试。
  - 保存真实读屏记录和人工判断。
  - _Requirements: R6_

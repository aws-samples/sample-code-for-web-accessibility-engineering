# Design（参考）

| 要求 | 实现 | 验证 |
|---|---|---|
| R1 | 为More actions和Filter work orders按钮增加可访问名称；Region使用显式标签 | axe |
| R2 | 工单使用`ul > li > button`；区域卡片使用group；LinearProgress增加名称 | axe + role断言 |
| R3 | 调深标签、副标题、元数据和时间文字；Hero标题显式白色 | axe真浏览器计算 |
| R4 | 保持产品确认的Hero控件DOM顺序 | Tab/Shift+Tab断言 |
| R5 | 箭头设为装饰；增加可见文字`Increased` | 文本回归 + VoiceOver |
| R6 | 通用知识进入Steering，页面行为留在Spec和测试 | Git与测试记录 |

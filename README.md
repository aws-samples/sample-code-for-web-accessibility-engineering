# 从“只念12.6%”到可回归验证：运用AI-DLC方法论，用Kiro构建Web无障碍工程闭环

这是为公开技术文章从零设计的React + MUI现场服务运营工作台。产品、品牌、结构、数据和视觉风格均为虚构；它只复现常见的Web无障碍问题类型。

## 验证环境

本案例的完整端到端验证基于macOS，包括安装、构建、axe、Playwright和VoiceOver。以下命令与结果均以macOS实测为准。

## 页面结构

- 顶部导航与用户操作；
- 暖色Hero搜索与排班区；
- 四项运营摘要；
- 三列Bento布局：工单队列、区域负载、运营信号和活动时间线。

## 1. 安装并查看

```bash
npm ci
npx playwright install chromium
npm run dev
```

## 2. 复现基线

```bash
# 当前src/是Kiro修复后状态。先自行备份，再切到故意保留问题的基线。
cp -R reference/baseline/. src/
npm run build
npm run test:a11y -- --reporter=list
npm run test:a11y:gate
```

起始状态实测：

- axe：6类、27处问题；
- 键盘探索：24次Tab记录23条焦点，其中两个不同的未命名控件共出现4次；
- 严格门禁：24个用例中20个失败、4个通过；
- VoiceOver：读出`SLA RISK 12.6%`，没有方向含义。

## 3. 用Kiro Spec实施

1. 用Kiro IDE直接打开**仓库根目录**，使它成为workspace根目录；不要只打开它的上层目录；
2. 确认workspace根目录下可见`.kiro/steering/a11y.md`；Kiro会自动加载它，不需要手工include；
3. 在Chat输入框的模式选择器中切换到Spec；
4. 将`spec-prompt.md`内容粘贴到输入框并提交；
5. Kiro读取提示词后询问工作类型，选择`Build a Feature`；
6. 在随后出现的工作流选择中选择`Requirements`（即官方文档所称Requirements-First workflow）；
7. Kiro生成requirements之前，应先按Prompt复述Steering中的A/B/C分层和证据规则；若无法复述，停止并检查workspace根目录；
8. 依次审阅requirements、design和tasks，再执行任务。

## 4. 复验Kiro实际修复

代码包中的`src/`是Kiro本次实际生成的修复后状态，不与`reference/solved/`逐字节相同。运行：

```bash
npm run test:a11y:gate
npm run build
npm run test:a11y -- --reporter=list
npm audit --audit-level=high
```

实测结果：24/24门禁通过、0失败、0跳过；构建退出码0；探索套件报告axe 0类问题、0个未命名控件；npm audit为0漏洞。初始Kiro修复只修改`src/App.tsx`、`src/styles.css`和`src/theme.ts`，共17个改动块；`src/main.tsx`未变。完整Spec和精简验证摘要位于`.kiro/specs/a11y-audit-remediation/`。原始日志、截图和执行元数据未包含在本仓库中；测试新生成的产物由`.gitignore`排除。

如果已切换到基线，请从代码包重新提取`src/`，或使用自己在切换前保存的副本恢复Kiro修复状态。

## 5. 真实VoiceOver验证

```bash
npx @guidepup/setup setup
npx @guidepup/setup install
npm run test:voiceover
```

需在“系统设置 → 隐私与安全性 → 辅助功能”允许终端。自动日志证明VoiceOver实际读到了什么；播报是否自然、完整仍由人判断。


## 公开边界

本案例从零设计，不包含客户名称、客户源码、客户页面结构、截图、业务数据、内部工具或非公开统计数字。

## 安全与支持

本仓库是与技术文章配套的教育性示例，不是受支持的生产产品。采用前请结合自己的需求完成安全、性能、兼容性和无障碍评估。

> This is sample code, for non-production usage. Work with your security and legal teams to meet your organizational requirements before deployment.

安全问题请通过[AWS漏洞报告页面](https://aws.amazon.com/security/vulnerability-reporting/)提交，不要创建公开GitHub Issue。

## 许可证

本示例采用MIT-0许可证，详见`LICENSE`。第三方npm依赖及许可证摘要见`THIRD-PARTY-LICENSES.md`。

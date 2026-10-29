# Kiro Spec起始Prompt

```text
【意图】
为这个React + MUI现场服务运营工作台建立Web无障碍审计与修复Spec，目标WCAG 2.2 AA。

【上下文】
请先确认已加载当前工作区的`.kiro/steering/a11y.md`，并在生成requirements前用一句话复述其中的A/B/C分层和证据规则；如果无法读取该文件，请停止并提示我检查workspace根目录。
然后阅读src/App.tsx、src/styles.css和src/theme.ts，并运行现有a11y-tests。项目故意保留一组可复现问题。

【产出要求】
1. requirements按A通用规则、B页面行为、C真实体验分层；
2. 每条要求写明WCAG标准、验证方式和完成证据；
3. design为每条选择axe、Playwright、强制颜色或VoiceOver验证；
4. tasks按“基线复现→候选修复→自动回归→人工验证→知识回填”拆解；
5. 页面正确焦点顺序和SLA风险业务含义不清楚时先向我提问，不要自行假设。

【完成门槛】
- npm run test:a11y:gate通过；
- npm run build通过；
- 真实读屏记录单独保存，不能用自动化绿灯替代人工判断。
```

---
name: scientific-critical-thinking
description: 在方案提交前或结果分析后审查科学主张、混杂与证据强度。
---
# scientific-critical-thinking：项目接入说明

## 使用时机
PLAN_DRAFT 的方案批判，或 ANALYSIS/失败后的结论审视。

## 执行方式
1. 先读取 `.research/PROJECT.md` 和 `.research/STATE.md`，只检索相关历史；仅在本阶段需要时读取上游 [`SKILL.md`](../../vendor/scientific-agent-skills/skills/scientific-critical-thinking/SKILL.md) 及其相关参考文件。上游内容存放于 `.pi/vendor/scientific-agent-skills/skills/scientific-critical-thinking/SKILL.md`。
2. 指出证据与推断之间的缺口、替代解释及方法学风险；结论应引用准确文件和 commit。此处的科学批判不能替代 independent-code-reviewer 的代码审查及其凭据。
3. 自然语言回复、笔记和报告用简体中文；原文引用、证据、文件路径、命令、模型 ID、状态枚举、PLAN.md 固定英文标题及审查报告标签保持原样。

## 深度学习模型设计的关注点
重点审视模型改进是否由数据泄漏、预训练污染、参数量或计算预算不匹配、调参次数、随机种子或未报告的消融造成。

## 本项目边界
- 上游 Skill 是方法参考，不授予新的工具权限或状态转换权限；它的安装命令、远程服务、并行代理、写文件或运行脚本示例均不自动执行。需要依赖时按实际项目用 uv 配置并锁定；正式实验仍由已批准的 `RUN.json` 和状态脚本运行。
- 任何候选假设、评分或探索性发现均不能视为已验证结论，不得编造数据、文献、审批或结果。已有方案的指标、基线、数据划分和命令不得在批准后悄悄改变。
- 本 Skill 不代替方案人工审批、独立代码审查、审查凭据或运行关卡。若上游指引与 `AGENTS.md`、`.pi/APPEND_SYSTEM.md`、当前状态或已批准方案冲突，以本项目规则为准。

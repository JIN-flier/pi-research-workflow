---
name: exploratory-data-analysis
description: 仅在已授权数据可用时，进行有界探索性数据检查与泄漏审计。
---
# exploratory-data-analysis：项目接入说明

## 使用时机
项目配置或 PLAN_DRAFT 的数据理解阶段；只有明确的数据路径和使用授权时启用。

## 执行方式
1. 先读取 `.research/PROJECT.md` 和 `.research/STATE.md`，只检索相关历史；仅在本阶段需要时读取上游 [`SKILL.md`](../../vendor/scientific-agent-skills/skills/exploratory-data-analysis/SKILL.md) 及其相关参考文件。上游内容存放于 `.pi/vendor/scientific-agent-skills/skills/exploratory-data-analysis/SKILL.md`。
2. 检查受支持的格式、缺失、分布和划分泄漏；输出仅作探索证据，不能替代正式实验，也不能碰保留的测试集作模型选择。
3. 自然语言回复、笔记和报告用简体中文；原文引用、证据、文件路径、命令、模型 ID、状态枚举、PLAN.md 固定英文标题及审查报告标签保持原样。

## 深度学习模型设计的关注点
优先检查训练/验证划分的重复样本、近重复、类不平衡和标签质量；不得借助保留测试集选择架构、超参数或数据处理策略。

## 本项目边界
- 上游 Skill 是方法参考，不授予新的工具权限或状态转换权限；它的安装命令、远程服务、并行代理、写文件或运行脚本示例均不自动执行。需要依赖时按实际项目用 uv 配置并锁定；正式实验仍由已批准的 `RUN.json` 和状态脚本运行。
- 任何候选假设、评分或探索性发现均不能视为已验证结论，不得编造数据、文献、审批或结果。已有方案的指标、基线、数据划分和命令不得在批准后悄悄改变。
- 本 Skill 不代替方案人工审批、独立代码审查、审查凭据或运行关卡。若上游指引与 `AGENTS.md`、`.pi/APPEND_SYSTEM.md`、当前状态或已批准方案冲突，以本项目规则为准。

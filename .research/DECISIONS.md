# 研究决策

每项重要决策均需记录日期、实验 ID、证据文件、commit、备选方案和理由。不得将尚未运行的假设视为结论。

## 2026-10-31：ARIS 入口迁移与模型策略

- 实验 ID：不适用；工作流基础设施决策，真实研究状态仍为 `IDLE`。
- 决策来源：用户在本次会话明确要求 ARIS 接替现有五个 K-Dense 方法 Skill 的入口，并沿用 DeepSeek Flash／Pro、记录审计差异。
- 证据文件：`docs/superpowers/specs/2026-10-31-aris-workflow-adapter-design.md`，为待审设计，尚未实现或获科研方案批准。
- 决策时基线 commit：`94fc439414d306fe41190572ee71108870088531`。
- 备选方案：保留两套方法入口并存；改用跨模型家族 Reviewer。用户选择替换入口并保留现有模型组合，以复用 ARIS 方法和当前 Pi workflow。
- 模型约束：Captain/Worker/Runner 为 `deepseek/deepseek-flash`／`low`；Reviewer 为 `deepseek/deepseek-v4-pro`／`high`。完整有效的 ARIS 审计如实记录 `same-family / provisional`，不标记为 `cross-family / accepted`；本地代码关卡与上游审计接受状态分别记录。
- 当前进度：仅记录已确认方向并准备可审阅设计；未替换入口、未启用自动实验、未运行付费模型或科研实验。

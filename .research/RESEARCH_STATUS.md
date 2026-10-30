# Research status — 2026-10-30

## Question

在 CPU、2 线程、每模型 3 epoch、≤100,000 参数、单 seed 的约束下，轻量 CNN（卷积 + MLP 头）能否在 MNIST 上达到 ≥98% 测试准确率，并优于同预算纯 MLP 基线？

## Recorded scientific evidence

- `.research/experiments/EXP-0001/PLAN.md` / `RUN.json`：已批准并提交的计划与正式命令；plan commit `b71c3fe135362856f950392eb395963c55c8543f`，SHA256 `da7401c5b07e169ed9fa4d5e2ef137c44eee281dda0dfb78ef82a8579f52f2c3`。
- `.research/experiments/EXP-0001/PLAN_REVIEW.md`：真实用户 APPROVE，经前台 checkpoint `research-plan-review-mvv1119r-ex46hw` 转达。
- `.research/experiments/EXP-0001/CODE_REVIEW.md`：初次独立审查 PASS；`.research/experiments/EXP-0001/REVIEW-b578aef-readonly-cli.md`：严格只读 CLI 补充复审 PASS。
- `.research/experiments/EXP-0001/EXECUTION.md`：`success`，exit 0；execution commit `b578aef217891d13d15697547562fdcb07d7a859`。
- `.research/experiments/EXP-0001/RESULTS.md`：CNN 一次性测试准确率 **0.9868**（≥0.98），最终验证 **0.9856**；MLP 测试 **0.9677**，验证 **0.9660**；3 epoch 各曲线、参数、耗时与峰值 RSS 已记录。
- `.research/experiments/EXP-0001/DECISION.md`：本轮 **CONTINUE** 后结束；H-0001 仅在本次 seed 与配置下得到支持。
- `.research/HYPOTHESES.md`：H-0001 状态 `supported (single seed/config)`。
- `.research/DECISIONS.md`：基础设施规则调整与 EXP-0001 结果决策均已记录。

关键实测值：

| 模型 | 参数量 | 最终验证 | 一次性测试 |
| --- | --- | --- | --- |
| CNN | 80,602 | 0.9856 | **0.9868** |
| MLP | 76,330 | 0.9660 | 0.9677 |

- 正式运行：in-process `54.306 s`，wrapper 约 `56.393 s`，峰值 RSS `476.1 MiB`；CPU-only、2 线程、seed 42。
- 测试集只读取一次（`count=1`, `stage="final"`）；未发现协议违规。
- 安装与数据下载单列：`uv sync` `35.7 s`，缓存增长约 `+888 MiB`（非准确网络流量）；MNIST 压缩文件 `11,594,722 bytes`。

## Uncertainty

- 只有单 seed、单次运行；不能估计方差、置信区间或统计显著性，不能外推为普遍结论。
- 固定 3 epoch，两个模型均未证明收敛。
- MLP 测试准确率 `0.9677` 低于计划预期区间 `97.2%–98.4%`；已如实记录，不通过重跑或调参补救。
- CPU 逐位可复现性未跨机器验证；split digest 使用本机字节序。

## Workflow validation status（与科学结果分开）

- 基础设施规则已按用户授权调整为“不同具体模型”：reviewer `deepseek/deepseek-v4-pro`，worker/runner `deepseek/deepseek-flash`；基础设施 commit `c4dfbbc`。
- **仍未修复的缺陷**：Pi 1.4 + pi-dynamic-workflows 3.14.0 下，named reviewer 的声明式只读工具策略未真正限制内置工具，实际发生成功 `bash` 调用（FAIL-0001）。已用显式 `--tools read,grep,find,ls --no-extensions --no-mcp` 的全新上下文补充审查作为 containment，但**不能声称插件已修复**，也不能声称初次 reviewer 实际只读。
- **进度可见性局限**：`run` helper 使用同步子进程，运行期间 STATE 仍为 `READY_TO_RUN`，结束后才保存日志与状态；未修复，未做并发实验。
- 详细阶段记录与本地链接见 `.research/WORKFLOW_VALIDATION.md`；原始输入/输出/日志在 `outputs/workflow-validation/`（不提交 Git）。

## Current state

`EXP-0001` 本轮已结束，workflow 由 helper 的 `decide CONTINUE` 返回 `IDLE`；没有当前实验，没有正在运行的训练。`execution_commit` 保持为 `b578aef…`；最终 docs 提交只归档研究记录。

## Next action

没有自动下一轮。若未来继续，必须先新建实验、重新写计划并取得真实人工批准；不得直接复用本轮测试集做“确认”或调参。优先考虑修复 reviewer 工具策略与 run 进度可见性等 workflow 缺陷，且应作为独立基础设施提交并独立审查。

## References

- Plan commit: `b71c3fe135362856f950392eb395963c55c8543f`
- Implementation / review / execution commit: `b578aef217891d13d15697547562fdcb07d7a859`
- Infrastructure commit: `c4dfbbc`
- Final docs commit: 由 `git log` 给出，不改变 execution commit。

# Research status — 2026-10-30

## Question

在 CPU、2 线程、每模型 3 epoch、≤100,000 参数、单 seed 的约束下，轻量 CNN（卷积 + MLP 头）能否在 MNIST 上达到 ≥98% 测试准确率，并优于同预算纯 MLP 基线？

## Recorded evidence

- `.research/PROJECT.md`：科学问题、数据、环境、指标和风险已由 researcher 需求填写；尚无实现或结果。
- `.research/experiments/EXP-0001/PLAN.md`：固定数据划分、精确网络结构、优化器、seed、运行命令、预算和失败判据。
- `.research/experiments/EXP-0001/RUN.json`：正式命令仅包含训练/验证/一次性测试，安装与数据下载单列。
- `.research/DECISIONS.md`：Reviewer 独立性规则调整（不同具体模型，规范化 openrouter 前缀）及授权记录。
- 当前没有任何已执行实验、准确率或训练日志；不得从计划推断结果。

## Uncertainty

- 98% 目标是否在 3 epoch 内达成未知；单 seed 无法给出方差。
- 首次安装与 MNIST 下载的耗时/体积尚未测量。
- 实现与独立审查尚未发生。

## Current state

`EXP-0001`，workflow_state `PLAN_DRAFT`；尚未提交计划或提交审批。

## Next action

提交项目配置与 `PLAN.md`/`RUN.json`，运行 `node scripts/research-workflow.mjs submit-plan`，然后停在 `PLAN_REVIEW` 等待真实人工审批。不得调用 implementation worker 或执行训练。

## References

- Plan commit/hash: 由 `submit-plan` 写入 `.research/STATE.md`。
- Infrastructure commit: `c4dfbbc`。

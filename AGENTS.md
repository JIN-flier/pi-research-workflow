# Pi Agent 科研项目

本仓库是科研工作流骨架。科学问题、数据、源代码和实验命令尚未提供；项目具体信息以 `.research/PROJECT.md` 为准。

## 输出语言

面向用户的回复、进度说明及方案、审查、分析、决策和交接记录的自然语言正文必须使用简体中文，委派给子代理时也须传递此要求。文件路径、命令、代码标识符、JSON/YAML 字段名、模型 ID、哈希、状态/决策枚举、`Research role:` 标记、PLAN.md 的十个固定英文二级标题、审查报告固定英文字段标签和 `Pending.` 待填写标记保持原样。引用原文和原始日志可保留原语言，配中文说明，不得改写原始证据。

## 开始或恢复

先读取 `.research/PROJECT.md`，再读取 `.research/STATE.md`。检索 `.research/DECISIONS.md`、`.research/HYPOTHESES.md`，且只检索相关实验/失败记录。仅在对应阶段启用时加载 `.pi/skills/` 中的 Skill。不得默认加载全部文献或实验。

## 环境与目录

- 当前环境提供 Pi 1.4.0 和 Node.js 24。
- `.pi/agents/` 包含供 `pi-dynamic-workflows` 使用的四种具名代理类型；研究审计员与代码审查员分别捕获凭据。
- 方法入口为 `.pi/skills/aris-*/`，固定上游在 `.pi/vendor/aris/`。使用前读取 `.pi/aris/ADAPTER.md` 并通过转接器检查阶段与能力；上游脚本和工具声明不授予执行权限。DeepSeek Flash/Pro 研究审计记录 `same-family / provisional`，不冒称 ARIS 跨家族接受。
- `.research/experiments/EXP-XXXX/` 保存每轮的方案、审查、实现、执行、结果和决策。
- `scripts/research-workflow.mjs` 强制执行状态与 Git 检查。`outputs/EXP-XXXX/` 保存运行日志。
- Python 科研项目使用 uv；按实际项目选择 Python 版本与依赖，提交环境配置和锁文件，并忽略 `.venv`。

## 实验与 Git 规则

填写 `PLAN.md` 和 `RUN.json`，提交两者，然后运行 `node scripts/research-workflow.mjs submit-plan`。人工审查以前台 Pi workflow 运行 `.pi/workflows/plan-review.workflow.js`；未回答或无界面模式必须中止。使用 `record-plan-review` 记录明确决定，包含理由与 workflow 运行 ID。未达到 `PLAN_APPROVED` 前不得运行实现代理。

Worker 仅提交已批准范围内的代码变更，并调用 `record-implementation MODEL`。Reviewer 使用 `independent-code-reviewer` 检查准确 commit 和已批准方案，然后调用 `record-review VERDICT MODEL RECEIPT_PATH "SUMMARY"`。只有当前 commit 获得 PASS 后才能 `run`。最多允许两轮 CHANGES_REQUIRED。方案变化必须重新进行方案审批；代码变化必须重新独立审查。不得修改基线或在批准后悄悄修改 `RUN.json`。

Reviewer 仅有只读 Pi 工具；Runner 仅允许通过受关卡约束的 `run` 命令运行。Pi 工具白名单不是操作系统沙箱。绕过 `scripts/research-workflow.mjs` 的命令属于正式实验工作流之外的操作。

## 项目具体信息缺失时

首个方案之前，研究者必须补充科学问题、数据、基线、指标、风险，以及真实的 `RUN.json` 命令。STATE.md 为 IDLE 且无当前实验时，通过状态脚本的 `new` 命令创建实验。不得编造结果或将占位方案标为已批准。

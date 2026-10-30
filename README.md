# Pi Agent research workflow (Phase 2–4)

本工程提供项目记忆、五个科研 Skills、三个 Subagents，以及实验方案人工审批和独立代码审查两道关卡。当前没有活动实验；研究问题、数据、代码和运行环境由真实项目初始化。

## 初始化研究项目

1. 填写 `.research/PROJECT.md`：科学问题、目标、已有工作、数据来源、Baseline、评价指标、资源限制及风险。
2. 在项目根目录启动 `pi -a`，让 Research Captain 读取 PROJECT.md 和 STATE.md，按需使用科研理解、文献调查和假设设计 Skills。
3. 检查 `.pi/agents/` 中的模型配置及凭据。Worker 与 Reviewer 必须使用不同具体模型；同一厂商的不同模型可以配对，脚本会规范化大小写和 `openrouter/` 路由前缀，防止同一模型换路由冒充。Reviewer 不可用时保持待审状态。
4. Python 项目使用 uv 管理环境；按项目需要选择 Python 版本和依赖，提交 `pyproject.toml`、`.python-version` 和 `uv.lock`，忽略本地 `.venv`。运行命令写入每轮实验的 RUN.json。

## 创建与执行一轮实验

当前 STATE.md 为 `IDLE`，`current_experiment` 为 `null`。配置好项目后创建首轮实验：

```bash
node scripts/research-workflow.mjs new EXP-0001
```

该命令生成独立实验目录和记录模板，并进入 `PLAN_DRAFT`。

1. 完成 PLAN.md 的十个部分和 RUN.json 中的准确命令，提交 Git 后运行 `node scripts/research-workflow.mjs submit-plan`。
2. 在交互式 Pi 中输入 `/research-plan-review`。审批使用前台 checkpoint；APPROVE 才允许实现，REVISE 返回设计，REJECT 终止本轮，无交互时中止。
3. 调用 `implementation-worker` 实现已批准方案，完成必要测试并提交代码，用 `record-implementation MODEL` 登记实际模型与 commit。
4. 将已批准方案、准确 Git diff 和 commit 传给独立上下文的 `independent-code-reviewer`，保存真实报告并通过 `record-review` 登记 verdict。代码变动后必须重审；最多两轮自动修复。
5. 只有当前 commit 审查 PASS 后，Runner 才能通过 `check-run` 和 `run` 执行批准命令。日志保存在 `outputs/实验ID/`，执行状态和 commit 写入 EXECUTION.md。
6. 使用 result-analysis 和 research-decision Skills 完成 RESULTS.md、DECISION.md，更新项目假设与决策记忆，通过 `decide` 命令结束本轮。

完整命令接口见 [.research/workflow/README.md](.research/workflow/README.md)。正常操作优先查命令说明，遇到具体错误再检查实现源码。

### 模型独立性规则的授权调整

经用户明确授权（2026-10-30，workflow 验证任务），本仓库把原先的“跨模型家族”校验放宽为“不同具体模型”：Reviewer 固定为 `deepseek/deepseek-v4-pro`，Worker/Runner 固定为 `deepseek/deepseek-flash`。脚本统一小写并剥离 `openrouter/` 前缀后比较，因此 `openrouter/deepseek/deepseek-flash` 与 `deepseek/deepseek-flash` 会被判为同一模型。代价是 Reviewer 与 Worker 可能共享同一厂商的训练与偏好，独立性弱于跨厂商家族审查；补偿措施是独立上下文、只读工具、精确 commit 审查和人工方案审批保持不变。其他关卡未改动。

## 记忆与关卡

新 Session 以 `.research/PROJECT.md`、`.research/STATE.md` 为入口，仅检索相关决策、假设、实验与失败记录。核心脚本检查方案版本、审查模型是否为不同具体模型、修复次数、代码工作区及实现/审查/执行 commit 一致性。

Pi 的工具白名单不构成操作系统沙箱。正式实验统一通过状态脚本的 `run` 入口执行。本项目提供 Phase 2–4 基础设施，完整科研循环由后续编排扩展。

## 验证 workflow

需要 Node.js 24、Pi CLI 和已安装的 `@quintinshaw/pi-dynamic-workflows@3.14.0`：

```bash
node --test tests/pi-config.test.mjs tests/workflow.test.mjs
```

测试覆盖真实 Pi 解析器、人工审批分支、只读工具策略、状态关卡和 commit 校验。测试使用临时目录，不生成项目实验记录。

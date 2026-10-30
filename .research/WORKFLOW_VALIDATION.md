# WORKFLOW VALIDATION — 从真实用户视角验证 Pi research workflow

- 日期：2026-10-30
- 项目：PROJECT-001 / EXP-0001
- 目的：用一次真实的科学实验验证本仓库的 Pi research workflow，而不是只跑单元测试或演示脚本。
- 结论摘要：科学实验完成并得到可用结果；workflow 在**规则适配 + 严格只读 CLI 补充审查**后完成验证，但**不能称原插件路径全部通过**。已发现的 reviewer 工具策略缺陷未修复，只做了 containment。

## 0. 总体阶段与版本

| 阶段 | 实际角色 / 模型 / thinking | 结果 | 关键 commit / run ID |
| --- | --- | --- | --- |
| 01 准备与基础设施修复 | Captain `deepseek/deepseek-flash` / low | 完成规则适配、PROJECT/PLAN/RUN、进入 `PLAN_REVIEW` | 基础设施 `c4dfbbc`；计划 `b71c3fe` |
| 02 人工计划审批 | 前台 Pi `deepseek/deepseek-flash` / low；人类用户决定 | APPROVE 精确 plan commit/hash | checkpoint `research-plan-review-mvv1119r-ex46hw` |
| 03 实现 | Captain flash；worker `deepseek/deepseek-flash` / low | 单 commit 实现，30 单测通过；真实数据冒烟发现并修复 sampler 双重索引错误 | implementation `b578aef`；workflow run `exp0001-implement-mvv14ht7-nb6oo5` |
| 04 初次独立审查 | Captain flash；reviewer `deepseek/deepseek-v4-pro` / low | 返回 PASS；但实际工具事件包含成功 `bash`，不符合声明的只读策略 | run `exp0001-independent-code-review-mvv1d23w-elr1sd` |
| 05 严格只读 CLI 补充审查 | 全新上下文 `deepseek/deepseek-v4-pro` / low | PASS；完整事件仅 `read/grep/ls`，13 次调用 | session `01a18d1e-b4bc-712b-a88d-e13d1efdb3c4` |
| 06 正式执行 | runner `deepseek/deepseek-flash` / low | `check-run` 后仅通过 gated `run` 执行一次；exit 0；wrapper ≈56.4 s | execution commit `b578aef`；session `01a18d21-e516-7292-85ee-362c103e2930` |
| 07 结果分析与归档 | Captain `deepseek/deepseek-flash` / low | 写 RESULTS/DECISION，更新研究记忆，调用 `decide CONTINUE` 结束本轮 | 不改变 `b578aef` |

全部原始记录入口：

- [COMMANDS.md](../outputs/workflow-validation/COMMANDS.md)
- [TRANSCRIPT.md](../outputs/workflow-validation/TRANSCRIPT.md)
- [APPROVAL-RELAY.md](../outputs/workflow-validation/APPROVAL-RELAY.md)
- 各阶段 `*.input.md` / `*.output.md` / `*.events.jsonl` / `*.stderr.log`
- 会话原始 JSONL：`outputs/workflow-validation/sessions/`、`outputs/workflow-validation/review-sessions/`

## 1. 阶段 01 — 准备、规则适配、计划

**实际动作**

- 读到仓库最初要求“reviewer 与 worker 属于不同模型家族”，而当前只配置了 DeepSeek 两个模型，两者冲突。
- 用户明确授权“允许修改为不同具体模型，继续完整验证”。据此做独立基础设施提交 `c4dfbbc`：reviewer 改为 `deepseek/deepseek-v4-pro`，worker/runner 保持 `deepseek/deepseek-flash`；校验改为比较规范化后的具体模型（小写并剥离 `openrouter/` 前缀），防止同一模型换路由冒充不同模型。未改其他 gate、全局配置或凭据。
- 该修复有先失败后通过的真实 Node 测试；全量 `node --test tests/*.test.mjs` 为 14 pass / 0 fail。
- 用 helper `new EXP-0001` 创建实验，填写 PROJECT、PLAN、RUN；`submit-plan` 后停在 `PLAN_REVIEW`。本阶段未实现、未安装研究依赖、未训练。

**结果**：PLAN commit `b71c3fe135362856f950392eb395963c55c8543f`，PLAN SHA256 `da7401c5b07e169ed9fa4d5e2ef137c44eee281dda0dfb78ef82a8579f52f2c3`；STATE `PLAN_REVIEW`。

**证据**：[01-prepare.input.md](../outputs/workflow-validation/01-prepare.input.md)、[01-prepare.output.md](../outputs/workflow-validation/01-prepare.output.md)、[01-prepare.events.jsonl](../outputs/workflow-validation/01-prepare.events.jsonl)、session `01a18d0c-ffc8-77b0-abbf-f28bb70b4753`。

## 2. 阶段 02 — 真实前台人工审批

**实际动作**

- 用户在看到具体 plan commit/hash 后，在 Codex 聊天中明确答复 APPROVE；操作者将该答复转达到 Pi 前台 checkpoint。
- 真实前台 workflow 为 `.pi/workflows/plan-review.workflow.js`，`background:false`；checkpoint 返回：
  `{"decision":"APPROVE","experimentId":"EXP-0001","planCommit":"b71c3fe…","planSha256":"da7401c5…"}`
- 随后执行 `record-plan-review APPROVE human "checkpoint research-plan-review-mvv1119r-ex46hw: …"`，写入 [PLAN_REVIEW.md](./experiments/EXP-0001/PLAN_REVIEW.md)。

**边界**：这不是模型自行审批，也不是 Captain 代签。无响应或 headless 中止按规则必须保持待审，本轮没有把模型写成 human reviewer。

**证据**：[02-plan-review.input.md](../outputs/workflow-validation/02-plan-review.input.md)、[02-plan-review.output.md](../outputs/workflow-validation/02-plan-review.output.md)、[02-plan-review.events.jsonl](../outputs/workflow-validation/02-plan-review.events.jsonl)、[02-plan-review.terminal.log](../outputs/workflow-validation/02-plan-review.terminal.log)、[APPROVAL-RELAY.md](../outputs/workflow-validation/APPROVAL-RELAY.md)。

## 3. 阶段 03 — 实现（包含真实错误与修复）

**实际动作**

- 通过真实 workflow `exp0001-implement-mvv14ht7-nb6oo5` 调用一次 `implementation-worker`，模型 `deepseek/deepseek-flash` / low，`isolation:false`。
- Worker 在分支 `codex/exp-0001-implementation` 上实现并提交 `b578aef217891d13d15697547562fdcb07d7a859`；只改实现所需文件，未改 PLAN/RUN/gate。

**必须保留的真实失败/修复记录**

- 30 个单元测试在实现后全部通过时，**仍然存在一个真实数据加载错误**。第一次用本地 MNIST 做非正式冒烟检查时抛出：
  `IndexError: list index out of range`（`torch/utils/data/dataset.py` 的 `Subset.__getitems__`）。
- 根因：训练 loader 被写成 `DataLoader(Subset(dataset, list(indices)), sampler=SubsetRandomSampler(list(indices)))`，sampler 返回的已是子集绝对索引，又被 `Subset` 二次映射，形成双重索引。
- Worker 在实现提交前自行修正为 `DataLoader(dataset, sampler=SubsetRandomSampler(list(indices)))`；评估 loader 保持 `Subset(..., shuffle=False)`。修正后才通过真实数据冒烟与 30 单测。
- 这件事说明“单测全绿”不等于“真实数据路径正确”；不得把本轮写成“首次实现无错误”。测试盲区（单测不加载真实 MNIST、不迭代真实 loader）仍保留在实现报告中。

**证据**：[03-implement.input.md](../outputs/workflow-validation/03-implement.input.md)、[03-implement.output.md](../outputs/workflow-validation/03-implement.output.md)、[03-implement.events.jsonl](../outputs/workflow-validation/03-implement.events.jsonl)、[IMPLEMENTATION.md](./experiments/EXP-0001/IMPLEMENTATION.md)、session `01a18d12-a7d3-755e-b0dd-583548e1e2bd`。

## 4. 阶段 04 — 初次独立审查及其证据问题

**实际动作**

- Captain 用真实 git diff 生成 [IMPLEMENTATION.diff](./experiments/EXP-0001/IMPLEMENTATION.diff)，核对 HEAD = `b578aef`、plan hash 一致、代码工作区干净。
- 通过 workflow `exp0001-independent-code-review-mvv1d23w-elr1sd` 调用一次 `independent-code-reviewer`，模型 `deepseek/deepseek-v4-pro` / low，`isolation:false`。
- 返回 PASS，5 项均为 NON-BLOCKING；`record-review PASS deepseek/deepseek-v4-pro` 后进入 `READY_TO_RUN`。原始报告保存在 [REVIEW-b578aef.md](./experiments/EXP-0001/REVIEW-b578aef.md)。

**真实缺陷，不得淡化**

- 事件日志显示该 reviewer 实际成功调用了 `bash`，执行了 Git 检查等命令；角色声明只允许 `read,grep,find,ls`，但实际能力更宽。
- Captain 最初把报告中的 `git show`/`git diff`/`git status` 误解释为“没有实际使用工具的证据瑕疵”，该说法已被外层纠正：reviewer **确实拥有并使用** `bash`。原始报告保留不改，更正写入 [FAIL-0001](./failures/FAIL-0001-reviewer-tool-policy.md) 和 [CODE_REVIEW.md](./experiments/EXP-0001/CODE_REVIEW.md)。
- 根因（源码检查）：插件 `src/agent.ts` 把 `applyToolPolicy` 过滤后的工具作为 `customTools` 传给 Pi 1.4 SDK，但未把角色 allowlist 应用到控制最终活动工具集的 SDK `tools`/`noTools` 选项；Pi 1.4 的 `customTools` 是追加工具，不排除默认内置工具。现有 14 个测试只测过滤结果，没有测真实 SDK 子会话的最终工具集。
- **该插件缺陷未修复**。本轮没有全局 patch 包，也没有宣称已修复。

**证据**：[04-review.input.md](../outputs/workflow-validation/04-review.input.md)、[04-review.output.md](../outputs/workflow-validation/04-review.output.md)、[04-review.events.jsonl](../outputs/workflow-validation/04-review.events.jsonl)、[FAIL-0001](./failures/FAIL-0001-reviewer-tool-policy.md)、session `01a18d18-db0a-752e-bad8-88639bf5752c`。

## 5. 阶段 05 — 严格只读 CLI 补充审查（containment，不是修复）

**为什么做**：初次 named-agent 审查的只读工具隔离未生效，外层因此没有立即训练。为了在不运行训练的前提下获得一份真正只读的独立复审，用真实 Pi CLI 新上下文重新审查**同一个未改动的 commit**。

**实际命令形态**（记录于 input / session，未修改原始日志）：

```text
pi -a --model deepseek/deepseek-v4-pro --thinking low --mode json \
  --tools read,grep,find,ls --no-extensions --no-mcp \
  --append-system-prompt <independent-code-reviewer role> \
  --session-dir outputs/workflow-validation/sessions \
  -p @outputs/workflow-validation/05-readonly-review.input.md
```

**结果**

- 新上下文 `deepseek/deepseek-v4-pro` / low 返回 PASS。
- 完整事件审计：实际工具名只有 `read`、`grep`、`ls`，共 13 次调用；没有 `bash`/`edit`/`write`，没有模型委派。
- 报告保存为 [REVIEW-b578aef-readonly-cli.md](./experiments/EXP-0001/REVIEW-b578aef-readonly-cli.md)。
- 实现、PLAN、RUN 未改动；这是**补充证据**，不是第二次 `record-review`。初次 helper 的 PASS 仍保留在状态历史中；没有编造第二个 helper 调用。
- 不能据此说“插件已修复”；正确说法是“通过显式 CLI 工具集把插件缺陷 containment 住，并得到一份可审计的只读复审”。

**证据**：[05-readonly-review.input.md](../outputs/workflow-validation/05-readonly-review.input.md)、[05-readonly-review.output.md](../outputs/workflow-validation/05-readonly-review.output.md)、[05-readonly-review.events.jsonl](../outputs/workflow-validation/05-readonly-review.events.jsonl)、[REVIEW-b578aef-readonly-cli.md](./experiments/EXP-0001/REVIEW-b578aef-readonly-cli.md)、session `01a18d1e-b4bc-712b-a88d-e13d1efdb3c4`。

## 6. 阶段 06 — 正式执行

**实际动作**

- Runner 使用严格 Pi CLI 工具集加载 `experiment-runner`，模型 `deepseek/deepseek-flash` / low，只允许两条 bash 命令：`check-run` 与 gated `run`。
- `check-run` 通过（无输出），随后执行 `node scripts/research-workflow.mjs run; echo "EXIT_STATUS=$?"`。注意：附加的 `echo` 是 runner 为捕获退出码而加的，训练命令本身未改变。
- 实际执行 commit `b578aef`，exit 0，wrapper `56.4 s`，stderr 空；训练与一次性 final 测试完成。
- 安装与数据下载在正式 run 之外单独计量；缓存增长约 888 MiB **不是准确网络流量**，MNIST 压缩文件为 11,594,722 字节。

**进度可见性局限**

- `run` helper 使用同步子进程：运行期间 STATE 仍显示 `READY_TO_RUN`，stdout/stderr/状态只在结束后落盘。因此运行中无法从 STATE 判断进度。
- 本轮只记录该局限，**不声称已修复**，也没有做并发或并行实验。

**证据**：[06-run.input.md](../outputs/workflow-validation/06-run.input.md)、[06-run.output.md](../outputs/workflow-validation/06-run.output.md)、[06-run.events.jsonl](../outputs/workflow-validation/06-run.events.jsonl)、[EXECUTION.md](./experiments/EXP-0001/EXECUTION.md)、[metrics.json](../outputs/EXP-0001/metrics.json)、session `01a18d21-e516-7292-85ee-362c103e2930`。

## 7. 阶段 07 — 结果分析与归档

- 只分析已有真实证据，不训练/不重跑/不调参；写 [RESULTS.md](./experiments/EXP-0001/RESULTS.md) 与 [DECISION.md](./experiments/EXP-0001/DECISION.md)。
- 结果：CNN test 0.9868、val 0.9856；MLP test 0.9677、val 0.9660；参数量 80,602 / 76,330；in-process 54.306 s，peak RSS 476.1 MiB。
- 结论：H-0001 仅在 seed 42 与本次配置下得到支持；不能声称统计显著或普遍结论。
- 用 helper `decide CONTINUE` 正式结束本轮；`CONTINUE` 只表达未来研究建议，不自动运行下一轮。
- 最终 docs 提交只包含 `.research` 归档，不包含 `outputs/`、`data/`、`.venv`，不改变 `execution_commit=b578aef…`。

**证据**：[07-analyze.input.md](../outputs/workflow-validation/07-analyze.input.md)、[07-analyze.events.jsonl](../outputs/workflow-validation/07-analyze.events.jsonl)、session `01a18d24-653d-72c0-a940-6727279557c1`。

## 8. 已适配的事项

1. **不同具体模型规则**：解决了“跨模型家族 gate 与仅 DeepSeek 配置冲突”；reviewer 与 worker 使用不同具体模型，且防止同模型换路由冒充。独立提交 `c4dfbbc`，未绕过科学计划审批。
2. **人工审批转达**：真实用户对精确 plan commit/hash 明确 APPROVE，再由前台 checkpoint 转达，没有让模型自批。
3. **严格 CLI 工具集 containment**：对 reviewer 与 runner 使用显式 `--tools`、`--no-extensions`、`--no-mcp`，把插件工具策略缺陷隔离在可审计路径内。
4. **commit/hash 与 gate 校验**：plan hash 重新计算、HEAD=implementation=reviewed=executed、`check-run` 通过；正式执行只经 gated `run`。
5. **真实数据冒烟**：在实现提交前发现并修正 sampler 双重索引；没有把 30 单测全绿当成真实数据路径已验证。

## 9. 尚未修复的缺陷

1. **reviewer 工具策略未真正隔离（FAIL-0001）**：Pi 1.4 + pi-dynamic-workflows 3.14.0 下，named reviewer 的实际工具集包含默认内置 `bash`。插件未修复；严格 CLI 只是 containment。不能用“初次 reviewer 只读”或“插件已修复”来描述本轮。
2. **初次 review 的证据描述被 Captain 误读**：Captain 曾把实际 `bash` 调用说成“没有实际使用工具的证据瑕疵”；该说法已纠正并保留原始报告。外层随后没有据此训练。
3. **`run` 进度不可见**：同步子进程导致运行期间 STATE 仍为 `READY_TO_RUN`，日志/状态结束后才落盘；未修复，未做并发实验。
4. **补充审查报告的行号不精确**：模型生成的补充报告有少量行号偏差；以源码/diff 为权威证据，不据此扩大结论。
5. **实现层非阻塞问题仍在**：部分 config 字段是信息性字段、`validate_metrics` 未逐模型绑定 test_accuracy、digest 字节序未注明等。它们不改变本轮结果，但应在未来独立修复并审查。

## 10. 简要评价

本轮验证**完成了**：计划审批、实现、独立审查、正式执行、结果分析和记忆归档都留下了真实证据，科学问题得到可用回答。

但必须准确表述为：**经规则适配与严格 CLI 补审后完成验证，不能称原插件路径全部通过。** 原 plugin 的 reviewer 工具隔离存在真实缺陷且未修复；本轮通过显式 CLI 只读复审和 gated runner 做了可审计的 containment。把这次验证描述成“workflow 全流程无缺陷”是不准确的。

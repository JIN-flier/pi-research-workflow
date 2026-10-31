# 工作流状态

`../STATE.md` 是恢复入口。状态脚本为 `scripts/research-workflow.mjs`；状态转换统一使用其命令。Pi 审批脚本为 `.pi/workflows/plan-review.workflow.js`，必须以前台方式运行。

ARIS 的 37 个方法入口通过 `.pi/aris/manifest.json` 和 `scripts/aris-adapter.mjs` 接入，操作见 [ARIS.md](ARIS.md)。先 prepare，再按结构化角色和能力交接，完成后 verify。研究审计使用新鲜的 `independent-research-auditor`、`research-audit.workflow.js` 和独立凭据；不写代码审查凭据、不推进实验状态。仍沿用 DeepSeek Flash/low、Pro/high，研究审计如实标记 same-family/provisional。

## 日常命令参考

在项目根目录运行 `node scripts/research-workflow.mjs COMMAND`。日常操作查阅本参考，不必读取状态脚本实现。

| 命令与参数 | 必需状态 | 结果 |
| --- | --- | --- |
| `status` | 任意 | 输出 STATE.md，不修改状态 |
| `new EXP-0001` | IDLE | 创建首轮实验模板并进入 PLAN_DRAFT；后续轮次使用尚未占用的 ID |
| `submit-plan` | PLAN_DRAFT | 检查已提交的 PLAN.md/RUN.json，进入 PLAN_REVIEW |
| `record-plan-review DECISION human "checkpoint RUN_ID: 理由"` | PLAN_REVIEW | 记录人工实际作出的 APPROVE、REVISE 或 REJECT 决定 |
| `record-implementation MODEL` | PLAN_APPROVED 或 IMPLEMENTATION_REVISION | 检查已批准方案和干净的代码 commit，进入 CODE_REVIEW |
| `record-review VERDICT MODEL RECEIPT_PATH "摘要"` | CODE_REVIEW 或尚未执行的 READY_TO_RUN | 核验宿主捕获的报告/会话证据，记录实际结论 |
| `reopen-review "理由"` | CODE_REVIEW 或 READY_TO_RUN | 重新独立审查前，立即撤销此前的 PASS |
| `check-run` | READY_TO_RUN | 检查方案哈希、代码工作区干净，以及 HEAD/实现/审查 commit 一致 |
| `run` | READY_TO_RUN | 获取独占运行锁，进入 RUNNING，实时输出 stdout/stderr，记录退出码/信号，进入 ANALYSIS 或 EXECUTION_FAILED |
| `recover-run "理由"` | RUNNING，或带有遗留锁的 READY_TO_RUN | 记录的所有者或子进程组仍存活时拒绝恢复；否则将中断记录为失败，不重新运行 |
| `decide VERDICT "证据"` | ANALYSIS、REJECTED、EXECUTION_FAILED 或 HUMAN_INTERVENTION | 记录 CONTINUE、REVISE、ABANDON 或 INCONCLUSIVE，并返回 IDLE |

人工审批通过 `workflow` 工具完整运行 `.pi/workflows/plan-review.workflow.js`，设置 `background: false`。从 STATE.md 传入 `{ experimentId, planCommit, planSha256 }`；`export const meta` 必须是脚本第一条语句。脚本不调用模型代理。人工确认由 Pi 前台界面提供。

API 详情查阅已安装的 workflow-authoring Skill。只有具体错误无法通过本参考或 Skill 解决时，才查看实现 JS。工作流基础设施修复应单独提交；`.pi/` 变更仍属于相对批准方案 commit 的实现审查 diff。

## 中文输出与协议兼容

`.pi/APPEND_SYSTEM.md` 约束总协调者使用简体中文；四个代理的角色提示、本地阶段及 ARIS 适配入口、审批提示和审查工作流也明确要求中文正文。引用原文、必要术语和原始日志可保留原语言，配中文说明，不得改写原始证据。

文件名、路径、命令、JSON/YAML 字段名、模型 ID、哈希、状态与决策枚举、`Research role:` 标记及审查报告的固定英文字段标签保持原样。审查报告的前四行仍为 `Verdict:`、`Experiment:`、`Reviewed commit:`、`Reviewer model:`，后三项 `Findings:`、`Evidence:`、`Required changes:` 的说明正文使用中文。不得在前四个值后追加中文注释。

`new` 生成的 PLAN.md 提供十个固定英文二级标题的中文对照，正文用中文填写；保留英文标题以兼容现有完整性校验，不改变校验逻辑。其他记录使用中文标题及“待填写（Pending.）”，保留 `Pending.` 供未完成结果校验使用；填写正式分析时应替换待填写内容。模板中文说明不代表方案或结果已完成。

## SDK 兼容与审查证据

`.pi/extensions/research-workflow.ts` 是固定版本 3.14.0 插件在项目中的唯一入口。`.pi/settings.json` 的包配置禁用上游扩展但保留其 skills；本地入口使用现有原生 ESM 宿主 SDK 工厂接口，不修改全局包。每个具名角色开始处理提示词前，检查声明的模型、请求/实际 thinking 及最终工具集合。Reviewer 只能使用 read/grep/find/ls，补齐 Pi 1.4 默认 createCodingTools 未包含的工具，并排除上游共享存储工具。未知工具或 thinking 不匹配时，在发送提示词前中止。

默认配置：Captain/Worker/Runner 为 DeepSeek Flash / low；Reviewer 为 DeepSeek V4 Pro / high（SDK 检查显示 V4 Pro 支持 off/high/max 后，由用户明确选择）。保留代理正文中的 `Research role:` 标记。正常工作流编排不得使用 `--no-extensions`，因为这也会禁用兼容适配层。改变 Pi/插件版本后，必须重新运行 SDK 集成测试，才能宣称兼容。

准备准确的实现 diff，然后通过 workflow 完整运行 `.pi/workflows/code-review.workflow.js`，设置 `background:false`，传入当前实验/实现/方案/哈希/diff 参数。独立审查不得使用 `thread`。宿主在当前实验目录写入 `reviews/UUID.json`、`.md` 和 `.events.jsonl`。Captain 通过只读目录查询找到凭据，检查实际活动工具、调用、模型、请求/实际 thinking、commit 和报告，再将路径传给 record-review。凭据缺失、被修改、工具越权、模型/commit 错误或证据不完整均不得放行。check-run 重新核验凭据/报告/事件哈希。凭据是可信参与者的审计记录，不是操作系统沙箱，也不是对抗恶意写入者的签名。

## 实时执行与中断恢复

RUNNING 期间查看 STATE.md/status 及 `outputs/EXP-XXXX/stdout.log` / `stderr.log`。状态脚本也会通过调用工具实时输出两个流。run 后不得追加 `echo`、管道或掩盖失败的兜底命令。重复启动会被拒绝，且不会截断首次运行日志；已有 stdout/stderr 文件不会被覆盖。SIGINT/SIGTERM 转发给实验进程组并记录为失败；强制终止所有者进程会留下锁，须在记录的进程停止后显式恢复。不得删除锁来重试实验。

## 验证

`node --test tests/*.test.mjs` 包含真实 SDK 会话及基于进程内合成响应的 workflow 执行，不需要付费模型或网络。`node tests/manual/pi-workflow-smoke.mjs` 是需显式启动的付费 DeepSeek 冒烟测试，在临时合成项目中运行；每次调用将输入输出保存在 outputs/workflow-hardening 下，不属于自动测试套件。项目具体 Python 代码、环境配置和测试应随实际研究项目提供，当前尚未配置。

工作流修复的验证状态记录在 [HARDENING.md](HARDENING.md)。科研记忆与实验输出日志为空；此前通过的测试不代表后续适配层变更已经验证。

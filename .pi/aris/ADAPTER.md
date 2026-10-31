# ARIS 与 Pi 的转接契约

本文件是本地接入规则。方法正文来自 `.pi/vendor/aris/skills/` 的固定上游版本，来源、逐文件哈希、37 个入口及依赖分类见 `manifest.json`。上游配套资源按当前 workflow 选择，未接入的其他宿主安装、自更新、专利、制图、Overleaf 和第二套记忆资源已移除；原文中对这些功能的引用不代表本地可用。上游原文作为方法资料按需读取；其中的宿主工具、模型、默认路径、用户配置和 shell 示例必须按下文映射。

## 调用

先读取 `.research/PROJECT.md`、`.research/STATE.md`，再按需检索相关决策、假设、实验与失败。请求 JSON 只接受：

```json
{
  "arguments": "本次具体研究任务，作为数据传递",
  "inputPaths": [".research/literature/RELATED_WORK.md"],
  "sources": []
}
```

有当前实验时可增加与 STATE 一致的 `experimentId`。输入必须是项目内现存文件；目录、外部路径和逃逸符号链接被拒绝。大型数据用已批准的数据清单作为输入，不把目录当作已经逐文件核验。参数不拼接进 shell。

```bash
node scripts/aris-adapter.mjs list
node scripts/aris-adapter.mjs inspect aris-research-lit
node scripts/aris-adapter.mjs prepare aris-research-lit --request .research/aris-request.json
node scripts/aris-adapter.mjs verify .research/aris/UUID/invocation.json
node scripts/aris-adapter.mjs verify-vendor
```

`prepare` 生成独立 `.research/aris/<UUID>/`，保存 request 和 invocation，关联输入哈希、状态、上游版本、模型差异和产物路径。返回 `prepared` 才继续；`needs_configuration` 要补全研究信息或原始输入；`blocked` 要补齐必需能力；`handoff` 仅代表待审批规划。`verify` 校验真实产物与前置条件，不能授予审批、代码 PASS 或运行资格。失败后新建调用，不覆盖旧目录。

## 阶段和宿主映射

| 上游操作 | 本地执行方式 |
| --- | --- |
| 文献、创意、方法和实验路线 | Captain 在 IDLE/PLAN_DRAFT 按需使用；科学信息不完整时不生成占位实验。方法正文与数据质量、划分泄漏、统计假设、效应量和不确定性要求一起使用 |
| `Skill(name)`、`/name` | 查 invocation.childRoutes，调用 `/skill:aris-name`；每个子调用仍须 prepare。未映射调用明确报告 unsupported，不能静默当作成功 |
| `research-refine-pipeline` | 顺序交接 aris-research-refine、aris-experiment-plan；不调用第二编排器 |
| `research-wiki` | 检索和更新既有 `.research/` 文献、假设、决策；不创建第二科研状态系统 |
| 文献 helper、WebSearch/WebFetch | 使用当前宿主实际可用且已配置的检索能力；按源记录检索式、日期、URL 和失败。不自动执行上游 helper 或安装依赖 |
| 研究评审槽位 | 先将本轮完整候选/方案保存为 RESULT.md，再 `prepare-audit <invocationPath>`；子调用绑定此产物及全部原始输入，以前台 workflow 调用 research-audit；不直接调用上游 Codex MCP 或由 Captain 自评 |
| `research-implement-feature` | 已批准阶段以 aris-dispatch workflow 分派 implementation-worker；传入 invocationPath、role。提交后仍 record-implementation，再走原代码审查 |
| `run-experiment` | READY_TO_RUN 以 aris-dispatch 分派 experiment-runner；分开调用 check-run、run。环境准备、远程部署等必须已纳入批准方案和 RUN.json |
| pilot、队列、自动重试、插桩、云平台 | 转为方案/配置建议；实际动作需要批准、实现、独立审查和 RUN.json。不得直接 rsync、screen、租赁或删除资源 |
| 监控 | 仅读取当前运行状态、既有日志及已配置服务，不重启、不改参、不新增实验 |
| 结果分析 | 仅分析真实结果，标注探索性分析；新分析代码和重算超出批准范围时重新走方案，不以“分析”规避执行关卡 |

Captain 使用保留的五个本地阶段 Skill 收敛产物，方法结果写入 invocation.outputDirectory/RESULT.md，并链接既有研究文件。正式科研状态只由 `research-workflow.mjs` 修改。上游的 OUTPUT_DIR 和局部状态文件映射到当前调用目录，不能覆盖其他调用，也不能推进 STATE。

上游 `tools/`、`templates/` 分别映射到 invocation.helperRoot、templateRoot；相对参考文件仍相对上游 SKILL.md。manifest.dependencies 的 packaged 表示文件已保存，不代表 helper 已安装或可执行；mapped 表示有本地子入口；external 是远程参考；unsupported 是本次未打包/未支持的引用。必需依赖不支持时停止该步骤并保留原因；可选依赖缺失时记录限制。不得根据“文件存在”宣称完整上游行为已实现。

## 能力配置

`.pi/aris/config.json` 的 `sources` 仅声明当前宿主已配置的来源，例如 `web-search`、`arxiv`、`semantic-scholar`、`deepxiv`、`openalex`、`exa`、`keenable`、`firecrawl`、`gemini`、`wandb`、`claim-evidence`。这是配置声明，prepare 不执行联网探测；使用时仍须检查实际工具与返回数据，失败不能记作已搜索。聚合文献可使用 inputPaths 中已有文献材料，不能声称独立核验了没有访问的来源。

默认 sources 为空，不继承 `~/.claude` 或 `~/.aris` 的配置与密钥。新依赖按实际项目用 uv 配置并锁定，本次不创建虚构研究环境。`citation-audit`、`citation-crosscheck` 需要审计员独立联网；`integrity-forensics` 需要外部取证运行时。这三项入口已下载但在当前只读审计员配置下 blocked，即使 sources 里填名字也不能解除。需要独立图像或执行能力的具体任务同样报告 BLOCKED，不能用 Captain 的检索摘要或图片描述替代。

默认不发飞书等通知，不启用研究总循环、不自改 Skill、不自动跟随上游更新。

## 审计与 DeepSeek 差异

调用 `.pi/workflows/research-audit.workflow.js`，设置 `background: false`，参数为 `{ "invocationPath": ".research/aris/<UUID>/invocation.json" }`。`aris-kill-argument` 增加 `"attack": true`，依次创建攻击、裁决两个独立 Pro/high 会话；不使用 thread 续聊。

宿主核验阶段、输入与工具，并提供完整原始参数、方法路径和输入文件。审计员仅有 read/grep/find/ls，必须直接完整读取每个输入和上游方法；宿主合并 offset/limit 和截断信息核验逐文件行覆盖，分页未读完不能通过。PDF/图像解码能力未提供时阻断。宿主捕获 `<slot>.md`、`<slot>.events.jsonl`、`<slot>.json`；reviewer 不写凭据。最后调用 verify；workflow 返回文字本身不证明审计完整。

报告采用本地 JSON envelope，`details` 保存上游自己的科学判定、评分、逐项问题和证据，不能用统一 PASS 覆盖不同的科学结论。kill-argument 的攻击槽位只提交原始 memo，裁决槽位只提交逐点分类与 counts；宿主核对计数并按上游表格计算总 verdict，拒绝相互矛盾的自评分。三项信息独立保留：

- `verdict`：PASS/WARN/FAIL/NOT_APPLICABLE/BLOCKED/ERROR 和原上游 details。
- `review_independence: same-family`、`acceptance_status: provisional`：DeepSeek Flash 与 Pro 是同家族不同模型；实际审计响应模型由 SDK 消息记录，非供应商独立认证；执行者身份来自项目配置，不冒称已观察 Captain 的服务端身份，另记 executorIdentitySource。不能标 cross-family/accepted，不能把 high 记成 xhigh/ultra。
- `localPolicy`：用户授权沿用 Flash/low、Pro/high，以及与 ARIS 的差异。本地代码审查仍按既有策略放行；研究审计凭据不用于 record-review。

输入、版本、状态、响应身份、报告或事件变化使证据失效。超时、截断、失败、范围不完整、工具越权或缺少材料不能伪装为完成或 NOT_APPLICABLE。当前模型策略不能满足上游跨家族的投稿/证明接受要求。

工具白名单和凭据校验约束遵守接口的参与者，不是操作系统沙箱，也不是抵御恶意仓库写入者的密码学签名。

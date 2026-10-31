# ARIS 科研 Skill 转接层设计

日期：2026-10-31。状态：待用户审阅，尚未进入实现。

## 已确认的目标与决策

用户希望直接复用 ARIS（Auto-Research-In-Sleep）的文献与创意、实验执行、保障与审计三类 Skill，通过转接层接入当前 Pi workflow。用户已明确选择：

- ARIS 接替现有五个 K-Dense 方法 Skill 的入口。
- 沿用 DeepSeek Flash／Pro，记录与上游审计独立性要求的差异。

采用此前讨论的固定上游原文加本地薄转接层方案。转接层处理宿主调用、状态检查、参数、产物路径与审计差异；研究方法正文继续来自固定版本的 ARIS。

本次属于工作流基础设施变更。真实项目仍为 `IDLE`，不创建科研实验，不填写虚构的科学问题、数据或 `RUN.json`，不把软件设计确认当作科研方案审批。

## 当前实现与约束

- Pi 1.4.0、Node.js 24、pi-dynamic-workflows 3.14.0。
- `.pi/skills/` 当前有五个原有阶段入口、五个 K-Dense 方法适配入口；上游资料位于 `.pi/vendor/scientific-agent-skills/`。
- `.pi/extensions/research-workflow.ts` 是现有 workflow 唯一入口，使用宿主 session 工厂适配。
- Captain、Worker、Runner 使用 `deepseek/deepseek-flash`／`low`；Reviewer 使用 `deepseek/deepseek-v4-pro`／`high`。
- 现有代码审查凭据严格绑定实验、批准方案、准确实现 commit 和全新只读 session。它不能直接承载方案形成前或运行后的通用研究审计。
- `.research/workflow/HARDENING.md` 记录两项既有 SDK 凭据集成测试失败；旧记录不能代替实现时的基线复现和修复验证。

## 方案比较与选择

| 方案 | 收益 | 代价及结论 |
| --- | --- | --- |
| 固定上游原文，加本地 Skill 和宿主转接层 | 保留方法原貌、来源与可比较差异；沿用当前状态机和模型 | 需要显式维护依赖、阶段映射和证据校验；采用此方案 |
| 直接安装 ARIS 的完整宿主包 | 可复用上游默认编排 | 默认工具、模型、部署和自动循环与本项目关卡冲突；不采用 |
| 将 ARIS 改写为本项目自有方法正文 | 表面上减少调用适配 | 方法容易漂移，难以满足直接使用上游 Skill 的目标；不采用 |

用户已选择转接层方向；表中宿主接口、命名和分批启用细节是本设计的建议，不表述为用户已逐项批准。

## 接入清单与入口迁移

本次范围固定为下列 37 个 canonical Skill，不根据上游目录总数自动扩大范围。

| 类别 | Skill |
| --- | --- |
| 文献与创意（18） | `research-lit`、`arxiv`、`semantic-scholar`、`deepxiv`、`openalex`、`alphaxiv`、`exa-search`、`keenable-search`、`firecrawl-search`、`gemini-search`、`web-debug-search`、`comm-lit-review`、`idea-creator`、`novelty-check`、`research-refine`、`experiment-plan`、`ablation-planner`、`formula-derivation` |
| 实验执行（10） | `research-implement-feature`、`run-experiment`、`monitor-experiment`、`analyze-results`、`experiment-queue`、`vast-gpu`、`serverless-modal`、`qzcli`、`training-check`、`system-profile` |
| 保障与审计（9） | `research-review`、`experiment-audit`、`result-to-claim`、`paper-claim-audit`、`citation-audit`、`citation-crosscheck`、`proof-checker`、`kill-argument`、`integrity-forensics` |

Pi 项目入口统一为 `/skill:aris-<canonical-name>`，例如 `/skill:aris-research-lit`。前缀区分本地接入协议与上游原文；上游子 Skill 调用也必须按 manifest 路由，不直接落到宿主同名 Skill。

以下五个入口退出 Pi 自动发现：`scientific-brainstorming`、`hypothesis-generation`、`scientific-critical-thinking`、`statistical-analysis`、`exploratory-data-analysis`。既有 K-Dense vendor 和许可证保留为历史资料，停止默认引用，不做无关清理。

保留 `research-understanding`、`literature-investigation`、`hypothesis-design`、`result-analysis`、`research-decision` 五个阶段 Skill，它们负责本地阶段交接，按需调用 ARIS 入口。迁移时修改 README 和系统提示中的旧调用。

能力差异必须明确：`idea-creator`／`research-refine` 对应创意和方法形成；`research-review` 对应研究批判；`analyze-results` 对应结果整理。ARIS 不提供与 K-Dense 统计方法和数据探索完全等价的上述入口。保留原有阶段中的数据质量、划分泄漏、统计假设、效应量与不确定性要求；需要专门方法或真实分析代码时，在实际研究方案中补足，不能宣称替换名称即获得等价能力。

## 上游固定与依赖

计划目录：

```text
.pi/vendor/aris/
  ORIGIN.md
  LICENSE
  skills/<canonical-name>/...
  skills/shared-references/...
  tools/...
.pi/aris/manifest.json
.pi/skills/aris-<canonical-name>/SKILL.md
scripts/aris-adapter.mjs
scripts/aris-audit-evidence.mjs
.pi/workflows/research-audit.workflow.js
.pi/agents/independent-research-auditor.md
```

实现时先解析并固定一个准确 upstream commit，再下载该 commit 的清单内容；本设计未固定 commit，不猜造哈希。记录仓库 URL、commit、获取时间、许可证、逐文件哈希和选择理由。上游文件保持原文、原相对布局，所有差异写在本地适配层。

不仅复制 `SKILL.md`：对共享参考、模板、脚本和引用的子 Skill 建立依赖清单，每个引用明确为已打包、已映射、可选未启用或不支持。禁止未解析的强制 helper、子调用在运行时静默跳过。必要时保留范围外的参考文件，但不因此注册新的可调用入口。上游若在固定版本新增实际硬依赖，须先完成兼容分类再将相应 Skill 标为可用。

不运行 ARIS 通用安装器、不注册第二份上游 workflow 扩展、不安装完整 Codex/Claude 宿主包、不自动跟随上游更新。Python helper 依赖在明确启用时用 uv 配置与锁定；不安装真实项目尚不需要的 GPU/统计环境。

## 转接层接口与执行边界

`scripts/aris-adapter.mjs` 提供统一查询与准备接口，由本地 Skill 先调用，再根据结构化结果执行允许的下一步。

建议命令：

```text
node scripts/aris-adapter.mjs list
node scripts/aris-adapter.mjs inspect aris-research-lit
node scripts/aris-adapter.mjs prepare aris-research-lit --request <JSON_PATH>
node scripts/aris-adapter.mjs verify <INVOCATION_PATH>
```

`list`／`inspect` 只读；`prepare` 检查当前项目与状态，产生调用描述和待使用的输入路径、上游文档路径、执行角色、允许的 workflow／命令、输出目录及不可用原因。`verify` 校验必要产物与证据，不能自行授予现有状态机的审批或执行资格。

请求文件包含 `skill`、`arguments`、`inputPaths`、可选 `experimentId` 和显式的外部服务选择。拒绝未知字段、未知 Skill、项目外产物写入、冲突实验 ID 和不适用阶段。参数仅作为数据传递，不拼成 shell 命令。输入文件路径和返回文件路径保持可追踪。

manifest 至少覆盖 canonical 名称、本地名称、分类、允许阶段、角色、必需输入、必需能力、上游路径、helper/子 Skill 映射、预期产物和已知语义差异。是否可用按能力和前置条件计算，不以 Markdown 文件存在视为可用。

这不是操作系统沙箱。准备命令的检查只约束遵守该接口的调用；正式执行仍依赖现有状态脚本和角色工具限制，不能宣称外部任意命令已被全面阻止。

## 阶段、角色与外部能力

| 操作 | 本地约束 |
| --- | --- |
| 检索、创意、方法和实验路线设计 | 在项目理解或 `PLAN_DRAFT` 阶段形成建议；项目关键信息缺失时仅输出待补内容，不编造研究方案 |
| `ablation-planner` | 读取真实结果与主张核验；提出下一轮方案，不修改已批准方案 |
| `research-implement-feature` | 仅交给已批准阶段的 Worker；仍调用现有 `record-implementation` |
| `run-experiment` | Runner 分两次调用现有 `check-run`、`run`；不直接启动训练或远程任务 |
| 队列、平台、性能剖析 | 只准备配置与方案；任何实际实验、探测运行、自动重试或插桩必须纳入批准范围和 `RUN.json`，代码变更重新审查 |
| `monitor-experiment`、`training-check` | 读取已存在运行的状态、日志或已配置服务；监控不自动重启、改参或新增实验 |
| `analyze-results` | 在有真实结果的分析阶段使用；区分原始数值、解释、建议，新分析代码不能借此绕过已批准范围 |
| 研究与产物审计 | 检查对应输入是否存在；按任务分别使用新鲜的审计上下文，结果不能代替人工审批或代码 PASS |

`idea-creator` 的 GPU pilot、`experiment-queue` 的 OOM retry、`run-experiment` 的自动同步/改码/安装、平台租赁与资源删除都不是因为读取上游 Skill 就自动获准。将这些动作转为待审批或待配置的明确交接，不能用“sanity check”名称规避正式实验关卡。Worker 原有允许的确定性软件测试和数据路径检查继续按既有职责执行。

检索、W&B、SSH、GPU 平台及独立联网引用核验分别做能力检测。无配置时返回具体缺失项；聚合文献检索可记录部分来源失败并使用成功来源，但不能声称搜过缺失来源。审计所需的独立联网/图像/执行能力缺失时保留 `BLOCKED` 或 `ERROR`，不能将 Captain 的检索摘要当成审计员独立核验。新审计员仍只允许 read/grep/find/ls，不自动增加联网或执行工具；因此这些审计在相应能力未另行设计前会明确受限。

默认不发送飞书等通知、不启用外部云平台、不租赁算力。需要这些功能时使用明确的项目配置和授权，不继承上游用户目录里的配置或密钥文件。

## DeepSeek 审计语义与证据

新增 `independent-research-auditor`，固定 `deepseek/deepseek-v4-pro`／`high`，全新上下文、仅四个只读工具，模型校验和工具集合检查沿用宿主原则。审计调用单独通过 `research-audit.workflow.js`，不冒用 `independent-code-reviewer`，不触发 `reopen-review` 或写入代码审查凭据。`kill-argument` 的攻击与裁决槽位使用不同的新鲜 session。

新增通用审计捕获与校验，隔离于既有 `captureReview` 和 `validateReviewEvidence` 的代码审查协议。宿主捕获原始报告、session 事件、初始消息数、实际工具调用、请求/有效 thinking、返回消息模型身份及输入文件哈希。保留配置模型与实际观察来源的区别，不把 SDK 模型标识描述为供应商独立认证。

审计结果分成三条独立信息，不能相互覆盖：

- `verdict`：上游实质审计结论及问题，保留相应 Skill 的枚举；通用报告使用适用的 `PASS`、`WARN`、`FAIL`、`NOT_APPLICABLE`、`BLOCKED`、`ERROR`，不强行转换不同 Skill 的科学结论枚举。
- `review_independence: same-family`、`acceptance_status: provisional`：在证据完整且确为 Flash/Pro 时记录；模型身份未知、会话失败或范围不完整时标记不可用，不能自填一个成功审计结论。
- `local_policy`：记录用户在本次会话授权沿用 DeepSeek Flash/Pro、与 ARIS 跨家族接受规则的差异，以及本地代码关卡是否满足。遵循本地规则的代码 PASS 仍可以放行现有执行；这不构成 ARIS 的 `cross-family / accepted`。

本地实际 thinking 为 `low`／`high`，上游示例档位另记差异，不能把 `high` 冒称 `xhigh` 或 `ultra`。不自动更换模型、降级或用执行者自评补齐审计。审计负面意见不会因为存在本地模型例外而被删除。

需要上游跨家族接受的投稿/证明就绪声明，当前配置只能记录该条件未满足；本次授权不被解释为更改上游的原始语义。代码审查、本地审计和上游就绪状态分别展示。

产物建议放在 `.research/aris/<invocation-id>/`，与具体实验相关时关联其 ID、批准方案和执行 commit；无实验时实验字段为 null。每次调用保留独立目录，包含请求、调用描述、原始报告、事件、凭据和适配结论，不覆盖历史记录。`verify` 校验输入/报告/事件哈希、session 完成状态、身份、工具和结论一致性；输入变化后的结果变为过期，需重新审计。失败不能伪装为 `NOT_APPLICABLE`。

## 共享状态与非目标

`.research/STATE.md` 仍是唯一科研状态入口，由原状态脚本写入。ARIS 的局部阶段文件仅用于当前 Skill 恢复，不能自动推进本地实验状态。研究记忆仍写入现有文献、假设、决策和实验文件；本次不另建一个竞争性的 research-wiki 状态系统。

本次不接入 `research-pipeline`、`idea-discovery`、`experiment-bridge`、`auto-review-loop` 等完整编排入口，不启用持续无人值守科研循环、自改 Skill、论文写作或自动投稿。37 个入口可被已有 workflow 按阶段调用；上游对范围外编排的调用需明确拦截或映射到已支持的阶段交接。

## 验证与交付标准

实现前复现当前离线 Node 套件基线，优先定位两项既有 SDK 凭据失败；涉及同一宿主捕获链路时在独立变更中修复并验证，不将故障测试删除或跳过。新接入不得依赖未经验证的凭据路径。

必要验证包括：

1. Pi 实际发现五个原有阶段 Skill 和 37 个 ARIS 入口，五个 K-Dense 入口退出发现，vendor 原文未自动加载。
2. 固定来源、许可证、文件哈希及强制引用解析完整；选取文件未被适配代码改写。
3. 适配层阶段检查、角色映射、参数数据化及外部依赖缺失处理有效；pilot、自动重试、直接部署不能获得现有正式运行资格。
4. SDK 离线合成传输下，新审计角色使用全新 session、准确 Pro/high 和只读工具；成功、失败、工具越权、输入篡改、未知模型、截断和过期证据分别得到正确结果。
5. `same-family / provisional` 与本地模型例外均可机器检查；代码凭据和研究审计凭据不可互换。已有人工审批、代码修订次数、运行锁和日志测试继续通过。
6. README、系统提示、阶段 Skill、审计差异说明与实际入口保持一致；依赖不可用的入口明确显示受限，不宣称已完成外部服务集成。

自动测试使用临时合成项目、实际 SDK 和进程内合成响应，不调用付费模型，不运行真实科研实验。外部服务、模型中文遵从性和真实方法质量属于后续按需验证，最终报告如实列明未验证项。

交付时报告改动范围、测试结果、既有失败处理、37 个入口的可用/受限状态，以及固定上游 commit。基础设施变更独立提交；研究状态仍保持原样。

## 留给实现者的选择

允许实现者决定纯内部模块拆分、测试 fixture 布局和 ID 生成方式，但不得改变上述范围、命名、模型、独立性语义或状态权限。准确上游 commit 在实现准备时取得并记录；若固定版本缺失清单中的 Skill 或出现无法兼容的强制依赖，明确报告差异，不能虚构兼容或静默缩小交付范围。

## 参考依据

- [ARIS 分类目录](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/docs/SKILLS_CATALOG.md)：接入集合；实现时改为所固定 commit 的可追溯引用。
- [ARIS reviewer-backends](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/shared-references/reviewer-backends.md)：模型身份、工具能力、完成性和同家族接受语义。
- [ARIS integration-contract](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/shared-references/integration-contract.md)：依赖解析、失败策略、产物与外部校验。
- 本仓库 `AGENTS.md`、`.pi/APPEND_SYSTEM.md`、`.research/workflow/README.md`、`scripts/pi-workflow-session.mjs`、`scripts/review-evidence.mjs`、`tests/pi-config.test.mjs`。

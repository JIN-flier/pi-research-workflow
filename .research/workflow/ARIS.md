# ARIS 操作指南

本次接入固定上游 commit `9a4f093dcf6fd7cd37ac2f2e79e9a0a7af05a492`，当前保留 103 个上游文件。方法原文和 MIT 许可证在 `.pi/vendor/aris/`，入口、依赖和文件哈希在 `.pi/aris/manifest.json`。保留五个本地阶段 Skill，用 37 个 ARIS 入口替换五个 K-Dense 方法入口，旧 K-Dense vendor 已移除。Skill 详情见 [转接契约](../../.pi/aris/ADAPTER.md)。

## 三类入口

| 类别 | canonical 名称；Pi 命令加 `/skill:aris-` 前缀 |
| --- | --- |
| 文献与创意（18） | research-lit、arxiv、semantic-scholar、deepxiv、openalex、alphaxiv、exa-search、keenable-search、firecrawl-search、gemini-search、web-debug-search、comm-lit-review、idea-creator、novelty-check、research-refine、experiment-plan、ablation-planner、formula-derivation |
| 实验执行（10） | research-implement-feature、run-experiment、monitor-experiment、analyze-results、experiment-queue、vast-gpu、serverless-modal、qzcli、training-check、system-profile |
| 保障与审计（9） | research-review、experiment-audit、result-to-claim、paper-claim-audit、citation-audit、citation-crosscheck、proof-checker、kill-argument、integrity-forensics |

读取单项入口的实际阶段、角色、产物和依赖：

```bash
node scripts/aris-adapter.mjs list
node scripts/aris-adapter.mjs inspect aris-research-lit
node scripts/aris-adapter.mjs verify-vendor
```

## 按需使用

Pi 重载项目后可输入 `/skill:aris-research-lit`，提供任务与本地原始材料；入口会按契约准备请求。也可自行把请求写入项目内 JSON，再运行 prepare。请求允许 `arguments`、`inputPaths`、可选 `experimentId` 和 `sources`，不接受 shell command 或任意输出目录。

例如已存在 `.research/literature/RELATED_WORK.md` 时：

```json
{
  "arguments": "根据这份已有文献材料，比较模型机制与最接近的原始工作，记录缺失来源。",
  "inputPaths": [".research/literature/RELATED_WORK.md"],
  "sources": []
}
```

将 JSON 保存为 `.research/aris-request.json` 后：

```bash
node scripts/aris-adapter.mjs prepare aris-research-lit --request .research/aris-request.json
```

返回 status、invocationPath、role、upstreamPath、workflow、outputDirectory、missingCapabilities 和模型差异。只在 prepared 时继续方法；blocked/needs_configuration/handoff 是明确的未执行交接。通用方法由 Captain 按需读取原文，写入本调用目录的 RESULT.md 并链接研究记录，随后 `verify <invocationPath>`。

当前科研资料尚未填写，idea-creator、novelty-check、research-refine、experiment-plan 不会生成占位实验。ARIS 缺少与原统计/数据探索完全等价的所选入口；数据质量、泄漏、统计假设、效应量和不确定性要求仍保留在本地阶段 Skill。

## 实现、运行与研究审计

准备实现或执行调用后，以前台 `workflow` 运行 `.pi/workflows/aris-dispatch.workflow.js`，参数为 `invocationPath` 和 `role`（implementation-worker 或 experiment-runner）。宿主在调用模型前核验当前阶段、输入与角色。

- 实现仍需 PLAN_APPROVED/IMPLEMENTATION_REVISION 和准确批准文件；Worker 提交后 record-implementation，转入原 CODE_REVIEW。
- 运行仍需 READY_TO_RUN、准确干净 HEAD 和独立代码 PASS；Runner 分开 check-run、run。不得在此时增加 W&B 代码、临时同步新代码或换命令。
- 完成后的 verify 从原 IMPLEMENTATION/EXECUTION、准确 commit 和审查凭据核验预期状态转换；不会因 STATE 合法改变而误判过期。EXECUTION_FAILED 仍如实返回失败，不推断科学结论。

研究审计调用以前台 `workflow` 运行 `.pi/workflows/research-audit.workflow.js`，参数为 `{ "invocationPath": ".research/aris/<UUID>/invocation.json" }`。kill-argument 还传 `"attack": true`。需要 ARIS 方法中的子评审槽位时，先把本轮完整候选/方案保存为父调用的 RESULT.md，再 `prepare-audit <父 invocationPath>`，使用返回的新 invocationPath，不能把 Captain 的意见冒充独立审计。

审计员固定 Pro/high，仅四个只读工具；输入是原始参数、上游标准和文件路径。宿主保存报告、事件和单独凭据。完成后 `verify <invocationPath>`，检查模型、工具、输入、范围、报告和事件；不能用代码 `record-review` 登记这种凭据。上游原生科学判定保存在 report.details，同家族接受状态单独记录 provisional，不因为存在本地授权而删除负面意见。

## 已下载但受限的能力

- 默认 sources 为空，联网、W&B 和专用检索服务未探测。只有已配置且宿主实际可用时，才在 `.pi/aris/config.json` 声明来源；不在配置中保存密钥。聚合检索可处理真实本地材料，不声称访问过不可用来源。
- experiment-queue、vast-gpu、serverless-modal、qzcli、system-profile 仅做方案准备。任务、预算、重试和部署需纳入批准方案与 RUN.json；本次未开通外部平台。
- citation-audit、citation-crosscheck 的独立联网，以及 integrity-forensics 的外部取证运行时，当前只读审计员不支持，因此 blocked。把名字填进 sources 不能解除该限制。
- 未映射的子 Skill 与未支持的必需 helper 必须显式报告缺口。Agent 生成视角在无安全叶代理时由 Captain 按上游顺序回退，记录覆盖情况；不得借用实现 Worker 绕过审批。
- 不使用上游安装器、默认通知、研究总循环、自改 Skill 或自动投稿。上游文件存在不等于其命令已授权。

## 验证边界

离线套件检查实际 Pi Skill 发现、工作流解析、真实 SDK 合成传输、阶段关卡、参数数据化、输入/事件篡改、审计身份、失败与截断、攻击/裁决分离及原运行锁。没有调用付费模型或真实科研实验，没有验证外部 API、GPU 部署、真实模型中文遵从性或科研方法质量。

工具白名单和审计记录不是操作系统沙箱。重新下载固定版本可运行 `node scripts/vendor-aris.mjs <固定上游 checkout> .`，不自动更新上游。更新上游前重新审核依赖和本地差异，不只替换 commit 字段。

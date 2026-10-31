# Workflow 验证与兼容性

日期：2026-10-31。范围：工作流基础设施；真实项目保持 IDLE、无当前实验。

## 来源与入口

- 上游：`wanshuiyin/Auto-claude-code-research-in-sleep`。
- 固定 commit：`9a4f093dcf6fd7cd37ac2f2e79e9a0a7af05a492`。
- 当前保留 37 个 canonical Skill 及所需 shared-references、tools、templates 和 MIT LICENSE，共 103 个上游文件；逐文件 SHA256 在 `.pi/aris/manifest.json`。初次导入的 147 个原文件中，44 个未接入资源已按整理要求移除。
- 原文件保持上游原文；导入脚本按明确清单选择资源，并拒绝所选源文件存在修改或未跟踪内容。清理后的来源哈希与依赖完整性另行核验。
- 37 个本地入口通过 Skill 结构校验；实际 Pi SDK 发现 37 个 ARIS 入口及五个本地阶段入口，无诊断，五个 K-Dense 入口退出发现，停用 vendor 已移除。
- 两个新 workflow 通过真实 Pi 解析/执行路径验证；研究审计使用原生宿主 session 工厂，不加载第二份扩展。

## 基线与 SDK fixture 修复

修改前在获准的离线环境运行 `node --test --test-reporter=tap tests/*.test.mjs`，31 项中 29 项通过、2 项失败，与历史记录一致。

根因位于测试 fixture：合成 provider 仍访问旧 `context.tools`，当前 SDK 将工具声明放在 transcript system delta；改用 `ai.getCurrentTools(context.messages)`。SDK 生成的 auth/model stores 原先进入临时仓库代码 diff，现移到忽略的 outputs/。未放宽生产环境的干净工作区、模型、工具或凭据校验。

修复后该文件三项真实 SDK 合成传输测试在获准环境通过。受控运行完成测试也曾在临时合成项目通过；随后补充的输入变化断言，在最终环境下因 Git fixture 权限限制未重新完成。

## 独立检查与修复

未适配基线为只读场景分析，未实际启动上游命令；不把它记为发生过的科研失败。随后由独立上下文对本地入口和临时材料执行 forward-test，并由另一独立上下文审查实现，未调用付费模型。

已修复的实质问题：

1. 原实现只核验成功 read 的路径；现在依据 offset/limit、工具截断元数据和实际返回文本合并逐文件行覆盖，未读完不可验证。部分读取拒绝、完整分页接受的回归已通过。
2. 子评审原先只复用初始输入；现在必须先保存本轮完整候选/方案 RESULT.md，并将它和原始输入一起绑定哈希。候选变化导致子审计失效的回归已通过。
3. kill-argument 原先允许裁决员自评总 verdict；现在攻击槽保留 memo，裁决槽提交逐点分类与 counts，由宿主按固定上游表格计算。未解决 critical 问题不能自填 PASS，计数不一致被拒绝，五类映射回归已通过。
4. 受控任务完成校验原先提前返回；现在保留全部执行输入及实现阶段科研背景的哈希绑定。实现允许修改的源码与必须保持的执行输入分开处理；本项最终动态回归受下述 Git 权限限制。

独立审查另建议导入脚本拒绝脏源 checkout，已加入检查；最终下载源为干净状态。未留下已知待处理的审查建议，但不能把受限测试记为通过。

## 最终验证

最终在沙箱内运行：

```bash
node --test --test-isolation=none --test-reporter=tap --test-reporter-destination=outputs/aris-validation/final.tap tests/*.test.mjs
```

60 项：36 项通过，24 项在临时 Git fixture 初始化时被 `spawnSync git EPERM` 阻断；逐项错误原因均为同一权限错误，未跳过或删除这些测试。该次临时日志已按文件整理要求删除，此处保留验证摘要；不能宣称完整套件通过。

通过项包含实际 Pi 发现、审批三分支和无界面中止、真实 SDK 研究审计、模型/thinking/工具约束、攻击与裁决独立 session、输入/报告/事件变化拒绝、部分读取与完整分页、子评审候选绑定、确定性 verdict 和解码能力缺失处理。无 Git fixture 的入口与阶段检查另有六项通过。

审查代理申请沙箱外重跑测试时收到 `Rejected("rejected by user")`，此后没有再次申请或执行被拒绝的提权动作。最终检查在沙箱内完成，未宣称完整套件通过。`git diff --check` 和本地新增 Node 模块语法检查通过。

## 本地模型与能力边界

Captain/Worker/Runner 为 DeepSeek Flash/low；代码 Reviewer 和独立研究 Auditor 为 Pro/high。研究审计保留实质 verdict 与原始 details，另记 same-family/provisional、本地授权差异及 upstreamAcceptanceSatisfied=false。审计响应模型来源为 SDK 消息，执行者模型来源为项目配置，不冒称独立服务端认证。研究审计不授权代码运行。

默认外部来源未配置、不自动探测；两项引用审计所需独立联网、诚信取证外部运行时及 PDF/图像独立解码不可用时 blocked。五个队列/平台/剖析入口只输出待审批规划。未运行 GPU、云部署、上游 helper、通知或真实科研实验；未验证付费模型中文遵从性或研究方法质量。

当前未配置真实科研问题、数据集或运行命令，STATE 保持 IDLE；没有创建科研实验。

## 文件整理范围

只保留 Pi 配置、四种角色、四个 workflow、42 个项目 Skill、ARIS 必需原文和依赖、状态/审计脚本、自动及手动测试、操作与验证文档，以及 `.research/` 运行时记忆模板。

移除停用 K-Dense vendor、未启用的 compact 配置、实施过程计划和临时日志，以及 ARIS 中未接入的其他宿主安装/自更新、专利、制图、Overleaf、自改 Skill 和第二套记忆资源。`.pi/npm/` 是现有 workflow 所需本地依赖，继续保留且被 Git 忽略。

清理后再次核验：103 个上游文件与固定来源的字节及 SHA256 一致，37 个 ARIS 入口和五个本地阶段入口完整，packaged 依赖和本地 Markdown 链接均有效。30 项无 Git 的 SDK/审计/发现测试和六项转接器测试通过；未重跑已受限的 Git fixture，也未再次申请沙箱外执行。导入脚本语法与 `git diff --check` 通过。

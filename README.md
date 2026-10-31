# Pi Agent 科研工作流：安装、使用与持续演进

本仓库提供科研记忆、五个原有阶段 Skill、五个按需接入的科研方法 Skill、三个具名子代理，以及人工方案审批、独立代码审查和受控执行关卡。学科方向是深度学习模型设计；当前尚未配置具体科学问题、数据集或研究代码，状态为 `IDLE`。它是 Phase 2–4 的工作流基础设施，尚不是无人值守的完整科研循环。

本指南使用 Linux/macOS 的 Bash 命令；Windows 用户可在 WSL 中使用同一流程。命令块在终端执行，标为“对话模板”的文本粘贴到交互式 Pi。模板中的 `〈…〉` 必须替换为真实信息；不得把示例内容当作真实实验或审批结果。

## 使用路线

1. [安装 Pi、获取仓库](#1-安装-pi获取仓库)
2. [安装插件并配置模型](#2-安装插件并配置模型)
3. [启动与安装验收](#3-启动与安装验收)
4. [填写项目并理解研究现状](#4-填写项目并理解研究现状)
5. [文献调查与假设设计](#5-文献调查与假设设计)
6. [创建实验、提交方案与人工审批](#6-创建实验提交方案与人工审批)
7. [委派实现与独立审查](#7-委派实现与独立审查)
8. [正式运行、分析与决策](#8-正式运行分析与决策)
9. [恢复会话、处理失败与继续下一轮](#9-恢复会话处理失败与继续下一轮)
10. [持续演进项目与工作流](#10-持续演进项目与工作流)

## 1. 安装 Pi、获取仓库

### 1.1 环境与版本

本仓库的适配目标为 **Node.js 24、Pi 1.4.0、pi-dynamic-workflows 3.14.0**。先安装 [Node.js 24](https://nodejs.org/en/download)，确保终端可以使用 `node`、`npm` 和 `git`。Python 研究项目另需 [uv](https://docs.astral.sh/uv/getting-started/installation/)，具体 Python 版本由研究项目选择。

```bash
node --version
npm --version
git --version
```

Pi 官方支持安装脚本和 npm 安装；为匹配当前适配层，本指南使用指定版本的 npm 包。安装方法见 [Pi 官方快速入门](https://pi.dev/docs/latest/quickstart)。

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@1.4.0
pi --version
```

应显示 `1.4.0`。已经安装其他版本时，先记录版本，再决定是否切换；不要直接升级工作流依赖来消除版本报错。npm 全局安装目录需在 `PATH` 中。

### 1.2 下载项目

```bash
git clone https://github.com/JIN-flier/pi-research-workflow.git
cd pi-research-workflow
git status --short
```

已有本地 checkout 时直接进入该目录。后续所有项目命令均从仓库根目录运行，不要在 `.pi/` 或实验子目录中启动 Pi。

Git 提交身份必须可用。首次使用且未配置时，为当前仓库设置自己的真实信息：

```bash
git config user.name "你的姓名"
git config user.email "你的邮箱"
```

## 2. 安装插件并配置模型

### 2.1 本项目需要哪些组件

| 组件 | 是否需要额外安装 | 作用与位置 |
| --- | --- | --- |
| Pi CLI / SDK 1.4.0 | 需要 | 交互会话、模型调用与 SDK，使用上节 npm 命令安装 |
| `@quintinshaw/pi-dynamic-workflows@3.14.0` | 需要 | workflow、子代理、checkpoint、workflow-authoring 等插件能力 |
| 项目适配扩展 | 已随仓库提供 | `.pi/extensions/research-workflow.ts`，约束最终工具集合并捕获审查凭据 |
| 十个项目 Skill（原有五个阶段 Skill + 五个科研方法适配层） | 已随仓库提供 | `.pi/skills/`，按阶段读取，不应一次全部加载 |
| 五个固定版本的上游科研 Skill | 已随仓库提供 | `.pi/vendor/scientific-agent-skills/`，供适配层按需引用；不会被 Pi 作为项目 Skill 自动发现 |
| 三个角色定义 | 已随仓库提供 | `.pi/agents/`，由 workflow 的 `agentType` 使用 |
| 系统提示与审批提示 | 已随仓库提供 | `.pi/APPEND_SYSTEM.md` 与 `.pi/prompts/research-plan-review.md` |

不需要另外安装通用 subagent 或 plan-mode 插件来完成本指南。`.pi/pi-compact.json` 只是保留的配置文件；仓库没有声明对应运行插件，不能据此认定额外的自动记忆功能已经启用。研究恢复以 `.research/` 文件为准。

### 2.2 安装项目本地 workflow 依赖

`.pi/npm/` 被 Git 忽略，新克隆时不会带来本机已安装的依赖或其清单。显式创建并安装固定版本：

```bash
mkdir -p .pi/npm
npm install --prefix .pi/npm --save-exact --legacy-peer-deps --ignore-scripts @quintinshaw/pi-dynamic-workflows@3.14.0
npm ls --prefix .pi/npm @quintinshaw/pi-dynamic-workflows
```

应显示 `3.14.0`。`--legacy-peer-deps` 避免 npm 自动安装第二份 Pi SDK 等宿主依赖，宿主依赖由 Pi 提供；`--ignore-scripts` 禁用安装生命周期脚本。这是本地适配扩展直接导入的路径，仅在别处全局安装插件不够。

仓库已在 `.pi/settings.json` 声明插件来源，并刻意禁用其上游扩展：

```json
{
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-flash",
  "defaultThinkingLevel": "low",
  "packages": [
    {
      "source": "npm:@quintinshaw/pi-dynamic-workflows@3.14.0",
      "extensions": []
    }
  ]
}
```

`extensions: []` 保留包中的 Skill，由本地扩展统一加载 workflow 运行入口。此项目无需再次运行通用的 `pi install` 来注册同一包；不要把该声明替换成会自动加载上游扩展的简单字符串。如果用户级设置已有该插件，请用 `pi config` 检查资源配置，避免额外加载第二份上游入口。一般插件安装方式可参考 [Pi Packages](https://pi.dev/docs/latest/packages) 和 [插件上游说明](https://github.com/QuintinShaw/pi-dynamic-workflows)。

### 2.3 上游科研 Skill 的选择性接入

本仓库从 [K-Dense Scientific Agent Skills](https://github.com/K-Dense-AI/scientific-agent-skills) 固定 commit 中接入五个与当前通用科研流程直接相关的 Skill，保留各目录的参考资料、模板和脚本。版本、许可证与选择范围见 [ORIGIN.md](.pi/vendor/scientific-agent-skills/ORIGIN.md)。项目入口在 `.pi/skills/`：它们先检查当前研究阶段并说明中文输出及关卡边界，再按需读取相应上游文件。上游目录本身不作为 Pi 的项目 Skill 自动加载；其中的 Python 环境安装和脚本示例须按真实研究任务另行判断。

| 项目 Skill 命令 | 何时用 | 接入阶段 |
| --- | --- | --- |
| `/skill:scientific-brainstorming` | 发散多个候选方向，记录假设与竞争解释 | 假设设计前 |
| `/skill:hypothesis-generation` | 从真实观察形成可区分的预测与证伪条件 | PLAN_DRAFT |
| `/skill:scientific-critical-thinking` | 检查方案或结论的偏差、混杂和证据强度 | PLAN_DRAFT、ANALYSIS |
| `/skill:statistical-analysis` | 预先确定统计比较，或核验已批准分析 | PLAN_DRAFT、ANALYSIS |
| `/skill:exploratory-data-analysis` | 已授权数据的格式、缺失、分布与泄漏检查 | 项目配置、PLAN_DRAFT |

当前已确定方向为深度学习模型设计，但尚未给出具体任务、数据格式或框架，因此没有复制上游全部 Skill。以后确定具体任务或框架（例如 Transformers、PyTorch Lightning 或图神经网络）时，按 [ORIGIN.md](.pi/vendor/scientific-agent-skills/ORIGIN.md) 的来源选取相应目录并核对许可证与依赖。新增方法不改变人工方案审批、独立代码审查或受控运行的状态关卡。

### 2.4 配置 API 凭据

当前角色使用 DeepSeek。可以在 Pi 中运行 `/login` 选择 DeepSeek 保存凭据，也可在启动 Pi 的终端设置 `DEEPSEEK_API_KEY`。Bash 中可用隐藏输入避免将密钥字面量写进命令历史：

```bash
read -r -s -p 'DeepSeek API Key: ' DEEPSEEK_API_KEY
export DEEPSEEK_API_KEY
printf '\n'
```

环境变量只影响当前终端及其子进程；新终端需要重新设置，或使用 `/login` 保存的凭据。不要将密钥放入 README、Git、PLAN.md、RUN.json 或对话报告。

检查当前 Pi 能否找到所需模型：

```bash
pi --list-models deepseek
```

模型出现在列表不等于已验证远程调用权限；运行对话会产生实际 API 调用。

| 角色 | 配置位置 | 模型 | thinking |
| --- | --- | --- | --- |
| Captain，总协调者 | `.pi/settings.json` | `deepseek/deepseek-flash` | `low` |
| Worker，实现 | `.pi/agents/implementation-worker.md` | `deepseek/deepseek-flash` | `low` |
| Reviewer，独立审查 | `.pi/agents/independent-code-reviewer.md` | `deepseek/deepseek-v4-pro` | `high` |
| Runner，执行 | `.pi/agents/experiment-runner.md` | `deepseek/deepseek-flash` | `low` |

Reviewer 的 `high` 是用户在 SDK 能力检查后明确选择的配置，V4 Pro 不支持 `low`，不得静默降级或把实际 high 标为 low。更换角色模型时，不仅要改主会话 `/model`，还要同步角色定义和 `code-review.workflow.js` 中的显式模型/thinking，并重新验证兼容性。

Worker 与 Reviewer 必须为不同具体模型。当前允许同一厂商的不同模型，这是 2026-10-30 经用户授权的调整，比跨厂商模型家族隔离更弱；以独立上下文、只读工具、准确 commit 审查和人工审批补偿。仅更换大小写、路由前缀或 thinking 后缀不算不同模型。Reviewer 不可用时应保持待审，不得用 Worker 冒充。

## 3. 启动与安装验收

检查仓库内容后，在根目录启动交互式 Pi：

```bash
pi -a
```

`-a` 是“本次信任项目文件”，不是批准科研方案。也可以运行 `pi` 并按界面完成项目信任。项目配置、扩展和提示需要在信任后加载；不要用 `--no-extensions` 启动正式工作流，那会禁用兼容适配层。

在 Pi 输入：

```text
/model
```

确认主会话使用 DeepSeek Flash。可使用 `/workflows` 查看插件面板；修改提示词、Skill 或设置后使用 `/reload`，重大配置变更后重新启动会话。

**对话模板：首次验收**

```text
请用简体中文检查本仓库的科研工作流是否可用。
先读取 .research/PROJECT.md，再读取 .research/STATE.md。
核对项目本地扩展、workflow 依赖版本、三个角色的模型/thinking/工具策略，
以及 /research-plan-review 提示是否可发现。
目前只做只读检查，报告可用项、缺失项和下一步；不要创建实验、审批或调用子代理。
不要输出任何密钥。
```

在另一个终端进行离线回归检查（不需要模型 API 请求）：

```bash
node --test tests/*.test.mjs
```

**当前已知验证边界：**2026-10-31 接入科研 Skill 后的最近一次记录为 31 项中 29 项通过，两项既有 SDK 证据集成测试仍失败，见 [HARDENING.md](.research/workflow/HARDENING.md)。安装成功不代表这些问题已修复；正式研究前应排查失败并验证真实审查凭据链路，不得跳过凭据校验。可选的 `node tests/manual/pi-workflow-smoke.mjs` 会调用付费 DeepSeek API，仅在明确准备承担调用时另行执行；它使用临时合成项目，不代表真实科研实验或人工批准。

## 4. 填写项目并理解研究现状

开始前需要你提供真实研究目标与数据。先让 Captain 整理信息，尚未明确的内容写为缺失项。

**对话模板：项目初始化**

```text
请先读取 .research/PROJECT.md，再读取 .research/STATE.md。
我提供的研究背景如下，请据此补全 PROJECT.md，不要推断或编造缺失事实：
科学问题与深度学习任务：〈问题、预测目标和适用场景〉
研究目标与已有模型：〈目标、最接近基线、论文或代码位置〉
数据来源、许可、目录和划分：〈数据说明〉
基线及其代码/结果：〈基线〉
主要指标、统计比较与证伪条件：〈定义〉
模型/训练框架与计算资源、时间、费用上限：〈框架、GPU、预算〉
风险：〈泄漏、伦理、许可、复现等实际风险〉
请列出仍需我补充的信息；本步不要实现代码或执行正式实验。
```

**对话模板：恢复研究理解**

```text
/skill:research-understanding
```

随后补充任务：

```text
只检索与当前问题相关的 DECISIONS.md、HYPOTHESES.md、实验及失败记录。
在 .research/RESEARCH_STATUS.md 中用中文区分已有证据、假设和不确定性，
列出当前状态允许的下一步；不要推进状态或默认读取全部历史。
```

已获数据使用授权并给出明确路径时，可在正式方案前使用 `/skill:exploratory-data-analysis` 检查数据质量和划分泄漏；探索结果不能当作正式实验，也不用于偷看保留测试集。

Python 项目使用 uv。让实现方案明确 Python 版本、依赖与安装方式；按需创建并提交 `pyproject.toml`、`.python-version`、`uv.lock`，忽略 `.venv`。实验所需环境变更也应纳入方案与代码审查，不能在批准后临时更换依赖或命令。uv 的安装方法见 [官方安装指南](https://docs.astral.sh/uv/getting-started/installation/)。

## 5. 文献调查与假设设计

**对话模板：文献调查**

```text
/skill:literature-investigation
```

```text
围绕 PROJECT.md 的科学问题，调查〈机制或方向〉的最接近原始论文。
记录检索式、日期、来源链接、方法、数据、基线、结论和局限，交叉核对引用。
更新 .research/literature/RELATED_WORK.md 与 NOVELTY_ANALYSIS.md。
区分论文主张与我们的推断，标明检索边界；不能访问文献时直接记录缺口。
不要凭不完整搜索宣称创新性，不要实现代码或正式运行实验。
```

检索渠道取决于当前可用工具；没有联网检索能力时，可提供论文链接、本地文档或接入相应工具。不要把“已安装 workflow 插件”当作所有文献来源均已可访问。

**对话模板：先发散，再形成可检验候选**

```text
/skill:scientific-brainstorming
```

```text
请基于 PROJECT.md、相关文献及已否决方向，独立提出几种不同机制的研究想法。
从模型架构、损失函数、训练策略与数据处理等角度发散，
逐项标明已知证据、最接近基线、假设、竞争解释、可反驳的预测和未知信息；
保留不同意见与负面证据。此时不要选择获胜方案、提交 PLAN.md 或运行实验。
```

有真实观察或初步结果后，可使用 `/skill:hypothesis-generation`，要求把观察、候选假设、替代解释及区分性预测明确分开。进入方案提交前，用 `/skill:scientific-critical-thinking` 检查设计、偏差和推断；需要统计比较时，用 `/skill:statistical-analysis` 预先定义比较与不确定性。所有方法输出最终由现有 `hypothesis-design` 收敛为一项可审查实验。

**对话模板：提出一项假设**

```text
/skill:hypothesis-design
```

```text
先检索 HYPOTHESES.md 和已否决决策，排除等价的旧想法。
基于项目和文献证据，提出一个可证伪假设及最小决定性实验，
说明机制、竞争解释、架构/训练干预、基线/消融、数据划分、指标、种子、
统计比较、预期结果、证伪标准、成本与风险。
先与我核对科学内容；项目具体信息缺失时列出缺口，不要编造实验命令。
不要实现代码或执行正式实验。
```

## 6. 创建实验、提交方案与人工审批

### 6.1 创建实验目录

只有状态为 `IDLE` 才能创建新一轮，使用尚未占用的 ID：

```bash
node scripts/research-workflow.mjs status
node scripts/research-workflow.mjs new EXP-0001
```

若已有活动实验，应恢复它，而不是再次 `new`。命令生成 `.research/experiments/EXP-0001/` 下的 PLAN.md、RUN.json 和后续记录模板，进入 `PLAN_DRAFT`。

**对话模板：形成可审批方案**

```text
请将刚讨论的假设落实到 EXP-0001 的 PLAN.md 和 RUN.json。
PLAN.md 十个固定英文二级标题保持原样，正文用中文填写完整。
RUN.json 使用真实可执行的 command 字符串数组，明确工作目录为项目根目录。
核对指标、基线、数据与资源风险；缺少命令或依赖信息时先指出。
完成后展示变更供我检查；本步不要批准方案、实现代码或正式运行。
```

PLAN.md 的十个部分分别为科学问题、假设、机制、相关工作与创新性、设计、基线与对照、指标、预期结果、证伪标准、成本与风险；模板开头提供中英文对照。RUN.json 的结构如下，示例占位符不可直接执行：

```json
{
  "command": ["〈可执行程序〉", "〈参数1〉", "〈参数2〉"],
  "description": "〈运行目的与环境说明〉"
}
```

`command` 通过进程参数直接启动，不是 shell 命令字符串；不要把空格拼接、重定向或管道当成参数数组中的 shell 语法。Python 项目可以采用 `uv run ...`，但模块、参数和依赖必须与实际项目一致。

### 6.2 提交并进入待审

人工检查两个文件后，在终端提交本轮方案：

```bash
git add .research/PROJECT.md .research/experiments/EXP-0001/PLAN.md .research/experiments/EXP-0001/RUN.json
git commit -m "提交 EXP-0001 实验方案"
node scripts/research-workflow.mjs submit-plan
node scripts/research-workflow.mjs status
```

进入 `PLAN_REVIEW`；此时记录的 `approved_plan_commit` 和 `approved_plan_sha256` 是待审批的版本绑定，**不代表已经批准**。先将尚未提交的工作流维护变更单独处理，避免与本轮实现混杂。

### 6.3 在 Pi 中人工审批

输入仓库提供的提示命令：

```text
/research-plan-review
```

它指示 Captain 完整读取 `.pi/workflows/plan-review.workflow.js`，通过 `workflow` 工具以前台模式运行。`args` 与 STATE.md 的对应关系为：

```text
experimentId = current_experiment
planCommit   = approved_plan_commit
planSha256   = approved_plan_sha256
background   = false
```

人工在 checkpoint 中确认准确方案版本。第一次选“是”为 APPROVE；第一次选“否”后，第二次选“是”为 REJECT，选“否”为 REVISE。

| 决定 | 下一状态 | 接下来做什么 |
| --- | --- | --- |
| APPROVE | PLAN_APPROVED | 委派实现 |
| REVISE | PLAN_DRAFT | 修改方案和命令，重新提交、submit-plan 和人工审批 |
| REJECT | REJECTED | 记录决策并结束本轮 |
| 未回答、超时或无界面中止 | 保持待审 | 恢复前台人工审批，不得推定批准 |

**对话模板：审批结果登记**

```text
请只依据刚才前台 checkpoint 的真实返回值登记审批。
用实际 workflow run ID 和我的理由记录 record-plan-review，展示新状态。
没有明确返回值时保持 PLAN_REVIEW，不得猜测决定或伪造 run ID。
```

登记接口为 `record-plan-review DECISION human "checkpoint RUN_ID: 人工理由"`，由 Captain 替换真实值。不要为了测试安装而在真实项目登记假批准，也不要用 `pi -p` 或后台 workflow 承担人工审批。

## 7. 委派实现与独立审查

### 7.1 已批准范围内实现

**对话模板：启动 Worker**

```text
确认当前实验已是 PLAN_APPROVED，再通过 workflow 委派 implementation-worker。
使用全新上下文，agentType: implementation-worker，
model: deepseek/deepseek-flash，thinking: low，isolation: false，label: implementation。
使用包含 export const meta、agent() 和明确返回值的完整脚本；
仅传递当前实验 ID、批准方案路径、RUN.json、状态及必需代码上下文。
要求 Worker 复核批准 commit/hash，建立专用分支，完成最小批准变更、测试和提交，
调用 record-implementation deepseek/deepseek-flash，更新 IMPLEMENTATION.md。
提交前检查真实数据路径，至少各迭代一个训练/验证批次，不优化、不评估测试集。
缺少真实数据时用确定性样本并记录局限；不将其当作正式实验。
不得修改批准方案、RUN.json、基线或数据；不得正式评估。报告使用中文。
```

`isolation: false` 让角色在当前项目工作区操作，其专用分支由 Worker 管理，便于状态脚本核验同一 HEAD；不要在未处理合并和重新审查的情况下，把另一个 worktree 的结果当作当前实现。

Worker 提交后，状态应为 `CODE_REVIEW`。`IMPLEMENTATION.md` 应包含文件、测试、数据路径验证、失败与修复、准确 commit 和局限。只有口头“已完成”而无实现 commit 和登记不够。

### 7.2 准备准确 diff 并启动 Reviewer

**对话模板：启动独立审查**

```text
请检查当前 CODE_REVIEW 状态，读取批准方案 commit 和 implementation_commit。
将这两个准确 commit 之间的完整实现 diff 保存到当前实验目录，
排除 .research 和 outputs 记录，但包含代码、测试、环境及 .pi 配置变更。
不要用未提交 diff 替代准确版本差异。
读取 .pi/workflows/code-review.workflow.js，完整交给 workflow 工具，background: false。
从真实状态传入 experimentId、implementationCommit、planCommit、planSha256，
以及刚保存的 diffPath；其中 planCommit/planSha256 来自 approved_plan_commit/approved_plan_sha256。
使用脚本规定的 independent-code-reviewer，不复用 Worker 会话，不用 thread 代替。
要求全新上下文、四个只读工具和中文报告；等待宿主自动生成报告、事件与凭据。
```

Captain 可用 `git diff --binary 批准方案COMMIT 实现COMMIT -- . ':(exclude).research' ':(exclude)outputs'` 生成 diff，实际 SHA 必须从 STATE.md 获取。审查脚本已固定 Reviewer 模型及 thinking，不要只改主会话模型来替代它。

**对话模板：核验与登记审查**

```text
请找到本次审查在当前实验 reviews/ 下自动产生的 .json 凭据、.md 报告和 .events.jsonl。
检查是否完成、真实模型、请求/实际 thinking、活动工具、实际调用、
实验 ID、批准方案版本、实现 commit 及报告是否一致。
仅根据真实报告调用 record-review VERDICT MODEL RECEIPT_PATH "中文摘要"。
凭据缺失、被修改、报告为空或 workflow 失败时，不得登记 PASS。
不得把实际发生的禁用工具调用解释成文字表述问题；报告当前状态。
```

报告开头的 `Verdict:`、`Experiment:`、`Reviewed commit:`、`Reviewer model:` 必须是原样独立行，值后不追加说明；随后 `Findings:`、`Evidence:`、`Required changes:` 正文使用中文。凭据由宿主生成，不由模型手工编写。

| 审查结论 | 下一步 |
| --- | --- |
| PASS | 当前准确 commit 进入 READY_TO_RUN |
| CHANGES_REQUIRED | 按审查问题修复、产生新 commit、record-implementation，再独立审查 |
| NEEDS_HUMAN_REVIEW | HUMAN_INTERVENTION，等待人工处理 |
| 缺少有效审查 | 保持待审，不执行实验 |

修复只覆盖已批准方案。方案需要变化时必须重新进入方案审批；当前 CLI 没有通用的“任意状态回到草稿”命令，遇到这种情况先请求人工处理，不手改 STATE.md 绕关。两次 CHANGES_REQUIRED 后进入 HUMAN_INTERVENTION，禁止无限自动修复。

**对话模板：修复与重审**

```text
请核对 revision_count 和审查记录，仅在 IMPLEMENTATION_REVISION 且未达到上限时，
向全新 implementation-worker 传入批准方案、准确审查问题及必需文件。
完成修复、新提交与 record-implementation 后，再用完整 code-review.workflow.js 独立审查。
如果修复需要改变科学方案、命令或基线，停止并请求人工重新规划，不扩大范围。
```

READY_TO_RUN 后、执行前需要对原 commit 重新审查时，先确认 HEAD 未变且代码工作区干净，再 `reopen-review "真实理由"` 立即撤销 PASS，并委派 Reviewer。该命令只重开审查，不授权修改代码。只有真实审查返回 CHANGES_REQUIRED 并进入 IMPLEMENTATION_REVISION 后，才能按批准范围修复和重新登记；若 HEAD/代码已先发生变化，停止并请求人工处理。PASS 后代码变化不能沿用原审查。

## 8. 正式运行、分析与决策

### 8.1 通过 Runner 正式运行

**对话模板：启动 Runner**

```text
请确认当前实验 READY_TO_RUN，当前准确 commit 有有效 PASS 凭据。
通过 workflow 使用全新 experiment-runner，model: deepseek/deepseek-flash，
thinking: low，isolation: false，label: experiment-run。
传入 STATE.md、批准方案、RUN.json、审查报告/凭据及数据环境准备证据。
要求先调用 node scripts/research-workflow.mjs check-run，
成功后再以另一独立 bash 工具调用 node scripts/research-workflow.mjs run。
不得直接执行 RUN.json 的底层命令，不得追加 echo、管道或成功兜底。
只运行本轮一次，不修改代码、方案、环境配置或 RUN.json。
报告真实执行 commit、退出码/信号、日志路径和失败信息，使用中文。
```

运行期间 STATE.md 显示 `RUNNING`，日志实时写入：

```text
outputs/EXP-0001/stdout.log
outputs/EXP-0001/stderr.log
.research/experiments/EXP-0001/EXECUTION.md
```

可在另一个终端查看状态与日志，不能再次启动 run：

```bash
node scripts/research-workflow.mjs status
tail -f outputs/EXP-0001/stdout.log
```

执行成功进入 `ANALYSIS`，失败进入 `EXECUTION_FAILED`。退出码为 0 只是执行证据，不等于科学假设成立。

### 8.2 分析结果

**对话模板：分析**

```text
/skill:result-analysis
```

```text
核验当前实验的退出状态、执行 commit、数据来源、原始输出及批准方案。
依据预先声明的指标重新计算或核验结果，与基线和证伪标准比较。
按需调用 /skill:statistical-analysis 检查统计假设、效应量与不确定性；
再用 /skill:scientific-critical-thinking 检查结论是否超出证据。
分析方差、混杂、泄漏、偏离方案和失败案例，在 RESULTS.md 中给出中文分析，
保留命令、输出路径、不确定性、局限与证据引用；替换待填写内容。
不得改指标、排除失败运行，或仅凭退出码宣称研究成功。
若执行失败，先做失败分析，不把它当成科学上的负结果。
```

### 8.3 作出决策并关闭本轮

**对话模板：决策**

```text
/skill:research-decision
```

```text
基于批准方案、代码审查、执行与分析证据，提出 CONTINUE、REVISE、ABANDON
或 INCONCLUSIVE，并说明理由、替代解释和哪些新证据会改变决定。
更新实验 DECISION.md、项目 DECISIONS.md 与 HYPOTHESES.md，引用实验和 commit。
使用 decide 命令登记真实结论并结束本轮，再展示 STATE.md 的下一步行动。
到此停止；不要自行创建下一轮或启动持续自主循环。
```

登记接口为 `node scripts/research-workflow.mjs decide VERDICT "证据摘要"`。从 ANALYSIS 关闭前必须有 RESULTS.md 的实际分析；REJECTED、EXECUTION_FAILED、HUMAN_INTERVENTION 也可记录有依据的结束决策。结束后回到 `IDLE`；研究决策的 REVISE 表示方向需要修订，不等于重开原方案审批。

### 8.4 提交与归档本轮记录

本轮执行结束并通过 decide 关闭、确认回到 IDLE 后，将科研记录单独提交，再开启下一轮分支。例如：

```bash
git add .research/STATE.md .research/DECISIONS.md .research/HYPOTHESES.md .research/experiments/EXP-0001
git commit -m "归档 EXP-0001 审查与研究记录"
```

按实际变更另外提交文献、失败分析和研究状态文件；审查报告、事件和凭据应保持原始内容。`outputs/` 被忽略，需要另行备份，并在记录中注明存储位置。

不要在 record-implementation 后至正式 run 完成前，为了保存记录额外创建 Git commit：即便只提交 `.research/`，HEAD 也会变化，从而破坏实现/审查/执行 commit 一致性。在这段时间保持原 HEAD，记录先写入工作区并备份，关闭本轮后再提交。

## 9. 恢复会话、处理失败与继续下一轮

### 9.1 新会话与恢复会话

在相同仓库根目录继续最近会话：

```bash
pi -a --continue
```

也可以启动后用 `/resume` 选择会话，或直接用 `pi -a` 开始新会话。会话历史帮助对话连续，**实验状态以 `.research/STATE.md` 和证据文件为准**。

**对话模板：接手与恢复**

```text
请先读取 PROJECT.md，再读取 STATE.md，只检索当前实验及相关决策/失败记录。
说明当前阶段、已绑定的方案/实现/审查/执行 commit，以及允许的下一步。
RUNNING 时只监控已有进程，不再次运行；待审时恢复真实审批或独立审查。
不要把上一会话的口头结论当作审批或 PASS，不要默认读取全部文献与历史。
```

### 9.2 故障处理

| 情况 | 处理方法 |
| --- | --- |
| 启动提示找不到 workflow 模块 | 检查根目录及 `.pi/npm/` 安装，执行上面的固定版本安装命令 |
| 找不到 `/workflows` 或 `/research-plan-review` | 检查项目是否受信任、工作目录、扩展/提示是否被禁用，`/reload` 或重启 |
| 请求/实际 thinking 不一致 | 对照角色配置和模型能力排查，不静默改标记 |
| 方案或 RUN.json 改变 | 不执行；改方案必须重新提交并人工审批，活动状态不支持回退时交人工处理 |
| CODE_REVIEW/READY_TO_RUN 下实现 commit 改变或工作区脏 | 保留变更并交人工处理；这两个状态不能直接 record-implementation，reopen-review 也要求原 commit 未变且代码干净。不得手改状态或删除文件强行通过 |
| 缺失凭据、SDK workflow 返回 null | 保持待审，排查实际会话/报告；不手工补造凭据 |
| 达到修订上限 | 停止，交人工判断；可记录结束决策后另开新实验 |
| 执行失败 | 保留日志，在 failures/ 下记录 ID、commit、错误、根因、证据与下一步 |
| 中断后有 run.lock | 检查锁记录的所有者及子进程组；仍存活时监控或人工停止，不删锁重跑 |

**对话模板：中断恢复**

```text
请检查 STATE.md、.research/run.lock、已有日志和锁内记录的所有者/子进程组。
任一进程仍存活时不得 recover 或另起运行。
仅在确认记录的进程全部停止后，使用 recover-run "实际中断原因"，
将中断记为失败，保留原日志、方案、代码和结果，不自动重新执行。
```

当前 run 使用独占锁，且不覆盖已有 stdout/stderr；不能通过删除锁、日志或手改状态来重复实验。同一科学方向需要重试时，结束失败轮次，再创建新 ID，写明与上轮的关系并重新走审批与审查。

### 9.3 开始下一轮

**对话模板：下一轮设计**

```text
当前轮次已关闭，请先确认 IDLE，并回顾该轮 DECISION.md、RESULTS.md 与相关失败。
基于这些证据提出下一项最小实验，说明与上轮相比唯一主要变化、预期和证伪条件。
检索 HYPOTHESES.md 及已否决方向；没有新证据不要重复被否决的想法。
先给我审阅；经我要求后使用未占用的实验 ID 创建新模板，重新走完整关卡。
不要覆盖旧实验记录、基线或数据，不连续自动执行。
```

例如下一轮使用 `new EXP-0002`，并在新方案引用 EXP-0001 的证据。CONTINUE 也不豁免下一轮人工审批。

## 10. 持续演进项目与工作流

### 10.1 研究方向的演进

每轮只检验可归因的变化，保留基线、数据版本、随机种子、环境锁文件、命令和 commit。将发现写入 RESULTS.md，将选择和被否决的方向写入 DECISIONS.md/HYPOTHESES.md；聊天记录不能替代项目记忆。输出日志默认不进 Git，需按项目需要另行备份或归档，并记录可定位路径及必要校验信息。

### 10.2 提示词、Skill 与模板的演进

| 想改变什么 | 修改位置 | 修改后核对 |
| --- | --- | --- |
| 全局中文输出与协调规则 | `AGENTS.md`、`.pi/APPEND_SYSTEM.md` | 不冲突、不弱化审批和审查 |
| 某阶段的科研方法 | `.pi/skills/对应阶段/SKILL.md` | 输入、步骤、输出、边界和完成标准仍完整 |
| 角色模型或工具 | `.pi/agents/` | 角色标记、模型独立性、实际 thinking 与最终工具集合 |
| 人工审批提示 | `.pi/prompts/`、`plan-review.workflow.js` | 前台、明确回答、无回答中止、版本绑定 |
| 独立审查编排 | `code-review.workflow.js`、SDK 适配层 | 准确 commit、全新上下文、只读工具、自动凭据 |
| 新实验生成模板 | `scripts/research-workflow.mjs` 的模板内容 | 空方案不通过、Pending. 仍拦截未分析结果 |

**对话模板：维护工作流**

```text
这次只维护基础设施：〈具体问题、复现证据与期望〉。
先定位现有实现和相关测试，给出最小修改范围。
保留人工审批、独立模型/上下文、只读审查、准确 commit、凭据校验与执行锁。
不改当前科学方案、RUN.json、数据、基线和历史结果；不创建假实验或假审批。
在独立维护分支/提交中实施必要变更与测试，报告变更、验证证据和未解决问题。
需要改 workflow JavaScript 时，先按需加载已安装的 workflow-authoring Skill。
```

尽量在没有活动实验的 `IDLE` 阶段维护基础设施。活跃实验中修改 `.pi/` 或脚本也会改变代码版本，旧 PASS 不能覆盖新代码；需要先人工明确处理方案/实现版本关系，不能把维护提交悄悄混入已批准执行。

### 10.3 升级 Pi 或插件

先记录当前版本和配置，在独立分支评估升级；分别调整 Pi、插件版本声明、本地安装与适配层版本检查。当前扩展主动拒绝非 3.14.0，不应只删掉检查来“修复”启动。

升级后运行离线套件，再按需进行明确授权的付费合成冒烟验证。确认计划审批三个分支、无界面中止、角色工具与 thinking、审查证据、commit 绑定、实时日志、独占锁和恢复行为。未验证项写入 HARDENING.md。不要在正式实验中途运行泛化的自动升级或无限自主工作流。

## 文件索引与协议约定

| 位置 | 用途 |
| --- | --- |
| `.research/PROJECT.md` | 科学问题与项目约束的来源 |
| `.pi/skills/`、`.pi/vendor/scientific-agent-skills/` | 阶段 Skill、方法适配层及固定版本上游资料 |
| `.research/STATE.md` | 状态恢复入口，状态转换使用脚本，不手改绕关 |
| `.research/DECISIONS.md`、`HYPOTHESES.md` | 跨轮次决策与假设记忆 |
| `.research/literature/`、`failures/`、`reviews/` | 文献、失败和审查记录 |
| `.research/experiments/EXP-XXXX/` | 本轮方案、实现、审查、执行、分析和决策 |
| `outputs/EXP-XXXX/` | 实时运行日志，默认被 Git 忽略 |
| `.pi/workflows/settings.json` | workflow 共享默认值，如代理会话持久化 |
| [命令参考](.research/workflow/README.md) | 每条命令的状态要求和准确接口 |
| [验证记录](.research/workflow/HARDENING.md) | 已验证范围、失败和兼容性边界 |

自然语言回复、报告和记录正文必须使用简体中文。机器读取的文件名、路径、命令、字段名、模型 ID、哈希、状态/决策枚举、`Research role:`、PLAN.md 十个英文二级标题、审查报告字段标签及 `Pending.` 标记保持原样。引用原文、术语与原始日志可以保留原语言，配中文说明，不得改写原始证据。

Pi 工具白名单不是操作系统沙箱；正式实验统一通过状态脚本的 `run` 入口。宿主凭据用于可信参与者审计，不是抵御恶意仓库写入者的签名。日常操作优先查命令参考，仅在排查具体故障时读取状态脚本或依赖源码。

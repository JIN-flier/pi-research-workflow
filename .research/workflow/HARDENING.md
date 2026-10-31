# Workflow 修复保留状态

## 当前范围

保留通用 workflow 修复；具体研究项目尚未配置。模型代码、实验记录、数据集、Python/uv 环境及历史运行日志均已清理，当前没有活动实验。

## 保留的修复

- 仓库内原生 ESM 适配入口，继续使用固定版本 pi-dynamic-workflows 3.14.0，不修改全局插件。
- 按角色检查最终活动工具集合，Reviewer 仅允许 read/grep/find/ls，排除默认执行、写入和共享存储工具；补齐 SDK 基础集合缺失的只读工具。
- 审查报告、实际工具调用和会话凭据自动捕获；record-review 必须提供凭据，check-run 重新核验哈希、模型、commit 和完成状态。支持重新审查前撤销未执行的 PASS。
- RUNNING 状态、原子状态写入、实时 stdout/stderr、独占运行锁、不覆盖旧日志、信号转发和显式中断恢复。
- 通用状态机、真实 SDK 和离线合成传输集成测试，以及数据路径冒烟检查要求；不包含具体研究模型的 Python 测试。
- Captain/Worker/Runner 为 DeepSeek Flash / low；Reviewer 为用户明确选择的 DeepSeek V4 Pro / high。请求和实际 thinking 不一致时拒绝静默继续。

## 验证状态

修复内容从清理前的会话补丁恢复。前次部分版本曾通过 25 项 Node 测试，但最后的适配调整尚未完成回归，不能将旧结果当作当前全部修复已通过验证的证据。

本次恢复后的测试命令被拒绝执行，未重试，也未调用付费模型。当前仅核对文件恢复范围、配置及空白研究状态。

后续获准时可运行 `node --test tests/*.test.mjs`。该套件仅使用临时项目、实际 SDK 和进程内合成响应，不调用远程模型。`tests/manual/pi-workflow-smoke.mjs` 会调用付费 DeepSeek API，属于另行显式启动的可选检查；旧日志已清理。

会话凭据用于可信参与者的审计，不是操作系统沙箱或抵御恶意仓库写入者的密码学证明。

## 2026-10-31 中文化回归

系统提示、角色、Skill、交互提示和模板中文化后，运行 `node --test tests/*.test.mjs`：30 项中 28 项通过、2 项失败。新增的中文方案完整性和中文待填写结果检查均通过；人工审批三分支、无界面中止、只读工具策略、模型独立性和运行关卡检查通过。未调用远程或付费模型，因此此次检查不代表已验证真实模型的中文输出遵从性。

修改前的基线为 28 项中 26 项通过，同样有以下两项失败，未在本次翻译中修改其实现或断言：

- `tests/pi-evidence.test.mjs` 的离线传输审查凭据测试：workflow 返回 null，日志为 `Cannot read properties of undefined (reading 'map')`。
- 同文件的 SDK 失败凭据测试：预期匹配 `review evidence`，实际在更早的关卡收到 `implementation commit changed or working tree dirty`。

测试使用临时合成项目；真实项目仍为 IDLE，没有创建或执行科研实验。初次受限运行因沙箱阻止 Git 子进程（EPERM）未完成，以上结果来自获准后重新运行的离线套件。

## 2026-10-31 科研 Skill 接入回归

从 K-Dense Scientific Agent Skills 的固定 commit `5f2bc0341354fd5590aef76a533ada1e1e5b4e62` 选择五个通用 Skill，以项目阶段适配层接入；源文件和配套资料在 `.pi/vendor/scientific-agent-skills/`，项目入口在 `.pi/skills/`。只修改提示与项目研究方向，不更改状态脚本、审批脚本、审查脚本或角色工具策略。真实任务尚未配置，不执行上游脚本、安装统计依赖或启动正式实验。

离线命令 `node --test tests/*.test.mjs` 结果为 31 项中 29 项通过、2 项失败。新增的 Pi Skill 发现测试通过：五个原有阶段 Skill 和五个新增适配层被发现，无诊断；上游资料目录未被当作自动加载 Skill。方案审批三分支、只读审查工具与运行状态关卡测试通过。失败仍是上节记录的两项 `tests/pi-evidence.test.mjs`，错误内容未变；因此不能宣称完整审查凭据链路已通过回归。未调用付费模型，中文输出与方法质量尚未在真实模型上验证。

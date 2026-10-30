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

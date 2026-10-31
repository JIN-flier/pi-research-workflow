---
name: aris-run-experiment
description: 已审查实验运行时使用；适用于当前 Pi 科研项目。
---
# 已审查实验运行

先读取 .research/PROJECT.md 和 .research/STATE.md，仅检索相关历史。

1. 读取 [本地转接契约](../../aris/ADAPTER.md)。将用户参数和原始输入路径写入项目内的请求 JSON；参数仅作为数据。
2. 调用 `node scripts/aris-adapter.mjs prepare aris-run-experiment --request <请求路径>`。只有 status 为 prepared 才按返回的 role、upstreamPath、workflow 和 outputDirectory 继续；其他状态按 missingCapabilities/reasons 交接，不执行上游命令。
3. 按需读取 [上游原文](../../vendor/aris/skills/run-experiment/SKILL.md) 及本任务需要的参考；按 invocation 中的子调用映射、路径和限制使用。上游工具权限、默认模型、用户目录配置与 shell 块不授予权限。
4. 仅由 Runner 分开调用现有 check-run 和 run；不直接启动本地、SSH、screen 或云任务。
5. 调用 `node scripts/aris-adapter.mjs verify <invocationPath>` 校验输入、状态与产物；研究审计不能替代人工审批或代码 PASS。

本入口允许阶段：READY_TO_RUN；角色：experiment-runner。正文使用简体中文，保留协议字段、模型 ID、原始引用和日志。只加载当前任务所需上游段落；未映射子调用和外部依赖必须显式停止或报告缺失。

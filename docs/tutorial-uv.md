# 用一个浮点求和实验学习科研 workflow

本教程使用 EXP-0001。研究问题是：大数相消时，`math.fsum` 是否比从 `0.0` 开始逐项 `+=` 更准确？它是一个已有数值方法的教学验证，不主张创新。

固定三个样例：`[1, 2, 3]` 作普通对照；`[1e16, 1, -1e16]` 和 `[1e16, 1, 1, -1e16]` 作相消样例。假设是两组相消样例的绝对误差严格下降，而普通对照不退化。实际结果需等正式运行后记录。

## 1. 看清环境和当前状态

在项目根目录操作：

```bash
cd /home/flier/agent/pi-agent/project
uv sync --locked --offline
uv run --locked --offline python -c "import sys; print(sys.version); print(sys.executable)"
node scripts/research-workflow.mjs status
```

本机已验证 Python 3.14.4。`sys.executable` 应指向项目 `.venv/bin/python`。这里的 Python 命令仅检查环境。

- `pyproject.toml` 声明项目和依赖；本例仅用标准库。
- `.python-version` 固定解释器版本，`uv.lock` 固定依赖解析。
- `.venv` 是本地生成的环境，不提交 Git。
- `uv sync --locked` 检查锁文件并同步环境；`uv run --locked` 在项目环境里执行命令，不需要 `source .venv/bin/activate`。
- `--offline` 适用于这台已安装所需 Python 的机器。换机器时，先在联网环境安装 Python 3.14.4，再同步环境。

本轮准备完成后的状态应为 `PLAN_REVIEW`。`PLAN.md` 是完整方案；`RUN.json` 是人工批准后允许执行的命令。`PLAN_REVIEW` 阶段等待人工选择，尚未实现或执行实验。

## 2. 体验 Gate 1：人工审批

先读 `.research/experiments/EXP-0001/PLAN.md` 和同目录 `RUN.json`。正式命令是 `uv run --locked --offline python src/summation_demo.py`，预估不足一秒、无需 GPU 或外部数据。

在项目根目录打开交互式 Pi：

```bash
pi -a
```

在 Pi 输入：

```text
/research-plan-review
```

这会要求 Research Captain 读取现有方案，并使用 `workflow` 工具执行项目的审批脚本，设置 `background: false`。第一次确认询问是否 APPROVE：选 Yes 即批准。选 No 后，第二次确认询问是否 REJECT：选 Yes 终止本轮，选 No 返回 REVISE。无交互时会中止。

Pi 应保存实际 checkpoint run ID 和你的理由，然后更新 STATE.md。批准后状态应为 `PLAN_APPROVED`。如果改方案，重新提交并重新审批；不要直接修改 STATE.md 中的状态。

## 3. 让 Worker 实现批准方案

仅在 `PLAN_APPROVED` 后，继续在 Pi 输入：

```text
继续 EXP-0001。先读取 STATE.md 并核对批准方案的 commit/hash，然后通过 workflow 的 agent() 调用 agentType="implementation-worker"，使用新上下文。只实现已批准的浮点求和实验。创建实验分支；所有 Python 命令使用 uv run --locked --offline。按 PLAN.md 编写并运行必要单元测试，提交实现 commit，生成 IMPLEMENTATION.md 并记录实现模型的真实 ID。完成后停在 CODE_REVIEW，不运行正式实验。
```

Worker 此时才创建 `src/summation_demo.py` 和 `tests/test_summation_demo.py`。单元测试命令为：

```bash
uv run --locked --offline python -m unittest discover -s tests -p test_summation_demo.py
```

测试检查程序实现是否符合方案；正式实验的测量结果要由后续 Runner 留档。实现提交后状态应为 `CODE_REVIEW`。

## 4. 体验 Gate 2：独立审查

当前角色配置使用 DeepSeek Worker 和 `openrouter/openai/gpt-5.4` Reviewer。配置 Reviewer 的可用凭据后，在 Pi 输入：

```text
继续 EXP-0001 的独立审查。读取批准方案和 implementation_commit，生成该 commit 相对 approved_plan_commit 的 Git diff。通过 agentType="independent-code-reviewer" 在独立上下文审查，将方案、diff 和 commit 明确传给它。确认实际模型与 Worker 来自不同模型家族。保存它的完整报告，再依据真实 verdict 调用 record-review；不要自行填写 PASS，也不执行实验。
```

PASS 后状态为 `READY_TO_RUN`；CHANGES_REQUIRED 返回修改，每次新提交都必须重审；NEEDS_HUMAN_REVIEW 停止等待人工处理。若模型不可用，保持待审状态。

## 5. Runner 正式运行并留下证据

仅在 `READY_TO_RUN` 后，在 Pi 输入：

```text
通过 experiment-runner 执行 EXP-0001。先核对 STATE.md、批准方案、RUN.json 和审查报告，调用 check-run，再只通过 node scripts/research-workflow.mjs run 正式执行。汇报真实退出状态、执行 commit 和 stdout/stderr 日志路径；不要改代码或配置。
```

Runner 的 `run` 命令内部调用已批准的 `uv run --locked --offline ...`。检查以下文件：

- `outputs/EXP-0001/stdout.log`：实际测得的 JSON。
- `outputs/EXP-0001/stderr.log`：错误日志。
- `.research/experiments/EXP-0001/EXECUTION.md`：运行记录。
- `.research/STATE.md`：成功后为 `ANALYSIS`，执行失败则为 `EXECUTION_FAILED`。

`uv` 管理 Python 环境；workflow 管理审批、commit 与证据。正式运行通过 workflow 的 `run` 入口留档。

## 6. 分析结果、收尾，再体验恢复

在 Pi 输入：

```text
按 result-analysis Skill 分析 EXP-0001 的真实输出，核对三组样例的误差与预先声明的判定标准，写 RESULTS.md。然后按 research-decision Skill 写出有证据的决定，更新 HYPOTHESES.md 和 DECISIONS.md，通过 decide 命令收尾。区分实验运行成功与假设得到支持，不扩大结论范围。
```

关闭 Pi，重新打开后输入：

```text
恢复本项目研究状态。先读 PROJECT.md 和 STATE.md，仅检索 EXP-0001 相关记录，告诉我假设、证据、最终决定和下一步。
```

此时即使没有上次聊天上下文，也应能依靠项目记忆恢复进度。

参考：[uv 项目指南](https://docs.astral.sh/uv/guides/projects/)、[Python 3.14 math.fsum 文档](https://docs.python.org/3.14/library/math.html#math.fsum)。

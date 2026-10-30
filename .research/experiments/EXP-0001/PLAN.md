# Experiment plan

EXP-0001：浮点求和教学实验。此文档是待审核方案，下面的预期值不是实测结果。

## Scientific question
当大数相消时，math.fsum 能否比从 0.0 开始、按输入顺序执行 total += x 的朴素累加保留更多精度？

## Hypothesis
对下面两组相消样例，math.fsum 的绝对误差均严格小于朴素累加；对普通对照，误差不增加。

## Mechanism
浮点运算精度有限，中间结果可能丢失较小的加数。math.fsum 使用多项中间和降低精度损失；本轮只验证指定样例上的表现。

## Related work and novelty
Python 官方文档：https://docs.python.org/3.14/library/math.html#math.fsum 。这是已有标准库方法的教学验证，不主张新算法或科研创新，不进行完整文献调查。

## Design
人工批准后，Worker 创建实验分支，新增 src/summation_demo.py 和 tests/test_summation_demo.py，使用 Python 标准库。

环境由 uv 管理：本机 Python 3.14.4，`.python-version` 固定解释器版本，`pyproject.toml` 声明 Python 3.14 系列且无第三方依赖，`uv.lock` 固定项目依赖解析。环境配置与方案一同提交。用 `uv sync --locked --offline` 准备 `.venv`；正式运行用 `uv run --locked --offline python src/summation_demo.py`，不直接调用系统 python3。无需激活虚拟环境。

固定输入与数学上的精确和：

| 样例 | 输入（浮点数，保持顺序） | 精确和 |
| --- | --- | --- |
| control | [1.0, 2.0, 3.0] | 6 |
| cancellation_one | [1e16, 1.0, -1e16] | 1 |
| cancellation_two | [1e16, 1.0, 1.0, -1e16] | 2 |

不使用随机数、数据划分或多次重复。上述精确和由整数运算确定。实现朴素累加函数，候选方法调用 math.fsum；不能用 Python 内置 sum 替代本方案的 baseline。

程序在 stdout 输出 JSON，包含 Python 版本、每个样例的输入、精确和、两种结果与绝对误差，以及 supported 布尔值。假设不成立也应如实输出并正常退出；异常才以非零退出码表示执行失败。

必要测试：输入不被修改；朴素函数逐项累加；每个误差等于 abs(结果-精确和)；supported 必须依据实际比较计算。测试命令为 `uv run --locked --offline python -m unittest discover -s tests -p test_summation_demo.py`。正式命令固定在 RUN.json 中。

## Baseline and controls
Baseline：固定的 total = 0.0、按顺序 total += x。候选：math.fsum。两者使用相同输入、顺序、Python 和机器。control 是无大数相消的对照；本轮不比较速度，不改输入来追求预期结果。

## Metrics
每种方法、每个样例的绝对误差 abs(结果 - 精确和)。两组相消样例均要求候选误差严格更小；普通对照要求候选误差不大于 baseline。

## Expected results
预期候选在相消样例误差更小，普通对照无退化；实际数值待执行记录。不得把此处的预期复制为 RESULTS.md 的观测。

## Falsification criteria
任一相消样例候选误差未严格减小，或对照误差增加，则本轮假设不受支持。若程序报错则记录执行失败，不当作假设被否定。

## Cost and risks
仅 CPU、无 GPU、无网络和第三方依赖；预计正式运行不足一秒。Worker/Reviewer 的模型调用仍可能产生费用。本例只说明固定输入的数值行为，不能推广为所有输入均改善。代码必须先经独立 Reviewer 审查，通过后 Runner 才能执行 RUN.json。

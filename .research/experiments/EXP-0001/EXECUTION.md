# EXECUTION — EXP-0001

- Experiment: EXP-0001
- Status: `success`，exit `0`
- Execution commit: `b578aef217891d13d15697547562fdcb07d7a859`
- Approved plan commit: `b71c3fe135362856f950392eb395963c55c8543f`
- Wrapper wall time: `56.4 s`（原始工具事件 `wall_time_seconds=56.4`、`durationMs=56447`；in-process metrics total `54.306 s`）
- Logs: `outputs/EXP-0001/stdout.log`、`outputs/EXP-0001/stderr.log`（空）、`outputs/EXP-0001/metrics.json`
- Run path: `node scripts/research-workflow.mjs check-run` → `node scripts/research-workflow.mjs run`
- Note: the runner appended `echo "EXIT_STATUS=$?"` after the gated `run` command to capture the exit status; the training command itself was unchanged.

## Original execution record (preserved verbatim)

- started=2026-10-30T14:06:18.759Z | finished=2026-10-30T14:07:15.152Z | command=["timeout","1800","env","OMP_NUM_THREADS=2","MKL_NUM_THREADS=2","PYTHONHASHSEED=42","uv","run","--frozen","python","-m","mnist_light.train","--config","configs/exp0001.json","--output","outputs/EXP-0001/metrics.json"] | commit=b578aef217891d13d15697547562fdcb07d7a859 | exit=0 | status=success | logs=outputs/EXP-0001/

## Result summary

- MLP: validation 0.9660，test 0.9677，76,330 params。
- CNN: validation 0.9856，test 0.9868，80,602 params。
- Test-set reads: `count=1`，`stage="final"`。
- In-process timings: setup 0.041 s，train_mlp 9.064 s，train_cnn 42.970 s，final_test 2.219 s，total 54.306 s；peak RSS 476.1 MiB。
- stderr empty；no retry，no extra run。

我已读取并核对了计划、RUN.json、实现报告、精确 diff 及全部相关源文件、配置、测试与锁文件。以下是独立复审报告。

---

**Verdict:** PASS

**Experiment:** EXP-0001（CNN vs MLP 轻量 MNIST，CPU-only，2 线程，3 epoch，seed 42）

**Reviewed commit:** `b578aef217891d13d15697547562fdcb07d7a859`

**Reviewer model:** `deepseek/deepseek-v4-pro`

**Tools used:** read, grep, find, ls（只读，未执行任何程序）

## Findings（无阻塞项）

### 1. CNN/MLP 数学与参数量 —— 正确
- MLP：`Flatten(784)→Linear(784,96)→ReLU→Linear(96,10)`。784×96+96=75,360；96×10+10=970；合计 **76,330**。`models.py:59-70` 与计划一致。
- CNN：Conv(1,16,3,p=1)=144+16=160；Conv(16,32,3,p=1)=4,608+32=4,640；Flatten 后 32×7×7=1,568；Linear(1568,48)=1,568×48+48=75,312；Linear(48,10)=480+10=490；合计 **80,602**。`models.py:74-94` 与计划一致。
- `MaxPool2d(2)` 默认 stride=2，28→14→7 正确。`build_mlp/build_cnn` 在构建时断言精确值并 `_check_budget` 上限 100,000（`models.py:97-115`）。无计算错误。

### 2. 种子与分割 —— 正确
- `make_split()` 使用 `np.random.default_rng(42).permutation(60000)`，前 5000 为 validation、余 55000 为 train（`data.py:41-48`），与计划逐字一致；互斥且覆盖 0..59,999（测试 `test_split_is_disjoint_and_covers_all_training_indices` 验证）。
- `split_digest` 对 int64 索引字节做 SHA256，写入 metrics（`data.py:51-60`、`train.py:329`）。可复现（独立 Generator，不污染全局 RNG）。

### 3. DataLoader 索引 —— 正确
- 训练 loader 用 `SubsetRandomSampler(list(indices), generator=torch.Generator().manual_seed(seed+epoch))`，`num_workers=0`（`data.py:105-120`），实现每 epoch 带 seed 重打乱。
- 评估 loader 用 `Subset(dataset, list(indices))`、`shuffle=False`，确定性（`data.py:123-130`）。validation 取 `val_idx`（5000 张），与 train 索引无交集。

### 4. 训练预算与线程 —— 正确
- `train_one_model` 严格 `for epoch in range(1, epochs+1)`，epochs=3（`train.py:230`）。每 epoch 后验证一次。
- `configure_runtime` 设 `torch.set_num_threads(2)`、`torch.use_deterministic_algorithms(True)`、`set_seed(42)`（`train.py:186-190`）；`OMP/MKL_NUM_THREADS` 在 torch 导入前 `setdefault`（`train.py:24-27`），RUN.json 亦导出同名变量。`num_workers=0` 全程。

### 5. 测试集协议 —— 正确（无泄漏）
- 测试集仅在 final 阶段经 `TestSetGuard.read()` 构造一次（`train.py:422-428`），此前 `run_experiment` 只加载训练集（`train.py:356-357`）。`load_mnist_test` 除 guard 工厂与 `load_mnist_datasets`（仅测试用）外无其他调用（grep 确认）。
- 每个固定模型在 final 阶段各做一次前向评估（`train.py:430-433`）；guard 构造失败不消耗配额（`data.py:147-155`），结束时 `assert_read_once()` + `read_count==1` 硬断言（`train.py:434-442`）。
- 模型选择仅用 `final_val_accuracy`（平局取参数量少者，`train.py:200-211`），测试集不参与选择；主目标始终为 CNN，提名不改变评估。看到测试结果后无训练/改参/重选。
- 归一化常量 0.1307/0.3081 为硬编码固定值，非测试集计算，无泄漏。

### 6. Metrics 契约 —— 正确
- 覆盖计划要求字段：experiment_id、git_commit、seed、versions、threads、parameter_counts、split_digest、split_sizes、epochs、batch_size、models、nominated_model、test_evaluations、timings_sec、peak_rss_mb（`train.py:55-76`、`build_metrics_skeleton`）。
- `validate_metrics` 强制 threads==2、每模型恰 3 epoch、测试读取恰 1 次且 stage=="final"（`train.py:123-198`），违规则抛错终止。

### 7. uv CPU-only 锁定环境 —— 正确
- `uv.lock`：torch 2.15.0+cpu、torchvision 0.29.2+cpu 均来自 `https://download.pytorch.org/whl/cpu`；grep `nvidia|cuda|cu11|cu12` 零命中。`.python-version`=3.12，`pyproject.toml` requires-python `>=3.12,<3.13` 且 `[[tool.uv.index]]` explicit + `[tool.uv.sources]` 锁定 CPU 索引。

### 8. 运行命令兼容性 —— 正确
- `parse_args` 仅接受 `--config`/`--output`（`train.py:89-93`），RUN.json 命令 `python -m mnist_light.train --config configs/exp0001.json --output outputs/EXP-0001/metrics.json` 可原样解析；无 `--download` 标志，正式运行 `download=False`，数据缺失即 `FileNotFoundError` 失败（不触发下载）。

### 9. Scope 与测试盲区 —— 可接受，不阻塞
- diff 仅含 11 个文件（`.gitignore` 修改 + 10 个新增），未改动 `RUN.json`、`PLAN.md`、workflow 脚本或基线，scope 干净。
- 盲区：单元测试不加载真实 MNIST、不执行训练循环/final 阶段/线程数生效的端到端验证；digest 只验证长度与内容敏感性（未固定具体值）。这些属于小型实验的可接受盲区，不构成正确性/泄漏/协议问题。实现报告已如实声明相关未验证风险。

## Evidence
- 参数量：`mnist_light/models.py`（MLP/CNN 定义、`EXPECTED_PARAMETER_COUNTS`、`build_*` 断言）。
- 分割与 guard：`mnist_light/data.py:41-60`、`133-163`。
- 训练/最终测试编排：`mnist_light/train.py:230-243`（epoch 循环）、`356-357`（仅训练集）、`420-443`（final 单次测试读）。
- 环境锁定：`uv.lock`（torch/torchvision `+cpu`，无 nvidia）、`pyproject.toml:29-36`。
- 测试：`tests/test_mnist_light.py`（参数量、分割互斥/可复现、guard 单次读、config/metrics 契约、CLI 无 download）。

## Required changes
无。未发现任何正确性、数据泄漏或协议违规问题；批准方案被如实实现，测试盲区已被实现报告显式披露且不构成阻塞。

（报告结束。未读取先前 REVIEW 报告；未执行任何程序，本复审仅基于读取到的代码与 diff。）

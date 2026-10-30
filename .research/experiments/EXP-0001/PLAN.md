# Experiment plan — EXP-0001

## Scientific question

在仅 CPU、PyTorch 限制 2 个线程、每个模型最多 3 个 epoch、每个模型参数量不超过 100,000、且仅使用一个随机种子的条件下：

1. 一个“卷积层 + MLP 分类头”的轻量级 MNIST 模型能否达到至少 98% 的测试准确率？
2. 在同一预算下，它的验证准确率是否高于纯 MLP 基线？

本实验是研究 workflow 的真实性验证和轻量可复现基准，不主张研究创新。

## Hypothesis

在 seed=42、固定 55,000/5,000 训练-验证划分、每个模型 3 个 epoch 的相同预算下，CNN（16/32 通道卷积 + 48 单元 MLP 头）的最终验证准确率高于纯 MLP（784→96→10），并且该 CNN 在训练与选择结束后的一次性测试准确率不低于 0.98。

## Mechanism

卷积核在空间上共享权重并具有平移等变性，池化降低空间分辨率，适合手写数字的局部笔画模式；因此在相同参数与 epoch 预算下，CNN 应比同预算全连接网络更样本有效。纯 MLP 缺少局部权重共享，需要更多参数才能表达相近的局部特征，故预期验证准确率较低。

## Related work and novelty

- LeCun, Bottou, Bengio, Haffner, “Gradient-based learning applied to document recognition”, *Proceedings of the IEEE* 86(11), 1998：MNIST 与卷积网络的经典工作，报告了远高于 98% 的测试准确率，但使用更大的网络和更长训练。
- torchvision MNIST 数据集文档与标准预处理常量（mean 0.1307, std 0.3081）。
- 本计划不进行系统性文献检索，也不主张任何方法新颖性；最接近的“prior work”是公开 MNIST 教学级 CNN 基准。实验价值仅在于在明确的低资源约束和可审查 workflow 下如实测量本仓库的第一个可复现结果。

## Design

### 数据与固定划分

- 数据：torchvision 原始 MNIST。训练集 60,000 张；官方测试集 10,000 张。
- 划分规则（固定、先于训练确定）：`numpy.random.default_rng(42).permutation(60000)`；取前 5,000 个索引为 validation，其余 55,000 个索引为 train。索引集合写入 metrics JSON 的 SHA256 摘要以便复核。验证集与训练集互斥；测试集索引不参与任何训练或选择。
- 预处理：`ToTensor()` 后按固定常量 `(x - 0.1307) / 0.3081` 归一化。不做数据增强。常量是 MNIST 常用固定值，不由测试集计算。
- 测试集协议：训练和模型选择全部结束后进入唯一的 final 阶段；在该阶段对两个已固定的模型各做一次前向评估（CNN 一次、MLP 一次），这是测试集唯一的读取阶段。看到测试结果后不再训练、不改超参数、不改变选择。若实现出现任何额外测试集读取，本轮结果无效。

### 模型（参数量硬上限 100,000）

- MLP 基线：`Flatten(784) → Linear(784,96) → ReLU → Linear(96,10)`。参数量 784×96+96 + 96×10+10 = **76,330**。
- CNN：`Conv2d(1,16,3,padding=1) → ReLU → MaxPool2d(2)`（28→14）→ `Conv2d(16,32,3,padding=1) → ReLU → MaxPool2d(2)`（14→7）→ `Flatten(1568)` → `Linear(1568,48) → ReLU → Linear(48,10)`。参数量 160 + 4,640 + 75,312 + 490 = **80,602**。
- 两个模型均由 `models.py` 构建；构建后立即断言参数量 ≤100,000，并在 metrics JSON 中记录精确统计值。
- 初始化：在每个模型构建前调用 `set_seed(42)`（Python `random`、NumPy、PyTorch），使 MLP 与 CNN 各自可复现。

### 训练协议（两者完全同预算）

- 优化器：Adam，`lr=1e-3`，`betas=(0.9,0.999)`，`eps=1e-8`，`weight_decay=0`。
- 损失：交叉熵。
- batch size 128；训练集每个 epoch 用带 seed 的生成器重新打乱；`num_workers=0`。
- 每个模型恰好 3 个 epoch；每 epoch 结束在 5,000 张 validation 上计算准确率，记录 loss/accuracy 曲线。
- 线程：`torch.set_num_threads(2)`，并设置 `OMP_NUM_THREADS=2`、`MKL_NUM_THREADS=2`；`torch.use_deterministic_algorithms(True)`。
- 选择规则：仅依据最终 validation 准确率在 MLP 与 CNN 之间指定“提名模型”；平局时选参数量更少者。该规则在看到测试结果前固定。主目标始终针对 CNN，不因选择而改变。

### 实现边界（获批后由实现 worker 完成）

计划约定尚未实现的脚本命令；本阶段不写实现、不安装依赖、不训练：

- `pyproject.toml`、`.python-version`（Python 3.12）和 `uv.lock` 必须提交；PyTorch 使用 CPU-only 索引，避免 CUDA 依赖。
- Python 包最小结构：`mnist_light/{__init__.py,data.py,models.py,train.py}`、`configs/exp0001.json`，以及模型/划分/测试集协议的单元测试。
- `train.py` 输出 metrics JSON，至少包含：实验 ID、Git commit、seed、Python/PyTorch/NumPy 版本、线程数、两个模型的参数量、划分摘要、每 epoch 训练 loss 与验证准确率、最终验证准确率、提名模型、两个模型各自的一次性测试准确率、每阶段耗时，并在结束时断言测试集只被读取一次。
- 实现阶段必须添加并通过测试：参数量精确值、划分大小/互斥/可复现、测试集访问守卫（第二次读取抛错）。

### 环境准备与成本分列

- 首次安装：`uv sync --frozen`（含 Python 3.12 与 CPU-only torch/torchvision wheel 下载）单独计时并记录下载量，不计入模型训练时间。
- 数据下载：一次性执行 `uv run --frozen python -m mnist_light.prepare --data-dir data`，单独计时；正式运行使用已存在的数据，`download=False`，若数据缺失则直接失败。
- 正式 RUN.json 命令只做训练、验证和最终一次性测试。

## Baseline and controls

- 基线：同数据、同划分、同 seed、同优化器、同 batch size、同 3 epoch 预算的纯 MLP（76,330 参数）。
- 控制：两个模型共享数据加载、预处理、随机种子、线程数与评估代码；唯一受控差异是网络结构（卷积 vs 全连接）。
- 不调整基线或模型以迎合测试结果；测试集不参与模型选择。

## Metrics

- 主指标：CNN 在测试集上的一次性准确率（目标 ≥0.98）。
- 次指标：MLP 测试准确率；两个模型的最终验证准确率及逐 epoch 验证曲线；参数量；每 epoch 与总训练/评估墙钟时间；峰值内存（如可获得）。
- 成本指标单独报告：首次安装耗时与下载量、数据集下载耗时与大小、正式运行墙钟时间。
- 报告保留 JSON 原始值和日志，不以四舍五入掩盖未达标。

## Expected results

- CNN 测试准确率预计约 98.3%–99.2%；MLP 预计约 97.2%–98.4%。
- 预期 CNN 验证准确率高于 MLP。
- 这些是预期而非承诺；单 seed、3 epoch 的结果不能外推为统计显著结论。

## Falsification criteria

1. CNN 的一次性测试准确率 < 0.98：主目标未达成，假设按原样记为未达标，不通过调参或重复测试来“补救”。
2. CNN 最终验证准确率 ≤ MLP 最终验证准确率：“CNN 在同预算下优于 MLP”被证伪或未获支持。
3. 任一模型参数量 >100,000、epoch 数 >3、线程数 ≠2、划分与测试集重叠、或测试集被读取超过规定次数：运行协议无效，不得作为科学结果。
4. 看到测试结果后发生训练、超参数修改或模型重选；或 `RUN.json` 在批准后被修改：结果无效。
5. 未提交可复现环境（`pyproject.toml`、`.python-version`、`uv.lock`）或正式运行触发未计量的安装/下载：视为准备失败，不产出正式结果。

## Cost and risks

- 硬件与时间：CPU、2 线程。预计 MLP 每 epoch <10 秒、CNN 每 epoch 约 20–60 秒，训练加验证 <5 分钟；正式运行硬预算 30 分钟墙钟，超时则按失败记录。
- 首次安装：CPU-only torch/torchvision 与 Python 解释器预计下载数百 MB，可能耗时 5–20 分钟（网络相关）；MNIST 下载约 11 MB，预计 <2 分钟。两者单独计量，不计入模型运行预算。
- 风险与缓解：
  - 测试集泄漏：测试加载器只在 final 阶段构造，并有访问计数守卫；测试不参与选择。
  - 参数量误算：构建时断言并记录；单元测试固定精确值。
  - CPU 非确定性：启用确定性算法、固定种子；仍可能存在极小的浮点差异，故只报告单次结果。
  - 单 seed：不估计方差，结论仅限该 seed；不声称显著性。
  - 依赖/网络失败：准备阶段失败则不动用正式 run，保留日志并报告阻塞。
  - 3 epoch 限制可能使 MLP 或 CNN 未充分收敛；这是预算约束的一部分，不通过增加 epoch 规避。
  - 基线公平性：除结构外所有训练因素保持一致。

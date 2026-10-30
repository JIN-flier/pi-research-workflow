# Project

- Project ID: PROJECT-001
- Scientific question: 在仅使用 CPU、限制 2 个线程、每个模型最多训练 3 个 epoch、参数量均不超过 100,000、且只使用一个随机种子的条件下，一个“卷积层 + MLP 分类头”的轻量级 MNIST 模型能否达到至少 98% 的测试准确率？在同一预算下，它的验证准确率是否高于纯 MLP 基线？
- Research objective: 用可复现、可审查的最小实验回答上述问题，并如实记录达标或未达标的结果。本实验是研究 workflow 的真实性验证与轻量基准，不主张任何研究创新。
- Prior work and available code: 仓库当前没有模型或训练代码。方法背景为 LeCun et al. (1998) 的 MNIST 卷积网络工作以及 torchvision 提供的 MNIST 数据集；具体实现将在计划获批后由实现 worker 编写。
- Constraints:
  - 每个方案最多 3 个 epoch，参数量均不超过 100,000。
  - 仅 CPU，PyTorch 线程数固定为 2；单随机种子，不承诺统计显著性。
  - MNIST 原始训练集固定划分为 train/validation；官方测试集只在训练和模型选择全部结束后评估一次。
  - 必须先有已提交计划、人工批准（PLAN_REVIEW 之后的显式 APPROVE）和独立代码审查 PASS，才允许正式运行。
  - 正式运行只能通过 `node scripts/research-workflow.mjs run`；不要求也不承诺达到 98%，未达标必须如实记录。
- Dataset: MNIST（torchvision 下载的原始 60,000 张训练图与 10,000 张测试图）。训练集按固定规则划分为 55,000 train / 5,000 validation；测试集仅用于最终一次性评估。数据不提交到 Git，存放于本地 `data/`。
- Python environment: 计划使用 uv 管理，Python 3.12（以实现阶段实际锁定为准），CPU-only PyTorch + torchvision + NumPy。必须提交 `pyproject.toml`、`.python-version` 和 `uv.lock`；`.venv/` 与数据目录忽略。首次安装（含 CPU wheel 下载）与数据集下载开销单独计量。
- Evaluation command: 每轮实验在已提交的 `RUN.json` 中给出精确命令；本轮计划为 `uv run --frozen` 调用 `mnist_light.train`，脚本尚待实现。
- Metrics: 主指标为 CNN 模型在测试集上的一次性准确率；次指标为 MLP 基线测试准确率、两者最终验证准确率、参数量、每 epoch 与总运行时间、环境准备/数据下载开销。
- Risks: CPU 上的非确定性、单 seed 无法估计方差、测试集被重复使用的泄漏风险、参数量统计错误、依赖下载失败、以及把 3 epoch 的轻量结果过度外推。缓解措施写入 EXP-0001 的 PLAN.md。
- Workflow note: 本项目的 Reviewer 使用 `deepseek/deepseek-v4-pro`，Worker/Runner 使用 `deepseek/deepseek-flash`；该独立性弱化及授权记录见 README 与 `.research/DECISIONS.md`。

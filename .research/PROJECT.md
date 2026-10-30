# Project

- Project ID: PROJECT-001
- Scientific question: 教学示例：在大数相消时，math.fsum 是否比逐项浮点累加更准确？
- Research objective: 用一个本地、无外部依赖的小实验学习 Phase 2–4 的方案审批、实现、独立审查、执行和记忆恢复。
- Prior work and available code: None in this repository yet.
- Constraints: Human approval for every experiment plan; independent code review before any formal run; preserve baselines and datasets.
- Dataset: PLAN.md 中固定的三组数字；无外部数据、无随机采样。
- Python environment: uv 管理的 `.venv`，Python 3.14.4；无第三方依赖，使用提交的 `uv.lock`。
- Evaluation command: Defined per experiment in committed `RUN.json`.

本项目暂用于 workflow 教学。真实科研开始前应填写真实研究目标；本示例不主张科研创新，预期结果尚未验证。

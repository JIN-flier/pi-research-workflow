# Research decisions

Record each consequential decision with date, experiment ID, evidence files, commit, alternatives, and reason. Do not treat an unrun hypothesis as a conclusion.

## 2026-10-30 — Infrastructure: reviewer independence rule (authorized)

- Decision: Reviewer is `deepseek/deepseek-v4-pro`; implementation worker and experiment runner remain `deepseek/deepseek-flash`. The code-review gate now requires a different concrete model (case-insensitive, with the `openrouter/` routing prefix normalized), replacing the previous cross-vendor family comparison. No other gate changed.
- Authorization: the user explicitly authorized adapting the workflow to different concrete models and completing the validation ("允许修改为不同具体模型，继续完整验证"). No global Pi configuration or credentials were modified.
- Trade-off: reviewer and worker can share one vendor's training and preferences, so independence is weaker than cross-family review. Mitigations kept: fresh independent context, read-only reviewer tools, review of the exact commit, and the human plan-approval gate.
- Evidence: `tests/workflow.test.mjs` (same-vendor different model accepted; same model via route or case rejected), `scripts/research-workflow.mjs`, `.pi/agents/independent-code-reviewer.md`, `README.md`.
- Commit: this infrastructure commit; its hash is reported from Git history rather than embedded here.

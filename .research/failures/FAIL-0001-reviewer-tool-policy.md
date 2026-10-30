# FAIL-0001 — Reviewer tools are augmented by Pi 1.4 defaults

- Date: 2026-10-30 (Asia/Shanghai)
- Experiment: EXP-0001
- Scientific execution at discovery: not started
- Versions: Pi 1.4.0; @quintinshaw/pi-dynamic-workflows 3.14.0
- Implementation commit: b578aef217891d13d15697547562fdcb07d7a859

## Observed evidence

The named `independent-code-reviewer` role declares only `read, grep, find, ls`. Its actual workflow run `exp0001-independent-code-review-mvv1d23w-elr1sd` used `deepseek/deepseek-v4-pro:low` and successfully called `bash`, including Git inspections and searches of uv.lock. This is visible in the `partialResult.details.agents[].history` entries in `outputs/workflow-validation/04-review.events.jsonl`, with both `toolCall` and successful `toolResult` records. No mutating command was observed, but the allowed-tool capability was broader than the declared policy.

The Captain's original public report incorrectly described these as references to tools that the reviewer did not have. That claim is contradicted by the actual event history: the reviewer DID have and use bash. Preserve that original report as evidence; this note corrects its interpretation. Initial PASS was already registered and state reached READY_TO_RUN before the outer operator completed this check. The outer operator did not start training on that basis.

## Cause found by source inspection

In the installed extension's `src/agent.ts`, `runTurn()` filters `baseTools` into `customTools` using `applyToolPolicy`, then passes `customTools` to `createAgentSession()`. Pi 1.4's actual SDK documents customTools as additional to built-in tools. Its `CreateAgentSessionOptions` separately provides `tools` / `noTools` for controlling the final active tool selection. The call does not apply the role allowlist to those SDK options. This explains why the pure filtering test passes while the actual child session regains default built-ins.

Existing `tests/pi-config.test.mjs` checks registry parsing and `applyToolPolicy()` output, not the final active tool set of an actual Pi 1.4 child session. The 14 passing tests therefore did not establish runtime tool isolation.

## Containment used for this validation

Run a fresh independent review of the same exact commit via the real Pi CLI, loading the same reviewer role with `--append-system-prompt`, and explicitly passing `--tools read,grep,find,ls --no-extensions --no-mcp`. This prevents extra extension/default execution capabilities. The model stays DeepSeek V4 Pro with thinking low. The complete new prompt/events/report are in stage 05 of the validation records. No plan, source code, RUN.json, or implementation commit was changed.

Do not call the plugin defect fixed: this is a documented execution fallback. A future infrastructure fix should align final SDK active tools with the resolved role policy and add an actual SDK session integration test, then independently review that fix. No global package was patched during this experiment.

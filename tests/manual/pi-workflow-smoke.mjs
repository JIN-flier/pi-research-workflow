// Explicit opt-in: this harness spends DeepSeek API tokens. Never part of node --test.
import { mkdirSync, writeFileSync, readFileSync, symlinkSync, readdirSync, openSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { implementation, state } from '../helpers/workflow-fixture.mjs';
import { validateReviewEvidence } from '../../scripts/review-evidence.mjs';
import { recordReview, runExperiment } from '../../scripts/research-workflow.mjs';

const project = fileURLToPath(new URL('../..', import.meta.url));
const base = join(project, 'outputs/workflow-hardening');
const output = join(base, `smoke-${Date.now()}`); mkdirSync(output, { recursive: true });
const root = implementation([process.execPath, '-e', 'console.log("workflow-smoke-ok")'], root => {
  mkdirSync(join(root, '.pi'), { recursive: true });
  for (const file of readdirSync(join(project, '.pi/agents'))) writeFileSync(join(root, '.pi/agents', file), readFileSync(join(project, '.pi/agents', file)));
  for (const directory of ['extensions', 'npm', 'workflows']) symlinkSync(join(project, '.pi', directory), join(root, '.pi', directory), 'dir');
  symlinkSync(join(project, 'scripts'), join(root, 'scripts'), 'dir');
  writeFileSync(join(root, '.pi/settings.json'), readFileSync(join(project, '.pi/settings.json')));
});
const s = state(root);
const childPrompt = `This is an explicitly synthetic workflow regression fixture, not a scientific experiment or a claim of real human plan approval. Review only experiment.py (one print statement) using your read-only tools. Read that file, then return exact standalone header lines Verdict: PASS, Experiment: EXP-0001, Reviewed commit: ${s.implementation_commit}, Reviewer model: deepseek/deepseek-v4-pro followed by Findings/Evidence/Required changes. Do not run commands or use other models. The test harness, not you, will validate and register the receipt. The fixture plan is generic test data; do not mistake it for a real scientific study.`;
const script = `export const meta = { name: 'research_hardening_smoke', description: 'Synthetic tool-policy/session-evidence regression', phases: [{title:'Review'}] }; phase('Review'); return await agent(${JSON.stringify(childPrompt)}, {agentType:'independent-code-reviewer',model:'deepseek/deepseek-v4-pro',thinking:'high',isolation:false,label:'strict-review-smoke'});`;
const prompt = `这是合成的 workflow 回归 fixture，不是科学实验。只调用一次 workflow 工具，background:false，script 必须为下面完整内容，然后原样报告结果并停止。不要自己执行 bash、改文件、登记状态、训练、调用其他模型或其他 agent。Captain 固定 DeepSeek Flash/low，子 agent 固定脚本中的 DeepSeek V4 Pro/high（用户已明确选择）。\n\n${script}`;
writeFileSync(join(output, 'smoke.input.md'), prompt);
writeFileSync(join(output, 'fixture.json'), JSON.stringify({ root, implementationCommit: s.implementation_commit, synthetic: true }, null, 2));
const stdout = openSync(join(output, 'smoke.events.jsonl'), 'w'), stderr = openSync(join(output, 'smoke.stderr.log'), 'w');
let result;
try {
  result = spawnSync('pi', ['-a', '--model', 'deepseek/deepseek-flash', '--thinking', 'low', '--no-mcp', '--mode', 'json', '--session-dir', join(output, 'sessions'), '-p', `@${join(output, 'smoke.input.md')}`], { cwd: root, stdio: ['ignore', stdout, stderr], timeout: 300000 });
} finally { closeSync(stdout); closeSync(stderr); }
assert.equal(result.status, 0, `Pi smoke failed: ${result.error ?? readFileSync(join(output, 'smoke.stderr.log'), 'utf8')}`);
const directory = '.research/experiments/EXP-0001/reviews';
const receipts = readdirSync(join(root, directory)).filter(f => f.endsWith('.json') && !f.endsWith('.events.jsonl'));
assert.equal(receipts.length, 1, 'one real automatically captured reviewer receipt required');
const receiptPath = `${directory}/${receipts[0]}`;
const receipt = validateReviewEvidence(root, s, receiptPath, 'PASS', 'deepseek/deepseek-v4-pro');
assert.ok(receipt.toolCalls.includes('read'));
recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'real Pi synthetic workflow smoke', receiptPath);
await runExperiment(root);
assert.equal(state(root).execution_status, 'success');
assert.match(readFileSync(join(root, 'outputs/EXP-0001/stdout.log'), 'utf8'), /workflow-smoke-ok/);
const summary = { status: 'PASS', synthetic: true, fixture: root, models: ['deepseek/deepseek-flash:low', 'deepseek/deepseek-v4-pro:high'], receiptPath: resolve(root, receiptPath), activeTools: receipt.activeTools, actualToolCalls: receipt.toolCalls, executionStatus: state(root).execution_status };
writeFileSync(join(output, 'smoke.result.json'), JSON.stringify(summary, null, 2) + '\n');
writeFileSync(join(base, 'latest-smoke.json'), JSON.stringify({ output, ...summary }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));

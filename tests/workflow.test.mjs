import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createExperiment, submitPlan, reviewPlan, recordImplementation, recordReview, assertExecutionReady, runExperiment, recordDecision } from '../scripts/research-workflow.mjs';

function fixture(runCommand = ['node', '-e', 'console.log(1)']) {
  const root = mkdtempSync(join(tmpdir(), 'research-gate-'));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  mkdirSync(join(root, '.research'), { recursive: true });
  createExperiment(root, 'EXP-0001');
  const plan = join(root, '.research/experiments/EXP-0001/PLAN.md');
  writeFileSync(plan, '# Plan\n\n' + [
    ['Scientific question', 'A measurable scientific question?'],
    ['Hypothesis', 'B increases accuracy.'],
    ['Mechanism', 'B reduces noise.'],
    ['Related work and novelty', 'Compare the nearest published method.'],
    ['Design', 'Compare B with baseline C.'],
    ['Baseline and controls', 'Hold inputs and seed fixed.'],
    ['Metrics', 'Primary metric is accuracy.'],
    ['Expected results', 'Expect improvement over C.'],
    ['Falsification criteria', 'No improvement falsifies B.'],
    ['Cost and risks', 'One short local run; leakage risk.'],
  ].map(([heading, body]) => `## ${heading}\n${body}\n`).join('\n'));
  writeFileSync(join(root, '.research/experiments/EXP-0001/RUN.json'), `${JSON.stringify({ command: runCommand })}\n`);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'plan']);
  return root;
}

test('implementation is blocked before explicit approval and approval is tied to plan commit', () => {
  const root = fixture();
  submitPlan(root);
  assert.throws(() => recordImplementation(root, 'deepseek/deepseek-flash'), /approved plan/);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-1');
  const state = readFileSync(join(root, '.research/STATE.md'), 'utf8');
  assert.match(state, /plan_status: approved/);
  writeFileSync(join(root, '.research/experiments/EXP-0001/PLAN.md'), '# changed');
  assert.throws(() => recordImplementation(root, 'deepseek/deepseek-flash'), /plan changed/);
});

test('REVISE returns to draft and REJECT terminates the round', () => {
  const revise = fixture();
  submitPlan(revise);
  reviewPlan(revise, 'REVISE', 'human', 'narrow the control');
  assert.match(readFileSync(join(revise, '.research/STATE.md'), 'utf8'), /workflow_state: PLAN_DRAFT/);
  const reject = fixture();
  submitPlan(reject);
  reviewPlan(reject, 'REJECT', 'human', 'not feasible');
  assert.match(readFileSync(join(reject, '.research/STATE.md'), 'utf8'), /workflow_state: REJECTED/);
});

test('execution requires an independent PASS for the exact clean HEAD', () => {
  const root = fixture();
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-2');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, 'deepseek/deepseek-flash');
  assert.throws(() => assertExecutionReady(root), /PASS review/);
  assert.throws(() => recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'same family'), /different model family/);
  recordReview(root, 'PASS', 'openrouter/openai/gpt-5.4', 'checked changes');
  assert.doesNotThrow(() => assertExecutionReady(root));
  writeFileSync(join(root, 'experiment.py'), 'print(2)\n');
  assert.throws(() => assertExecutionReady(root), /working tree/);
});

test('only two automatic revisions and each new commit needs another review', () => {
  const root = fixture();
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-3');
  for (let i = 0; i < 3; i++) {
    writeFileSync(join(root, 'experiment.py'), `print(${i})\n`);
    execFileSync('git', ['-C', root, 'add', '.']);
    execFileSync('git', ['-C', root, 'commit', '-qm', `revision ${i}`]);
    if (i < 2) {
      recordImplementation(root, 'deepseek/deepseek-flash');
      recordReview(root, 'CHANGES_REQUIRED', 'openrouter/openai/gpt-5.4', 'fix math');
    }
  }
  assert.throws(() => recordImplementation(root, 'deepseek/deepseek-flash'), /revision limit/);
});

test('formal run records logs and execution commit, then decision closes the round', () => {
  const root = fixture();
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-4');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, 'deepseek/deepseek-flash');
  recordReview(root, 'PASS', 'openrouter/openai/gpt-5.4', 'checked changes');
  runExperiment(root);
  assert.match(readFileSync(join(root, 'outputs/EXP-0001/stdout.log'), 'utf8'), /1/);
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /execution_status: success/);
  writeFileSync(join(root, '.research/experiments/EXP-0001/RESULTS.md'), '# RESULTS\n\nAccuracy is 0.8; baseline is 0.7.\n');
  recordDecision(root, 'CONTINUE', 'Results support a follow-up');
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /workflow_state: IDLE/);
});

test('nonzero experiment exit is recorded as failure', () => {
  const root = fixture(['node', '-e', 'process.stderr.write("failed\\n"); process.exit(2)']);
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-5');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, 'deepseek/deepseek-flash');
  recordReview(root, 'PASS', 'openrouter/openai/gpt-5.4', 'checked changes');
  assert.throws(() => runExperiment(root), /experiment failed/);
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /execution_status: failed/);
  assert.match(readFileSync(join(root, 'outputs/EXP-0001/stderr.log'), 'utf8'), /failed/);
});

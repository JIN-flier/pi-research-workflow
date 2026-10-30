import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createExperiment, submitPlan, reviewPlan, recordImplementation, recordReview, assertExecutionReady, runExperiment, recordDecision } from '../scripts/research-workflow.mjs';
import { evidence, installFixturePolicy } from './helpers/workflow-fixture.mjs';

function fixture(runCommand = ['node', '-e', 'console.log(1)']) {
  const root = mkdtempSync(join(tmpdir(), 'research-gate-'));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  mkdirSync(join(root, '.research'), { recursive: true });
  createExperiment(root, 'EXP-0001');
  installFixturePolicy(root);
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

function approvedImplementation(model = 'deepseek/deepseek-flash') {
  const root = fixture();
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-independence');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, model);
  return root;
}

test('localized templates remain incomplete until every protocol section is filled', () => {
  const root = mkdtempSync(join(tmpdir(), 'research-localized-'));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  createExperiment(root, 'EXP-0001');
  const path = join(root, '.research/experiments/EXP-0001/PLAN.md');
  const template = readFileSync(path, 'utf8');
  assert.match(template, /科学问题/);
  assert.throws(() => submitPlan(root), /plan is incomplete: Scientific question/);
  const headings = template.match(/^## .+$/gm);
  assert.equal(headings.length, 10);
  const complete = template.replace(/^(## .+)$/gm, '$1\n具体的中文方案内容。');
  writeFileSync(path, complete.replace('## Metrics\n具体的中文方案内容。', '## Metrics'));
  assert.throws(() => submitPlan(root), /plan is incomplete: Metrics/);
  writeFileSync(path, complete);
  writeFileSync(join(root, '.research/experiments/EXP-0001/RUN.json'), JSON.stringify({ command: ['node', '-e', 'console.log(1)'], description: '中文命令说明' }));
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'localized fixture plan']);
  assert.equal(submitPlan(root).workflow_state, 'PLAN_REVIEW');
});

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
  assert.throws(() => recordReview(root, 'PASS', 'openrouter/deepseek/deepseek-flash', 'same concrete model via router'), /different concrete model/);
  recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'checked changes', evidence(root));
  assert.doesNotThrow(() => assertExecutionReady(root));
  writeFileSync(join(root, 'experiment.py'), 'print(2)\n');
  assert.throws(() => assertExecutionReady(root), /working tree/);
});

test('a different concrete model from the same vendor is an acceptable reviewer', () => {
  const root = approvedImplementation('deepseek/deepseek-flash');
  assert.doesNotThrow(() => recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'different concrete model in a fresh context', evidence(root)));
  const state = readFileSync(join(root, '.research/STATE.md'), 'utf8');
  assert.match(state, /reviewer_model: "deepseek\/deepseek-v4-pro"/);
});

test('the same concrete model is rejected through another route or different letter case', () => {
  const root = approvedImplementation('deepseek/deepseek-flash');
  assert.throws(() => recordReview(root, 'PASS', 'openrouter/deepseek/deepseek-flash', 'same model via router'), /different concrete model/);
  assert.throws(() => recordReview(root, 'PASS', 'DeepSeek/DeepSeek-Flash', 'same model with different case'), /different concrete model/);
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /workflow_state: CODE_REVIEW/);
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
      recordReview(root, 'CHANGES_REQUIRED', 'deepseek/deepseek-v4-pro', 'fix math', evidence(root, { verdict: 'CHANGES_REQUIRED' }));
    }
  }
  assert.throws(() => recordImplementation(root, 'deepseek/deepseek-flash'), /revision limit/);
});

test('formal run records logs and execution commit, then decision closes the round', async () => {
  const root = fixture();
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-4');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, 'deepseek/deepseek-flash');
  recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'checked changes', evidence(root));
  await runExperiment(root);
  assert.match(readFileSync(join(root, 'outputs/EXP-0001/stdout.log'), 'utf8'), /1/);
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /execution_status: success/);
  writeFileSync(join(root, '.research/experiments/EXP-0001/RESULTS.md'), '# RESULTS\n\nAccuracy is 0.8; baseline is 0.7.\n');
  recordDecision(root, 'CONTINUE', 'Results support a follow-up');
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /workflow_state: IDLE/);
});

test('nonzero experiment exit is recorded as failure', async () => {
  const root = fixture(['node', '-e', 'process.stderr.write("failed\\n"); process.exit(2)']);
  submitPlan(root);
  reviewPlan(root, 'APPROVE', 'human', 'approved at checkpoint run-5');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, 'deepseek/deepseek-flash');
  recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'checked changes', evidence(root));
  await assert.rejects(runExperiment(root), /experiment failed/);
  assert.match(readFileSync(join(root, '.research/STATE.md'), 'utf8'), /execution_status: failed/);
  assert.match(readFileSync(join(root, 'outputs/EXP-0001/stderr.log'), 'utf8'), /failed/);
});

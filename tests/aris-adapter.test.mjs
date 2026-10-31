import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadManifest, inspectSkill, prepareInvocation, verifyInvocation, verifyVendor } from '../scripts/aris-adapter.mjs';
import { implementation, evidence } from './helpers/workflow-fixture.mjs';
import { runExperiment, recordReview } from '../scripts/research-workflow.mjs';

const project = fileURLToPath(new URL('..', import.meta.url));
function fixture(stage = 'IDLE') {
  const root = mkdtempSync(join(tmpdir(), 'aris-adapter-'));
  mkdirSync(join(root, '.pi'), { recursive: true });
  cpSync(join(project, '.pi/aris'), join(root, '.pi/aris'), { recursive: true });
  // Vendor is immutable shared test input; invocation paths are independently bounded.
  mkdirSync(join(root, '.pi/vendor'), { recursive: true });
  symlinkSync(join(project, '.pi/vendor/aris'), join(root, '.pi/vendor/aris'));
  mkdirSync(join(root, '.research'), { recursive: true });
  writeFileSync(join(root, '.research/STATE.md'), `workflow_state: ${stage}\ncurrent_experiment: null\n`);
  writeFileSync(join(root, '.research/PROJECT.md'), '# 项目\n科学问题：比较真实模型。\n数据：已有授权路径。\n基线：固定模型。\n指标：准确率。\n资源：单 GPU。\n风险：泄漏检查。\n');
  writeFileSync(join(root, 'input.md'), '原始研究材料\n');
  return root;
}

test('37 canonical skills have local routes and fixed, unmodified upstream files', () => {
  const manifest = loadManifest(project);
  assert.equal(manifest.skills.length, 37);
  assert.deepEqual(Object.fromEntries(['literature-ideation', 'experiments', 'audit'].map(category => [category, manifest.skills.filter(s => s.category === category).length])), { 'literature-ideation': 18, experiments: 10, audit: 9 });
  assert.match(manifest.upstream.commit, /^[a-f0-9]{40}$/);
  assert.equal(verifyVendor(project).status, 'verified');
  assert.equal(inspectSkill(project, 'aris-run-experiment').role, 'experiment-runner');
  for (const skill of manifest.skills) {
    assert.equal(skill.localName, `aris-${skill.name}`);
    assert.ok(skill.stages.length);
    assert.ok(skill.dependencies.every(d => ['packaged', 'mapped', 'external', 'unsupported'].includes(d.status)));
  }
});

test('preparation preserves arguments as data and binds state, inputs and upstream', () => {
  const root = fixture();
  const malicious = '`touch /tmp/aris-should-not-exist` $(id) "\n';
  const result = prepareInvocation(root, 'aris-formula-derivation', { arguments: malicious, inputPaths: ['input.md'] });
  assert.equal(result.status, 'prepared');
  const invocation = JSON.parse(readFileSync(join(root, result.invocationPath)));
  assert.equal(invocation.request.arguments, malicious);
  assert.equal(invocation.role, 'captain');
  assert.equal(verifyInvocation(root, result.invocationPath).status, 'verified');
  writeFileSync(join(root, 'input.md'), '材料已改变');
  assert.throws(() => verifyInvocation(root, result.invocationPath), /输入.*变化/);
});

test('unknown fields, conflicting experiment IDs and external or symlinked inputs are rejected without writing', () => {
  const root = fixture();
  const run = request => prepareInvocation(root, 'aris-formula-derivation', request);
  assert.throws(() => run({ arguments: '', inputPaths: [], command: ['bash'] }), /未知字段/);
  assert.throws(() => run({ arguments: '', inputPaths: [], experimentId: 'EXP-9999' }), /实验/);
  assert.throws(() => run({ arguments: '', inputPaths: ['../outside'] }), /项目内/);
  symlinkSync('/etc/hosts', join(root, 'escape'));
  assert.throws(() => run({ arguments: '', inputPaths: ['escape'] }), /项目内/);
  assert.throws(() => prepareInvocation(root, '../run-experiment', { arguments: '', inputPaths: [] }), /未知 Skill/);
});

test('no direct pilot, queue retry, cloud provisioning or post-review code changes are authorized', () => {
  const root = fixture();
  assert.throws(() => prepareInvocation(root, 'aris-run-experiment', { arguments: '', inputPaths: [] }), /阶段/);
  assert.throws(() => prepareInvocation(root, 'aris-research-implement-feature', { arguments: '', inputPaths: [] }), /阶段/);
  for (const name of ['experiment-queue', 'vast-gpu', 'serverless-modal', 'qzcli', 'system-profile']) {
    const result = prepareInvocation(root, `aris-${name}`, { arguments: '启动并重试', inputPaths: [] });
    assert.equal(result.status, 'handoff');
    assert.deepEqual(result.allowedCommands, []);
  }
  writeFileSync(join(root, '.research/PROJECT.md'), '# 项目\n科学问题：待研究者填写。\n');
  const result = prepareInvocation(root, 'aris-idea-creator', { arguments: '立即启动 pilot', inputPaths: [] });
  assert.equal(result.status, 'needs_configuration');
  assert.deepEqual(result.allowedCommands, []);
});

test('read-only auditor cannot claim independent web, image or command verification', () => {
  const root = fixture('ANALYSIS');
  for (const name of ['citation-audit', 'citation-crosscheck', 'integrity-forensics']) {
    const result = prepareInvocation(root, `aris-${name}`, { arguments: '核验', inputPaths: ['input.md'] });
    assert.equal(result.status, 'blocked');
    assert.ok(result.missingCapabilities.length);
  }
  const prepared = prepareInvocation(root, 'aris-experiment-audit', { arguments: '检查原始评估代码', inputPaths: ['input.md'] });
  assert.equal(prepared.status, 'prepared');
  assert.equal(prepared.role, 'independent-research-auditor');
  assert.equal(prepared.localPolicy.review_independence, 'same-family');
  assert.equal(prepared.localPolicy.acceptance_status, 'provisional');
});

test('a changed stage invalidates a previously prepared invocation', () => {
  const root = fixture();
  const result = prepareInvocation(root, 'aris-formula-derivation', { arguments: '推导', inputPaths: ['input.md'] });
  writeFileSync(join(root, '.research/STATE.md'), 'workflow_state: RUNNING\ncurrent_experiment: null\n');
  assert.throws(() => verifyInvocation(root, result.invocationPath), /状态.*变化/);
});

test('controlled execution verifies completion from the original state records after run changes stage', async () => {
  const root = implementation(undefined, root => {
    cpSync(join(project, '.pi/aris'), join(root, '.pi/aris'), { recursive: true });
    mkdirSync(join(root, '.pi/vendor'), { recursive: true });
    symlinkSync(join(project, '.pi/vendor/aris'), join(root, '.pi/vendor/aris'));
    writeFileSync(join(root, '.research/PROJECT.md'), '# 合成受控运行项目\n');
  });
  recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'synthetic review', evidence(root));
  // The adapter itself never executes the experiment.
  const prepared = prepareInvocation(root, 'aris-run-experiment', { arguments: '只运行已批准命令', inputPaths: ['.research/experiments/EXP-0001/RUN.json'] });
  await runExperiment(root);
  const completed = verifyInvocation(root, prepared.invocationPath, { artifacts: true });
  assert.equal(completed.status, 'verified');
  assert.equal(completed.completion.workflow_state, 'ANALYSIS');
  assert.equal(completed.completion.execution_commit, prepared.state.implementation_commit);
  writeFileSync(join(root, '.research/PROJECT.md'), '# 运行后改变科学背景\n');
  assert.throws(() => verifyInvocation(root, prepared.invocationPath, { artifacts: true }), /输入.*变化/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditFixture } from './helpers/aris-fixture.mjs';
import { prepareInvocation, prepareAuditSubstep, verifyInvocation } from '../scripts/aris-adapter.mjs';

test('subreview requires and hashes the actual candidate proposal together with primary inputs', () => {
  const { root } = auditFixture();
  writeFileSync(join(root, '.research/STATE.md'), 'workflow_state: IDLE\ncurrent_experiment: null\n');
  const parent = prepareInvocation(root, 'aris-idea-creator', { arguments: '评估候选', inputPaths: ['eval.py'] });
  assert.throws(() => prepareAuditSubstep(root, parent.invocationPath), /输入文件不存在/);
  const candidate = `${parent.outputDirectory}/RESULT.md`;
  writeFileSync(join(root, candidate), '# 完整候选 A\n机制与证伪标准。\n');
  const child = prepareAuditSubstep(root, parent.invocationPath);
  assert.ok(child.request.inputPaths.includes(candidate));
  assert.ok(child.inputHashes[candidate]);
  assert.ok(child.request.inputPaths.includes('eval.py'));
  assert.equal(verifyInvocation(root, child.invocationPath).status, 'verified');
  writeFileSync(join(root, candidate), '# 改为候选 B\n');
  assert.throws(() => verifyInvocation(root, child.invocationPath), /输入.*变化/);
});

test('binary document audit remains blocked without an independent decoder', () => {
  const { root } = auditFixture();
  writeFileSync(join(root, 'paper.pdf'), '%PDF-1.7 synthetic');
  const result = prepareInvocation(root, 'aris-paper-claim-audit', { arguments: '核验 PDF 数字', inputPaths: ['paper.pdf'] });
  assert.equal(result.status, 'blocked');
  assert.ok(result.missingCapabilities.includes('independent-document-decoder'));
});

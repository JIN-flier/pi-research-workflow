import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPiRuntime } from './helpers/pi-runtime.mjs';
import { loadManifest } from '../scripts/aris-adapter.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, '.pi/workflows/plan-review.workflow.js'), 'utf8');
const { parseWorkflowScript, runWorkflow, loadAgentRegistry, applyToolPolicy, sdk } = await loadPiRuntime(root);

test('Pi discovers 37 ARIS adapters and five original stages, with K-Dense retired and vendor excluded', () => {
  const loaded = sdk.loadSkillsFromDir({ dir: join(root, '.pi/skills'), source: 'project' });
  assert.deepEqual(loaded.diagnostics, []);
  assert.deepEqual(loaded.skills.map(skill => skill.name).sort(), [
    'hypothesis-design', 'literature-investigation', 'research-decision', 'research-understanding', 'result-analysis',
    ...loadManifest(root).skills.map(s => s.localName),
  ].sort());
});

test('Pi parses the actual workflow envelope and rejects a script without metadata', () => {
  const parsed = parseWorkflowScript(source);
  assert.equal(parsed.meta.name, 'research_plan_review');
  assert.deepEqual(parsed.meta.phases, [{ title: '人工方案审批' }]);
  assert.throws(() => parseWorkflowScript(parsed.body), /must be the first statement/);
});

test('Pi discovers project roles and filters reviewer tools to read only', () => {
  const registry = loadAgentRegistry(root, { userDir: '/nonexistent', legacyUserDir: '/nonexistent' });
  for (const name of ['experiment-runner', 'implementation-worker', 'independent-code-reviewer']) assert.ok(registry.has(name));
  const reviewer = registry.get('independent-code-reviewer');
  const tools = ['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write'].map(name => ({ name }));
  assert.deepEqual(applyToolPolicy(tools, reviewer.tools, reviewer.disallowedTools).map(tool => tool.name), ['read', 'grep', 'find', 'ls']);
  assert.ok(reviewer.model, 'Reviewer must bind a model; availability and independence are checked at dispatch/review');
});

const options = () => ({
  cwd: root,
  args: { experimentId: 'EXP-TEST', planCommit: 'abc123', planSha256: 'hash123' },
  persistLogs: false,
  agentRegistry: new Map(),
});

for (const [decision, answers] of [['APPROVE', [true]], ['REJECT', [false, true]], ['REVISE', [false, false]]]) {
  test(`real Pi runtime returns ${decision} only from the supplied confirmations`, async () => {
    const replies = [...answers];
    let calls = 0;
    const result = await runWorkflow(source, {
      ...options(),
      confirm: async (_prompt, settings) => {
        calls++;
        assert.equal(settings.headless, 'abort');
        assert.equal(settings.default, false);
        assert.equal(settings.kind, 'confirm');
        return replies.shift();
      },
    });
    assert.equal(calls, answers.length);
    assert.equal(result.result.decision, decision);
    assert.equal(result.result.planCommit, 'abc123');
  });
}

test('real Pi runtime aborts the plan gate without a human confirmation channel', async () => {
  await assert.rejects(runWorkflow(source, options()), error => error.code === 'WORKFLOW_ABORTED' && /headless/.test(error.message));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPiRuntime } from './helpers/pi-runtime.mjs';
import { auditFixture } from './helpers/aris-fixture.mjs';
import { createWorkflowSessionFactory } from '../scripts/pi-workflow-session.mjs';
import { validateAuditEvidence } from '../scripts/aris-audit-evidence.mjs';

const project = fileURLToPath(new URL('..', import.meta.url));
const { sdk, ai, WorkflowAgent, runWorkflow, loadAgentRegistry, installHostCreateAgentSession } = await loadPiRuntime(project);

async function exercise({ fail = false, wrongModel = false, thinking = 'high', name = 'experiment-audit', attack = false } = {}) {
  const { root, prepared } = auditFixture(name), toolSets = [], observed = [];
  mkdirSync(join(root, 'outputs'), { recursive: true });
  const runtime = await sdk.ModelRuntime.create({ authPath: join(root, 'outputs/auth.json'), modelsPath: null, modelsStorePath: join(root, 'outputs/models.json'), refreshOnCreate: false, allowModelNetwork: false });
  let requests = 0;
  runtime.registerProvider('deepseek', {
    api: 'openai-completions', apiKey: 'synthetic-offline-only', baseUrl: 'https://no-network.invalid',
    models: [{ id: 'deepseek-v4-pro', name: 'Offline synthetic auditor', reasoning: true, input: ['text'], contextWindow: 64000, maxTokens: 3000, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, thinkingLevelMap: { low: null, high: 'high', max: 'max' } }],
    streamSimple(model, context) {
      requests++;
      toolSets.push(ai.getCurrentTools(context.messages).map(t => t.name).sort());
      const text = JSON.stringify(context.messages);
      const slot = attack && !text.includes('ARIS audit slot: review') ? 'attack' : 'review';
      observed.push(slot);
      const first = !context.messages.some(m => m.role === 'assistant');
      const paths = ['eval.py', prepared.upstreamPath, ...(attack && slot === 'review' ? [`${prepared.outputDirectory}/attack.md`] : [])];
      const details = name === 'kill-argument' ? slot === 'attack' ? { attack_memo: '离线合成攻击原文。' } : { decomposed_points: [{ id: 'P1', verdict: 'answered_by_current_text', severity_if_unresolved: 'minor' }], counts: { answered_by_current_text: 1, partially_answered: 0, still_unresolved: 0 } } : { synthetic: true };
      const report = JSON.stringify({ audit_skill: name, invocation_id: prepared.id, slot, ...(name !== 'kill-argument' ? { verdict: 'PASS' } : {}), scope_complete: true, summary: '离线 SDK 合成测试，无真实科研结论。', details });
      const content = fail ? [] : first ? paths.map((path, index) => ({ type: 'toolCall', id: `read-${slot}-${index}`, name: 'read', arguments: { path: join(root, path) } })) : [{ type: 'text', text: report }];
      const stopReason = fail ? 'error' : first ? 'toolUse' : 'stop';
      const message = { role: 'assistant', provider: model.provider, model: wrongModel ? 'deepseek-flash' : model.id, api: model.api, content, stopReason, timestamp: Date.now(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, ...(fail ? { errorMessage: 'synthetic failure' } : {}) };
      const stream = ai.createAssistantMessageEventStream();
      queueMicrotask(() => { stream.push(fail ? { type: 'error', reason: 'error', error: message } : { type: 'done', reason: stopReason, message }); stream.end(message); });
      return stream;
    },
  });
  const settingsManager = sdk.SettingsManager.inMemory();
  const loader = new sdk.DefaultResourceLoader({ cwd: root, agentDir: root, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noThemes: true, noPromptTemplates: true });
  await loader.reload();
  const agent = new WorkflowAgent({ cwd: root, modelRegistry: new sdk.ModelRegistry(runtime), session: { modelRuntime: runtime, resourceLoader: loader, settingsManager } });
  installHostCreateAgentSession(createWorkflowSessionFactory(sdk.createAgentSession, sdk), sdk);
  let result, error;
  const source = readFileSync(join(project, '.pi/workflows/research-audit.workflow.js'), 'utf8').replace("thinking: 'high'", `thinking: '${thinking}'`);
  try { result = await runWorkflow(source, { cwd: root, args: { invocationPath: prepared.invocationPath, attack }, agent, agentRegistry: loadAgentRegistry(root, { userDir: '/nonexistent', legacyUserDir: '/nonexistent' }), persistLogs: false }); }
  catch (caught) { error = caught; }
  finally { installHostCreateAgentSession(sdk.createAgentSession, sdk); }
  return { root, prepared, toolSets, requests, observed, result, error };
}

test('actual Pi workflow + SDK captures an independent Pro/high audit and never grants code PASS', async () => {
  const result = await exercise();
  assert.ifError(result.error);
  assert.ok(result.result.result);
  assert.deepEqual(result.toolSets, [['find', 'grep', 'ls', 'read'], ['find', 'grep', 'ls', 'read']]);
  const evidence = validateAuditEvidence(result.root, result.prepared.invocationPath);
  assert.equal(evidence.reviews[0].reportedModel, 'deepseek/deepseek-v4-pro');
  assert.equal(evidence.reviews[0].thinking, 'high');
  assert.equal(evidence.reviews[0].initialMessageCount, 0);
  assert.equal(evidence.reviews[0].acceptance_status, 'provisional');
  assert.equal(evidence.codeGateAuthorized, false);
});
test('actual SDK failure and a wrong returned model cannot validate a research audit', async () => {
  for (const options of [{ fail: true }, { wrongModel: true }]) {
    const result = await exercise(options);
    assert.throws(() => validateAuditEvidence(result.root, result.prepared.invocationPath));
  }
});
test('actual SDK rejects auditor thinking mismatch before contacting even the synthetic provider', async () => {
  const result = await exercise({ thinking: 'low' });
  assert.equal(result.requests, 0);
  assert.ok(result.error || !result.result?.result);
});
test('kill-argument actual workflow uses separate fresh attack and adjudication SDK sessions', async () => {
  const result = await exercise({ name: 'kill-argument', attack: true });
  assert.ifError(result.error);
  const evidence = validateAuditEvidence(result.root, result.prepared.invocationPath);
  assert.equal(evidence.reviews.length, 2);
  assert.notEqual(evidence.reviews[0].sessionId, evidence.reviews[1].sessionId);
  assert.deepEqual(result.observed, ['attack', 'attack', 'review', 'review']);
});

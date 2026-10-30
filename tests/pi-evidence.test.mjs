import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPiRuntime } from './helpers/pi-runtime.mjs';
import { implementation, state } from './helpers/workflow-fixture.mjs';
import { createWorkflowSessionFactory } from '../scripts/pi-workflow-session.mjs';
import { validateReviewEvidence } from '../scripts/review-evidence.mjs';
import { recordReview, assertExecutionReady } from '../scripts/research-workflow.mjs';

const project = fileURLToPath(new URL('..', import.meta.url));
const { sdk, ai, WorkflowAgent, runWorkflow, loadAgentRegistry, installHostCreateAgentSession } = await loadPiRuntime(project);

async function exercise({ thinking = 'high', fail = false } = {}) {
  const root = implementation(undefined, root => writeFileSync(join(root, '.pi/agents/independent-code-reviewer.md'), readFileSync(join(project, '.pi/agents/independent-code-reviewer.md'))));
  const snapshot = state(root), declaredToolSets = [];
  let requests = 0;
  // The transport is an in-process synthetic provider. No internet, credentials,
  // real model, or paid API is used; SDK/tool execution/workflow/capture are real.
  const runtime = await sdk.ModelRuntime.create({ authPath: join(root, 'fixture-auth.json'), modelsPath: null, modelsStorePath: join(root, 'fixture-models.json'), refreshOnCreate: false, allowModelNetwork: false });
  const report = `Verdict: PASS\nExperiment: EXP-0001\nReviewed commit: ${snapshot.implementation_commit}\nReviewer model: deepseek/deepseek-v4-pro\nFindings: None\nEvidence: synthetic provider read the fixture file\nRequired changes: None`;
  runtime.registerProvider('deepseek', {
    api: 'openai-completions', apiKey: 'synthetic-test-only', baseUrl: 'https://no-network.invalid',
    models: [{ id: 'deepseek-v4-pro', name: 'Synthetic DeepSeek fixture', reasoning: true, input: ['text'], contextWindow: 32000, maxTokens: 2000, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, thinkingLevelMap: { low: null, high: 'high', max: 'max' } }],
    streamSimple(model, context) {
      declaredToolSets.push(context.tools.map(t => t.name).sort());
      const first = requests++ === 0;
      const content = fail ? [] : first ? [{ type: 'toolCall', id: 'fixture-read', name: 'read', arguments: { path: join(root, 'experiment.py') } }] : [{ type: 'text', text: report }];
      const stopReason = fail ? 'error' : first ? 'toolUse' : 'stop';
      const message = { role: 'assistant', provider: model.provider, model: model.id, api: model.api, content, stopReason, timestamp: Date.now(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, ...(fail ? { errorMessage: 'synthetic transport failure' } : {}) };
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
  let error;
  try {
    const result = await runWorkflow(`export const meta = {name:'offline_sdk_review',description:'Synthetic transport integration'}; return await agent('Read experiment.py and review this synthetic fixture.', {agentType:'independent-code-reviewer',model:'deepseek/deepseek-v4-pro',thinking:'${thinking}',isolation:false,label:'review'});`, { cwd: root, agent, agentRegistry: loadAgentRegistry(root, { userDir: '/nonexistent', legacyUserDir: '/nonexistent' }), persistLogs: false });
    if (result.result === null) error = new Error(`workflow returned null: ${JSON.stringify(result.agents ?? result)}`);
  } catch (failure) { error = failure; }
  finally { installHostCreateAgentSession(sdk.createAgentSession, sdk); }
  return { root, snapshot, error, declaredToolSets, requests, directory: join(root, '.research/experiments/EXP-0001/reviews') };
}

test('real workflow + SDK capture validates a read-only review receipt with an offline transport', async () => {
  const result = await exercise();
  assert.ifError(result.error);
  assert.deepEqual(result.declaredToolSets, [['find', 'grep', 'ls', 'read'], ['find', 'grep', 'ls', 'read']]);
  const path = join('.research/experiments/EXP-0001/reviews', readdirSync(result.directory).find(f => f.endsWith('.json')));
  const receipt = validateReviewEvidence(result.root, result.snapshot, path, 'PASS', 'deepseek/deepseek-v4-pro');
  assert.deepEqual(receipt.toolCalls, ['read']);
  assert.equal(receipt.thinking, 'high');
  assert.equal(receipt.initialMessageCount, 0);
  recordReview(result.root, 'PASS', 'deepseek/deepseek-v4-pro', 'offline SDK integration fixture', path);
  assert.doesNotThrow(() => assertExecutionReady(result.root));
});
test('a model thinking mismatch is blocked before calling even the offline provider', async () => {
  const result = await exercise({ thinking: 'low' });
  assert.ok(result.error);
  assert.equal(result.requests, 0);
  assert.equal(existsSync(result.directory), false);
});
test('an actual SDK provider failure produces a failed receipt that cannot authorize PASS', async () => {
  const result = await exercise({ fail: true });
  assert.ok(result.error);
  const path = join('.research/experiments/EXP-0001/reviews', readdirSync(result.directory).find(f => f.endsWith('.json')));
  assert.equal(JSON.parse(readFileSync(join(result.root, path), 'utf8')).status, 'failed');
  assert.throws(() => recordReview(result.root, 'PASS', 'deepseek/deepseek-v4-pro', 'wrong summary', path), /review evidence/);
});

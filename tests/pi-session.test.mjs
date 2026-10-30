import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPiRuntime } from './helpers/pi-runtime.mjs';
import { createWorkflowSessionFactory } from '../scripts/pi-workflow-session.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { sdk } = await loadPiRuntime(root);
const readonly = ['read', 'grep', 'find', 'ls'];

test('the real SDK child session exposes only the resolved reviewer tools', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'pi-readonly-session-'));
  const settingsManager = sdk.SettingsManager.inMemory();
  const loader = new sdk.DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await loader.reload();
  // Regression boundary: a role's filtered customTools must restrict the FINAL
  // SDK selection, not merely the custom-tool array (FAIL-0001).
  const createSession = createWorkflowSessionFactory(sdk.createAgentSession);
  const { session } = await createSession({ cwd, agentDir: cwd, settingsManager, resourceLoader: loader, sessionManager: sdk.SessionManager.inMemory(cwd), customTools: sdk.createReadOnlyTools(cwd) });
  try {
    await session.bindExtensions({});
    assert.deepEqual(session.getActiveToolNames().sort(), readonly.slice().sort());
    assert.equal(session.agent.state.tools.some(t => ['bash', 'edit', 'write', 'codemode', 'tool_search'].includes(t.name)), false);
  } finally { session.dispose(); }
});

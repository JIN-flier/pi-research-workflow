// Read installed SDK metadata without prompting a model or printing credentials.
import { fileURLToPath } from 'node:url';
import { loadPiRuntime } from '../helpers/pi-runtime.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const { sdk } = await loadPiRuntime(root);
const runtime = await sdk.ModelRuntime.create({ refreshOnCreate: false, allowModelNetwork: false });
for (const id of ['deepseek-flash', 'deepseek-v4-pro']) {
  const model = runtime.getModel('deepseek', id);
  if (!model) { console.log(JSON.stringify({ id, missing: true })); continue; }
  const settingsManager = sdk.SettingsManager.inMemory();
  const loader = new sdk.DefaultResourceLoader({ cwd: root, agentDir: sdk.getAgentDir(), settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noThemes: true, noPromptTemplates: true });
  await loader.reload();
  const { session } = await sdk.createAgentSession({ cwd: root, modelRuntime: runtime, model, thinkingLevel: 'low', tools: [], resourceLoader: loader, settingsManager, sessionManager: sdk.SessionManager.inMemory(root) });
  try { console.log(JSON.stringify({ id, requestedThinking: 'low', effectiveThinking: session.thinkingLevel, availableThinking: session.getAvailableThinkingLevels() })); }
  finally { session.dispose(); }
}

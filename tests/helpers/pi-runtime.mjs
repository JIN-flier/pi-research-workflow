import { existsSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Pi supplies peer dependencies to extensions. Plain Node tests need the same
// fallback to the installed Pi CLI; no dependency installation or model call.
export async function loadPiRuntime(root) {
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi/agent');
  const packageDir = [
    process.env.PI_DYNAMIC_WORKFLOWS_DIR,
    join(root, '.pi/npm/node_modules/@quintinshaw/pi-dynamic-workflows'),
    join(agentDir, 'npm/node_modules/@quintinshaw/pi-dynamic-workflows'),
  ].find(path => path && existsSync(join(path, 'dist/workflow.js')));
  if (!packageDir) throw new Error('Install @quintinshaw/pi-dynamic-workflows before running Pi integration tests');
  const pi = (process.env.PATH || '').split(':').map(dir => join(dir, 'pi')).find(existsSync);
  if (!pi) throw new Error('Pi CLI must be on PATH for integration tests');
  const parentURL = pathToFileURL(realpathSync(pi)).href;
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      try { return nextResolve(specifier, context); }
      catch (error) {
        if (error.code !== 'ERR_MODULE_NOT_FOUND' || specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes(':')) throw error;
        return nextResolve(specifier, { ...context, parentURL });
      }
    },
  });
  try {
    const workflow = await import(pathToFileURL(join(packageDir, 'dist/workflow.js')).href);
    const registry = await import(pathToFileURL(join(packageDir, 'dist/agent-registry.js')).href);
    const sdk = await import(new URL('./index.js', parentURL).href);
    const agents = await import(pathToFileURL(join(packageDir, 'dist/agent.js')).href);
    const ai = await import('@earendil-works/pi-ai');
    return { ...workflow, ...registry, ...agents, sdk, ai, packageDir };
  } finally { hook.deregister(); }
}

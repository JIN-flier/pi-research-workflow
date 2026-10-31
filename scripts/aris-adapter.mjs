#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digest, validateReviewEvidence } from './review-evidence.mjs';
import { getResearchState, assertExecutionReady } from './research-workflow.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function projectPath(root, path, { existing = true } = {}) {
  if (typeof path !== 'string' || !path || path.includes('\0')) throw new Error('需要项目内文件路径');
  const base = realpathSync(root), absolute = resolve(base, path);
  const inside = value => { const rel = relative(base, value); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
  if (!inside(absolute)) throw new Error('路径必须位于项目内');
  let ancestor = absolute;
  while (!existsSync(ancestor) && ancestor !== base) ancestor = dirname(ancestor);
  if (!inside(realpathSync(ancestor))) throw new Error('符号链接目标必须位于项目内');
  if (existing && (!existsSync(absolute) || !statSync(absolute).isFile())) throw new Error(`项目内输入文件不存在：${path}`);
  return absolute;
}
export function loadManifest(root) {
  const manifest = json(join(root, '.pi/aris/manifest.json'));
  if (manifest.version !== 1 || manifest.skills.length !== 37) throw new Error('ARIS manifest 版本或选择集合错误');
  return manifest;
}
export function inspectSkill(root, name) {
  const skill = loadManifest(root).skills.find(s => s.localName === name);
  if (!skill) throw new Error(`未知 Skill：${name}`);
  return skill;
}
export function verifyVendor(root) {
  const manifest = loadManifest(root), base = join(root, '.pi/vendor/aris');
  for (const [path, hash] of Object.entries(manifest.upstream.hashes)) {
    if (path.startsWith('/') || path.split('/').includes('..') || digest(readFileSync(join(base, path))) !== hash) throw new Error(`ARIS 上游文件哈希不匹配：${path}`);
  }
  return { status: 'verified', commit: manifest.upstream.commit, files: Object.keys(manifest.upstream.hashes).length };
}
function validateRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('请求必须为 JSON 对象');
  for (const key of Object.keys(request)) if (!['arguments', 'inputPaths', 'experimentId', 'sources'].includes(key)) throw new Error(`未知字段：${key}`);
  if (typeof request.arguments !== 'string' || !Array.isArray(request.inputPaths) || request.inputPaths.some(p => typeof p !== 'string')) throw new Error('请求需要 arguments 字符串和 inputPaths 数组');
  if (request.sources !== undefined && (!Array.isArray(request.sources) || request.sources.some(s => typeof s !== 'string'))) throw new Error('sources 必须为字符串数组');
}
function configuredCapabilities(root, request) {
  const path = join(root, '.pi/aris/config.json');
  const config = existsSync(path) ? json(path) : { sources: [] };
  if (Object.keys(config).some(k => k !== 'sources') || !Array.isArray(config.sources) || config.sources.some(s => typeof s !== 'string')) throw new Error('ARIS 配置仅接受 sources 字符串数组，不接受凭据或命令');
  const result = new Set(config.sources);
  if (request.inputPaths.length || result.size) result.add('literature-source');
  return result;
}
function assertApprovedImplementation(root, state) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (!state.current_experiment || !state.approved_plan_commit || !state.approved_plan_sha256) throw new Error('缺少已批准方案');
  const prefix = `.research/experiments/${state.current_experiment}`;
  const plan = readFileSync(projectPath(root, `${prefix}/PLAN.md`), 'utf8');
  if (digest(plan) !== state.approved_plan_sha256 || digest(git('show', `${state.approved_plan_commit}:${prefix}/PLAN.md`)) !== state.approved_plan_sha256 || readFileSync(projectPath(root, `${prefix}/RUN.json`), 'utf8') !== git('show', `${state.approved_plan_commit}:${prefix}/RUN.json`)) throw new Error('已批准方案或 RUN.json 已变化，必须重新审批');
}
function stateSnapshot(state) {
  return Object.fromEntries(['workflow_state', 'current_experiment', 'approved_plan_commit', 'approved_plan_sha256', 'implementation_commit', 'execution_commit', 'execution_run_id'].map(k => [k, state[k] ?? null]));
}
function conditions(root, skill, request, state) {
  if (!skill.stages.includes(state.workflow_state)) throw new Error(`Skill ${skill.localName} 不适用于阶段 ${state.workflow_state}`);
  if (request.experimentId !== undefined && request.experimentId !== state.current_experiment) throw new Error('请求实验 ID 与当前实验不一致');
  const reasons = [], capabilities = configuredCapabilities(root, request);
  const missingCapabilities = skill.requiredCapabilities.filter(c => !capabilities.has(c));
  // The auditor's four file tools cannot gain web/execution capabilities from configuration.
  for (const capability of ['independent-web', 'external-forensics-runtime']) if (skill.requiredCapabilities.includes(capability) && !missingCapabilities.includes(capability)) missingCapabilities.push(capability);
  if (skill.mode === 'audit' && request.inputPaths.some(p => /\.(pdf|png|jpe?g|gif|webp|bmp)$/i.test(p))) missingCapabilities.push('independent-document-decoder');
  if (skill.mode === 'implementation') assertApprovedImplementation(root, state);
  if (skill.mode === 'execution') assertExecutionReady(root);
  if (skill.projectRequired && /待研究者|待填写|尚未|Pending\./i.test(readFileSync(join(root, '.research/PROJECT.md'), 'utf8'))) reasons.push('PROJECT.md 的科学问题、数据、基线、指标、资源和风险仍需补全；不得推导占位实验。');
  if (['audit', 'monitor'].includes(skill.mode) || skill.name === 'analyze-results') if (!request.inputPaths.length) reasons.push('必须提供真实原始输入文件，不能凭空审计、监控或分析。');
  for (const source of request.sources ?? []) if (!capabilities.has(source)) missingCapabilities.push(source);
  const status = skill.mode === 'planning-only' ? 'handoff' : missingCapabilities.length ? 'blocked' : reasons.length ? 'needs_configuration' : 'prepared';
  return { status, reasons, missingCapabilities: [...new Set(missingCapabilities)] };
}
export function prepareInvocation(root, name, request) {
  validateRequest(request);
  const manifest = loadManifest(root), skill = inspectSkill(root, name), state = getResearchState(root);
  const inputPaths = [...new Set(request.inputPaths)].map(path => relative(realpathSync(root), realpathSync(projectPath(root, path))));
  request = { ...request, inputPaths };
  const readiness = conditions(root, skill, request, state);
  verifyVendor(root);
  const id = randomUUID(), outputDirectory = `.research/aris/${id}`;
  const directory = projectPath(root, outputDirectory, { existing: false });
  const policies = ['.pi/settings.json', '.pi/agents/independent-research-auditor.md'].filter(path => existsSync(join(root, path)));
  const inputs = [...new Set(['.research/PROJECT.md', ...policies, ...inputPaths])];
  const invocation = { version: 1, id, skill: name, mode: skill.mode, role: skill.role, ...readiness, request, state: stateSnapshot(state),
    upstreamCommit: manifest.upstream.commit, manifestSha256: digest(readFileSync(join(root, '.pi/aris/manifest.json'))),
    inputHashes: Object.fromEntries(inputs.map(path => [path, digest(readFileSync(projectPath(root, path)))])),
    upstreamPath: skill.upstreamPath, helperRoot: '.pi/vendor/aris/tools', templateRoot: '.pi/vendor/aris/templates', outputDirectory,
    childRoutes: manifest.childRoutes, disabledChildren: manifest.disabledChildren, localPolicy: manifest.modelPolicy,
    workflow: skill.mode === 'audit' ? '.pi/workflows/research-audit.workflow.js' : ['implementation', 'execution'].includes(skill.mode) ? '.pi/workflows/aris-dispatch.workflow.js' : null,
    allowedCommands: readiness.status !== 'prepared' ? [] : skill.mode === 'execution' ? ['node scripts/research-workflow.mjs check-run', 'node scripts/research-workflow.mjs run'] : [],
    slots: skill.name === 'kill-argument' ? ['attack', 'review'] : ['review'],
    expectedArtifacts: skill.mode === 'implementation' ? [`.research/experiments/${state.current_experiment}/IMPLEMENTATION.md`] : skill.mode === 'execution' ? [`.research/experiments/${state.current_experiment}/EXECUTION.md`, `outputs/${state.current_experiment}/stdout.log`, `outputs/${state.current_experiment}/stderr.log`] : skill.expectedArtifacts, limitations: skill.limitations, createdAt: new Date().toISOString() };
  mkdirSync(dirname(directory), { recursive: true });
  mkdirSync(directory, { recursive: false });
  writeFileSync(join(directory, 'request.json'), JSON.stringify(request, null, 2) + '\n', { flag: 'wx' });
  const invocationPath = `${outputDirectory}/invocation.json`;
  writeFileSync(join(directory, 'invocation.json'), JSON.stringify(invocation, null, 2) + '\n', { flag: 'wx' });
  return { ...invocation, invocationPath };
}
export function readInvocation(root, path) {
  if (!/^\.research\/aris\/[a-f0-9-]{36}\/invocation\.json$/.test(path)) throw new Error('无效的 ARIS invocation 路径');
  const invocation = json(projectPath(root, path));
  if (invocation.version !== 1 || path !== `.research/aris/${invocation.id}/invocation.json` || invocation.outputDirectory !== `.research/aris/${invocation.id}`) throw new Error('ARIS invocation 身份或路径不一致');
  return invocation;
}
export function verifyInvocation(root, path, { artifacts = false } = {}) {
  const invocation = readInvocation(root, path), manifest = loadManifest(root);
  if (digest(readFileSync(join(root, '.pi/aris/manifest.json'))) !== invocation.manifestSha256 || manifest.upstream.commit !== invocation.upstreamCommit) throw new Error('ARIS manifest 或上游版本已变化');
  if (artifacts && ['implementation', 'execution'].includes(invocation.mode)) return verifyControlledCompletion(root, invocation);
  for (const [input, hash] of Object.entries(invocation.inputHashes)) if (digest(readFileSync(projectPath(root, input))) !== hash) throw new Error(`输入文件已变化：${input}`);
  if (!same(invocation.state, stateSnapshot(getResearchState(root)))) throw new Error('科研状态已变化；重新准备调用');
  const skill = inspectSkill(root, invocation.skill);
  const check = conditions(root, skill, invocation.request, getResearchState(root));
  if (!same(check, { status: invocation.status, reasons: invocation.reasons, missingCapabilities: invocation.missingCapabilities })) throw new Error('调用前置条件已变化');
  verifyVendor(root);
  if (artifacts) {
    if (invocation.status !== 'prepared') throw new Error(`调用未准备就绪：${invocation.status}`);
    if (invocation.mode === 'audit' || invocation.mode === 'audit-substep') {
      throw new Error('研究审计产物请使用 verify-audit 校验，不能以普通 RESULT.md 代替');
    }
    const result = readFileSync(projectPath(root, `${invocation.outputDirectory}/RESULT.md`), 'utf8');
    if (!result.trim() || /Pending\.|待填写/.test(result)) throw new Error('Skill 产物尚未完成');
  }
  return { status: 'verified', invocation };
}

function verifyControlledCompletion(root, invocation) {
  const state = getResearchState(root), original = invocation.state;
  if (invocation.status !== 'prepared' || !state.current_experiment || ['current_experiment', 'approved_plan_commit', 'approved_plan_sha256'].some(k => state[k] !== original[k])) throw new Error('受控任务的实验或批准方案已变化');
  assertApprovedImplementation(root, state);
  for (const [path, hash] of Object.entries(invocation.inputHashes)) {
    // Worker may legitimately change source inputs; scientific context and all
    // execution inputs remain bound to the prepared invocation.
    if ((invocation.mode === 'execution' || path.startsWith('.research/')) && digest(readFileSync(projectPath(root, path))) !== hash) throw new Error(`输入文件已变化：${path}`);
  }
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', '.', ':(exclude).research', ':(exclude)outputs'], { encoding: 'utf8' }).trim();
  if (dirty || head !== state.implementation_commit) throw new Error('受控任务的实现 commit 不匹配或工作区不干净');
  if (invocation.mode === 'implementation') {
    if (state.workflow_state !== 'CODE_REVIEW') throw new Error('实现尚未登记为 CODE_REVIEW');
    projectPath(root, `.research/experiments/${state.current_experiment}/IMPLEMENTATION.md`);
  } else {
    if (!['ANALYSIS', 'EXECUTION_FAILED'].includes(state.workflow_state) || state.execution_commit !== original.implementation_commit || !state.execution_run_id || state.execution_run_id === original.execution_run_id) throw new Error('受控运行尚未完成或执行 commit 不匹配');
    validateReviewEvidence(root, state, state.review_evidence_path, 'PASS', state.reviewer_model);
    projectPath(root, `.research/experiments/${state.current_experiment}/EXECUTION.md`);
    projectPath(root, `outputs/${state.current_experiment}/stdout.log`);
    projectPath(root, `outputs/${state.current_experiment}/stderr.log`);
  }
  verifyVendor(root);
  return { status: 'verified', invocation, completion: stateSnapshot(state), executionStatus: state.execution_status ?? null, note: '完成校验不表示科学假设成立；失败状态保持原样。' };
}

async function main() {
  const [command, name, flag, requestPath] = process.argv.slice(2), root = process.cwd();
  let output;
  if (command === 'list') output = loadManifest(root).skills.map(s => ({ ...s, availableInCurrentStage: s.stages.includes(getResearchState(root).workflow_state), capabilityScope: s.mode === 'planning-only' ? 'planning-only' : s.requiredCapabilities }));
  else if (command === 'inspect') output = inspectSkill(root, name);
  else if (command === 'verify-vendor') output = verifyVendor(root);
  else if (command === 'prepare' && flag === '--request' && requestPath) output = prepareInvocation(root, name, json(projectPath(root, requestPath)));
  else if (command === 'verify') {
    const invocation = readInvocation(root, name);
    if (['audit', 'audit-substep'].includes(invocation.mode)) {
      const { validateAuditEvidence } = await import('./aris-audit-evidence.mjs');
      output = validateAuditEvidence(root, name);
    } else output = verifyInvocation(root, name, { artifacts: true });
  } else if (command === 'prepare-audit') {
    output = prepareAuditSubstep(root, name);
  } else throw new Error('用法：list | inspect aris-NAME | prepare aris-NAME --request JSON_PATH | prepare-audit INVOCATION_PATH | verify INVOCATION_PATH | verify-vendor');
  console.log(JSON.stringify(output, null, 2));
}
export function prepareAuditSubstep(root, path) {
  const { invocation } = verifyInvocation(root, path);
  if (invocation.status !== 'prepared' || !['idea-creator', 'novelty-check', 'research-refine', 'ablation-planner'].includes(inspectSkill(root, invocation.skill).name)) throw new Error('此调用没有可映射的研究评审槽位');
  // Reuse the exact primary inputs, not the executor's interpretation. A separate
  // invocation gives the substep its own immutable artifacts and fresh session.
  const candidate = `${invocation.outputDirectory}/RESULT.md`;
  const proposal = readFileSync(projectPath(root, candidate), 'utf8');
  if (!proposal.trim() || /Pending\.|待填写/.test(proposal)) throw new Error('先保存本轮完整候选或方法产物，再准备子评审');
  const result = prepareInvocation(root, invocation.skill, { ...invocation.request, inputPaths: [...invocation.request.inputPaths, candidate] });
  const audit = { ...result, mode: 'audit-substep', role: 'independent-research-auditor', parentInvocation: path, workflow: '.pi/workflows/research-audit.workflow.js', expectedArtifacts: ['review.json', 'review.md', 'review.events.jsonl'] };
  delete audit.invocationPath;
  writeFileSync(projectPath(root, result.invocationPath), JSON.stringify(audit, null, 2) + '\n');
  return { ...audit, invocationPath: result.invocationPath };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });

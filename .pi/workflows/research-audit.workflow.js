export const meta = {
  name: 'aris_research_audit',
  description: 'ARIS 原始证据独立审计；宿主记录同家族差异，不推进代码关卡',
  phases: [{ title: '独立研究审计' }],
};

if (!/^\.research\/aris\/[a-f0-9-]{36}\/invocation\.json$/.test(args?.invocationPath ?? '')) throw new Error('需要转接器生成的 invocationPath');
if (args.attack !== undefined && typeof args.attack !== 'boolean') throw new Error('attack 必须为布尔值');
phase('独立研究审计');
const slots = args.attack === true ? ['attack', 'review'] : ['review'];
const reports = [];
for (const slot of slots) {
  const report = await agent(
    `ARIS invocation: ${args.invocationPath}\nARIS audit slot: ${slot}\n` +
    '按宿主捕获协议独立读取原始输入；正文使用简体中文。不得复用其他研究上下文，不得自行写凭据。',
    { agentType: 'independent-research-auditor', model: 'deepseek/deepseek-v4-pro', thinking: 'high', isolation: false, label: `aris-${slot}` },
  );
  if (!report) throw new Error(`研究审计槽位 ${slot} 未完成；不视为 PASS`);
  reports.push({ slot, report });
}
return { invocationPath: args.invocationPath, reports, review_independence: 'same-family', acceptance_status: 'provisional', codeGateAuthorized: false, requiresVerification: true };

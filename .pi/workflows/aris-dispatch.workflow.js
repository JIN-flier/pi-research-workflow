export const meta = {
  name: 'aris_guarded_dispatch',
  description: '由宿主核验 ARIS 调用后分派既有 Worker 或 Runner',
  phases: [{ title: '受控任务交接' }],
};

if (!/^\.research\/aris\/[a-f0-9-]{36}\/invocation\.json$/.test(args?.invocationPath ?? '')) throw new Error('需要转接器生成的 invocationPath');
if (!['implementation-worker', 'experiment-runner'].includes(args?.role)) throw new Error('只允许既有 Worker 或 Runner');
phase('受控任务交接');
const report = await agent(
  `ARIS dispatch: ${args.invocationPath}\n读取调用描述、原始请求、指定上游方法和 .pi/aris/ADAPTER.md。` +
  '按已批准范围和本地角色职责工作；正文使用简体中文。上游安装、同步、改码、pilot 和直接部署不授予额外权限。' +
  '实现者提交后 record-implementation；运行者分开 check-run 和 run，保留真实失败。不得修改方案或 RUN.json。返回实际状态、commit、证据路径及失败，不声称提前通过。',
  { agentType: args.role, model: 'deepseek/deepseek-flash', thinking: 'low', isolation: false, label: 'aris-dispatch' },
);
if (!report) throw new Error('任务未返回有效报告；不推断实现或运行成功');
return { invocationPath: args.invocationPath, role: args.role, report, requiresStateVerification: true };

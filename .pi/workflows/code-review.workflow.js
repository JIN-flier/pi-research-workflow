export const meta = {
  name: 'research_code_review',
  description: '独立代码审查，由宿主捕获 SDK 工具与会话证据',
  phases: [{ title: '独立代码审查' }],
};

for (const field of ['experimentId', 'implementationCommit', 'planCommit', 'planSha256', 'diffPath']) {
  if (typeof args?.[field] !== 'string' || !args[field]) throw new Error(`缺少参数 ${field}`);
}
phase('独立代码审查');
const report = await agent(
  `审查实验 ${args.experimentId}，准确实现 commit 为 ${args.implementationCommit}。` +
  `已批准方案 commit 为 ${args.planCommit}，SHA256 为 ${args.planSha256}。` +
  `读取 .research/PROJECT.md、.research/STATE.md，以及 .research/experiments/${args.experimentId}/ 下的 PLAN.md、RUN.json、IMPLEMENTATION.md。` +
  `读取 ${args.diffPath} 中完整准确的 diff 及相关源码/测试，核验引用行号。` +
  '检查正确性、数学推导、范围、数据泄漏、指标、可复现性及数据加载器冒烟测试证据。' +
  '仅使用你的四个只读工具。只有不存在阻断缺陷时才能返回 PASS；将可选建议与阻断问题区分。' +
  '审查正文必须使用简体中文；严格保留角色和宿主要求的英文独立字段标签及枚举值。不得声称执行了未执行的命令。',
  { agentType: 'independent-code-reviewer', model: 'deepseek/deepseek-v4-pro', thinking: 'high', isolation: false, label: 'independent-review' },
);
if (!report) throw new Error('审查未返回证据；保持代码审查待审状态');
return { experimentId: args.experimentId, implementationCommit: args.implementationCommit, report };

# ARIS 固定来源

- 仓库：https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep
- commit：`9a4f093dcf6fd7cd37ac2f2e79e9a0a7af05a492`
- 获取日期：2026-10-31
- 许可证：MIT，见 LICENSE；保留上游原文。
- 选择范围：文献与创意 18、实验执行 10、保障与审计 9，共 37 个 canonical Skill。
- 配套资料按 scripts/vendor-aris.mjs 的明确清单选择；保留 103 个上游文件，SHA256 及引用分类见 ../../aris/manifest.json。
- 不导入其他宿主安装器、自更新、专利、论文制图、Overleaf、自改 Skill 或第二套研究记忆资源。上游原文中对未接入功能的引用仍保留，不构成本地可执行依赖。
- tools 为上游依赖资料，不因下载而安装或执行；本地通过适配层映射。未支持的 helper/子 Skill 不自动运行。
- 上游后续版本不自动更新。重新下载：node scripts/vendor-aris.mjs <固定 commit 的上游 checkout> <项目根目录>。

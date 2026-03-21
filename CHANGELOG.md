# 更新日志

## [版本 1.1.0] - 2026-03-21

### 🎉 新增功能

#### Manager 任务编排 Agent
- **智能任务判断**：自动分析任务类型，决定是直接回答还是需要工具
- **执行指引生成**：为复杂任务提供关键需求、建议工具、执行步骤
- **结果质量评估**：评估执行结果的完整性、准确性、实用性（1-5 分评分）
- **任务分发优化**：简单任务快速回答，复杂任务交给 Worker Agent

#### 性能优化
- **减少重复判断**：Manager 和 Worker Agent 不再重复分析任务，节省约 25% 的 LLM 调用
- **降低 Token 消耗**：只传递相关工具给 Worker Agent，节省约 70% 的 token
- **工具智能筛选**：根据任务特点选择最相关的工具，避免无关工具干扰

### 📝 文档更新

- 新增 `MANAGER.md` - Manager 使用文档
- 新增 `REFACTORING.md` - 重构说明文档
- 更新 `README.md` - 添加 Manager 相关内容

### 🔧 代码变更

**Manager (`src/manager.js`)**
- 增强判断提示词，要求返回建议工具和执行步骤
- 解析执行指引（关键需求、建议工具、执行步骤）
- 调用 `runAgentWithGuidance` 并传递指引

**Worker Agent (`src/agent.js`)**
- 新增 `runAgentWithGuidance()` 函数
- 根据建议工具筛选工具定义
- 有指引时跳过 Think 阶段，直接基于指引执行
- 保留 `runAgentWithThink()` 保持向后兼容

**内置工具 (`src/skills/builtins.js`)**
- Browser 工具升级：使用 Puppeteer，自动检测系统浏览器
- 无需预先启动浏览器和调试端口

### 🎯 使用建议

| 场景 | 使用方式 |
|------|---------|
| 日常任务处理 | Manager（推荐） |
| 需要任务分类和评估 | Manager |
| 调试 Agent 行为 | Worker Agent |

### ✅ 测试结果

- ✅ 简单任务判断正确，直接返回答案
- ✅ 复杂任务判断正确，提供执行指引
- ✅ 工具筛选成功，减少 token 消耗
- ✅ 执行结果准确，评估功能正常
- ✅ 向后兼容，现有代码无需改动

---

## [版本 1.0.0] - 初始版本

### 核心功能

- Think-Act 模式（思考 + 行动分离）
- LLM 多 Provider 支持（千问 / OpenAI / DeepSeek / Moonshot / Ollama）
- 内置工具（read/write/list/exec/web_search/browser 等）
- Skill 市场（ClaWHub）集成
- 自定义 Skill 注册
- 交互式命令行界面（REPL）

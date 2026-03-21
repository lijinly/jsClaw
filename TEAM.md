# Team —— 协作团队

## 🏠 什么是 Team？

Team 是一个持久化的协作团队，在这里可以常驻一组 Member、一个 Leader 和你。

### Team 的核心概念

1. **Team（团队）** - 持久化的工作环境，专门处理某一类任务
2. **Member（成员）** - 具有特定技能组的 Agent
3. **Leader（队长）** - Team 的编排者，负责：
   - 在 Team 内：接收任务 → 组织 Members 执行 → 输出结果
   - 在 Team 外：接收任务 → 决定自己完成或引导用户进入 Team

### Team 的设计理念

```
传统模式：
用户 → Leader → Member
（单一路径，所有任务都走同一套流程）

Team 模式：
用户
  ├─→ Team 外任务 → Leader 决策
  │                    ├─ 简单任务 → Leader 自己完成
  │                    └─ 复杂任务 → 引导用户进入 Team
  │
  └─→ Team 内任务 → Team Leader 组织 Members → Members 执行
```

## 🎯 Team 的优势

### 1. **任务分类更清晰**
- 每个 Team 专注于特定领域（开发、研究、测试等）
- Members 在 Team 中有明确的职责分工

### 2. **资源利用更高效**
- Team 外的简单任务：Leader 直接完成，不启动 Members
- Team 内的复杂任务：专门优化的 Members 协作执行

### 3. **协作更灵活**
- 可以多个 Team 并存，针对不同任务类型
- 用户可以自由进入和退出 Team
- Leader 智能判断应该在哪里完成任务

## 📝 使用示例

### 基础用法

```javascript
import 'dotenv/config';
import { initLLM } from './llm.js';
import { TeamLab } from './TeamLab.js';

// 初始化 LLM
initLLM();

// 创建 Team 系统
const teamSystem = new TeamLab();
await teamSystem.initialize();

// Team 外提交任务（Leader 决策）
const result = await teamSystem.submitTask('现在几点了？');
// → Leader 自己完成，无需 Team

const result2 = await teamSystem.submitTask('帮我分析项目代码结构');
// → Leader 建议进入"开发团队"

// 进入 Team
await teamSystem.enterTeam('dev-team');

// Team 内提交任务（Members 协作）
const result3 = await teamSystem.submitTask('读取并分析 package.json');
// → Team Leader 组织 Members 执行

// 退出 Team
await teamSystem.exitTeam();
```

### 自定义 Team 配置

在 `src/TeamConfig.json` 中定义 Teams：

```json
{
  "teams": {
    "my-team": {
      "id": "my-team",
      "name": "我的团队",
      "description": "用于特定任务",
      "members": [
        {
          "id": "member-1",
          "role": "developer",
          "skills": ["code-analysis", "file-editing"]
        }
      ]
    }
  }
}
```

## 🏗️ 架构设计

### 核心组件

```
TeamLab（系统入口）
  │
  ├─ TeamRegistry（Team 管理）
  │    ├─ 管理所有 Teams
  │    ├─ 处理 Team 进入/退出
  │    └─ 查找和匹配 Team
  │
  ├─ Team（团队）
  │    ├─ TeamLeader（Team 内的编排者）
  │    │    ├─ handleTaskInTeam()
  │    │    ├─ handleTaskOutsideTeam()
  │    │    └─ 技能匹配器
  │    │
  │    └─ Members（执行者）
  │         ├─ Member-1（角色：developer）
  │         ├─ Member-2（角色：researcher）
  │         └─ ...
```

### Member 的技能体系

```
Member
  │
  ├─ 基础技能（系统内置，所有 Member 共享）
  │    ├─ read, write, list, edit
  │    ├─ exec, web_search, web_fetch
  │    └─ browser, message
  │
  └─ 角色技能（动态加载，根据 Member 角色）
       ├─ code-analysis（开发者 Member）
       ├─ data-analysis（研究者 Member）
       └─ ...
```

## 🔄 任务处理流程

### 场景 1：Team 外简单任务

```
用户提交任务（Team 外）
   ↓
[TeamLeader 接收]
   ↓
分析任务：简单任务，无需特殊技能
   ↓
Leader 自己完成
   ↓
返回结果
```

### 场景 2：Team 外复杂任务

```
用户提交任务（Team 外）
   ↓
[TeamLeader 接收]
   ↓
分析任务需求（需要：read, exec, code-analysis）
   ↓
技能匹配器：查找匹配的 Team
   ↓
找到"开发团队"（有 Developer Member）
   ↓
引导用户："建议进入'开发团队'"
   ↓
用户选择：进入 Team
   ↓
切换到 Team 内处理流程
```

### 场景 3：Team 内任务

```
用户提交任务（Team 内）
   ↓
[TeamLeader 接收]
   ↓
分析任务需求
   ↓
选择合适的 Member（或多个 Members 协作）
   ↓
Members 执行任务
   ↓
返回结果
```

## 📦 相关文件

- `src/Team.js` - Team 核心实现
- `src/Member.js` - Member 核心实现
- `src/TeamLeader.js` - Team 内的 Leader
- `src/TeamRegistry.js` - Team 注册和管理
- `src/TeamLab.js` - Team 实验室
- `src/TeamConfig.json` - Team 配置文件
- `src/demo-team.js` - 演示示例

## 🚀 运行演示

```bash
# 运行 Team 系统演示
npm run demo:team
```

演示包含多个场景：
1. Team 外提交简单任务
2. Team 外提交复杂任务（建议进入 Team）
3. 进入 Team
4. Team 内提交任务
5. 退出 Team

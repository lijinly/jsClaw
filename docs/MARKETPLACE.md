# ClaWHub Skill 市场

> 官方 Skill 生态，一键安装扩展能力

## 快速开始

```bash
# 浏览 Skill（列出前 20 个）
npm run skill:list

# 搜索 Skill
npm run skill:list -- pdf

# 查看详情
node src/marketplace.js info <slug>

# 安装
npm run skill:install -- <slug>

# 卸载
npm run skill:remove -- <slug>

# 查看已安装
npm run skill:installed
```

## API

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { SKILLS_DIR, loadIndex, saveIndex, fetchJSON } from './Marketplace.js';

// 搜索
const data = await fetchJSON(`https://clawhub.ai/api/search?q=pdf`);
// { results: [{ slug, displayName, summary }, ...] }

// 详情
const data = await fetchJSON(`https://clawhub.ai/api/v1/skills/<slug>`);
// { skill, latestVersion, owner }

// 下载
const zipUrl = `https://wry-manatee-359.convex.site/api/v1/download?slug=<slug>`;
const res = await fetch(zipUrl);
const zipBuffer = Buffer.from(await res.arrayBuffer());
```

## 安装目录

```
src/skills/plugins/
├── index.json          ← 已安装清单
├── <slug>/
│   ├── SKILL.md        ← Skill 定义
│   └── _meta.json      ← 元信息
└── ...
```

## index.json 格式

```json
{
  "skill-a": {
    "version": "1.0.0",
    "installedAt": "2024-01-01T00:00:00Z"
  },
  "skill-b": {
    "version": "2.0.0",
    "installedAt": "2024-01-02T00:00:00Z"
  }
}
```

## SKILL.md 格式

```markdown
# Skill Name

## 描述
这是 Skill 的描述...

## 触发词
skill-name, 触发词

## 参数
- param1: 参数1描述（必填）
- param2: 参数2描述（可选）

## 执行
\`\`\`javascript
export default {
  name: 'skill_name',
  description: '描述',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string' },
    },
    required: ['param1'],
  },
  execute: async (params) => {
    // 执行逻辑
    return { result: '...' };
  },
};
\`\`\`
```

## 限流说明

ClaWHub 有严格限流（429 错误），频繁调用需要：
- 添加延迟
- 缓存结果
- 批量请求合并

## 测试

```bash
node src/marketplace.js list
node src/marketplace.js info <slug>
node src/marketplace.js installed
```

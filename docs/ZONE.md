# Zone —— Workspace 生命周期管理

> Workspace 的创建、加载、保存、卸载和销毁

## 概念

```
┌─────────────────────────────────────────────────────────────────┐
│                        Zone vs Workspace                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Zone                                                            │
│   ├── Workspace A  (created/loaded/running/saved)               │
│   ├── Workspace B  (created/loaded/running/saved)               │
│   └── Workspace C  (created/loaded/running/saved)               │
│                                                                 │
│   一个 Zone 可以管理多个 Workspace                                │
│   Workspace 是实际的工作区域                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
data/zones/<zoneId>/
├── meta.json              ← Zone 元信息
├── workspaces/
│   ├── <workspaceId>/
│   │   ├── state.json    ← Workspace 运行时状态
│   │   ├── config.json   ← Workspace 配置（可选）
│   │   └── .memory/      ← Workspace 记忆
│   └── ...
└── cache/                ← Zone 缓存
```

## Zone API

### 创建 Zone

```javascript
import { Zone } from './Zone.js';

const zone = new Zone({
  zoneId: 'dev',              // Zone ID
  name: '开发Zone',           // Zone 名称
  zonesRoot: 'data/zones',    // Zones 根目录
  projectRoot: '/path/to/prj', // 项目根目录
});

await zone.initialize();
```

### ZoneManager（推荐）

```javascript
import { getZoneManager } from './Zone.js';

const zm = getZoneManager();

// 创建 Zone
const zone = await zm.createZone({ zoneId: 'dev', name: '开发' });

// 获取 Zone
const zone = await zm.getZone('dev');

// 获取默认 Zone（名为 'default'）
const defaultZone = await zm.getDefaultZone();

// 列出所有 Zone
const zones = zm.listZones();
// [{ id, name, workspaceCount, isLoaded, createdAt }, ...]

// 删除 Zone
await zm.deleteZone('dev');
```

## Workspace 操作

### 创建

```javascript
// 在 Zone 中创建 Workspace
const result = await zone.createWorkspace({
  workspaceId: 'project1',       // Workspace ID
  name: '项目1',                   // 名称
  description: '新项目',           // 描述
  members: [                        // 成员配置
    {
      id: 'dev',
      name: '开发者',
      identity: '专业开发者',
      skills: ['read', 'write'],
    },
  ],
});

// 返回
// {
//   success: true,
//   workspace: { id, name, description, ... },
//   path: '/path/to/workspace',
// }
```

### 加载

```javascript
// 从磁盘加载到内存
const ws = await zone.loadWorkspace('project1');
// 返回 Workspace 状态对象
```

### 保存

```javascript
// 保存单个 Workspace
await zone.saveWorkspace('project1');

// 保存所有已加载的 Workspace
const result = await zone.saveAll();
// { saved: ['project1', ...], failed: [] }
```

### 卸载

```javascript
// 从内存卸载（不删除文件）
await zone.unloadWorkspace('project1');

// 强制卸载（不保存）
await zone.unloadWorkspace('project1', false);
```

### 删除

```javascript
// 删除 Workspace（从磁盘删除）
await zone.deleteWorkspace('project1');

// 强制删除（即使在内存中）
await zone.deleteWorkspace('project1', { force: true });
```

### 查询

```javascript
// 获取 Workspace 状态
const ws = zone.getWorkspace('project1');

// 获取所有已加载的 Workspace
const allWs = zone.getAllWorkspaces();

// 列出 Zone 中所有 Workspace（包括未加载的）
const list = zone.listWorkspaces();
// [{ id, name, description, status, createdAt, updatedAt }, ...]
```

## Workspace 状态

| 状态 | 说明 |
|------|------|
| `created` | 已创建，未加载 |
| `loaded` | 已加载到内存 |
| `running` | 正在运行 |
| `saved` | 已保存到磁盘 |
| `error` | 出错 |

## Zone 生命周期

```javascript
// 创建
const zone = await zm.createZone({ zoneId: 'dev' });

// 创建 Workspace
await zone.createWorkspace({ workspaceId: 'project1', members: [...] });

// 加载 Workspace
const ws = await zone.loadWorkspace('project1');

// 使用...

// 保存
await zone.saveWorkspace('project1');

// 卸载
await zone.unloadWorkspace('project1');

// 销毁 Zone
await zone.destroy();
```

## ZoneManager 多 Zone 管理

### 场景：按环境隔离

```javascript
const zm = getZoneManager();

// 开发 Zone
const devZone = await zm.createZone({ zoneId: 'dev', name: '开发环境' });
await devZone.createWorkspace({ workspaceId: 'frontend', ... });
await devZone.createWorkspace({ workspaceId: 'backend', ... });

// 测试 Zone
const testZone = await zm.createZone({ zoneId: 'test', name: '测试环境' });
await testZone.createWorkspace({ workspaceId: 'integration', ... });

// 生产 Zone
const prodZone = await zm.createZone({ zoneId: 'prod', name: '生产环境' });
await prodZone.createWorkspace({ workspaceId: 'main', ... });
```

### 切换 Zone

```javascript
// 获取不同 Zone 的 Workspace
const devWs = await (await zm.getZone('dev')).loadWorkspace('frontend');
const testWs = await (await zm.getZone('test')).loadWorkspace('integration');
```

## 事件

```javascript
// Workspace 创建后
zone.on('workspace:created', (ws) => {
  console.log('Workspace 创建:', ws.id);
});

// Workspace 加载后
zone.on('workspace:loaded', (ws) => {
  console.log('Workspace 加载:', ws.id);
});

// Workspace 保存后
zone.on('workspace:saved', (ws) => {
  console.log('Workspace 已保存:', ws.id);
});
```

## 与 WorkSpace 类的区别

```
┌─────────────────────────────────────────────────────────────────┐
│                      Zone vs WorkSpace                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Zone (Zone.js)                                                │
│   • Workspace 的生命周期管理                                      │
│   • 创建/加载/保存/卸载/销毁                                     │
│   • 持久化到磁盘                                                │
│   • 内存管理                                                    │
│                                                                 │
│   WorkSpace (WorkSpace.js)                                       │
│   • 运行时的工作空间                                             │
│   • 管理 Member                                                  │
│   • 协调任务执行                                                │
│   • 加载工作记忆                                                │
│                                                                 │
│   关系：Zone 管理 WorkSpace 的生命周期                           │
│         WorkSpace 在内存中运行                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 测试

```bash
node tests/TestZone.js
```

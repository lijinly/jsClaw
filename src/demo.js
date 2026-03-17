// ─────────────────────────────────────────────
//  Demo —— 无需 API Key 的本地技能演示
// ─────────────────────────────────────────────
import './skills/builtins.js';
import { executeToolCalls } from './skillRegistry.js';

console.log('=== jsClaw Skill 本地演示（不需要 API Key）===\n');

const mockCalls = [
  {
    id: 'call_1',
    function: { name: 'calculate', arguments: '{"expression":"(100 + 200) * 3 / 5"}' },
  },
  {
    id: 'call_2',
    function: { name: 'get_current_time', arguments: '{}' },
  },
  {
    id: 'call_3',
    function: { name: 'web_search', arguments: '{"query":"jsClaw 极简 Agent 框架"}' },
  },
];

const results = await executeToolCalls(mockCalls);
results.forEach(r => console.log(`[${r.tool_call_id}] →`, r.content));

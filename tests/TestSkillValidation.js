// ─────────────────────────────────────────────
//  TestSkillValidation.js - 工具执行验证测试
// ─────────────────────────────────────────────
import {
  registerSkill,
  executeToolCalls,
  getToolDefinitions,
} from '../src/SkillRegistry.js';

// 清理已注册的 skills（用于测试隔离）
function cleanupSkills() {
  // 重新加载模块以清空 registry
}

// ═══════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════

async function testBackwardCompatibility() {
  console.log('\n📋 测试 1: 向后兼容性（无 validation）');

  registerSkill({
    name: 'test_compat',
    description: '向后兼容测试',
    parameters: { type: 'object', properties: {} },
    execute: async (args) => ({ success: true, data: 'compatible' }),
  });

  const results = await executeToolCalls([{
    id: 'call_1',
    function: { name: 'test_compat', arguments: '{}' },
  }]);

  const passed = results.length === 1 &&
                 results[0].content?.includes('compatible');

  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testBeforeValidation() {
  console.log('\n📋 测试 2: 前置验证失败');

  registerSkill({
    name: 'test_before',
    description: '前置验证测试',
    parameters: { type: 'object', properties: {} },
    execute: async (args) => ({ success: true }),
    validation: {
      beforeExecute: (skill, args) => {
        if (!args.required) {
          return { valid: false, error: '缺少必需参数' };
        }
        return { valid: true };
      },
    },
  });

  const results = await executeToolCalls([{
    id: 'call_2',
    function: { name: 'test_before', arguments: '{}' },
  }]);

  const passed = results.length === 1 &&
                 results[0].content?.includes('验证失败') &&
                 results[0].content?.includes('缺少必需参数');

  console.log('  错误信息:', results[0].content);
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testBeforeValidationPass() {
  console.log('\n📋 测试 3: 前置验证通过');

  registerSkill({
    name: 'test_before_pass',
    description: '前置验证通过测试',
    parameters: { type: 'object', properties: {} },
    execute: async (args) => ({ success: true, received: args.value }),
    validation: {
      beforeExecute: (skill, args) => {
        if (args.value > 0) {
          return { valid: true };
        }
        return { valid: false, error: '值必须大于0' };
      },
    },
  });

  const results = await executeToolCalls([{
    id: 'call_3',
    function: { name: 'test_before_pass', arguments: JSON.stringify({ value: 42 }) },
  }]);

  const passed = results.length === 1 &&
                 results[0].content?.includes('42');

  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testAfterValidation() {
  console.log('\n📋 测试 4: 后置验证失败');

  registerSkill({
    name: 'test_after',
    description: '后置验证测试',
    parameters: { type: 'object', properties: {} },
    execute: async (args) => ({ code: 500, error: '服务器错误' }),
    validation: {
      afterExecute: (skill, result) => {
        if (result.code >= 400) {
          return { valid: false, error: `HTTP ${result.code} 错误` };
        }
        return { valid: true };
      },
    },
  });

  const results = await executeToolCalls([{
    id: 'call_4',
    function: { name: 'test_after', arguments: '{}' },
  }]);

  const passed = results.length === 1 &&
                 results[0].content?.includes('结果验证失败') &&
                 results[0].content?.includes('HTTP 500');

  console.log('  错误信息:', results[0].content);
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testTimeout() {
  console.log('\n📋 测试 5: 超时控制');

  registerSkill({
    name: 'test_timeout',
    description: '超时测试',
    parameters: { type: 'object', properties: {} },
    execute: async (args) => {
      await new Promise(r => setTimeout(r, 5000)); // 5秒
      return { success: true };
    },
    validation: {
      timeout: 100, // 100ms 超时
    },
  });

  const start = Date.now();
  const results = await executeToolCalls([{
    id: 'call_5',
    function: { name: 'test_timeout', arguments: '{}' },
  }]);
  const duration = Date.now() - start;

  const passed = results.length === 1 &&
                 results[0].content?.includes('超时') &&
                 duration < 1000; // 应该远小于5秒

  console.log('  耗时:', duration, 'ms');
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testToolDefinitions() {
  console.log('\n📋 测试 6: 工具定义不受 validation 影响');

  const tools = getToolDefinitions();
  const compatTool = tools.find(t => t.function.name === 'test_compat');

  const passed = compatTool &&
                 !compatTool.function.validation; // validation 不暴露给 LLM

  console.log('  工具数量:', tools.length);
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

// ═══════════════════════════════════════════
//  运行测试
// ═══════════════════════════════════════════

async function runTests() {
  console.log('═'.repeat(60));
  console.log('🧪 工具执行验证测试');
  console.log('═'.repeat(60));

  const results = [];
  results.push({ name: '向后兼容性', passed: await testBackwardCompatibility() });
  results.push({ name: '前置验证失败', passed: await testBeforeValidation() });
  results.push({ name: '前置验证通过', passed: await testBeforeValidationPass() });
  results.push({ name: '后置验证失败', passed: await testAfterValidation() });
  results.push({ name: '超时控制', passed: await testTimeout() });
  results.push({ name: '工具定义', passed: await testToolDefinitions() });

  console.log('\n' + '═'.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('═'.repeat(60));

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  const passed = results.filter(r => r.passed).length;
  console.log(`\n总计: ${passed}/${results.length} 通过`);

  if (passed === results.length) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️ 部分测试失败\n');
  }

}

// 导出函数供 RunAll.js 调用
export { runTests as default };

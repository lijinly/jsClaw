// ─────────────────────────────────────────────
//  Agent 类测试
// ─────────────────────────────────────────────
import { initLLM } from './llm.js';
import { Agent, runAgentWithThink } from './agent.js';

async function test1_ClassCreation() {
  console.log('\n=== 测试 1: Agent 类创建 ===');
  
  const agent = new Agent({
    name: '测试助手',
    role: '测试助手',
    verbose: true,
  });
  
  console.log(`✅ Agent 创建成功: ${agent.name}, ${agent.role}`);
}

async function test2_RunMethod() {
  console.log('\n=== 测试 2: Agent.run() 方法 ===');
  
  const agent = new Agent({
    name: '测试助手',
    verbose: false,
  });
  
  try {
    const result = await agent.run('你好，请简单介绍一下你自己');
    console.log('✅ Agent.run() 执行成功');
    console.log('结果:', result.result?.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Agent.run() 执行失败:', error.message);
  }
}

async function test3_CompatibilityFunction() {
  console.log('\n=== 测试 3: 兼容函数 runAgentWithThink ===');
  
  try {
    const result = await runAgentWithThink('你好', { verbose: false });
    console.log('✅ runAgentWithThink() 执行成功');
    console.log('结果:', result.result?.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ runAgentWithThink() 执行失败:', error.message);
  }
}

async function test4_Setters() {
  console.log('\n=== 测试 4: Setter 方法 ===');
  
  const agent = new Agent({ name: '原名' });
  
  agent.setName('新名称');
  agent.setRole('新角色');
  agent.setVerbose(true);
  agent.setMaxRounds(10);
  
  console.log(`✅ Setter 方法正常`);
  console.log(`   名称: ${agent.name}`);
  console.log(`   角色: ${agent.role}`);
  console.log(`   Verbose: ${agent.verbose}`);
  console.log(`   MaxRounds: ${agent.maxRounds}`);
}

async function main() {
  // 初始化 LLM
  initLLM();
  
  await test1_ClassCreation();
  await test2_RunMethod();
  await test3_CompatibilityFunction();
  await test4_Setters();
  
  console.log('\n✅ 所有测试完成');
}

main().catch(console.error);

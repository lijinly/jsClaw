// ─────────────────────────────────────────────
//  Agent 类使用示例
// ─────────────────────────────────────────────
import { Agent } from './agent.js';

// ──────────────────────────────────────────
//  示例 1: 基础使用
// ──────────────────────────────────────────
async function example1_BasicUsage() {
  console.log('\n=== 示例 1: 基础使用 ===\n');

  const agent = new Agent({
    name: '助手',
    role: '智能助手',
    verbose: true,
  });

  const result = await agent.run('你好，请介绍一下你自己');
  
  console.log('\n📋 最终结果：', result.result);
}

// ──────────────────────────────────────────
//  示例 2: 带指引的执行
// ──────────────────────────────────────────
async function example2_WithGuidance() {
  console.log('\n=== 示例 2: 带指引的执行 ===\n');

  const agent = new Agent({
    name: '文件助手',
    role: '文件操作助手',
    verbose: true,
  });

  const result = await agent.runWithGuidance('统计当前目录下的文件数量', {
    guidance: {
      keyRequirements: [
        '获取当前工作目录的实时文件列表',
        '准确排除子目录',
        '可靠计数',
      ],
      suggestedTools: ['exec'],
      executionSteps: '使用 find 或 dir 命令统计文件数量',
    },
    systemPrompt: '你是一个文件操作助手，专注于文件和目录管理。',
  });
  
  console.log('\n📋 最终结果：', result.result);
}

// ──────────────────────────────────────────
//  示例 3: 自定义 Agent 子类
// ──────────────────────────────────────────
class FileAgent extends Agent {
  constructor() {
    super({
      name: '文件专家',
      role: '专业的文件和目录管理助手',
      verbose: true,
      maxRounds: 3,
    });
  }

  // 可以重写方法来定制行为
  async run(userMessage, options = {}) {
    // 添加自定义的前置处理
    console.log('\n🔍 [文件专家] 开始分析任务...');
    console.log(`   任务: ${userMessage}`);
    
    const result = await super.run(userMessage, {
      ...options,
      systemPrompt: options.systemPrompt || this.role,
    });
    
    // 添加自定义的后置处理
    console.log('\n✅ [文件专家] 任务完成');
    
    return result;
  }
}

async function example3_CustomAgent() {
  console.log('\n=== 示例 3: 自定义 Agent 子类 ===\n');

  const agent = new FileAgent();
  
  const result = await agent.run('列出当前目录的所有文件');
  
  console.log('\n📋 最终结果：', result.result);
}

// ──────────────────────────────────────────
//  示例 4: 动态配置
// ──────────────────────────────────────────
async function example4_DynamicConfig() {
  console.log('\n=== 示例 4: 动态配置 ===\n');

  const agent = new Agent({ verbose: false });
  
  // 动态修改配置
  agent.setName('动态助手');
  agent.setRole('可以动态调整配置的助手');
  agent.setVerbose(true);
  agent.setMaxRounds(10);
  
  console.log(`当前配置: ${agent.name}, ${agent.role}, maxRounds=${agent.maxRounds}\n`);
  
  const result = await agent.run('你好，介绍一下你自己');
  
  console.log('\n📋 最终结果：', result.result);
}

// ──────────────────────────────────────────
//  示例 5: 多 Agent 协作
// ──────────────────────────────────────────
async function example5_MultiAgentCollaboration() {
  console.log('\n=== 示例 5: 多 Agent 协作 ===\n');

  const researcher = new Agent({
    name: '研究员',
    role: '信息收集和分析助手',
    verbose: true,
    maxRounds: 2,
  });

  const writer = new Agent({
    name: '作者',
    role: '内容创作助手',
    verbose: true,
    maxRounds: 2,
  });

  // 研究阶段
  console.log('\n--- 第一阶段：研究 ---\n');
  const researchResult = await researcher.run('什么是 JavaScript 的闭包？');
  const research = researchResult.result;

  // 写作阶段
  console.log('\n--- 第二阶段：写作 ---\n');
  const writeResult = await writer.run(
    `基于以下研究内容，写一篇通俗易懂的关于 JavaScript 闭包的介绍文章：\n\n${research}`
  );
  
  console.log('\n📋 最终文章：', writeResult.result);
}

// ──────────────────────────────────────────
//  主函数
// ──────────────────────────────────────────
async function main() {
  // 运行示例（选择一个取消注释）
  await example1_BasicUsage();
  // await example2_WithGuidance();
  // await example3_CustomAgent();
  // await example4_DynamicConfig();
  // await example5_MultiAgentCollaboration();

  // console.log('\n请取消注释上面的示例来运行！');
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  example1_BasicUsage,
  example2_WithGuidance,
  example3_CustomAgent,
  example4_DynamicConfig,
  example5_MultiAgentCollaboration,
};

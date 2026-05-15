// ─────────────────────────────────────────────
//  WorkSpace + Member 架构测试
// ─────────────────────────────────────────────
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WorkSpace } from '../src/WorkSpace.js';
import { initLLM } from '../src/Llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 初始化 LLM
initLLM();

/**
 * 测试工具函数
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 断言失败: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function section(name) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${name}`);
  console.log('─'.repeat(50));
}

/**
 * 测试 1: WorkSpace 基本创建
 */
async function testWorkspaceCreation() {
  section('测试 1: WorkSpace 基本创建');

  const workspace = new WorkSpace({
    id: 'test',
    name: '测试工作空间',
    description: '用于测试的工作空间',
  });

  await workspace.initialize();

  assert(workspace.members.size >= 1, 'WorkSpace 至少有一个 Member');
  assert(workspace.defaultMember !== null, '默认 Member 已创建');
  assert(workspace.defaultMember.id === 'default', '默认 Member ID 为 default');

  console.log('\n✅ 测试 1 通过\n');
}

/**
 * 测试 2: 添加和移除 Member
 */
async function testMemberManagement() {
  section('测试 2: Member 管理');

  const workspace = new WorkSpace();
  await workspace.initialize();

  const initialCount = workspace.members.size;

  // 添加 Member
  await workspace.addMember({
    id: 'test-member-1',
    name: '测试成员1',
    role: '测试角色',
    skills: ['read', 'write'],
  });

  assert(workspace.members.size === initialCount + 1, 'Member 添加成功');

  // 获取 Member
  const member = workspace.getMember('test-member-1');
  assert(member !== null, '可以获取 Member');
  assert(member.name === '测试成员1', 'Member 名称正确');

  // 列出 Members
  console.log('\n  Members 列表:');
  workspace.listMembers();

  // 移除 Member
  const removed = workspace.removeMember('test-member-1');
  assert(removed === true, 'Member 移除成功');
  assert(workspace.members.size === initialCount, 'Member 数量恢复');

  // 尝试移除默认 Member（应该失败）
  const notRemoved = workspace.removeMember('default');
  assert(notRemoved === false, '不能移除默认 Member');

  console.log('\n✅ 测试 2 通过\n');
}

/**
 * 测试 3: 单 Member 执行任务
 */
async function testSingleMemberExecution() {
  section('测试 3: 单 Member 执行');

  const workspace = new WorkSpace();
  await workspace.initialize();

  // 使用默认 Member 执行简单任务
  const result = await workspace.executeWithMember('default', '你好，请介绍一下你自己', {
    verbose: false,
  });

  console.log('\n  [调试] result:', JSON.stringify(result, null, 2));

  assert(result.success === true, `任务执行成功: ${result.error || ''}`);
  assert(result.executor === 'Member', '执行者是 Member');
  assert(result.memberId === 'default', '使用的是默认 Member');
  assert(result.result !== undefined, '有返回结果');

  const resultText = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
  console.log('\n  执行结果预览:');
  console.log(`  ${resultText.substring(0, 100)}...`);

  console.log('\n✅ 测试 3 通过\n');
}

/**
 * 测试 4: 任务提交接口
 */
async function testTaskSubmission() {
  section('测试 4: 任务提交接口');

  const workspace = new WorkSpace();
  await workspace.initialize();

  // 不指定 Member → 使用默认
  const result1 = await workspace.submitTask('你好');
  assert(result1.memberId === 'default', '默认使用 default Member');

  // 指定 Member
  await workspace.addMember({
    id: 'test-executor',
    name: '测试执行者',
    role: '测试',
  });

  const result2 = await workspace.submitTask({
    description: '你好',
    memberId: 'test-executor',
  });
  assert(result2.memberId === 'test-executor', '使用指定的 Member');

  console.log('\n✅ 测试 4 通过\n');
}

/**
 * 测试 5: 多 Member 协作执行
 */
async function testMultiMemberCollaboration() {
  section('测试 5: 多 Member 协作');

  const workspace = new WorkSpace();
  await workspace.initialize();

  // 添加额外 Member
  await workspace.addMember({
    id: 'collab-1',
    name: '协作成员1',
    role: '协作测试',
  });

  await workspace.addMember({
    id: 'collab-2',
    name: '协作成员2',
    role: '协作测试',
  });

  // 多 Member 协作
  const result = await workspace.submitTask({
    description: '你好，请简单介绍一下你自己',
    memberIds: ['default', 'collab-1', 'collab-2'],
  });

  assert(result.success === true, '协作执行成功');
  assert(result.executor === 'Members', '执行者是多个 Members');
  assert(result.membersUsed.length === 3, '使用了 3 个 Member');

  console.log('\n✅ 测试 5 通过\n');
}

/**
 * 测试 6: WorkSpace 信息获取
 */
async function testWorkspaceInfo() {
  section('测试 6: WorkSpace 信息');

  const workspace = new WorkSpace({
    id: 'info-test',
    name: '信息测试空间',
  });
  await workspace.initialize();

  // 添加测试 Member
  await workspace.addMember({
    id: 'info-member',
    name: '信息成员',
    role: '信息测试',
  });

  // 获取信息
  const info = workspace.getInfo();
  assert(info.id === 'info-test', 'ID 正确');
  assert(info.name === '信息测试空间', '名称正确');
  assert(info.memberCount >= 2, 'Member 数量正确');

  // 获取 Member 概要
  const summaries = workspace.getMemberSummaries();
  assert(Array.isArray(summaries), '返回概要数组');
  assert(summaries.length >= 2, '有至少 2 个 Member 概要');

  console.log('\n  WorkSpace 信息:');
  console.log(`  ID: ${info.id}`);
  console.log(`  名称: ${info.name}`);
  console.log(`  Members: ${info.memberCount}`);

  console.log('\n✅ 测试 6 通过\n');
}

/**
 * 测试 7: 错误处理
 */
async function testErrorHandling() {
  section('测试 7: 错误处理');

  const workspace = new WorkSpace();
  await workspace.initialize();

  // 不存在的 Member
  const result = await workspace.executeWithMember('non-existent', '测试');
  assert(result.success === false, '不存在的 Member 返回失败');
  assert(result.error.includes('不存在'), '错误消息包含"不存在"');
  assert(Array.isArray(result.availableMembers), '提供可用 Member 列表');

  console.log('\n✅ 测试 7 通过\n');
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     WorkSpace + Member 架构测试套件              ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const tests = [
    { name: '基本创建', fn: testWorkspaceCreation },
    { name: 'Member 管理', fn: testMemberManagement },
    { name: '单 Member 执行', fn: testSingleMemberExecution },
    { name: '任务提交接口', fn: testTaskSubmission },
    { name: '多 Member 协作', fn: testMultiMemberCollaboration },
    { name: '信息获取', fn: testWorkspaceInfo },
    { name: '错误处理', fn: testErrorHandling },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      console.error(`\n❌ ${test.name} 失败: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('═'.repeat(50) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// 运行测试
runAllTests().catch(error => {
  console.error('\n❌ 测试运行失败:', error);
  process.exit(1);
});

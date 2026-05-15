// ─────────────────────────────────────────────
//  WorkSpace + Member 架构演示
// ─────────────────────────────────────────────
import { WorkSpace } from '../src/WorkSpace.js';
import { getSystemConfig } from '../src/SystemConfig.js';

/**
 * 演示 WorkSpace + Member 新架构
 */
async function demo() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     WorkSpace + Member 架构演示                ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 加载系统配置
  const systemConfig = getSystemConfig();

  // 创建 WorkSpace（使用 SystemConfig）
  const workspace = new WorkSpace({
    id: 'default',  // 使用配置中的 default workspace
    name: '演示工作空间',
    description: '展示 WorkSpace + Member 架构的工作方式',
    systemConfig: systemConfig,
  });

  // 初始化（加载配置，创建 Members）
  await workspace.initialize();

  // ─────────────────────────────────────────
  //  演示 1: 使用默认 Member 执行任务
  // ─────────────────────────────────────────
  console.log('\n📌 演示 1: 使用默认 Member 执行任务');
  console.log('─'.repeat(50));

  const result1 = await workspace.submitTask({
    description: '请用一句话介绍自己',
    // 不指定 memberId，自动使用 defaultMember
  });

  console.log(`\n结果: ${result1.result?.substring(0, 200)}...`);

  // ─────────────────────────────────────────
  //  演示 2: 指定 Member 执行
  // ─────────────────────────────────────────
  console.log('\n📌 演示 2: 指定 Member 执行任务');
  console.log('─'.repeat(50));

  // 查看可用的 Members
  const members = workspace.getMemberSummaries();
  console.log('\n可用 Members:');
  members.forEach(m => {
    console.log(`  - ${m.name} (${m.id}): ${m.role}`);
  });

  // 使用 researcher 执行
  if (workspace.getMember('researcher')) {
    const result2 = await workspace.submitTask({
      description: '查找关于人工智能的最新新闻',
      memberId: 'researcher',
    });
    console.log(`\nresearcher 执行结果: ${result2.result?.substring(0, 200)}...`);
  }

  // ─────────────────────────────────────────
  //  演示 3: 多 Member 协作
  // ─────────────────────────────────────────
  console.log('\n📌 演示 3: 多 Member 协作执行');
  console.log('─'.repeat(50));

  const result3 = await workspace.submitTask({
    description: '分析这个任务的可行性',
    memberIds: ['default', 'researcher', 'coder'],  // 多个 Member 同时执行
  });

  console.log(`\n协作执行使用了 ${result3.membersUsed.length} 个 Member`);
  console.log('Members:', result3.membersUsed.join(', '));

  // ─────────────────────────────────────────
  //  演示 4: 动态添加 Member
  // ─────────────────────────────────────────
  console.log('\n📌 演示 4: 动态添加 Member');
  console.log('─'.repeat(50));

  await workspace.addMember({
    id: 'analyst',
    name: '分析师',
    role: '专业数据分析员',
    skills: ['read', 'write', 'exec'],
  });

  console.log('\n添加后 Members:');
  workspace.listMembers();

  // ─────────────────────────────────────────
  //  演示 5: WorkSpace 信息
  // ─────────────────────────────────────────
  console.log('\n📌 演示 5: WorkSpace 信息');
  console.log('─'.repeat(50));

  const info = workspace.getInfo();
  console.log('\nWorkSpace 概要:');
  console.log(`  ID: ${info.id}`);
  console.log(`  名称: ${info.name}`);
  console.log(`  Member 数量: ${info.memberCount}`);
  console.log(`  默认 Member: ${info.defaultMember?.name}`);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║               演示完成                           ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
}

// 运行演示
demo().catch(error => {
  console.error('\n❌ 演示失败:', error);
  process.exit(1);
});

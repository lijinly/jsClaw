// ─────────────────────────────────────────────
//  测试运行器
// ─────────────────────────────────────────────
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 将 Windows 路径转换为 file:// URL
 */
function toFileURL(filePath) {
  // Windows: D:\path\to\file.js → file:///D:/path/to/file.js
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.match(/^\/[A-Z]:/)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

/**
 * 运行单个测试文件
 */
export async function runTest(testFile, verbose = true) {
  const startTime = Date.now();
  const testPath = join(__dirname, testFile);
  const testURL = toFileURL(testPath);

  if (verbose) {
    console.log(`\n▶ 运行: ${testFile}`);
  }

  try {
    // 使用动态 import 运行测试（需要 file:// URL）
    await import(testURL);
    const duration = Date.now() - startTime;

    if (verbose) {
      console.log(`✓ 完成 (${duration}ms)`);
    }

    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ 失败: ${error.message}`);
    if (verbose) {
      console.error(error.stack);
    }
    return { success: false, duration, error: error.message };
  }
}

/**
 * 运行多个测试
 */
export async function runTests(testCases, verbose = true) {
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await runTest(testCase.file, verbose);
    results.push({ ...testCase, ...result });

    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }

  // 输出汇总
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║              测试结果汇总                   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  for (const result of results) {
    const status = result.success ? '✓' : '✗';
    const duration = result.duration ? `(${result.duration}ms)` : '';
    console.log(`  ${status} ${result.name} ${duration}`);
  }

  console.log(`\n总计: ${passed} 通过, ${failed} 失败`);

  return { passed, failed, results };
}

// 如果直接运行此文件
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const testFiles = [
    { name: 'ContextManager 基础测试', file: './test-context-manager.js' },
    { name: 'ContextManager 大规模测试', file: './test-context-large.js' },
    { name: 'ContextManager + Agent 集成', file: './test-context-integration.js' },
    { name: 'GoalTracker 基础测试', file: './test-goal-tracker.js' },
    { name: 'GoalTracker + Agent 集成', file: './test-goal-agent-integration.js' },
    { name: 'WorkSpace + Member 架构测试', file: './test-workspace-member.js' },
  ];

  console.log('╔════════════════════════════════════════════╗');
  console.log('║         jsClaw 测试套件                      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  runTests(testFiles).then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

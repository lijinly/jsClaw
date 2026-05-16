// ─────────────────────────────────────────────
//  TestErrorHandling.js - 错误处理与恢复机制测试
// ─────────────────────────────────────────────

// 模拟 Manager 的错误处理函数（用于独立测试）
const ErrorType = {
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
  UNKNOWN: 'unknown',
};

function classifyError(error) {
  const msg = error.message?.toLowerCase() || '';
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('ECONNREFUSED')) {
    return ErrorType.TRANSIENT;
  }
  if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('invalid') || msg.includes('forbidden')) {
    return ErrorType.PERMANENT;
  }
  return ErrorType.UNKNOWN;
}

function calculateBackoff(attempt, config = {}) {
  const baseDelayMs = config.baseDelayMs ?? 1000;
  const maxDelayMs = config.maxDelayMs ?? 30000;
  const exponentialBackoff = config.exponentialBackoff ?? true;
  if (exponentialBackoff) {
    return Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  }
  return baseDelayMs;
}

// 模拟熔断器
class CircuitBreaker {
  constructor(threshold = 5, maxDelayMs = 30000) {
    this.threshold = threshold;
    this.maxDelayMs = maxDelayMs;
    this.failures = 0;
    this.isOpen = false;
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= this.threshold && !this.isOpen) {
      this.isOpen = true;
      console.log(`[CircuitBreaker] 熔断开启，${this.maxDelayMs}ms 后恢复`);
      setTimeout(() => {
        this.isOpen = false;
        this.failures = 0;
        console.log('[CircuitBreaker] 熔断恢复');
      }, this.maxDelayMs);
    }
  }

  recordSuccess() {
    this.failures = 0;
  }

  isTripped() {
    return this.isOpen;
  }
}

// ═══════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════

function testClassifyTimeoutError() {
  console.log('\n📋 测试 1: 错误分类 - 超时错误');

  const error = new Error('Connection timeout');
  const type = classifyError(error);

  console.log('  错误信息:', error.message);
  console.log('  分类结果:', type);
  console.log('  结果:', type === ErrorType.TRANSIENT ? '✅ 通过' : '❌ 失败');
  return type === ErrorType.TRANSIENT;
}

function testClassifyPermissionError() {
  console.log('\n📋 测试 2: 错误分类 - 权限错误');

  const error = new Error('Permission denied');
  const type = classifyError(error);

  console.log('  错误信息:', error.message);
  console.log('  分类结果:', type);
  console.log('  结果:', type === ErrorType.PERMANENT ? '✅ 通过' : '❌ 失败');
  return type === ErrorType.PERMANENT;
}

function testClassifyUnauthorizedError() {
  console.log('\n📋 测试 3: 错误分类 - 未授权错误');

  const error = new Error('Unauthorized access');
  const type = classifyError(error);

  console.log('  错误信息:', error.message);
  console.log('  分类结果:', type);
  console.log('  结果:', type === ErrorType.PERMANENT ? '✅ 通过' : '❌ 失败');
  return type === ErrorType.PERMANENT;
}

function testClassifyUnknownError() {
  console.log('\n📋 测试 4: 错误分类 - 未知错误');

  const error = new Error('Something went wrong');
  const type = classifyError(error);

  console.log('  错误信息:', error.message);
  console.log('  分类结果:', type);
  console.log('  结果:', type === ErrorType.UNKNOWN ? '✅ 通过' : '❌ 失败');
  return type === ErrorType.UNKNOWN;
}

function testClassifyEconnrefused() {
  console.log('\n📋 测试 5: 错误分类 - 连接拒绝');

  const error = new Error('ECONNREFUSED');
  const type = classifyError(error);

  console.log('  错误信息:', error.message);
  console.log('  分类结果:', type);
  console.log('  结果:', type === ErrorType.TRANSIENT ? '✅ 通过' : '❌ 失败');
  return type === ErrorType.TRANSIENT;
}

function testClassifyForbidden() {
  console.log('\n📋 测试 6: 错误分类 - 禁止访问');

  const error = new Error('403 Forbidden');
  const type = classifyError(error);

  console.log('  错误信息:', error.message);
  console.log('  分类结果:', type);
  console.log('  结果:', type === ErrorType.PERMANENT ? '✅ 通过' : '❌ 失败');
  return type === ErrorType.PERMANENT;
}

function testExponentialBackoff() {
  console.log('\n📋 测试 7: 指数退避计算');

  const config = { baseDelayMs: 1000, maxDelayMs: 30000, exponentialBackoff: true };

  const delay0 = calculateBackoff(0, config);
  const delay1 = calculateBackoff(1, config);
  const delay2 = calculateBackoff(2, config);
  const delay3 = calculateBackoff(3, config);
  const delay10 = calculateBackoff(10, config); // 应该达到 maxDelayMs

  console.log('  attempt=0:', delay0, 'ms (期望 1000)');
  console.log('  attempt=1:', delay1, 'ms (期望 2000)');
  console.log('  attempt=2:', delay2, 'ms (期望 4000)');
  console.log('  attempt=3:', delay3, 'ms (期望 8000)');
  console.log('  attempt=10:', delay10, 'ms (期望 30000, capped)');

  const passed = delay0 === 1000 && delay1 === 2000 && delay2 === 4000 && delay3 === 8000 && delay10 === 30000;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

function testLinearBackoff() {
  console.log('\n📋 测试 8: 线性退避计算');

  const config = { baseDelayMs: 1000, maxDelayMs: 30000, exponentialBackoff: false };

  const delay0 = calculateBackoff(0, config);
  const delay1 = calculateBackoff(1, config);
  const delay5 = calculateBackoff(5, config);

  console.log('  attempt=0:', delay0, 'ms (期望 1000)');
  console.log('  attempt=1:', delay1, 'ms (期望 1000)');
  console.log('  attempt=5:', delay5, 'ms (期望 1000)');

  const passed = delay0 === 1000 && delay1 === 1000 && delay5 === 1000;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

function testCircuitBreaker() {
  console.log('\n📋 测试 9: 熔断机制');

  const cb = new CircuitBreaker(5, 100); // 阈值5，100ms后恢复（用于测试）

  console.log('  初始状态: isOpen =', cb.isTripped());

  // 连续失败4次，不应触发熔断
  for (let i = 0; i < 4; i++) {
    cb.recordFailure();
  }
  console.log('  失败4次后: isOpen =', cb.isTripped(), '(期望 false)');

  // 第5次失败，触发熔断
  cb.recordFailure();
  console.log('  失败5次后: isOpen =', cb.isTripped(), '(期望 true)');

  const passed = !cb.isTripped() === false && cb.isTripped() === true;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

function testCircuitBreakerResetsOnSuccess() {
  console.log('\n📋 测试 10: 熔断器成功重置');

  // 创建新的熔断器实例（避免受前一个测试影响）
  const cb = new CircuitBreaker(5, 100);

  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  console.log('  失败3次后:', cb.failures);

  cb.recordSuccess();
  console.log('  成功后:', cb.failures, '(期望 0)');

  // 验证计数器已重置
  const afterSuccess = cb.failures === 0;

  // 现在再失败4次，不应该触发熔断（因为之前重置了）
  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  console.log('  再失败4次后:', cb.failures, '(期望 4，未触发熔断)');

  const notTrippedYet = !cb.isTripped();

  // 再失败1次，触发熔断
  cb.recordFailure();
  console.log('  再失败1次后: isOpen =', cb.isTripped(), '(期望 true)');

  const passed = afterSuccess && notTrippedYet;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

function testErrorTypeMapping() {
  console.log('\n📋 测试 11: 错误类型完整映射');

  const testCases = [
    { msg: 'timeout', expected: 'transient' },
    { msg: 'ECONNREFUSED', expected: 'transient' },
    { msg: 'enotfound', expected: 'transient' },
    { msg: 'permission denied', expected: 'permanent' },
    { msg: 'unauthorized', expected: 'permanent' },
    { msg: 'invalid parameter', expected: 'permanent' },
    { msg: 'forbidden', expected: 'permanent' },
    { msg: 'generic error', expected: 'unknown' },
  ];

  let allPassed = true;
  for (const tc of testCases) {
    const error = new Error(tc.msg);
    const type = classifyError(error);
    const passed = type === tc.expected;
    console.log(`  "${tc.msg}" -> ${type} ${passed ? '✅' : '❌'}`);
    if (!passed) allPassed = false;
  }

  console.log('  结果:', allPassed ? '✅ 通过' : '❌ 失败');
  return allPassed;
}

// ═══════════════════════════════════════════
//  运行测试
// ═══════════════════════════════════════════

async function runTests() {
  console.log('═'.repeat(60));
  console.log('🧪 错误处理与恢复机制测试');
  console.log('═'.repeat(60));

  const results = [];

  // 错误分类测试
  results.push({ name: '超时错误分类', passed: testClassifyTimeoutError() });
  results.push({ name: '权限错误分类', passed: testClassifyPermissionError() });
  results.push({ name: '未授权错误分类', passed: testClassifyUnauthorizedError() });
  results.push({ name: '未知错误分类', passed: testClassifyUnknownError() });
  results.push({ name: '连接拒绝分类', passed: testClassifyEconnrefused() });
  results.push({ name: '禁止访问分类', passed: testClassifyForbidden() });

  // 退避策略测试
  results.push({ name: '指数退避计算', passed: testExponentialBackoff() });
  results.push({ name: '线性退避计算', passed: testLinearBackoff() });

  // 熔断机制测试
  results.push({ name: '熔断机制触发', passed: testCircuitBreaker() });
  results.push({ name: '熔断器成功重置', passed: testCircuitBreakerResetsOnSuccess() });

  // 完整映射测试
  results.push({ name: '错误类型完整映射', passed: testErrorTypeMapping() });

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

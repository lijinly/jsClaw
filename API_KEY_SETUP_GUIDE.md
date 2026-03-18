# 🔐 jsClaw API Key 配置指南

## 快速开始

### 方案 A：当前会话临时配置（5 秒钟）✅ 最快

1. 双击运行：`setup-api-key-session.bat`
2. 然后在弹出的命令行中运行：`npm start`

**优点**：无需管理员权限  
**缺点**：关闭命令行后失效

---

### 方案 B：永久配置（系统级环境变量）✅ 推荐

#### 方式 1：自动脚本

1. **右键点击** `setup-api-key-permanent.bat`
2. 选择 **以管理员身份运行**
3. 按照提示输入 API Key
4. **重启 IDE 或命令行**

#### 方式 2：手动设置（Windows）

1. 按 `Win + R` 打开"运行"
2. 输入 `sysdm.cpl` 并回车
3. 点击 **环境变量** 按钮
4. 点击 **新建**（系统变量）
5. 变量名：`OPENAI_API_KEY`
6. 变量值：`sk-45d478ddd7b94b0d838d9fce6f1e3762`
7. 点击 **确定** 并重启 IDE

#### 方式 3：命令行设置（需要管理员权限）

```bash
# Windows CMD（管理员）
setx OPENAI_API_KEY "sk-45d478ddd7b94b0d838d9fce6f1e3762"

# Windows PowerShell（管理员）
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-45d478ddd7b94b0d838d9fce6f1e3762", "User")

# Linux / macOS
export OPENAI_API_KEY="sk-45d478ddd7b94b0d838d9fce6f1e3762"
```

---

### 方案 C：项目级配置（开发用）

编辑 `.env` 文件：

```env
# 取消注释下面这行
OPENAI_API_KEY=sk-45d478ddd7b94b0d838d9fce6f1e3762
```

**优点**：快速方便  
**缺点**：可能不小心提交到 Git（有风险）

---

## ✅ 配置优先级

jsClaw Agent 会按以下优先级读取 API Key：

1. **函数参数** - `initLLM({ apiKey: "..." })`
2. **系统环境变量** - `process.env.OPENAI_API_KEY` ⭐ 推荐
3. **.env 文件** - `OPENAI_API_KEY=...`
4. **默认值** - 触发错误提示

---

## 🧪 验证配置

### 检查系统环境变量是否设置

```bash
# Windows CMD
echo %OPENAI_API_KEY%

# Windows PowerShell
$env:OPENAI_API_KEY

# Linux / macOS
echo $OPENAI_API_KEY
```

应该显示：`sk-45d478ddd7b94b0d838d9fce6f1e3762`

### 运行诊断脚本

```bash
cd D:\jsClaw
node diagnose-api.js
```

### 测试 Agent

```bash
npm test        # 运行快速测试
npm start       # 启动交互式对话
```

---

## 🔒 安全建议

✅ **安全做法**：
- 使用系统环境变量（方案 B）
- 不要提交 .env 文件到 Git
- .gitignore 已配置排除 .env

❌ **不安全做法**：
- 在代码中硬编码 API Key
- 提交含真实 Key 的 .env 到 Git
- 在公共场所显示 API Key

---

## 🐛 常见问题

### Q1: 设置后仍显示 "API Key 未配置"

**原因**：环境变量需要重启 IDE 才能生效

**解决**：
1. 完全关闭 IDE
2. 重新打开 IDE
3. 或使用 `setup-api-key-session.bat` 临时设置

### Q2: 系统变量设置了但读不到

**原因**：可能是 .env 文件中的注释导致 dotenv 读到了空值

**解决**：
1. 确保 .env 中的 `OPENAI_API_KEY` 被注释了
2. 运行 `node diagnose-api.js` 检查

### Q3: 能不能同时从 .env 和系统环境变量读取？

**可以的！** jsClaw 已经支持：
- 优先读系统环境变量
- 系统环境变量为空时，回退到 .env

### Q4: 不想每次都配置，有没有自动方案？

**有的！** 参考方案 B 永久配置，配置一次就可以了。

---

## 📞 更多帮助

- GitHub 问题：https://github.com/xxx/jsClaw/issues
- 文档：README.md
- 诊断工具：`node diagnose-api.js`

---

**最后更新**：2026-03-18  
**支持的 API Key 格式**：`sk-*`（阿里云千问 / OpenAI 兼容格式）

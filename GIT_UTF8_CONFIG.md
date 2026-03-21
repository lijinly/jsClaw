# Git 中文编码配置说明

## 问题
在 Windows 上使用 Git 提交中文 commit message 时，在本地查看是正常的，但推送到 GitHub 后显示为乱码。

## 原因
Windows 的 Git 默认使用系统编码（GBK）处理中文字符，而 GitHub 使用 UTF-8，导致编码不匹配。

## 解决方案

### 1. 配置 Git 使用 UTF-8 编码
执行以下命令：

```bash
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8
git config --global gui.encoding utf-8
git config --global core.quotePath false
```

### 2. 配置说明

- `i18n.commitencoding utf-8` - 提交信息使用 UTF-8 编码
- `i18n.logoutputencoding utf-8` - 日志输出使用 UTF-8 编码
- `gui.encoding utf-8` - GUI 界面使用 UTF-8 编码
- `core.quotePath false` - 不对路径中的非 ASCII 字符进行转义

### 3. 验证配置
创建一个测试 commit：

```bash
git commit --allow-empty -m "test: 测试中文编码"
```

查看 commit 信息：

```bash
git log -1 --format=fuller
```

应该能正确显示中文："test: 测试中文编码"

撤销测试 commit（可选）：

```bash
git reset --soft HEAD~1
```

### 4. 已存在的乱码 commit
对于已经推送到远程的乱码 commit，有以下处理方式：

#### 方案 A：使用 git rebase 修改（推荐）
```bash
# 交互式 rebase 最近 N 个 commit
git rebase -i HEAD~N

# 将要修改的 commit 前的 pick 改为 edit
# 保存后，Git 会停在每个 edit 的 commit 上

# 修改 commit message
git commit --amend

# 继续下一个
git rebase --continue
```

#### 方案 B：创建新的提交修正（简单）
直接使用正确的中文 message 创建新的 commit，保持历史记录。

### 5. 永久解决方案（可选）
将以下内容添加到 `~/.gitconfig` 文件中：

```ini
[i18n]
    commitencoding = utf-8
    logoutputencoding = utf-8

[gui]
    encoding = utf-8

[core]
    quotePath = false
```

## 注意事项
1. 这个配置是全局的，会影响所有 Git 仓库
2. 如果只想在某个项目中生效，去掉 `--global` 参数
3. 配置后，新提交的中文 commit message 都能正常显示
4. 已存在的乱码 commit 需要手动修正

## 完成示例
```bash
# 配置 Git
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8
git config --global gui.encoding utf-8
git config --global core.quotePath false

# 验证配置
git commit --allow-empty -m "test: 测试中文编码"
git log -1

# 撤销测试
git reset --soft HEAD~1
```

现在你可以放心使用中文提交 commit message 了！

#!/bin/bash
# 这个脚本用于设置系统环境变量（macOS / Linux）
# 使用方法：bash setup-env.sh

echo "正在配置系统环境变量..."
echo ""

read -p "请输入你的 API Key: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "错误：API Key 不能为空"
    exit 1
fi

# 检测 shell 类型
if [ -f ~/.bashrc ]; then
    SHELL_RC=~/.bashrc
elif [ -f ~/.zshrc ]; then
    SHELL_RC=~/.zshrc
else
    SHELL_RC=~/.bash_profile
fi

# 添加到 shell 配置文件
echo "" >> "$SHELL_RC"
echo "# jsClaw API Key" >> "$SHELL_RC"
echo "export OPENAI_API_KEY=\"$API_KEY\"" >> "$SHELL_RC"

echo ""
echo "✅ 成功！环境变量已添加到 $SHELL_RC"
echo ""
echo "请执行以下命令使配置生效："
echo "  source $SHELL_RC"
echo ""
echo "或关闭终端重新打开"

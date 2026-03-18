@echo off
REM 这个脚本用于设置系统环境变量（需要管理员权限运行）
REM 使用方法：右键选择"以管理员身份运行"

echo 正在配置系统环境变量...
echo.

REM 获取用户输入
set /p API_KEY="请输入你的 API Key: "

if "%API_KEY%"=="" (
    echo 错误：API Key 不能为空
    pause
    exit /b 1
)

REM 设置系统环境变量（需要管理员权限）
setx OPENAI_API_KEY "%API_KEY%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ 成功！环境变量 OPENAI_API_KEY 已设置
    echo.
    echo 注意：你需要重启命令行或 IDE 才能使新的环境变量生效
    echo.
) else (
    echo.
    echo ❌ 设置失败，请确保以管理员身份运行此脚本
    echo.
)

pause

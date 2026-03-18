@echo off
REM ============================================
REM jsClaw - API Key 永久配置脚本
REM ============================================

echo.
echo ====================================================
echo jsClaw API Key 永久配置
echo ====================================================
echo.

REM 从用户输入获取 API Key
set /p API_KEY="请输入你的 API Key (格式: sk-xxxxx...): "

if "%API_KEY%"=="" (
    echo.
    echo ❌ 错误：API Key 不能为空！
    echo.
    pause
    exit /b 1
)

REM 验证格式
if not "%API_KEY:~0,3%"=="sk-" (
    echo.
    echo ⚠️  警告：API Key 格式异常，期望格式：sk-xxxxx...
    echo 实际格式：%API_KEY:~0,8%...
    echo.
)

REM 设置系统环境变量
echo.
echo ⏳ 正在设置系统环境变量...
setx OPENAI_API_KEY "%API_KEY%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ 成功！API Key 已设置到系统环境变量
    echo.
    echo 📌 重要：需要重启 IDE 或命令行才能生效
    echo.
    echo 验证方法（重启后）：
    echo   echo %%OPENAI_API_KEY%%
    echo.
) else (
    echo.
    echo ❌ 失败：无法设置环境变量（可能需要管理员权限）
    echo.
)

pause

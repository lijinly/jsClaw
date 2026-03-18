@echo off
REM ============================================
REM jsClaw - 当前会话 API Key 配置
REM ============================================

echo.
echo ====================================================
echo jsClaw API Key 临时配置（仅当前会话）
echo ====================================================
echo.

set OPENAI_API_KEY=sk-45d478ddd7b94b0d838d9fce6f1e3762

echo ✅ API Key 已设置到当前会话
echo.
echo 现在可以运行：
echo   npm start
echo.
echo 📌 注意：关闭命令行后配置会丢失
echo 想要永久配置，请运行：setup-api-key-permanent.bat
echo.

cmd /k

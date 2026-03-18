@echo off
cd /d D:\jsClaw
git add -A
git commit -m "security: move API Key to system environment variable"
git push origin main

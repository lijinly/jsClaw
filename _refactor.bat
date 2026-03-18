@echo off
cd /d D:\jsClaw
git add -A
git commit -m "refactor: remove runAgent method, keep only Think-Act mode for simplicity"
git push origin main

@echo off
cd /d D:\jsClaw
git add README.md .env.example
git commit -m "docs: add full README with background, usage and examples"
git push origin main

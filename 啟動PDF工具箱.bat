@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在啟動 PDF 工具箱 (port 8010)...
start "" http://localhost:8010/
npx --yes http-server -p 8010 -c-1 .
if errorlevel 1 pause

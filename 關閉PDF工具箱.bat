@echo off
chcp 65001 >nul
echo 正在關閉 port 8010 的服務...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8010 ^| findstr LISTENING') do (
    echo 終止 PID %%a
    taskkill /F /PID %%a
)
echo 完成。
pause

@echo off
chcp 65001 >nul
title URL 重定向追踪器
echo.
echo  正在启动 URL 重定向追踪器...
echo.

:: Check if build exists
if not exist "dist\client\index.html" (
    echo  首次运行，正在构建前端...
    echo.
    call npx vite build
    if errorlevel 1 (
        echo.
        echo  构建失败，请检查 Node.js 是否已安装
        pause
        exit /b 1
    )
)

:: Start server
node server\index.js
pause

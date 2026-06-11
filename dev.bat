@echo off
chcp 65001 >nul
title URL 重定向追踪器 (开发模式)
echo.
echo  启动开发模式...
echo  前端: http://localhost:5173
echo  后端: http://localhost:3001
echo.

:: Start backend in background
start /b node server\index.js

:: Start Vite dev server (proxies API to backend)
npx vite --open

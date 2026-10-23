@echo off
chcp 65001 >nul
title 网站管理器
cd /d "%~dp0"

if not exist "package.json" (
  echo 找不到项目目录：%~dp0
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo 首次运行，正在安装依赖（需要联网，约 1-3 分钟）...
  rem 结束可能残留的 electron 进程，释放脚本占用的文件
  taskkill /f /im electron.exe >nul 2>nul
  timeout /t 2 /nobreak >nul
  if exist node_modules rmdir /s /q node_modules
  if exist node_modules (
    echo node_modules 文件夹被占用，无法删除。
    echo 请关闭 VS Code 等可能占用本项目的程序，稍后重试。
    pause
    exit /b 1
  )
  set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
  set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
  call npm install
  if not exist "node_modules\electron\dist\electron.exe" (
    echo 依赖安装失败，请检查网络后重新运行本脚本。
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
exit /b 0

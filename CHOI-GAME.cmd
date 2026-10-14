@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Cai Node.js 24 LTS tu https://nodejs.org roi mo lai file nay.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Game: http://localhost:5173/flight-simulator/
echo Giu cua so nay mo khi choi. Ctrl+C de dung server.
call npm.cmd run dev -- --open
pause

@echo off
rem Inicia o MORAA GO neste computador (demonstracao local).
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist dist call npm run build
echo.
echo  MORAA GO em http://localhost:8787   (Ctrl+C para encerrar)
echo.
call npm start

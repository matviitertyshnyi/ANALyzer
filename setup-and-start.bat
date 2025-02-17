REM filepath: /d:/progr/ANALyzer/setup-and-start.bat
@echo off
echo Installing required dependencies...
call npm install -g ts-node typescript @types/node
call npm install

echo Creating necessary directories...
mkdir data 2>nul
mkdir logs 2>nul

echo Directories created:
echo - %~dp0data
echo - %~dp0logs

echo Starting bot...
call ts-node anal_back/server.ts

pause
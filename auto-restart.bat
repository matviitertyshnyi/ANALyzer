@echo off
:start
cd %~dp0
echo Starting ANALyzer Bot...
npm run bot
echo Bot stopped or crashed, restarting in 5 seconds...
timeout /t 5
goto start

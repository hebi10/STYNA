@echo off
call npm run deploy:prep
if errorlevel 1 exit /b %errorlevel%

call npm run functions:build
exit /b %errorlevel%

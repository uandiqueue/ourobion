@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-process-probe.ps1" %*
exit /b %ERRORLEVEL%

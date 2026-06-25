@echo off
cd /d "%~dp0"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0run_server.ps1\"' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
exit

@echo off
setlocal
cd /d "%~dp0\.."
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 "%~dp0tools\sync_instance.py" %*
) else (
  python "%~dp0tools\sync_instance.py" %*
)
if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] sync_instance failed with code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

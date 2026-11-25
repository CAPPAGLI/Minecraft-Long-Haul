@echo off
setlocal
cd /d "%~dp0\.."
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 "%~dp0tools\build_local.py" %*
) else (
  python "%~dp0tools\build_local.py" %*
)
if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] build_local failed with code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

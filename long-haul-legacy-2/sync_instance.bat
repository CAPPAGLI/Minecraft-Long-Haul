@echo off
REM Long Haul Legacy 2.0 delta-sync wrapper.
REM Examples:
REM   long-haul-legacy-2\sync_instance.bat --instance "D:\path\to\instance"
REM   long-haul-legacy-2\sync_instance.bat --skip-mods
REM   long-haul-legacy-2\sync_instance.bat --with-optional         (also download safe CurseForge optional mods)
REM   long-haul-legacy-2\sync_instance.bat --with-all-optional     (also download experimental DOOMED)
setlocal
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
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

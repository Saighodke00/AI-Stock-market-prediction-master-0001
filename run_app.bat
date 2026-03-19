@echo off
setlocal enabledelayedexpansion
title Apex AI - Intelligence Hub (v4.0.1)

:: --- Color Definitions (Standard CMD) ---
set "CYA= [96m"
set "GRN= [92m"
set "RED= [91m"
set "YLW= [93m"
set "RST= [0m"

echo %CYA%================================================%RST%
echo %CYA%   APEX AI v4.0.1 - INTELLIGENCE HUB      %RST%
echo %CYA%================================================%RST%
echo [*] Launcher Process ID: %RANDOM%
echo [*] System Time: %TIME%
echo.

:: --- Phase 1: Environment Diagnostics ---
echo %YLW%[STAGE 1: DIAGNOSTICS]%RST%
echo ------------------------------------------------

:: 1.1 Check Virtual Environment
if not exist venv\Scripts\activate.bat (
    echo %RED%[!] ERROR: Virtual environment missing in .\venv\%RST%
    echo [*] Fix: Run 'python -m venv venv' then '.\venv\Scripts\pip install -r requirements.txt'
    pause
    exit /b 1
) else (
    echo [OK] Python Virtual Environment found.
)

:: 1.2 Check Python Presence
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
    echo [OK] Python Detected: !PY_VER!
) else (
    echo %RED%[!] ERROR: Python not found in PATH.%RST%
)

:: 1.3 Check Node.js (Frontend requirement)
where npm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    for /f "tokens=1" %%v in ('npm -v 2^>^&1') do set "NODE_VER=%%v"
    echo [OK] Node/NPM Detected: v!NODE_VER!
) else (
    echo %YLW%[!] WARNING: npm not found. Frontend may fail to start.%RST%
)

:: 1.4 Check Directories
if not exist frontend (
    echo %RED%[!] ERROR: "frontend" directory is missing!%RST%
    pause
    exit /b 1
)
echo.

:: --- Phase 2: Launching Services ---
echo %YLW%[STAGE 2: SERVICE ACTIVATION]%RST%
echo ------------------------------------------------

:: 2.1 Backend (FastAPI + Uvicorn)
echo [*] Starting %CYA%FastAPI Backend%RST% on port 8000...
echo [INFO] Redirecting logs to separate window: "Apex AI - Backend"
start "Apex AI - Backend" cmd /k "call venv\Scripts\activate.bat && echo [BACKEND] Starting Uvicorn Engine... && uvicorn main:app --host 0.0.0.0 --port 9001 --reload"

:: 2.2 Frontend (React + Vite)
echo [*] Starting %CYA%React UI%RST% on port 3000...
echo [INFO] Redirecting logs to separate window: "Apex AI - UI"
start "Apex AI - UI" cmd /k "cd frontend && echo [FRONTEND] Starting Vite Dev Server... && npm run dev"

echo.
echo %GRN%[*] Services are warming up...%RST%
timeout /t 6 /nobreak > nul

:: --- Phase 3: Final Access ---
echo.
echo %YLW%[STAGE 3: ACCESS SUMMARY]%RST%
echo ------------------------------------------------
echo %GRN%[SUCCESS] Intelligence Hub is online.%RST%
echo.
echo    Local Terminal:   http://localhost:3000
echo    API Blueprint:    http://localhost:8000/docs
echo.
echo ------------------------------------------------
echo %YLW%[TROUBLESHOOTING]%RST%
echo  - If you see "MemoryError": Backend is optimized, check your RAM.
echo  - If window closes: Check venv or npm installations.
echo  - If blank screen: Ensure both windows say "Running".
echo ------------------------------------------------
echo.

:: Launch Browser
start http://localhost:3000

echo Launch complete. Press any key to close this manager.
pause > nul
exit
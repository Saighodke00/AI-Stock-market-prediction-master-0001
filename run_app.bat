@echo off
setlocal enabledelayedexpansion
title APEX AI - NEURAL LAUNCHER v5.1

:: ── ANSI ESCAPE CHARACTER CAPTURE ──────────────────────────────────────────
:: This is the most robust way to get the ESC character in a batch file.
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do set ESC=%%b

set "CYA=%ESC%[96m"
set "GRN=%ESC%[92m"
set "RED=%ESC%[91m"
set "YLW=%ESC%[93m"
set "BLD=%ESC%[1m"
set "RST=%ESC%[0m"
set "DIM=%ESC%[2m"

:: ── HEADER ───────────────────────────────────────────────────────────────────
cls
echo %CYA%%BLD%
echo   █████╗ ██████╗ ███████╗██╗  ██╗     █████╗ ██╗
echo  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝    ██╔══██╗██║
echo  ███████║██████╔╝█████╗   ╚███╔╝     ███████║██║
echo  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗     ██╔══██║██║
echo  ██║  ██║██║     ███████╗██╔╝ ██╗    ██║  ██║██║
echo  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝ v5.1
echo %RST%
echo %DIM%  [Diagnostic Baseline Initialized at %TIME%]%RST%
echo.

:: ── STAGE 0: PORT CLEARANCE (Resolves ECONNREFUSED) ─────────────────────────
echo %HYL%[STAGE 0: CLEARING PORTS]%RST%
for %%p in (3000 9001) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%p ^| findstr LISTENING') do (
        echo %DIM%Found process %%a on port %%p. Terminating...%RST%
        taskkill /f /pid %%a >nul 2>&1
    )
)
echo %HGR%[OK]%RST% Transmission Bands Reset.
echo.

:: ── STAGE 1: SYSTEM CHECK ────────────────────────────────────────────────────
echo %YLW%[STAGE 1: SYSTEM CHECK]%RST%

:: Define Paths
set "ROOT=%~dp0"
set "PYTHON=%ROOT%venv\Scripts\python.exe"
set "UVICORN=%ROOT%venv\Scripts\uvicorn.exe"
set "STREAMLIT=%ROOT%venv\Scripts\streamlit.exe"

:: Verify Files
if not exist "%PYTHON%" (
    echo %RED%[X] ERROR: Python not found in venv\Scripts\%RST%
    echo     Please run 'python -m venv venv' then install requirements.
    pause
    exit /b 1
)

:: Check for common port conflicts and WARN (don't exit)
for %%p in (3000 9001) do (
    netstat -ano | findstr :%%p >nul
    if !errorlevel! equ 0 (
        echo %YLW%[!!] WARNING:%RST% Port %%p is busy. Service might fail to bind.
    )
)
echo %GRN%[OK]%RST% System Diagnostics Complete.
echo.

:: ── STAGE 2: ACTIVATE SERVICES ───────────────────────────────────────────────
echo %YLW%[STAGE 2: UPLINK SEQUENCE]%RST%

:: 2.1 Backend (FastAPI)
echo %CYA%[*] Initializing Core Engine...%RST% (Port 9001)
start "Apex AI - Backend" cmd /k "cd /d "%ROOT%" && "%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 9001 --reload"

:: 2.2 (Deprecated - Streamlit Analytics Removed)

:: 2.3 Frontend (React)
echo %CYA%[*] Deploying Visual Interface...%RST% (Port 3000)
if exist "%ROOT%frontend" (
    start "Apex AI - UI" cmd /k "cd /d "%ROOT%frontend" && npm run dev"
) else (
    echo %RED%[X] ERROR: Frontend directory not found.%RST%
)

echo.
echo %GRN%[√] All services dispatched.%RST%

:: ── STAGE 3: MISSION CONTROL ────────────────────────────────────────────────
echo %YLW%[STAGE 3: HEALTH MONITOR]%RST%

set "RETRY_COUNT=0"
set "MAX_RETRIES=20"

echo %DIM%Waiting for Neural Bridge to stabilize...%RST%

:PING_LOOP
timeout /t 3 /nobreak > nul
set /a "RETRY_COUNT+=1"

:: Use curl to check if API is up
curl -s http://localhost:9001/api/health > nul
if %errorlevel% neq 0 (
    if !RETRY_COUNT! geq !MAX_RETRIES! (
        echo.
        echo %RED%[!!] TIMEOUT:%RST% Backend failed to respond after 60s.
        echo      Check the "Apex AI - Backend" window for errors.
        pause
        exit /b 1
    )
    set /p ".=." <nul
    goto PING_LOOP
)

echo.
echo.
echo %GRN%%BLD%  >>> MISSION CONTROL ONLINE <<<%RST%
echo -------------------------------------------------------------
echo  DASHBOARD:      %CYA%http://localhost:3000%RST%
echo  API DOCS:       %DIM%http://localhost:9001/docs%RST%
echo -------------------------------------------------------------
echo.

:: Launch Unified Interface
start http://localhost:3000

echo %GRN%Launch Sequence Complete.%RST%
pause
exit
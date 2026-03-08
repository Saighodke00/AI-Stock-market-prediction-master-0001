@echo off
title Apex AI - Intelligence Hub (v4)
echo ================================================
echo   APEX AI v4.0 - Master Hub
echo ================================================
echo [*] Initializing services...
echo.

cd /d %~dp0

REM --- Service 1: FastAPI Backend (Engine) ---
echo [*] Starting FastAPI Backend on http://localhost:8000
start "Apex AI - Backend" cmd /k "if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) & uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude ""tests/*"" --reload-exclude ""frontend/*"" --reload-exclude ""data/*"""

REM --- Service 2: React Frontend (UI) ---
echo [*] Starting React UI on http://localhost:3000
start "Apex AI - Intelligence Hub" cmd /k "cd frontend & npm run dev"

echo.
echo [*] Waiting for services to initialize...
timeout /t 5 /nobreak > nul

echo [*] Launching dashboard in browser...
start http://localhost:3000

echo.
echo ================================================
echo   All services launched. 
echo   Check separate windows for logs.
echo ================================================
pause
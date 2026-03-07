@echo off
title Apex AI - Intelligence Hub
echo ================================================
echo   APEX AI v4.0 - Intelligence Hub (Streamlit)
echo ================================================
echo [*] Initializing services...
echo.

cd /d %~dp0

REM --- Service 1: FastAPI Backend (Engine) ---
echo [*] Starting FastAPI Backend on http://localhost:8000
start "Apex AI - Backend" cmd /k "call venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

REM --- Service 2: Streamlit Frontend (UI) ---
REM echo [*] Starting Streamlit UI on http://localhost:8501
REM start "Apex AI - Intelligence Hub" cmd /k "call venv\Scripts\activate.bat && streamlit run app.py"

echo.
echo [*] Waiting for services to initialize...
timeout /t 5 /nobreak > nul

echo [*] Launching dashboard in browser...
start http://localhost:8000

echo.
echo ================================================
echo   All services launched. 
echo   Check separate windows for logs.
echo ================================================
pause
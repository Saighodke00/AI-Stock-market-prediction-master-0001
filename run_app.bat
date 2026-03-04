@echo off
setlocal enabledelayedexpansion
title Apex AI - Command Center
color 0A

:: --- SETTINGS ---
set BACKEND_PORT=8000
set FRONTEND_PORT=8501
set PYTHON_EXEC=python
set VENV_PATH=venv
set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

cls
echo.
echo  [96m+----------------------------------------------------------+[0m
echo  [96m^|[0m  [92m█████╗ ██████╗ ███████╗██╗  ██╗     █████╗ ██╗[0m          [96m^|[0m
echo  [96m^|[0m  [92m██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝    ██╔══██╗██║[0m          [96m^|[0m
echo  [96m^|[0m  [92m███████║██████╔╝█████╗   ╚███╔╝     ███████║██║[0m          [96m^|[0m
echo  [96m^|[0m  [92m██╔══██║██╔═══╝ ██╔══╝   ██╔██╗     ██╔══██║██║[0m          [96m^|[0m
echo  [96m^|[0m  [92m██║  ██║██║     ███████╗██╔╝ ██╗    ██║  ██║██║[0m          [96m^|[0m
echo  [96m^|[0m  [92m╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝[0m          [96m^|[0m
echo  [96m+----------------------------------------------------------+[0m
echo  [90m         NEURAL ORCHESTRATOR v4.0 // MULTI-SERVICE[0m
echo.

:: --- STEP 1: VENV VALIDATION ---
echo  [94m[1/5][0m Validating Environment...
if not exist "%VENV_PATH%\Scripts\activate.bat" (
    echo  [33m[WARN][0m Virtual environment not found. Initializing setup...
    %PYTHON_EXEC% -m venv %VENV_PATH%
    if errorlevel 1 (
        echo  [31m[ERROR][0m Failed to create venv. Is Python installed?
        pause
        exit /b 1
    )
)
call %VENV_PATH%\Scripts\activate.bat
echo  [32m[OK][0m   Environment Active.

:: --- STEP 2: DEPENDENCY SYNC ---
echo.
echo  [94m[2/5][0m Syncing Dependencies...
pip install -r requirements.txt --quiet --timeout 10
if errorlevel 1 (
    echo  [33m[WARN][0m Dependency sync had issues. Attempting launch anyway...
) else (
    echo  [32m[OK][0m   Dependencies Synchronized.
)

:: --- STEP 3: INFRASTRUCTURE CHECK (REDIS) ---
echo.
echo  [94m[3/5][0m Checking Infrastructure...
:: Check if Redis is likely running (standard port 6379)
netstat -an | findstr :6379 >nul
if errorlevel 1 (
    echo  [33m[WARN][0m Redis not detected on port 6379. 
    echo         Note: Neural API caching will be disabled.
) else (
    echo  [32m[OK][0m   Redis Engine Detected.
)

:: --- STEP 4: LAUNCH NEURAL API (FASTAPI) ---
echo.
echo  [94m[4/5][0m Powering up Neural API...
set PYTHONPATH=%PROJECT_DIR%
start "Apex AI - Neural API" /min cmd /c "call venv\Scripts\activate.bat && python main.py"

:: Wait for API to warm up
echo  [90mWaiting for Neural Weights to stabilize...[0m
timeout /t 5 /nobreak >nul

:: --- STEP 5: LAUNCH INTELLIGENCE HUB (STREAMLIT) ---
echo.
echo  [94m[5/5][0m Booting Intelligence Hub...
echo.
echo  [92mSYSTEM READY.[0m
echo  [90mAPI Endpoint:    http://localhost:%BACKEND_PORT%[0m
echo  [90mIntelligence:    http://localhost:%FRONTEND_PORT%[0m
echo.
echo  [96m----------------------------------------------------------[0m
streamlit run app.py --server.port %FRONTEND_PORT% --browser.gatherUsageStats false

pause

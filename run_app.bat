@echo off
title Apex AI - Streamlit Terminal
echo ================================================
echo   APEX AI v4.0 - Aero Terminal
echo ================================================
echo [*] Using virtual environment...
echo [*] Starting Streamlit on http://localhost:8501
echo.
cd /d %~dp0
call venv\Scripts\activate.bat
venv\Scripts\streamlit.exe run app.py

@echo off
echo ========================================================
echo     Apex AI - Production Model Training Initialization
echo ========================================================
echo.
echo This script will train the Temporal Fusion Transformer (TFT).
echo Depending on your hardware (CPU vs GPU), this may take 10-60 minutes.
echo Using Target Ticker: AAPL (as index proxy)
echo.

if not exist "models" mkdir models

:: Activate virtual environment if it exists
if exist "venv\Scripts\activate" call venv\Scripts\activate

:: Run the training script on AAPL for 3 years to generate the baseline weights
echo [1/2] Training model on recent data...
python train_tft.py AAPL 3y

If %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Training failed. Please check logs.
    exit /b %ERRORLEVEL%
)

:: Find the best checkpoint dynamically and copy it to production destination
echo [2/2] Exporting finest checkpoint to production envelope...
for /f "delims=" %%i in ('dir /b /s checkpoints\tft\*.ckpt') do (
    copy "%%i" "models\tft_model.ckpt" /Y
    goto :Found
)

:Found
echo.
echo ========================================================
echo   Training Completed! 
echo   Production weights saved to: models\tft_model.ckpt
echo   The backend `/api/signal` will now serve real AI predictions.
echo ========================================================
pause

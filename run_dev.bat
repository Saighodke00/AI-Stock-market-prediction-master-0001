@echo off
echo [1/2] Starting Apex AI Backend...
start cmd /k "cd .. && venv\Scripts\activate && python main.py"
timeout /t 5

echo [2/2] Starting Apex AI Frontend...
cd frontend
npm run dev

@echo off
echo Starting FLASH Bridge Services...
echo.

echo Starting backend server...
start "FLASH Backend" cmd /k "cd backend && npm start"

timeout /t 3 /nobreak >nul

echo Starting frontend server...
start "FLASH Frontend" cmd /k "cd frontend && npm start"

echo.
echo Services started! Check the opened command windows for status.
echo Backend: http://localhost:3002
echo Frontend: http://localhost:3000
pause

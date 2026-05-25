@echo off
REM =============================================================
REM TRACE — Full Launch Script
REM Starts PostgreSQL, builds frontends, seeds DB, launches server.
REM =============================================================

echo.
echo  ████████╗██████╗  █████╗  ██████╗███████╗
echo  ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝
echo     ██║   ██████╔╝███████║██║     █████╗  
echo     ██║   ██╔══██╗██╔══██║██║     ██╔══╝  
echo     ██║   ██║  ██║██║  ██║╚██████╗███████╗
echo     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝
echo.
echo  Tracking, Reporting, Analysis ^& Community Evidence
echo  ===================================================
echo.

cd /d %~dp0

REM --- Step 1: Start PostgreSQL ---
echo [1/6] Starting PostgreSQL...
docker compose up -d postgres
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker failed. Is Docker Desktop running?
    pause
    exit /b 1
)

REM --- Step 2: Wait for PostgreSQL ---
echo [2/6] Waiting for database...
:waitloop
docker compose exec -T postgres pg_isready -U trace_admin -d trace >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    timeout /t 2 /nobreak >nul
    goto waitloop
)
echo        Database ready.

REM --- Step 3: Install dependencies ---
echo [3/6] Installing dependencies...
call npm install --include=dev >nul 2>&1
cd pwa && call npm install >nul 2>&1 && cd ..
cd operator && call npm install >nul 2>&1 && cd ..

REM --- Step 4: Build frontends ---
echo [4/6] Building reporter PWA...
cd pwa && call npx vite build >nul 2>&1 && cd ..
echo        Building operator dashboard...
cd operator && call npx vite build >nul 2>&1 && cd ..

REM --- Step 5: Seed database ---
echo [5/6] Seeding database...
call npx tsx src/db/seed.ts 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo        Seed skipped (may already exist)
)

REM --- Step 6: Launch server ---
echo [6/6] Starting TRACE server...
echo.
echo  ===================================================
echo  TRACE is running:
echo.
echo    Reporter PWA:     http://localhost:3100
echo    Operator Dashboard: http://localhost:3100/operator
echo    API:              http://localhost:3100/api/v1
echo    WebSocket:        ws://localhost:3100/ws
echo    Health:           http://localhost:3100/health
echo.
echo  Press Ctrl+C to stop.
echo  ===================================================
echo.

call npx tsx src/index.ts

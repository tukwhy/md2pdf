@echo off
chcp 65001 >nul
cls
echo =======================================================
echo          Markdown to PDF One-Click Converter
echo =======================================================
echo.

cd /d "%~dp0"

python --version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python and add it to PATH.
    echo.
    pause
    exit /b 1
)

python md2pdf.py %*

if errorlevel 1 (
    echo.
    echo [ERROR] Conversion failed. Please check messages above.
    pause
    exit /b 1
) else (
    echo.
    echo [SUCCESS] Done!
    ping 127.0.0.1 -n 3 >nul
    exit /b 0
)
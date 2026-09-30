@echo off
REM Micronauta en vivo para el Tablero Solbus (dejar esta ventana abierta)
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Se creo el archivo .env: completa las contrasenas y volve a ejecutar.
  notepad .env
  exit /b
)
python -m pip install -q -r requirements.txt
python micronauta_live.py %*
pause

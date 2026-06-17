# Dev launcher — starts the FastAPI backend and the Next.js frontend together.
# Usage (from "UI App/" with renv activated):  ./dev.ps1
#
# First time only:
#   python -m venv backend/renv ; backend/renv/Scripts/pip install -r backend/requirements.txt
#   cd frontend ; npm install ; cd ..
#   Copy-Item .env.example .env

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Ensure .env exists
if (-not (Test-Path "$root/.env")) {
    Copy-Item "$root/.env.example" "$root/.env"
    Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

# Resolve python (prefer venv)
$venvPy = "$root/backend/renv/Scripts/python.exe"
$python = if (Test-Path $venvPy) { $venvPy } else { "python" }

Write-Host "Starting backend (FastAPI) on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$backend = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" `
    -WorkingDirectory "$root/backend" -PassThru -NoNewWindow

Write-Host "Starting frontend (Next.js) on http://localhost:3000 ..." -ForegroundColor Cyan
# npm is npm.cmd on Windows (not a Win32 .exe), so launch it via cmd.exe.
$frontend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory "$root/frontend" -PassThru -NoNewWindow

Write-Host "`nBoth servers starting. Press Ctrl+C to stop." -ForegroundColor Green

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
    if (-not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force }
}

# Launch both the local Python FastAPI backend (port 8000) and the Vite frontend dev server (port 5173)
$ErrorActionPreference = "Stop"

Write-Host "Starting CodeSeek AI FastAPI backend on http://localhost:8000 ..." -ForegroundColor Cyan
$backendJob = Start-Process -FilePath "uvicorn" -ArgumentList "app.main:app", "--app-dir", "backend", "--port", "8000" -PassThru -NoNewWindow

try {
    Write-Host "Starting CodeSeek AI Frontend on http://localhost:5173 ..." -ForegroundColor Cyan
    npm --prefix frontend run dev -- --port 5173
}
finally {
    if ($backendJob -and !$backendJob.HasExited) {
        Write-Host "Stopping FastAPI backend..." -ForegroundColor Yellow
        Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    }
}

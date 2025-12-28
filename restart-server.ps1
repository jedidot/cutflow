# CutFlow Server Restart Script
# UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Stopping server processes..." -ForegroundColor Yellow

# Kill process on port 3001 (server)
$port3001 = netstat -ano | findstr ":3001" | Select-String "LISTENING"
if ($port3001) {
    $pid = ($port3001 -split '\s+')[-1]
    if ($pid) {
        Write-Host "Killing process on port 3001: PID $pid" -ForegroundColor Yellow
        taskkill /PID $pid /F 2>$null
        Start-Sleep -Seconds 1
    }
}

# Kill process on port 5173 (Vite)
$port5173 = netstat -ano | findstr ":5173" | Select-String "LISTENING"
if ($port5173) {
    $pid = ($port5173 -split '\s+')[-1]
    if ($pid) {
        Write-Host "Killing process on port 5173: PID $pid" -ForegroundColor Yellow
        taskkill /PID $pid /F 2>$null
        Start-Sleep -Seconds 1
    }
}

Write-Host "`nStarting server..." -ForegroundColor Green
Write-Host "FFmpeg path: C:\ffmpeg\bin\ffmpeg.exe" -ForegroundColor Cyan

$env:FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"

# Check FFmpeg
if (Test-Path $env:FFMPEG_PATH) {
    Write-Host "FFmpeg verified!" -ForegroundColor Green
} else {
    Write-Host "Warning: FFmpeg not found: $env:FFMPEG_PATH" -ForegroundColor Yellow
}

Write-Host "`nTo start server, run:" -ForegroundColor Cyan
Write-Host "  npm run dev:server:ffmpeg" -ForegroundColor White
Write-Host "`nTo start frontend, run in another terminal:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White


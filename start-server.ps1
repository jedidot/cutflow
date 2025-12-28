# CutFlow 서버 시작 스크립트 (FFmpeg 경로 포함)

# FFmpeg 경로 설정
$env:FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"

Write-Host "FFmpeg 경로 설정: $env:FFMPEG_PATH" -ForegroundColor Green

# FFmpeg 확인
if (Test-Path $env:FFMPEG_PATH) {
    Write-Host "FFmpeg 확인 완료!" -ForegroundColor Green
    & $env:FFMPEG_PATH -version | Select-Object -First 1
} else {
    Write-Host "경고: FFmpeg를 찾을 수 없습니다: $env:FFMPEG_PATH" -ForegroundColor Yellow
}

Write-Host "`n서버 시작 중..." -ForegroundColor Cyan
npm run dev:server


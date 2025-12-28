# FFmpeg 설치 가이드

> **참고**: 현재 CutFlow는 클라이언트 측 FFmpeg.wasm을 사용하므로, 서버에 FFmpeg를 설치할 필요가 없습니다.  
> 서버 측 비디오 처리가 필요한 경우에만 아래 가이드를 참고하세요.

## 서버 측 FFmpeg 설치 (선택사항)

서버에서 비디오 처리를 수행하려면 FFmpeg가 필요합니다.

### Windows

#### Chocolatey 사용 (권장)
```powershell
choco install ffmpeg
```

#### 수동 설치
1. https://www.gyan.dev/ffmpeg/builds/ 에서 다운로드
2. 압축 해제 후 PATH 환경 변수에 `bin` 폴더 추가

### macOS
```bash
brew install ffmpeg
```

### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

## 설치 확인

```bash
ffmpeg -version
```

## 환경 변수 설정 (선택사항)

FFmpeg를 PATH에 추가하지 않은 경우:
```bash
# Windows PowerShell
$env:FFMPEG_PATH="C:\ffmpeg\bin\ffmpeg.exe"

# Linux/macOS
export FFMPEG_PATH="/usr/local/bin/ffmpeg"
```

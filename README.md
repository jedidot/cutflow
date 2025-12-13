# CutFlow - 비디오 에디터

캔바 같은 비디오 편집 애플리케이션입니다.

## 기능

- 🎬 비디오, 오디오, 이미지 파일 업로드
- 📝 타임라인 기반 편집
- ✏️ 텍스트 오버레이 추가
- 🎨 다양한 효과 적용
- 📤 비디오 내보내기

## 설치 및 실행

### 필수 요구사항

- Node.js 18 이상
- FFmpeg (비디오 편집용)

#### FFmpeg 설치

**Windows:**
```bash
# Chocolatey 사용
choco install ffmpeg

# 또는 직접 다운로드
# https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 의존성 설치

```bash
npm install
```

### 개발 서버 실행

두 개의 터미널에서 각각 실행:

**터미널 1 - 프론트엔드:**
```bash
npm run dev
```

**터미널 2 - 백엔드:**
```bash
npm run dev:server
```

또는 한 번에 실행 (concurrently 필요):
```bash
npm run dev:all
```

### 빌드

```bash
npm run build
```

## 사용 방법

1. 로그인 페이지에서 데모 계정으로 로그인
2. 미디어 라이브러리에서 파일 업로드
3. 업로드된 파일을 타임라인에 추가
4. 타임라인에서 클립 편집 (드래그, 리사이즈)
5. 텍스트 오버레이 추가
6. 내보내기 버튼으로 최종 비디오 생성

## API 엔드포인트

- `POST /api/upload` - 단일 파일 업로드
- `POST /api/upload/multiple` - 다중 파일 업로드
- `GET /api/files` - 업로드된 파일 목록
- `POST /api/export` - 비디오 내보내기

## 기술 스택

- **프론트엔드:** React, Vite, Tailwind CSS
- **백엔드:** Express.js, Multer
- **비디오 처리:** FFmpeg

## 라이선스

MIT

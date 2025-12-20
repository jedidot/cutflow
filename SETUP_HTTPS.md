# HTTPS 설정 가이드 (Mixed Content 오류 해결)

## 문제
- **에러**: `blocked:mixed-content`
- **원인**: HTTPS 사이트에서 HTTP 리소스 로드 시 브라우저 차단

## 해결 방법: 서버에 HTTPS 설정

### 1단계: mkcert 설치 (로컬 인증서 생성 도구)

#### Windows에서 설치:
```powershell
# Chocolatey 사용 (관리자 권한 필요)
choco install mkcert

# 또는 직접 다운로드
# https://github.com/FiloSottile/mkcert/releases
# mkcert-v1.4.4-windows-amd64.exe 다운로드 후
# mkcert.exe로 이름 변경하고 PATH에 추가
```

#### 설치 확인:
```cmd
mkcert --version
```

### 2단계: 로컬 CA 설치

```cmd
mkcert -install
```

이 명령어는 로컬 인증 기관(CA)을 설치하여 브라우저가 인증서를 신뢰하도록 합니다.

### 3단계: 인증서 생성

프로젝트 디렉토리에서:
```cmd
cd C:\IIWeb\CutFlow
mkcert 106.254.252.42 localhost 127.0.0.1
```

이 명령어는 다음 파일을 생성합니다:
- `106.254.252.42+2.pem` (인증서)
- `106.254.252.42+2-key.pem` (개인 키)

### 4단계: 서버 코드 확인

`server.js` 파일이 이미 HTTPS를 지원하도록 수정되어 있습니다:
- 인증서 파일이 있으면 HTTPS 서버 시작 (포트 3443)
- 없으면 HTTP 서버만 시작 (포트 3001)

### 5단계: 서버 재시작

```cmd
# 서버 중지 (Ctrl+C)
# 서버 재시작
node server.js
```

콘솔에 다음 메시지가 보여야 합니다:
```
🚀 HTTPS 서버가 https://0.0.0.0:3443 에서 실행 중입니다.
🚀 HTTP 서버가 http://0.0.0.0:3001 에서 실행 중입니다.
```

### 6단계: Vercel 환경 변수 변경

1. Vercel 대시보드 → Settings → Environment Variables
2. `VITE_API_BASE_URL` 값 변경:
   - 기존: `http://106.254.252.42:3001`
   - 변경: `https://106.254.252.42:3443`
3. Save
4. 재배포 (Git 푸시 또는 수동 재배포)

### 7단계: 방화벽 포트 열기

HTTPS 포트 3443도 열어야 합니다:

1. Windows 방화벽 고급 설정
2. 인바운드 규칙 → 새 규칙
3. 포트 선택 → TCP → 특정 로컬 포트: `3443`
4. 연결 허용 선택
5. 모든 프로필 적용
6. 이름: "CutFlow API HTTPS Port 3443"

### 8단계: 테스트

1. 브라우저에서 직접 접속:
```
https://106.254.252.42:3443/api/health
```

2. https://cutflow.vercel.app/ 접속
3. 파일 업로드 테스트
4. "서버 연결 실패" 메시지가 사라져야 합니다

## 대안 방법 (임시)

mkcert 설치가 어렵다면:

### 방법 A: Vercel Serverless Functions 사용

`api/proxy.js` 파일 생성:
```javascript
export default async function handler(req, res) {
  const response = await fetch(`http://106.254.252.42:3001${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  });
  const data = await response.json();
  res.json(data);
}
```

하지만 이 방법은 파일 업로드가 복잡할 수 있습니다.

### 방법 B: Cloudflare Tunnel 사용

1. Cloudflare 계정 생성
2. Cloudflare Tunnel 설정
3. HTTPS 터널 생성

## 체크리스트

- [ ] mkcert 설치 완료
- [ ] 로컬 CA 설치 완료 (`mkcert -install`)
- [ ] 인증서 파일 생성 완료 (`106.254.252.42+2.pem`, `106.254.252.42+2-key.pem`)
- [ ] 서버 재시작 완료
- [ ] HTTPS 서버가 포트 3443에서 실행 중
- [ ] 방화벽 포트 3443 열림
- [ ] Vercel 환경 변수 `https://106.254.252.42:3443`로 변경
- [ ] Vercel 재배포 완료
- [ ] 파일 업로드 테스트 성공

## 문제 해결

### 인증서가 생성되지 않는 경우
- mkcert가 제대로 설치되었는지 확인
- 관리자 권한으로 실행했는지 확인

### HTTPS 서버가 시작되지 않는 경우
- 인증서 파일이 프로젝트 루트에 있는지 확인
- 파일 이름이 정확한지 확인 (`106.254.252.42+2.pem`, `106.254.252.42+2-key.pem`)

### 여전히 Mixed Content 오류가 발생하는 경우
- Vercel 환경 변수가 `https://`로 시작하는지 확인
- 브라우저 캐시 클리어
- 시크릿 모드에서 테스트


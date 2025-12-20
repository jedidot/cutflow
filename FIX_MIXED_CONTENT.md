# Mixed Content 오류 해결

## 문제
- **에러**: `blocked:mixed-content`
- **원인**: HTTPS 사이트에서 HTTP 리소스를 로드하려고 할 때 브라우저가 차단

## 해결 방법

### 방법 1: 서버에 HTTPS 설정 (권장, 영구적 해결)

#### A. Nginx 리버스 프록시 + Let's Encrypt SSL

1. **Nginx 설치** (서버에)
```bash
# Windows의 경우 Chocolatey 사용
choco install nginx

# 또는 직접 다운로드
```

2. **Nginx 설정 파일 생성**
`C:\nginx\conf\nginx.conf` 또는 `/etc/nginx/sites-available/cutflow-api`:

```nginx
server {
    listen 80;
    server_name 106.254.252.42;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **Let's Encrypt SSL 인증서** (Windows에서는 복잡할 수 있음)

#### B. 간단한 해결: 서버에서 HTTPS 직접 설정

`server.js`에 HTTPS 지원 추가 (인증서 필요):

```javascript
import https from 'https';
import fs from 'fs';

// HTTPS 옵션 (인증서 파일 필요)
const httpsOptions = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem')
};

// HTTPS 서버 시작
https.createServer(httpsOptions, app).listen(3443, HOST, () => {
  console.log(`🚀 HTTPS 서버가 https://${HOST}:3443 에서 실행 중입니다.`);
});
```

### 방법 2: Vercel에서 프록시 사용 (임시 해결)

Vercel의 `vercel.json` 파일 생성:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://106.254.252.42:3001/api/:path*"
    }
  ]
}
```

그리고 `src/App.jsx`에서:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
// Vercel에서 프록시 사용 시
const API_BASE_URL = window.location.origin;
```

하지만 이 방법은 Vercel의 서버리스 함수를 사용해야 할 수 있습니다.

### 방법 3: 임시 해결 - 브라우저에서 Mixed Content 허용 (개발용)

**주의**: 보안상 권장하지 않지만, 빠른 테스트용으로 사용 가능

Chrome에서:
1. 주소창에 `chrome://flags/#block-insecure-private-network-requests` 입력
2. "Block insecure private network requests" 비활성화
3. 브라우저 재시작

또는 Chrome 실행 시:
```bash
chrome.exe --disable-web-security --user-data-dir="C:/temp/chrome_dev"
```

### 방법 4: 가장 간단한 해결 - 서버에 HTTPS 설정 (권장)

#### mkcert 사용 (로컬 개발용, 빠른 설정)

1. **mkcert 설치**
```bash
# Chocolatey 사용
choco install mkcert

# 또는 직접 다운로드
```

2. **로컬 CA 생성**
```bash
mkcert -install
```

3. **인증서 생성**
```bash
cd C:\IIWeb\CutFlow
mkcert 106.254.252.42 localhost 127.0.0.1
```

4. **server.js 수정**
```javascript
import https from 'https';
import fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync('./106.254.252.42+2-key.pem'),
  cert: fs.readFileSync('./106.254.252.42+2.pem')
};

https.createServer(httpsOptions, app).listen(3443, HOST, () => {
  console.log(`🚀 HTTPS 서버가 https://${HOST}:3443 에서 실행 중입니다.`);
});
```

5. **Vercel 환경 변수 변경**
- `VITE_API_BASE_URL` → `https://106.254.252.42:3443`

## 추천 해결 방법

**가장 빠른 방법**: 방법 4 (mkcert 사용)
- 빠르게 HTTPS 설정 가능
- 브라우저에서 신뢰할 수 있는 인증서 생성
- 프로덕션에도 사용 가능 (인증서 배포 필요)

**가장 안정적인 방법**: 방법 1 (Nginx + Let's Encrypt)
- 프로덕션 환경에 적합
- 무료 SSL 인증서
- 자동 갱신 가능

## 다음 단계

어떤 방법을 사용하시겠어요?
1. mkcert로 빠르게 HTTPS 설정 (추천)
2. Nginx + Let's Encrypt 설정
3. 임시로 브라우저 설정 변경 (테스트용)


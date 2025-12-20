# 외부 URL에서 업로드 가능한 테스트 환경 구축 가이드

## 개요
106.254.252.42 서버에 업로드 API를 배포하고, https://cutflow.vercel.app/ 에서 접근 가능하도록 설정하는 방법입니다.

## 필요한 사항

### 1. 서버 설정 (106.254.252.42)

#### 1.1 서버 파일 업로드
- `server.js` 파일을 서버에 업로드
- `package.json` 파일 확인 및 의존성 설치

#### 1.2 의존성 설치
```bash
npm install
# 또는
pnpm install
```

#### 1.3 환경 변수 설정 (선택사항)
`.env` 파일 생성:
```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
```

#### 1.4 서버 실행
```bash
# 개발 환경
node server.js

# 프로덕션 환경 (PM2 사용 권장)
pm2 start server.js --name cutflow-api
pm2 save
pm2 startup
```

### 2. 방화벽 설정

#### 2.1 포트 열기 (3001)
```bash
# Ubuntu/Debian
sudo ufw allow 3001/tcp
sudo ufw reload

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

#### 2.2 서버 방화벽 확인
- AWS/Azure/GCP 등 클라우드 서비스 사용 시 보안 그룹에서 포트 3001 허용 필요

### 3. 프론트엔드 설정 (Vercel)

#### 3.1 환경 변수 설정
Vercel 대시보드에서 환경 변수 추가:
- `VITE_API_BASE_URL=http://106.254.252.42:3001`
- 또는 프로덕션용: `VITE_API_BASE_URL=https://106.254.252.42:3001` (HTTPS 설정 시)

#### 3.2 App.jsx 수정
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

### 4. CORS 설정 확인

`server.js`의 `allowedOrigins` 배열에 다음이 포함되어 있는지 확인:
- `https://cutflow.vercel.app`
- 개발 환경용 localhost 주소들

### 5. HTTPS 설정 (선택사항, 권장)

#### 5.1 Nginx 리버스 프록시 설정
```nginx
server {
    listen 443 ssl;
    server_name 106.254.252.42;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

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

#### 5.2 Let's Encrypt SSL 인증서 (무료)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 106.254.252.42
```

### 6. 테스트

#### 6.1 서버 헬스 체크
```bash
curl http://106.254.252.42:3001/api/health
```

#### 6.2 CORS 테스트
브라우저 콘솔에서:
```javascript
fetch('http://106.254.252.42:3001/api/health')
  .then(r => r.json())
  .then(console.log)
```

### 7. 문제 해결

#### 7.1 CORS 오류
- `server.js`의 `allowedOrigins`에 프론트엔드 URL이 포함되어 있는지 확인
- 브라우저 콘솔에서 정확한 오류 메시지 확인

#### 7.2 연결 실패
- 방화벽 포트가 열려있는지 확인
- 서버가 실행 중인지 확인: `ps aux | grep node`
- 네트워크 연결 확인: `telnet 106.254.252.42 3001`

#### 7.3 파일 업로드 실패
- `uploads` 폴더 권한 확인: `chmod 755 uploads`
- 디스크 공간 확인: `df -h`
- 파일 크기 제한 확인 (현재 500MB)

## 보안 고려사항

1. **인증 추가** (선택사항)
   - JWT 토큰 기반 인증
   - API 키 인증

2. **Rate Limiting**
   - `express-rate-limit` 패키지 사용

3. **HTTPS 사용 권장**
   - 민감한 데이터 전송 시 필수

4. **파일 검증 강화**
   - 바이러스 스캔
   - 파일 타입 검증 강화

## 모니터링

### PM2 모니터링
```bash
pm2 monit
pm2 logs cutflow-api
```

### 로그 확인
서버 로그는 콘솔에 출력되며, PM2를 사용하면 파일로 저장 가능합니다.


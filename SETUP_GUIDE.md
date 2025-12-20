# 외부 URL에서 파일 업로드 가능하도록 설정 가이드

## 현재 상황
- ✅ 로컬: 파일 업로드 작동 중 (localhost:3001)
- ❌ 외부 URL (https://cutflow.vercel.app/): 파일 업로드 작동 안 함
- 🎯 목표: 외부 URL에서도 파일 업로드 가능하도록 설정

## 해결 방법: 고정 IP 서버 (106.254.252.42) 활용

### 1단계: 서버 (106.254.252.42)에 파일 배포

#### 1.1 서버 접속 및 파일 업로드
```bash
# 서버에 접속
ssh user@106.254.252.42

# 프로젝트 디렉토리 생성
mkdir -p /var/www/cutflow-api
cd /var/www/cutflow-api

# 파일 업로드 (로컬에서)
# 방법 1: scp 사용
scp server.js user@106.254.252.42:/var/www/cutflow-api/
scp package.json user@106.254.252.42:/var/www/cutflow-api/

# 방법 2: git 사용 (권장)
git init
git remote add origin <your-repo-url>
git pull origin main
```

#### 1.2 의존성 설치
```bash
cd /var/www/cutflow-api
npm install
# 또는
pnpm install
```

#### 1.3 업로드 폴더 생성 및 권한 설정
```bash
mkdir -p uploads output
chmod 755 uploads output
chown -R $USER:$USER uploads output
```

#### 1.4 FFmpeg 설치 확인 (비디오/오디오 처리용)
```bash
# FFmpeg 설치 확인
ffmpeg -version
ffprobe -version

# 설치되어 있지 않다면
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

### 2단계: 서버 실행 및 관리

#### 2.1 PM2 설치 (프로세스 관리)
```bash
npm install -g pm2
```

#### 2.2 서버 실행
```bash
cd /var/www/cutflow-api
pm2 start server.js --name cutflow-api
pm2 save
pm2 startup  # 시스템 재시작 시 자동 시작 설정
```

#### 2.3 서버 상태 확인
```bash
pm2 status
pm2 logs cutflow-api
```

### 3단계: 방화벽 및 네트워크 설정

#### 3.1 포트 3001 열기
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3001/tcp
sudo ufw reload
sudo ufw status

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

#### 3.2 서버 방화벽 확인
- AWS: 보안 그룹에서 인바운드 규칙에 포트 3001 추가
- Azure: 네트워크 보안 그룹에서 인바운드 규칙 추가
- GCP: 방화벽 규칙에서 포트 3001 허용

#### 3.3 서버 접근 테스트
```bash
# 서버에서 테스트
curl http://localhost:3001/api/health

# 외부에서 테스트 (로컬 컴퓨터에서)
curl http://106.254.252.42:3001/api/health
```

### 4단계: 프론트엔드 설정 (Vercel)

#### 4.1 Vercel 환경 변수 설정
1. Vercel 대시보드 접속: https://vercel.com/dashboard
2. 프로젝트 선택: cutflow
3. Settings → Environment Variables
4. 다음 환경 변수 추가:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `http://106.254.252.42:3001`
   - **Environment**: Production, Preview, Development 모두 선택

#### 4.2 코드 확인
`src/App.jsx` 파일에 다음 코드가 있는지 확인:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

#### 4.3 재배포
```bash
# 로컬에서
git add .
git commit -m "Add API base URL environment variable"
git push

# Vercel이 자동으로 재배포합니다
```

### 5단계: CORS 설정 확인

#### 5.1 server.js 확인
`server.js`의 `allowedOrigins` 배열에 다음이 포함되어 있는지 확인:
```javascript
const allowedOrigins = [
  'https://cutflow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174'
];
```

#### 5.2 서버 재시작
```bash
pm2 restart cutflow-api
```

### 6단계: 테스트

#### 6.1 헬스 체크
브라우저에서 접속:
```
http://106.254.252.42:3001/api/health
```
응답: `{"status":"ok","timestamp":"..."}`

#### 6.2 CORS 테스트
브라우저 콘솔에서 (https://cutflow.vercel.app/ 에서):
```javascript
fetch('http://106.254.252.42:3001/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

#### 6.3 파일 업로드 테스트
1. https://cutflow.vercel.app/ 접속
2. 파일 업로드 버튼 클릭
3. 파일 선택 및 업로드
4. 브라우저 개발자 도구 → Network 탭에서 요청 확인

### 7단계: 문제 해결

#### 문제 1: CORS 오류
**증상**: 브라우저 콘솔에 "CORS policy" 오류
**해결**:
1. `server.js`의 `allowedOrigins`에 정확한 URL 확인
2. 서버 재시작: `pm2 restart cutflow-api`
3. 브라우저 캐시 클리어

#### 문제 2: 연결 실패
**증상**: "Failed to fetch" 또는 "Network error"
**해결**:
1. 방화벽 포트 확인: `sudo ufw status` 또는 `sudo firewall-cmd --list-ports`
2. 서버 실행 확인: `pm2 status`
3. 서버 로그 확인: `pm2 logs cutflow-api`
4. 네트워크 연결 확인: `telnet 106.254.252.42 3001`

#### 문제 3: 파일 업로드 실패
**증상**: 업로드 중 오류 발생
**해결**:
1. 업로드 폴더 권한 확인: `ls -la uploads/`
2. 디스크 공간 확인: `df -h`
3. 파일 크기 제한 확인 (현재 500MB)
4. 서버 로그 확인: `pm2 logs cutflow-api`

#### 문제 4: 환경 변수 적용 안 됨
**증상**: 여전히 localhost로 요청
**해결**:
1. Vercel 환경 변수 재확인
2. 빌드 캐시 클리어 후 재배포
3. 브라우저에서 `console.log(import.meta.env.VITE_API_BASE_URL)` 확인

## 대안 방법들

### 방법 1: HTTPS 설정 (권장)
현재는 HTTP로 설정되어 있지만, HTTPS를 사용하는 것이 더 안전합니다.

#### Nginx 리버스 프록시 설정
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
    }
}
```

#### Let's Encrypt SSL 인증서
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 106.254.252.42
```

그 후 Vercel 환경 변수를 `https://106.254.252.42`로 변경

### 방법 2: 클라우드 스토리지 사용 (선택사항)
- AWS S3
- Cloudinary
- Google Cloud Storage

하지만 현재 고정 IP 서버를 사용 중이므로, 서버에 직접 저장하는 것이 더 간단합니다.

## 최종 체크리스트

- [ ] 서버에 파일 배포 완료
- [ ] 의존성 설치 완료
- [ ] 업로드 폴더 생성 및 권한 설정 완료
- [ ] FFmpeg 설치 확인 완료
- [ ] PM2로 서버 실행 중
- [ ] 방화벽 포트 3001 열림
- [ ] 서버 접근 테스트 성공
- [ ] Vercel 환경 변수 설정 완료
- [ ] 프론트엔드 재배포 완료
- [ ] CORS 설정 확인 완료
- [ ] 파일 업로드 테스트 성공

## 다음 단계

모든 설정이 완료되면:
1. 정기적인 백업 설정 (업로드된 파일)
2. 로그 모니터링 설정
3. 성능 최적화 (필요시)
4. 보안 강화 (인증 추가 등)


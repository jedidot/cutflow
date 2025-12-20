# 파일 업로드 기능 활성화 - 빠른 시작 가이드

## 현재 상태
✅ 서버 파일 배포 완료
✅ http://106.254.252.42:3001/ 접속 확인

## 다음 단계

### 1단계: 서버 실행 확인 및 시작

#### 서버가 실행 중인지 확인
```bash
# PM2 사용 시
pm2 list
pm2 status

# 또는 프로세스 확인
ps aux | grep node
```

#### 서버가 실행되지 않았다면 시작
```bash
cd /var/www/cutflow-api  # 또는 배포한 경로
node server.js

# 또는 PM2로 실행 (권장)
pm2 start server.js --name cutflow-api
pm2 save
pm2 startup  # 시스템 재시작 시 자동 시작
```

### 2단계: 서버 헬스 체크

브라우저에서 다음 URL 접속:
```
http://106.254.252.42:3001/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

✅ 이 응답이 보이면 서버가 정상 작동 중입니다.

### 3단계: 방화벽 포트 확인

#### Windows 서버인 경우
1. Windows 방화벽 설정 열기
2. 인바운드 규칙 → 새 규칙
3. 포트 선택 → TCP → 특정 로컬 포트: 3001
4. 연결 허용 선택
5. 모든 프로필 적용
6. 이름: "CutFlow API Port 3001"

#### Linux 서버인 경우
```bash
# Ubuntu/Debian
sudo ufw allow 3001/tcp
sudo ufw reload
sudo ufw status

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

### 4단계: Vercel 환경 변수 설정

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard

2. **프로젝트 선택**
   - cutflow 프로젝트 클릭

3. **Settings → Environment Variables 이동**

4. **환경 변수 추가**
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `http://106.254.252.42:3001`
   - **Environment**: 
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
   - **Save** 클릭

5. **재배포**
   - Deployments 탭으로 이동
   - 최신 배포의 "..." 메뉴 → "Redeploy" 클릭
   - 또는 코드 푸시 시 자동 재배포

### 5단계: 프론트엔드 코드 확인

`src/App.jsx` 파일에 다음 코드가 있는지 확인:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

이미 설정되어 있어야 합니다.

### 6단계: 최종 테스트

#### 6.1 서버 API 테스트
브라우저에서:
```
http://106.254.252.42:3001/api/files
```

**예상 응답:**
```json
{
  "files": []
}
```

#### 6.2 CORS 테스트
브라우저 콘솔에서 (https://cutflow.vercel.app/ 에서):
```javascript
fetch('http://106.254.252.42:3001/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**예상 응답:** `{status: "ok", timestamp: "..."}`

#### 6.3 파일 업로드 테스트
1. https://cutflow.vercel.app/ 접속
2. 브라우저 개발자 도구 열기 (F12)
3. Network 탭 열기
4. 파일 업로드 버튼 클릭
5. 파일 선택
6. Network 탭에서 요청 확인:
   - URL: `http://106.254.252.42:3001/api/upload/multiple`
   - Status: 200 OK
   - Response: 파일 정보 JSON

## 문제 해결

### 문제 1: 서버가 응답하지 않음
```bash
# 서버 로그 확인
pm2 logs cutflow-api

# 또는 직접 실행 시 콘솔 확인
# 서버 재시작
pm2 restart cutflow-api
```

### 문제 2: CORS 오류
브라우저 콘솔에 "CORS policy" 오류가 보이면:

1. `server.js` 파일 확인:
```javascript
const allowedOrigins = [
  'https://cutflow.vercel.app',  // 이게 있어야 함
  // ...
];
```

2. 서버 재시작:
```bash
pm2 restart cutflow-api
```

### 문제 3: 연결 실패 (Failed to fetch)
1. 방화벽 확인
2. 서버 실행 확인: `pm2 status`
3. 포트 확인: `netstat -an | grep 3001`

### 문제 4: 환경 변수가 적용 안 됨
1. Vercel 환경 변수 재확인
2. 빌드 캐시 클리어 후 재배포
3. 브라우저에서 확인:
```javascript
console.log(import.meta.env.VITE_API_BASE_URL)
// 예상: "http://106.254.252.42:3001"
```

## 체크리스트

- [ ] 서버 실행 중 (pm2 status 또는 ps 확인)
- [ ] http://106.254.252.42:3001/api/health 응답 확인
- [ ] 방화벽 포트 3001 열림
- [ ] Vercel 환경 변수 설정 완료
- [ ] Vercel 재배포 완료
- [ ] CORS 테스트 성공
- [ ] 파일 업로드 테스트 성공

## 다음 단계 (선택사항)

### HTTPS 설정 (권장)
현재는 HTTP로 작동하지만, HTTPS를 설정하면 더 안전합니다.

### 모니터링 설정
```bash
# PM2 모니터링
pm2 monit

# 로그 확인
pm2 logs cutflow-api --lines 100
```

### 백업 설정
업로드된 파일을 정기적으로 백업하는 것을 권장합니다.


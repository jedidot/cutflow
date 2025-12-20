# 서버 연결 실패 해결 (서버는 정상 작동 중)

## ✅ 확인 완료
- 서버 실행 중 (LISTENING)
- 헬스 체크 성공: `{"status":"ok","timestamp":"..."}`

## 문제 원인
서버는 정상이지만 프론트엔드가 연결하지 못하는 경우:
1. 환경 변수가 아직 적용되지 않음 (Vercel 재배포 필요)
2. 브라우저 캐시 문제
3. CORS 문제

## 해결 방법

### 1단계: Network 탭에서 실제 요청 확인

1. https://cutflow.vercel.app/ 접속
2. **F12** (개발자 도구) 열기
3. **Network** 탭 선택
4. 페이지 새로고침 (F5)
5. Network 탭에서 요청 확인:
   - `/api/files` 요청 찾기
   - **Request URL** 확인:
     - ✅ `http://106.254.252.42:3001/api/files` → 환경 변수 적용됨
     - ❌ `http://localhost:3001/api/files` → 환경 변수 미적용

### 2단계: 환경 변수 미적용인 경우

#### A. Vercel 재배포 확인
1. Vercel 대시보드 → **Deployments** 탭
2. 최신 배포 상태 확인
3. "Building" 또는 "Deploying" 중이면 완료 대기
4. 완료 후 다시 테스트

#### B. 빈 커밋으로 재배포 트리거
```bash
cd c:\IIWeb\CutFlow
git commit --allow-empty -m "Trigger redeploy for API URL"
git push
```

### 3단계: 브라우저 캐시 클리어

1. **하드 리프레시:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **또는 시크릿 모드에서 테스트:**
   - `Ctrl + Shift + N` (Chrome)
   - `Ctrl + Shift + P` (Firefox)
   - https://cutflow.vercel.app/ 접속

### 4단계: CORS 확인

Network 탭에서 `/api/files` 요청을 클릭하고:
- **Response Headers** 확인
- `Access-Control-Allow-Origin` 헤더가 있는지 확인
- 값이 `https://cutflow.vercel.app` 또는 `*`인지 확인

CORS 오류가 있다면:
1. `server.js`의 `allowedOrigins` 확인
2. 서버 재시작:
```cmd
# 서버 콘솔에서 Ctrl+C로 중지 후
node server.js
```

### 5단계: 임시 확인용 코드 추가

환경 변수가 제대로 적용되는지 확인하기 위해:

`src/App.jsx` 파일 수정:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 임시: 확인용 (배포 후 제거)
console.log('🔍 API_BASE_URL:', API_BASE_URL);
```

그리고 Git에 푸시:
```bash
git add src/App.jsx
git commit -m "Add API_BASE_URL log for debugging"
git push
```

배포 완료 후 브라우저 콘솔에서 `API_BASE_URL` 값 확인

## 빠른 확인 방법

**Network 탭에서 확인:**
1. F12 → Network 탭
2. 페이지 새로고침
3. `/api/files` 요청 찾기
4. Request URL 확인

**예상 결과:**
- ✅ `http://106.254.252.42:3001/api/files` → 정상
- ❌ `http://localhost:3001/api/files` → 환경 변수 미적용

## 다음 단계

Network 탭에서 실제 요청 URL을 확인하고 알려주세요:
- 어떤 URL로 요청이 가는지?
- 에러 메시지가 있다면 무엇인지?

이 정보를 알려주시면 정확한 해결 방법을 제시하겠습니다!


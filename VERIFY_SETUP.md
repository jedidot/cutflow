# 환경 변수 설정 확인 및 검증 가이드

## ✅ 환경 변수 설정 확인

현재 설정:
- **Name**: `VITE_API_BASE_URL` ✅
- **Value**: `http://106.254.252.42:3001` ✅
- **Environment**: All Environments ✅

## 검증 단계

### 1. Vercel 재배포 확인
1. Vercel 대시보드 → Deployments 탭
2. 최신 배포 확인
3. "..." 메뉴 → "Redeploy" 클릭
4. 배포 완료 대기

### 2. 브라우저에서 확인
1. https://cutflow.vercel.app/ 접속
2. F12 (개발자 도구) 열기
3. Console 탭에서 실행:
```javascript
console.log(import.meta.env.VITE_API_BASE_URL)
```
**예상 결과**: `"http://106.254.252.42:3001"`

### 3. Network 요청 확인
1. 개발자 도구 → Network 탭 열기
2. 파일 업로드 버튼 클릭
3. 파일 선택
4. Network 탭에서 요청 확인:
   - **Request URL**: `http://106.254.252.42:3001/api/upload/multiple`
   - **Status**: 200 OK

### 4. 서버 응답 확인
브라우저에서 직접 접속:
```
http://106.254.252.42:3001/api/health
```
**예상 응답**:
```json
{"status":"ok","timestamp":"2024-..."}
```

## 문제 해결

### 환경 변수가 적용되지 않는 경우
1. **빌드 로그 확인**
   - Vercel → Deployments → 최신 배포 → Build Logs
   - 환경 변수가 주입되었는지 확인

2. **캐시 클리어**
   - 브라우저 하드 리프레시: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
   - 또는 시크릿 모드에서 테스트

3. **환경 변수 재설정**
   - Vercel → Settings → Environment Variables
   - 기존 변수 삭제 후 재추가
   - 재배포

### CORS 오류가 발생하는 경우
브라우저 콘솔에 "CORS policy" 오류가 보이면:

1. **서버 CORS 설정 확인**
   - `server.js`의 `allowedOrigins` 배열 확인
   - `'https://cutflow.vercel.app'` 포함 여부 확인

2. **서버 재시작**
   ```bash
   pm2 restart cutflow-api
   # 또는
   # 서버 콘솔에서 Ctrl+C 후 node server.js 재실행
   ```

### 연결 실패 (Failed to fetch)
1. **서버 실행 확인**
   - 원격 데스크톱에서 서버가 실행 중인지 확인
   - `http://106.254.252.42:3001/api/health` 직접 접속 테스트

2. **방화벽 확인**
   - Windows 방화벽에서 포트 3001 허용 확인
   - 외부에서 접근 가능한지 확인

3. **네트워크 확인**
   - 다른 컴퓨터/네트워크에서 `http://106.254.252.42:3001/api/health` 접속 테스트

## 최종 체크리스트

- [ ] Vercel 환경 변수 설정 완료
- [ ] Vercel 재배포 완료
- [ ] 브라우저 콘솔에서 환경 변수 값 확인 (`http://106.254.252.42:3001`)
- [ ] Network 탭에서 API 요청이 올바른 서버로 가는지 확인
- [ ] 파일 업로드 테스트 성공
- [ ] 서버 헬스 체크 응답 확인

## 성공 확인 방법

모든 것이 정상 작동하면:
1. 파일 업로드 버튼 클릭
2. 파일 선택
3. 업로드 진행
4. 파일이 미디어 라이브러리에 표시됨
5. 타임라인에 추가 가능

이 모든 단계가 성공하면 설정이 완료된 것입니다! 🎉


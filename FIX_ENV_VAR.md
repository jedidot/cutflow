# 환경 변수 HTTP → HTTPS 변경 가이드

## 현재 문제
- 브라우저 콘솔에 `API_BASE_URL: http://106.254.252.42:3001` 반복 출력
- 환경 변수가 아직 HTTP로 설정되어 있음

## 해결 방법

### 1단계: Vercel 환경 변수 확인 및 변경

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - cutflow 프로젝트 선택

2. **Settings → Environment Variables**

3. **`VITE_API_BASE_URL` 확인 및 수정**
   - 현재 값이 `http://106.254.252.42:3001`인지 확인
   - 값 변경: `https://106.254.252.42:3443`
   - Environment: Production, Preview, Development 모두 선택
   - **Save** 클릭

4. **환경 변수 삭제 후 재추가 (필요시)**
   - 기존 변수 삭제
   - 새로 추가: `VITE_API_BASE_URL` = `https://106.254.252.42:3443`
   - Save

### 2단계: Vercel 재배포 강제 실행

환경 변수 변경만으로는 재배포가 트리거되지 않을 수 있습니다.

**방법 A: Git 빈 커밋 푸시 (가장 확실함)**
```bash
cd c:\IIWeb\CutFlow
git add .
git commit -m "Update API URL to HTTPS"
git push
```

**방법 B: 코드 약간 수정 후 푸시**
`src/App.jsx`에서 주석 한 줄 추가:
```javascript
// Updated for HTTPS
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

그리고:
```bash
git add src/App.jsx
git commit -m "Update for HTTPS API"
git push
```

### 3단계: 배포 확인

1. Vercel → Deployments 탭
2. 새로운 배포가 시작되는지 확인
3. "Building" → "Ready" 상태로 변경될 때까지 대기
4. 배포 완료 확인

### 4단계: 브라우저에서 확인

1. **브라우저 캐시 완전 클리어**
   - `Ctrl + Shift + Delete`
   - 캐시된 이미지 및 파일 선택
   - 삭제

2. **시크릿 모드에서 테스트** (권장)
   - `Ctrl + Shift + N` (Chrome)
   - https://cutflow.vercel.app/ 접속

3. **콘솔 확인**
   - F12 → Console 탭
   - `API_BASE_URL` 로그가 더 이상 반복되지 않아야 함
   - (로그를 제거했으므로 출력되지 않음)

4. **Network 탭 확인**
   - Request URL이 `https://106.254.252.42:3443/api/files`인지 확인
   - Mixed Content 오류가 사라졌는지 확인

## 문제 해결

### 환경 변수가 여전히 HTTP로 나오는 경우

1. **Vercel 빌드 로그 확인**
   - Deployments → 최신 배포 → Build Logs
   - 환경 변수가 주입되었는지 확인

2. **환경 변수 재설정**
   - 삭제 후 재추가
   - 값이 정확한지 확인 (`https://`로 시작)

3. **강제 재배포**
   - Git 푸시로 재배포 트리거
   - 또는 Vercel CLI 사용

### 반복 로그 문제

코드에서 로그를 제거했습니다. 이제 반복 메시지가 나타나지 않습니다.

## 최종 확인

배포 완료 후:
- [ ] Network 탭에서 Request URL이 `https://106.254.252.42:3443`로 시작
- [ ] Mixed Content 오류 사라짐
- [ ] "서버 연결 실패" 메시지 사라짐
- [ ] 파일 업로드 정상 작동


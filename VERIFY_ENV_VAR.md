# 환경 변수 확인 방법

## ❌ 브라우저 콘솔에서 직접 확인 불가
`import.meta.env`는 브라우저 콘솔에서 직접 사용할 수 없습니다.

## ✅ 올바른 확인 방법

### 방법 1: Network 탭에서 확인 (가장 확실함)

1. https://cutflow.vercel.app/ 접속
2. **F12** (개발자 도구) 열기
3. **Network** 탭 선택
4. 파일 업로드 버튼 클릭
5. 파일 선택
6. Network 탭에서 요청 확인:
   - **Request URL**이 `http://106.254.252.42:3001/api/upload/multiple`인지 확인
   - **Status**가 200 OK인지 확인

✅ 이렇게 확인하면 환경 변수가 제대로 적용되었는지 알 수 있습니다!

### 방법 2: 코드에 임시 로그 추가

`src/App.jsx` 파일 상단에 임시로 추가:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 임시: 환경 변수 확인용 (배포 후 제거)
console.log('API_BASE_URL:', API_BASE_URL);
```

그리고 Git에 푸시:
```bash
git add src/App.jsx
git commit -m "Add API_BASE_URL log for verification"
git push
```

배포 완료 후 브라우저 콘솔에서 `API_BASE_URL: http://106.254.252.42:3001`이 출력되는지 확인합니다.

### 방법 3: 실제 파일 업로드 테스트

가장 확실한 방법은 실제로 파일을 업로드해보는 것입니다:

1. https://cutflow.vercel.app/ 접속
2. 파일 업로드 버튼 클릭
3. 파일 선택
4. 업로드가 성공하면 환경 변수가 제대로 적용된 것입니다!

## 확인 체크리스트

- [ ] Network 탭에서 API 요청이 `http://106.254.252.42:3001`로 가는지 확인
- [ ] 파일 업로드가 성공하는지 확인
- [ ] 업로드된 파일이 미디어 라이브러리에 표시되는지 확인

## 문제 해결

### Network 탭에서 요청이 localhost로 가는 경우
- 환경 변수가 아직 적용되지 않았을 수 있습니다
- Vercel 재배포 확인
- 브라우저 캐시 클리어 (Ctrl+Shift+R)

### CORS 오류가 발생하는 경우
- 서버의 CORS 설정 확인
- `server.js`의 `allowedOrigins`에 `https://cutflow.vercel.app` 포함 확인

### 연결 실패 (Failed to fetch)
- 서버가 실행 중인지 확인: `http://106.254.252.42:3001/api/health`
- 방화벽 포트 3001 열림 확인


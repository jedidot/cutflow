# API URL 수정 - localhost → 106.254.252.42:3001

## 문제
- Request URL이 `http://localhost:3001/api/files`로 나옴
- 환경 변수가 아직 적용되지 않음

## 해결 방법

### 방법 1: Git 푸시로 재배포 (권장)

코드에 확인용 로그를 추가했으므로, Git에 커밋하고 푸시하면 재배포가 트리거됩니다:

```bash
cd c:\IIWeb\CutFlow
git add src/App.jsx
git commit -m "Add API_BASE_URL logging for debugging"
git push
```

Vercel이 자동으로 재배포를 시작합니다.

### 방법 2: 임시로 직접 하드코딩 (빠른 테스트용)

환경 변수가 제대로 작동하지 않는다면, 임시로 직접 설정할 수 있습니다:

`src/App.jsx` 파일 수정:
```javascript
// 임시: 프로덕션 환경에서 직접 설정
const API_BASE_URL = import.meta.env.PROD 
  ? 'http://106.254.252.42:3001'
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001');
```

또는 더 간단하게:
```javascript
const API_BASE_URL = 'http://106.254.252.42:3001';
```

하지만 이 방법은 로컬 개발 시 문제가 될 수 있으므로, 환경 변수를 사용하는 것이 좋습니다.

## 재배포 확인

1. Vercel 대시보드 → Deployments 탭
2. 새로운 배포가 "Building" 상태로 시작되는지 확인
3. 완료되면 "Ready" 상태로 변경됨

## 배포 완료 후 확인

1. https://cutflow.vercel.app/ 접속
2. F12 → Console 탭
3. `API_BASE_URL: http://106.254.252.42:3001` 메시지 확인
4. Network 탭에서 Request URL 확인:
   - ✅ `http://106.254.252.42:3001/api/files`
   - ❌ `http://localhost:3001/api/files` (여전히 이거면 재배포 미완료)

## 빠른 해결 (임시)

지금 당장 테스트하고 싶다면:

`src/App.jsx`에서:
```javascript
const API_BASE_URL = 'http://106.254.252.42:3001';
```

이렇게 하면 즉시 작동하지만, 로컬 개발 시 문제가 될 수 있습니다.


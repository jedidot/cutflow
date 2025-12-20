# Mixed Content 오류 최종 해결

## 현재 문제
- 여전히 `http://106.254.252.42:3001`로 요청이 감
- Vercel 환경 변수가 아직 적용되지 않음

## 해결 방법

### 코드 수정 완료 ✅
프로덕션 환경에서는 기본적으로 HTTPS를 사용하도록 코드를 수정했습니다.

### 다음 단계: Git 푸시 및 재배포

```bash
cd c:\IIWeb\CutFlow
git add src/App.jsx
git commit -m "Fix: Use HTTPS for production API URL"
git push
```

### 배포 확인

1. Vercel 대시보드 → Deployments 탭
2. 새로운 배포가 시작되는지 확인
3. "Building" → "Ready" 상태로 변경될 때까지 대기 (1-2분)

### 배포 완료 후 테스트

1. **브라우저 캐시 완전 클리어**
   - `Ctrl + Shift + Delete`
   - 또는 시크릿 모드: `Ctrl + Shift + N`

2. **https://cutflow.vercel.app/ 접속**

3. **Network 탭에서 확인**
   - Request URL이 `https://106.254.252.42:3443/api/files`인지 확인
   - Mixed Content 오류가 사라졌는지 확인

4. **파일 업로드 테스트**
   - "서버 연결 실패" 메시지가 사라져야 함
   - 파일 업로드가 정상 작동해야 함

## 확인 사항

배포 전에 확인:
- [ ] HTTPS 서버가 포트 3443에서 실행 중
- [ ] `https://106.254.252.42:3443/api/health` 접속 가능
- [ ] 방화벽 포트 3443 열림

## 코드 변경 내용

프로덕션 환경(`import.meta.env.PROD`)에서는:
- 환경 변수가 있으면 사용
- 없으면 기본값으로 `https://106.254.252.42:3443` 사용

로컬 개발 환경에서는:
- 환경 변수가 있으면 사용
- 없으면 `http://localhost:3001` 사용

이렇게 하면 Vercel 환경 변수가 설정되지 않아도 프로덕션에서는 HTTPS를 사용합니다.


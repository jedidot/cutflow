# Mixed Content 오류 최종 해결

## 현재 상황
- ✅ HTTPS 서버 설정 완료 (포트 3443)
- ❌ 여전히 `http://106.254.252.42:3001`로 요청이 가고 있음
- ❌ Mixed Content 오류 발생

## 원인
Vercel 환경 변수가 아직 HTTP로 설정되어 있거나, 재배포가 완료되지 않았습니다.

## 해결 방법

### 1단계: Vercel 환경 변수 변경

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - cutflow 프로젝트 선택

2. **Settings → Environment Variables**

3. **`VITE_API_BASE_URL` 수정**
   - 기존 값: `http://106.254.252.42:3001`
   - 새 값: `https://106.254.252.42:3443`
   - Save 클릭

### 2단계: Vercel 재배포

환경 변수 변경 후 자동으로 재배포가 시작되거나, 수동으로 트리거해야 합니다:

**방법 A: Git 푸시로 재배포**
```bash
cd c:\IIWeb\CutFlow
git commit --allow-empty -m "Update API URL to HTTPS"
git push
```

**방법 B: Vercel CLI 사용**
```bash
vercel --prod
```

### 3단계: 배포 완료 확인

1. Vercel 대시보드 → Deployments 탭
2. 새로운 배포가 "Building" → "Ready" 상태로 변경되는지 확인
3. 배포 완료 대기 (1-2분)

### 4단계: 최종 테스트

1. **브라우저 캐시 클리어**
   - `Ctrl + Shift + R` (하드 리프레시)
   - 또는 시크릿 모드에서 테스트

2. **https://cutflow.vercel.app/ 접속**

3. **Network 탭에서 확인**
   - Request URL이 `https://106.254.252.42:3443/api/files`인지 확인
   - Mixed Content 오류가 사라졌는지 확인

4. **파일 업로드 테스트**
   - "서버 연결 실패" 메시지가 사라져야 함
   - 파일 업로드가 정상 작동해야 함

## 확인 체크리스트

- [ ] Vercel 환경 변수 `VITE_API_BASE_URL` = `https://106.254.252.42:3443`
- [ ] Vercel 재배포 완료
- [ ] HTTPS 서버가 포트 3443에서 실행 중
- [ ] 방화벽 포트 3443 열림
- [ ] 브라우저에서 `https://106.254.252.42:3443/api/health` 접속 가능
- [ ] Network 탭에서 Request URL이 `https://`로 시작
- [ ] Mixed Content 오류 사라짐
- [ ] 파일 업로드 성공

## 문제 해결

### 여전히 HTTP로 요청이 가는 경우
- Vercel 재배포가 완료되지 않았을 수 있음
- 브라우저 캐시 클리어
- 시크릿 모드에서 테스트

### HTTPS 서버에 연결 실패
- 서버가 실행 중인지 확인
- 방화벽 포트 3443 열림 확인
- `https://106.254.252.42:3443/api/health` 직접 접속 테스트

### 브라우저에서 "안전하지 않은 연결" 경고
- mkcert 인증서는 로컬 CA가 설치된 브라우저에서만 신뢰됨
- "고급" → "계속 진행" 클릭하여 진행 가능
- 프로덕션에서는 공인 인증서 사용 권장


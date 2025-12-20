# Vercel 재배포 방법

## 방법 1: 코드 푸시로 자동 재배포 (가장 간단)

환경 변수는 이미 설정되어 있으므로, 코드를 조금 수정하고 푸시하면 자동으로 재배포됩니다.

### 로컬에서 실행:
```bash
# 간단한 변경사항 추가 (예: 주석 추가)
# src/App.jsx 파일의 아무 곳이나 주석 한 줄 추가

# Git에 커밋 및 푸시
git add .
git commit -m "Trigger redeploy for environment variables"
git push
```

Vercel이 자동으로 감지하여 재배포를 시작합니다.

## 방법 2: Vercel CLI 사용

### CLI 설치 및 로그인
```bash
npm install -g vercel
vercel login
```

### 프로젝트 디렉토리에서 재배포
```bash
cd c:\IIWeb\CutFlow
vercel --prod
```

## 방법 3: Vercel 대시보드에서 수동 재배포

### 옵션 A: Settings에서 재배포
1. Vercel 대시보드 → 프로젝트 선택
2. Settings 탭
3. General 섹션에서 "Redeploy" 버튼 찾기
4. 또는 "Deployments" 섹션 확인

### 옵션 B: Deployments 탭
1. Vercel 대시보드 → 프로젝트 선택
2. Deployments 탭
3. 최신 배포 항목 클릭
4. 상세 페이지에서 "Redeploy" 버튼 찾기
5. 또는 우측 상단의 "..." 메뉴 확인

### 옵션 C: 새 배포 트리거
1. Deployments 탭
2. "Create Deployment" 또는 "Deploy" 버튼 확인
3. 또는 Git 커밋 해시를 선택하여 특정 커밋 재배포

## 방법 4: 환경 변수 재설정으로 트리거

환경 변수를 삭제했다가 다시 추가하면 재배포가 트리거될 수 있습니다:

1. Settings → Environment Variables
2. `VITE_API_BASE_URL` 삭제
3. Save
4. 다시 추가
5. Save

## 방법 5: 빈 커밋 푸시 (가장 확실한 방법)

```bash
# Git에서 빈 커밋 생성
git commit --allow-empty -m "Trigger redeploy for environment variables"
git push
```

이렇게 하면 코드 변경 없이도 재배포가 트리거됩니다.

## 확인 방법

재배포가 시작되면:
1. Vercel 대시보드 → Deployments 탭
2. 새로운 배포가 "Building" 또는 "Deploying" 상태로 표시됨
3. 완료되면 "Ready" 상태로 변경됨

## 배포 완료 후 확인

1. 배포 완료 후 https://cutflow.vercel.app/ 접속
2. 브라우저 개발자 도구(F12) → Console 탭
3. 다음 명령어 실행:
```javascript
console.log(import.meta.env.VITE_API_BASE_URL)
```
4. `"http://106.254.252.42:3001"`이 출력되어야 함

## 추천 방법

**가장 간단한 방법**: 방법 5 (빈 커밋 푸시)
- 코드 변경 불필요
- 확실하게 재배포 트리거
- 빠르고 안전


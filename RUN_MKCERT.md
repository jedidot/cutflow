# mkcert 실행 방법

## 현재 상황
- 파일 위치: `C:\www\cutflow\api\mkcert-v1.4.4-windows-amd64.exe`
- PowerShell에서 실행 시도했지만 인식되지 않음

## 해결 방법

### 방법 1: PowerShell에서 `.\` 접두사 사용 (권장)

```powershell
cd C:\www\cutflow\api
.\mkcert-v1.4.4-windows-amd64.exe -install
```

### 방법 2: 전체 경로로 실행

```powershell
C:\www\cutflow\api\mkcert-v1.4.4-windows-amd64.exe -install
```

### 방법 3: 파일 이름 변경 후 실행

```powershell
cd C:\www\cutflow\api
Rename-Item mkcert-v1.4.4-windows-amd64.exe mkcert.exe
.\mkcert.exe -install
```

## 실행 순서

### 1단계: 로컬 CA 설치
```powershell
cd C:\www\cutflow\api
.\mkcert-v1.4.4-windows-amd64.exe -install
```

**예상 출력:**
```
Created a new local CA at "C:\Users\YourName\AppData\Local\mkcert" ✨
The local CA is now installed in the system trust store! ⚡
```

### 2단계: 인증서 생성
```powershell
.\mkcert-v1.4.4-windows-amd64.exe 106.254.252.42 localhost 127.0.0.1
```

**예상 출력:**
```
Created a new certificate valid for the following names 📜
 - "106.254.252.42"
 - "localhost"
 - "127.0.0.1"

The certificate is at "./106.254.252.42+2.pem" and the key at "./106.254.252.42+2-key.pem" ✅
```

### 3단계: 생성된 파일 확인
```powershell
dir 106.254.252.42*
```

다음 파일이 생성되어야 합니다:
- `106.254.252.42+2.pem`
- `106.254.252.42+2-key.pem`

### 4단계: 서버 코드에서 인증서 경로 확인

`server.js`는 현재 프로젝트 루트(`__dirname`)에서 인증서를 찾습니다.
인증서를 생성한 위치가 `C:\www\cutflow\api`라면:

**옵션 A: 인증서 파일을 프로젝트 폴더로 복사**
```powershell
# 인증서를 C:\IIWeb\CutFlow로 복사
Copy-Item C:\www\cutflow\api\106.254.252.42+2*.pem C:\IIWeb\CutFlow\
```

**옵션 B: server.js에서 인증서 경로 수정**
`server.js`의 인증서 경로를 `C:\www\cutflow\api`로 변경

## 빠른 실행 명령어

PowerShell에서 순서대로 실행:

```powershell
# 1. 디렉토리 이동
cd C:\www\cutflow\api

# 2. 로컬 CA 설치
.\mkcert-v1.4.4-windows-amd64.exe -install

# 3. 인증서 생성
.\mkcert-v1.4.4-windows-amd64.exe 106.254.252.42 localhost 127.0.0.1

# 4. 생성된 파일 확인
dir 106.254.252.42*

# 5. 인증서를 서버 프로젝트 폴더로 복사 (필요시)
Copy-Item 106.254.252.42+2*.pem C:\IIWeb\CutFlow\
```

## 문제 해결

### 관리자 권한 필요
로컬 CA 설치 시 관리자 권한이 필요할 수 있습니다:
- PowerShell을 관리자 권한으로 실행
- 또는 우클릭 → "관리자 권한으로 실행"

### 바이러스 백신 차단
바이러스 백신이 차단할 수 있습니다:
- 예외 추가 또는 임시 비활성화


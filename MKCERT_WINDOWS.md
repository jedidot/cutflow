# Windows에서 mkcert 사용 가이드

## mkcert 다운로드 및 실행

### 1단계: 파일 다운로드
- https://github.com/FiloSottile/mkcert/releases
- `mkcert-v1.4.4-windows-amd64.exe` 다운로드

### 2단계: 파일 이름 변경 및 위치
다운로드한 파일을:
1. `mkcert.exe`로 이름 변경
2. 프로젝트 폴더(`C:\IIWeb\CutFlow`)에 복사
   - 또는 시스템 PATH에 추가할 폴더에 복사 (예: `C:\Windows\System32`)

### 3단계: 명령 프롬프트에서 실행

**방법 A: 프로젝트 폴더에서 직접 실행**
```cmd
cd C:\IIWeb\CutFlow
mkcert.exe -install
```

**방법 B: 전체 경로로 실행**
```cmd
cd C:\IIWeb\CutFlow
C:\IIWeb\CutFlow\mkcert.exe -install
```

### 4단계: 로컬 CA 설치 확인
```cmd
mkcert.exe -install
```

성공하면:
```
Created a new local CA at "C:\Users\YourName\AppData\Local\mkcert" ✨
The local CA is now installed in the system trust store! ⚡
```

### 5단계: 인증서 생성
```cmd
cd C:\IIWeb\CutFlow
mkcert.exe 106.254.252.42 localhost 127.0.0.1
```

성공하면 다음 파일이 생성됩니다:
- `106.254.252.42+2.pem`
- `106.254.252.42+2-key.pem`

## 문제 해결

### 문제 1: "mkcert.exe는(은) 내부 또는 외부 명령, 실행할 수 있는 프로그램, 또는 배치 파일이 아닙니다"
**해결**: 전체 경로로 실행하거나 파일이 있는 폴더로 이동

### 문제 2: 관리자 권한 필요
**해결**: 명령 프롬프트를 관리자 권한으로 실행
- Windows 검색: "cmd"
- "명령 프롬프트" 우클릭 → "관리자 권한으로 실행"

### 문제 3: 파일 실행이 안 됨
**해결**: 
1. 파일 우클릭 → 속성 → "차단 해제" 체크
2. 또는 PowerShell에서:
```powershell
cd C:\IIWeb\CutFlow
.\mkcert.exe -install
```

### 문제 4: 바이러스 백신이 차단
**해결**: 
- 바이러스 백신에서 예외 추가
- 또는 임시로 비활성화

## 빠른 실행 방법

1. **명령 프롬프트 열기** (관리자 권한)
2. **프로젝트 폴더로 이동**:
```cmd
cd C:\IIWeb\CutFlow
```

3. **mkcert.exe 파일이 있는지 확인**:
```cmd
dir mkcert.exe
```

4. **로컬 CA 설치**:
```cmd
mkcert.exe -install
```

5. **인증서 생성**:
```cmd
mkcert.exe 106.254.252.42 localhost 127.0.0.1
```

## 대안: 수동으로 인증서 생성 (OpenSSL 사용)

mkcert가 작동하지 않는다면 OpenSSL을 사용할 수 있습니다:

1. OpenSSL 설치 (Chocolatey):
```powershell
choco install openssl
```

2. 인증서 생성:
```cmd
openssl req -x509 -newkey rsa:4096 -nodes -keyout 106.254.252.42+2-key.pem -out 106.254.252.42+2.pem -days 365 -subj "/CN=106.254.252.42"
```

하지만 이 방법은 브라우저에서 경고가 나타날 수 있습니다.


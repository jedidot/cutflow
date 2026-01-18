# CutFlow 아이콘 PNG 변환 가이드

카카오톡 등 일부 메신저는 SVG 이미지를 지원하지 않으므로 PNG 파일이 필요합니다.

## 방법 1: 브라우저에서 변환 (권장)

1. `public/svg-to-png.html` 파일을 브라우저에서 엽니다.
2. "PNG 다운로드" 버튼을 클릭합니다.
3. 다운로드된 `cutflow-icon.png` 파일을 `public/` 폴더에 복사합니다.

## 방법 2: 온라인 도구 사용

1. https://svgtopng.com/ 또는 https://convertio.co/kr/svg-png/ 같은 온라인 변환 도구를 사용합니다.
2. `public/cutflow-icon.svg` 파일을 업로드합니다.
3. 크기를 512x512로 설정하고 PNG로 변환합니다.
4. 다운로드된 파일을 `public/cutflow-icon.png`로 저장합니다.

## 방법 3: 이미지 편집 프로그램 사용

Adobe Illustrator, Inkscape, GIMP 등에서 SVG를 열고 PNG로 내보냅니다.

## 확인

PNG 파일이 생성되면 `public/cutflow-icon.png` 파일이 있어야 합니다.
`index.html`의 메타 태그는 이미 PNG를 사용하도록 설정되어 있습니다.

## 카카오톡 캐시 초기화

변경 후에도 카카오톡에서 아이콘이 보이지 않으면:
1. https://developers.kakao.com/tool/clear/og 에서 캐시를 초기화합니다.
2. 공유할 URL을 입력하고 "초기화" 버튼을 클릭합니다.

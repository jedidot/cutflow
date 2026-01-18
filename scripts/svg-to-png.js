// SVG를 PNG로 변환하는 스크립트
// 사용법: node scripts/svg-to-png.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG 파일 읽기
const svgPath = path.join(__dirname, '../public/cutflow-icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

// SVG를 base64로 인코딩
const base64Svg = Buffer.from(svgContent).toString('base64');
const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

// HTML 파일 생성 (브라우저에서 PNG로 변환하기 위한 임시 파일)
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 20px; background: white; }
    canvas { border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h2>SVG to PNG 변환</h2>
  <p>아래 이미지를 우클릭하여 "이미지로 저장"을 선택하거나, 브라우저 개발자 도구를 사용하여 PNG로 저장하세요.</p>
  <img id="svgImage" src="${dataUri}" style="max-width: 512px; height: auto;" />
  <br><br>
  <canvas id="canvas" width="512" height="512"></canvas>
  <br><br>
  <button onclick="downloadPNG()">PNG 다운로드</button>
  
  <script>
    const img = document.getElementById('svgImage');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = function() {
      ctx.drawImage(img, 0, 0, 512, 512);
    };
    
    function downloadPNG() {
      const link = document.createElement('a');
      link.download = 'cutflow-icon.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  </script>
</body>
</html>
`;

const htmlPath = path.join(__dirname, '../public/svg-to-png.html');
fs.writeFileSync(htmlPath, htmlContent);

console.log('✅ 변환 HTML 파일이 생성되었습니다: public/svg-to-png.html');
console.log('📝 브라우저에서 이 파일을 열고 "PNG 다운로드" 버튼을 클릭하세요.');
console.log('📝 또는 이미지를 우클릭하여 "이미지로 저장"을 선택하세요.');

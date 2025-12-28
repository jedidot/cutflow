import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 포트 설정
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// CORS 설정 - 모든 origin 허용 (필요시 특정 origin으로 제한 가능)
app.use(cors({
  origin: '*', // 프로덕션에서는 특정 origin으로 제한하는 것을 권장
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 업로드 폴더 설정
const uploadsDir = 'C:\\www\\cutflow\\uploads';

// 업로드 폴더가 없으면 생성
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`업로드 폴더 생성: ${uploadsDir}`);
}

// 정적 파일 서빙 (업로드된 파일 접근용)
app.use('/uploads', express.static(uploadsDir));

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 타임스탬프와 랜덤 숫자로 고유한 파일명 생성
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB 제한
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.aac', '.ogg'];
    
    // 확장자 체크
    if (!allowedExts.includes(ext)) {
      console.error('지원하지 않는 확장자:', ext, file.originalname);
      return cb(new Error(`지원하지 않는 파일 확장자입니다: ${ext}`));
    }
    
    // MIME 타입 체크
    const isImage = ['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext);
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
    const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
    
    if (!file.mimetype || 
        (isImage && file.mimetype.startsWith('image/')) ||
        (isVideo && file.mimetype.startsWith('video/')) ||
        (isAudio && file.mimetype.startsWith('audio/'))) {
      return cb(null, true);
    }
    
    // 확장자가 맞으면 허용
    if (isImage || isVideo || isAudio) {
      return cb(null, true);
    }
    
    console.error('파일 필터링 실패:', {
      filename: file.originalname,
      mimetype: file.mimetype,
      extname: ext
    });
    cb(new Error(`지원하지 않는 파일 형식입니다: ${file.originalname}`));
  }
});

// API 키 검증 미들웨어 (선택사항)
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '') || req.query.apiKey;
  
  // API 키가 설정되지 않았으면 통과 (선택사항)
  const REQUIRED_API_KEY = process.env.API_KEY;
  if (!REQUIRED_API_KEY) {
    return next();
  }
  
  // API 키가 설정되어 있으면 검증
  if (!apiKey || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: '인증 실패: 유효한 API 키가 필요합니다.' });
  }
  
  next();
};

// 단일 파일 업로드 엔드포인트
app.post('/api/upload', verifyApiKey, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const file = req.file;
    
    res.json({
      success: true,
      id: Date.now(),
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      message: '파일 업로드 성공'
    });
  } catch (error) {
    console.error('업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다: ' + error.message });
  }
});

// 여러 파일 업로드 엔드포인트
app.post('/api/upload/multiple', verifyApiKey, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    console.log(`업로드된 파일 수: ${req.files.length}`);

    const files = req.files.map((file) => ({
      id: Date.now() + Math.random(),
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));

    res.json({ 
      success: true,
      files,
      message: `${files.length}개 파일 업로드 성공`
    });
  } catch (error) {
    console.error('다중 업로드 오류:', error);
    res.status(500).json({ 
      error: '파일 업로드 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uploadsDir: uploadsDir
  });
});

// 업로드된 파일 목록 가져오기
app.get('/api/files', verifyApiKey, (req, res) => {
  try {
    const filenames = fs.readdirSync(uploadsDir);
    const files = filenames.map((filename, index) => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        id: Date.now() + index,
        filename: filename,
        path: `/uploads/${filename}`,
        size: stats.size,
        uploadedAt: stats.birthtime
      };
    });

    res.json({ files });
  } catch (error) {
    console.error('파일 목록 가져오기 오류:', error);
    res.status(500).json({ error: '파일 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 서버 시작
app.listen(PORT, HOST, () => {
  console.log(`🚀 원격 업로드 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
  console.log(`📁 업로드 폴더: ${uploadsDir}`);
  console.log(`🔑 API 키: ${process.env.API_KEY ? '설정됨' : '설정 안됨 (선택사항)'}`);
  console.log(`🌐 CORS: 모든 origin 허용`);
});


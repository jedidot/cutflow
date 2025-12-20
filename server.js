import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 3001;
// eslint-disable-next-line no-undef
const HOST = process.env.HOST || '0.0.0.0'; // 모든 인터페이스에서 접근 가능하도록

// CORS 설정 - 특정 origin 허용
const allowedOrigins = [
  'https://cutflow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174'
];

app.use(cors({
  origin: function (origin, callback) {
    // origin이 없는 경우 (같은 도메인에서의 요청) 허용
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 개발 환경에서는 모든 origin 허용 (선택사항)
      // eslint-disable-next-line no-undef
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS 정책에 의해 차단되었습니다.'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 업로드 폴더 생성
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

[uploadsDir, outputDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 정적 파일 서빙
app.use('/uploads', express.static(uploadsDir));
app.use('/output', express.static(outputDir));

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
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
    
    // MIME 타입 체크 (더 유연하게 - 확장자 기반으로 판단)
    const isImage = ['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext);
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
    const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
    
    // MIME 타입이 없거나 허용된 타입인지 확인
    if (!file.mimetype || 
        (isImage && file.mimetype.startsWith('image/')) ||
        (isVideo && file.mimetype.startsWith('video/')) ||
        (isAudio && file.mimetype.startsWith('audio/'))) {
      return cb(null, true);
    }
    
    // MIME 타입이 맞지 않아도 확장자가 맞으면 허용 (일부 브라우저가 잘못된 MIME 타입을 보낼 수 있음)
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

// 파일 업로드 엔드포인트
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const file = req.file;
    let duration = 0;
    let type = 'unknown';

    // 파일 타입 확인
    if (file.mimetype.startsWith('video/')) {
      type = 'video';
      // FFprobe로 비디오 길이 가져오기
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
        );
        duration = Math.floor(parseFloat(stdout.trim()) || 0);
      } catch (error) {
        console.error('비디오 길이 가져오기 실패:', error);
        duration = 30; // 기본값
      }
    } else if (file.mimetype.startsWith('audio/')) {
      type = 'audio';
      // FFprobe로 오디오 길이 가져오기
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
        );
        duration = Math.floor(parseFloat(stdout.trim()) || 0);
      } catch (error) {
        console.error('오디오 길이 가져오기 실패:', error);
        duration = 30; // 기본값
      }
    } else if (file.mimetype.startsWith('image/')) {
      type = 'image';
      duration = 5; // 이미지는 기본 5초
    }

    res.json({
      id: Date.now(),
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      type: type,
      duration: duration,
      mimetype: file.mimetype
    });
  } catch (error) {
    console.error('업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 여러 파일 업로드
app.post('/api/upload/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    console.log(`업로드된 파일 수: ${req.files.length}`);

    const files = await Promise.all(
      req.files.map(async (file) => {
        let duration = 0;
        let type = 'unknown';

        if (file.mimetype.startsWith('video/')) {
          type = 'video';
          try {
            const { stdout } = await execAsync(
              `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
            );
            duration = Math.floor(parseFloat(stdout.trim()) || 0);
          } catch {
            duration = 30;
          }
        } else if (file.mimetype.startsWith('audio/')) {
          type = 'audio';
          try {
            const { stdout } = await execAsync(
              `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
            );
            duration = Math.floor(parseFloat(stdout.trim()) || 0);
          } catch {
            duration = 30;
          }
        } else if (file.mimetype.startsWith('image/')) {
          type = 'image';
          duration = 5;
        }

        return {
          id: Date.now() + Math.random(),
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/${file.filename}`,
          size: file.size,
          type: type,
          duration: duration,
          mimetype: file.mimetype
        };
      })
    );

    res.json({ files });
  } catch (error) {
    console.error('다중 업로드 오류:', error);
    res.status(500).json({ 
      error: '파일 업로드 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 업로드된 파일 목록 가져오기
app.get('/api/files', async (req, res) => {
  try {
    const filenames = fs.readdirSync(uploadsDir);
    const files = await Promise.all(
      filenames.map(async (filename, index) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        let type = 'unknown';
        if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) type = 'video';
        else if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) type = 'audio';
        else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) type = 'image';

        let duration = type === 'image' ? 5 : 30;
        
        // 비디오/오디오 길이 가져오기
        if (type === 'video' || type === 'audio') {
          try {
            const { stdout } = await execAsync(
              `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
            );
            duration = Math.floor(parseFloat(stdout.trim()) || duration);
          } catch (err) {
            console.error(`파일 길이 가져오기 실패 (${filename}):`, err.message);
          }
        }

        // 원본 파일명 추출 (타임스탬프-랜덤-원본파일명 형식)
        const parts = filename.split('-');
        const originalName = parts.length > 2 ? parts.slice(2).join('-') : filename;

        return {
          id: Date.now() + index,
          filename: filename,
          originalName: originalName,
          path: `/uploads/${filename}`,
          size: stats.size,
          type: type,
          duration: duration
        };
      })
    );

    res.json({ files });
  } catch (error) {
    console.error('파일 목록 가져오기 오류:', error);
    res.status(500).json({ error: '파일 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 파일 삭제 엔드포인트
app.delete('/api/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true, message: '파일이 삭제되었습니다.' });
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
  }
});

// 비디오 내보내기
app.post('/api/export', async (req, res) => {
  try {
    const { clips, duration } = req.body;
    
    if (!clips || clips.length === 0) {
      return res.status(400).json({ error: '편집할 클립이 없습니다.' });
    }

    const outputFilename = `output-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    // 클립을 시간순으로 정렬
    const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
    
    // 비디오/이미지 클립과 오디오 클립 분리
    const videoClips = sortedClips.filter(c => c.type === 'video' || c.type === 'image');
    const audioClips = sortedClips.filter(c => c.type === 'audio');

    let ffmpegInputs = [];
    let filterComplex = [];
    let outputMaps = [];

    // 비디오 트랙 처리
    if (videoClips.length > 0) {
      videoClips.forEach((clip, index) => {
        const filePath = path.join(__dirname, clip.path.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) {
          throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
        }
        
        ffmpegInputs.push(`-i "${filePath}"`);
        
        let filter = '';
        
        if (clip.type === 'image') {
          // 이미지를 비디오로 변환 (loop 필터 사용)
          filter = `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0[v${index}]`;
        } else {
          // 비디오 스케일링 및 시간 조정
          filter = `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[v${index}]`;
        }
        
        filterComplex.push(filter);
      });

      // 비디오 클립들을 concat으로 연결
      if (videoClips.length > 1) {
        const concatInputs = videoClips.map((_, i) => `[v${i}]`).join('');
        filterComplex.push(`${concatInputs}concat=n=${videoClips.length}:v=1:a=0[outv]`);
        outputMaps.push('-map', '[outv]');
      } else {
        outputMaps.push('-map', '[v0]');
      }
    }

    // 오디오 트랙 처리
    if (audioClips.length > 0) {
      audioClips.forEach((clip, index) => {
        const filePath = path.join(__dirname, clip.path.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) {
          throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
        }
        
        const videoInputCount = videoClips.length;
        ffmpegInputs.push(`-i "${filePath}"`);
        
        const clipDuration = clip.endTime - clip.startTime;
        const audioIndex = videoInputCount + index;
        filterComplex.push(`[${audioIndex}:a]asetpts=PTS-STARTPTS,atrim=0:${clipDuration}[a${index}]`);
      });

      // 오디오 믹싱
      if (audioClips.length > 1) {
        const amixInputs = audioClips.map((_, i) => `[a${i}]`).join('');
        filterComplex.push(`${amixInputs}amix=inputs=${audioClips.length}:duration=longest[outa]`);
        outputMaps.push('-map', '[outa]');
      } else {
        outputMaps.push('-map', '[a0]');
      }
    }

    // FFmpeg 명령어 조립
    const filterComplexStr = filterComplex.length > 0 
      ? `-filter_complex "${filterComplex.join(';')}"` 
      : '';
    
    const ffmpegCommand = [
      'ffmpeg',
      ...ffmpegInputs,
      filterComplexStr,
      ...outputMaps,
      `-t ${duration}`,
      '-c:v libx264',
      '-preset medium',
      '-crf 23',
      '-c:a aac',
      '-b:a 192k',
      `"${outputPath}"`,
      '-y'
    ].filter(Boolean).join(' ');

    console.log('FFmpeg 명령어:', ffmpegCommand);

    // 비동기로 실행
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg 오류:', error);
        console.error('FFmpeg stderr:', stderr);
        return res.status(500).json({ error: '비디오 내보내기 중 오류가 발생했습니다: ' + error.message });
      }

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: '출력 파일이 생성되지 않았습니다.' });
      }

      res.json({
        success: true,
        filename: outputFilename,
        path: `/output/${outputFilename}`,
        size: fs.statSync(outputPath).size
      });
    });

  } catch (error) {
    console.error('내보내기 오류:', error);
    res.status(500).json({ error: '비디오 내보내기 중 오류가 발생했습니다: ' + error.message });
  }
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 서버 시작
// HTTPS 인증서 파일 경로 확인
const keyPath = path.join(__dirname, '106.254.252.42+2-key.pem');
const certPath = path.join(__dirname, '106.254.252.42+2.pem');

// HTTPS 인증서가 있으면 HTTPS 서버 시작, 없으면 HTTP 서버만 시작
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  https.createServer(httpsOptions, app).listen(3443, HOST, () => {
    console.log(`🚀 HTTPS 서버가 https://${HOST}:3443 에서 실행 중입니다.`);
    console.log(`📁 업로드 폴더: ${uploadsDir}`);
    console.log(`📁 출력 폴더: ${outputDir}`);
    console.log(`🌐 허용된 Origin: ${allowedOrigins.join(', ')}`);
  });
  
  // HTTP 서버도 함께 실행 (포트 3001)
  app.listen(PORT, HOST, () => {
    console.log(`🚀 HTTP 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
  });
} else {
  // HTTPS 인증서가 없으면 HTTP만 실행
  app.listen(PORT, HOST, () => {
    console.log(`🚀 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
    console.log(`📁 업로드 폴더: ${uploadsDir}`);
    console.log(`📁 출력 폴더: ${outputDir}`);
    console.log(`🌐 허용된 Origin: ${allowedOrigins.join(', ')}`);
    console.log(`⚠️  HTTPS 인증서가 없어 HTTP만 실행 중입니다.`);
    console.log(`💡 HTTPS를 사용하려면 mkcert로 인증서를 생성하세요.`);
  });
}

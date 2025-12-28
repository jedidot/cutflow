import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import * as ftp from 'basic-ftp';

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

// FFmpeg 경로 설정 (환경 변수 또는 기본값)
// eslint-disable-next-line no-undef
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

// FFprobe 경로 설정 (FFmpeg 경로 기반으로 자동 설정)
// eslint-disable-next-line no-undef
let ffprobePath = process.env.FFPROBE_PATH;
if (!ffprobePath && ffmpegPath !== 'ffmpeg') {
  // FFmpeg 경로가 설정되어 있으면 같은 디렉토리의 ffprobe 사용
  ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
} else if (!ffprobePath) {
  ffprobePath = 'ffprobe';
}

console.log('FFmpeg 경로:', ffmpegPath);
console.log('FFprobe 경로:', ffprobePath);

// 파일 다운로드 엔드포인트 (CORS 헤더 포함)
app.get('/api/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(outputDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }
    
    // CORS 헤더 설정
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // 파일 다운로드 헤더 설정
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // 파일 전송
    res.sendFile(filePath);
  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({ error: '파일 다운로드 중 오류가 발생했습니다.' });
  }
});

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
          `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
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
          `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
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
              `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
            );
            duration = Math.floor(parseFloat(stdout.trim()) || 0);
          } catch {
            duration = 30;
          }
        } else if (file.mimetype.startsWith('audio/')) {
          type = 'audio';
          try {
            const { stdout } = await execAsync(
              `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`
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
              `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
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
  let responseSent = false;
  
  const sendError = (status, message) => {
    if (!responseSent) {
      responseSent = true;
      res.status(status).json({ error: message });
    }
  };

  const sendSuccess = (data) => {
    if (!responseSent) {
      responseSent = true;
      res.json(data);
    }
  };

  try {
    const { clips, duration, texts = [], effects = [] } = req.body;
    
    if (!clips || clips.length === 0) {
      return sendError(400, '편집할 클립이 없습니다.');
    }

    const outputFilename = `output-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);
    const textFilePaths = []; // 정리할 텍스트 파일 경로들

    // 클립을 시간순으로 정렬
    const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
    
    // 비디오/이미지 클립과 오디오 클립 분리
    const videoClips = sortedClips.filter(c => c.type === 'video' || c.type === 'image');
    const audioClips = sortedClips.filter(c => c.type === 'audio');

    let ffmpegArgs = ['ffmpeg'];
    let filterComplex = [];
    let outputMaps = [];
    const inputFiles = [];

    // 비디오 트랙 처리
    if (videoClips.length > 0) {
      videoClips.forEach((clip, index) => {
        // 경로 정규화: /uploads/... 형식에서 실제 파일 경로로 변환
        let clipPath = clip.path;
        if (clipPath.startsWith('/uploads/')) {
          clipPath = path.join(uploadsDir, clipPath.replace('/uploads/', ''));
        } else if (clipPath.startsWith('/')) {
          clipPath = path.join(__dirname, clipPath.substring(1));
        } else {
          clipPath = path.join(__dirname, clipPath);
        }
        
        // Windows 경로 정규화
        const normalizedPath = path.normalize(clipPath);
        
        if (!fs.existsSync(normalizedPath)) {
          throw new Error(`파일을 찾을 수 없습니다: ${normalizedPath}`);
        }
        
        inputFiles.push(normalizedPath);
        ffmpegArgs.push('-i', normalizedPath);
        
        // 클립 길이 계산
        const clipDuration = clip.endTime - clip.startTime;
        
        let filter = '';
        
        if (clip.type === 'image') {
          // 이미지를 비디오로 변환하고 길이 제한 (오디오 없음)
          filter = `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,trim=duration=${clipDuration},setpts=PTS-STARTPTS[v${index}]`;
        } else {
          // 비디오 스케일링, 길이 제한 및 시간 조정 (오디오 제거 - 별도 오디오 클립 사용)
          // 오디오 클립이 있으면 비디오의 오디오를 제거
          filter = `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,trim=duration=${clipDuration},setpts=PTS-STARTPTS[v${index}]`;
        }
        
        filterComplex.push(filter);
      });

      // 비디오 클립들을 concat으로 연결 (오디오 제거: a=0)
      let videoOutput = 'outv';
      if (videoClips.length > 1) {
        const concatInputs = videoClips.map((_, i) => `[v${i}]`).join('');
        filterComplex.push(`${concatInputs}concat=n=${videoClips.length}:v=1:a=0[${videoOutput}]`);
      } else {
        // 단일 비디오 클립도 오디오 제거
        videoOutput = 'v0';
        // v0는 이미 오디오가 없는 비디오 스트림이므로 그대로 사용
      }

      // 텍스트 오버레이 추가
      if (texts && texts.length > 0) {
        let currentVideoLabel = videoOutput;
        
        texts.forEach((text, textIndex) => {
          // 텍스트 클립 찾기
          const textClip = sortedClips.find(c => c.type === 'text' && c.textId === text.id);
          if (!textClip) return;

          const textStart = textClip.startTime;
          const textEnd = textClip.endTime;
          
          // 텍스트를 임시 파일로 저장 (특수문자 문제 회피)
          const textFilePath = path.join(outputDir, `text_${Date.now()}_${textIndex}.txt`);
          fs.writeFileSync(textFilePath, text.content, 'utf8');
          textFilePaths.push(textFilePath);
          
          // 폰트 크기와 위치 설정
          const fontSize = text.fontSize || 48;
          const x = text.x || 100;
          const y = text.y || 100;
          // 색상 처리
          let fontColor = (text.color || 'white').replace(/^#/, '');
          if (!fontColor.startsWith('0x') && fontColor !== 'white' && fontColor !== 'black') {
            fontColor = '0x' + fontColor;
          } else if (fontColor === 'white') {
            fontColor = '0xFFFFFF';
          } else if (fontColor === 'black') {
            fontColor = '0x000000';
          }
          
          // Windows 경로를 FFmpeg 형식으로 변환
          // FFmpeg 필터 체인에서 경로는 작은따옴표 없이 사용하고, 콜론을 이스케이프
          // textfile 옵션은 경로를 따옴표 없이도 처리할 수 있지만, 콜론은 문제가 됨
          // 해결: 경로를 상대 경로로 변환 (FFmpeg는 작업 디렉토리 기준)
          const relativePath = path.relative(__dirname, textFilePath).replace(/\\/g, '/');
          
          // 새로운 비디오 레이블 생성
          const nextVideoLabel = textIndex === texts.length - 1 ? `${videoOutput}_text` : `${videoOutput}_text${textIndex}`;
          
          // drawtext 필터 생성 (textfile 사용으로 특수문자 문제 해결)
          // 상대 경로 사용 (콜론 문제 없음)
          const textFilter = `[${currentVideoLabel}]drawtext=textfile=${relativePath}:fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,${textStart},${textEnd})'[${nextVideoLabel}]`;
          filterComplex.push(textFilter);
          
          currentVideoLabel = nextVideoLabel;
        });

        if (texts.length > 0) {
          videoOutput = `${videoOutput}_text`;
        }
      }

      // 그래픽 효과 적용 (zoom, fade, blur)
      // 주의: 시간 기반 조건부 적용은 복잡하므로, 효과가 있는 구간에만 간단히 적용
      if (effects && effects.length > 0) {
        let currentVideoLabel = videoOutput;
        
        // 효과를 시간순으로 정렬
        const sortedEffects = [...effects].sort((a, b) => a.startTime - b.startTime);
        
        // 효과가 있는 경우에만 처리 (sparkles 제외)
        const applicableEffects = sortedEffects.filter(e => ['zoom', 'fade', 'blur'].includes(e.type));
        
        if (applicableEffects.length > 0) {
          console.log('그래픽 효과 적용:', applicableEffects.length, '개');
          
          // 첫 번째 효과만 적용 (여러 효과 동시 적용은 복잡하므로)
          const firstEffect = applicableEffects[0];
          const effectStart = firstEffect.startTime;
          const effectEnd = firstEffect.endTime;
          const intensity = (firstEffect.intensity || 50) / 100;
          const nextVideoLabel = `${currentVideoLabel}_effect`;
          
          let effectFilter = '';
          
          switch (firstEffect.type) {
            case 'zoom': {
              // 줌 효과: 간단한 scale 필터 사용 (전체 영상에 적용)
              const zoomScale = 1.0 + (intensity * 0.2); // 최대 1.2배로 제한
              effectFilter = `[${currentVideoLabel}]scale=iw*${zoomScale}:ih*${zoomScale}[${nextVideoLabel}]`;
              break;
            }
              
            case 'fade': {
              // 페이드 효과: fade 필터 사용
              const fadeDuration = Math.min(1.0, (effectEnd - effectStart) / 2);
              effectFilter = `[${currentVideoLabel}]fade=t=in:st=${effectStart}:d=${fadeDuration},fade=t=out:st=${effectEnd - fadeDuration}:d=${fadeDuration}[${nextVideoLabel}]`;
              break;
            }
              
            case 'blur': {
              // 블러 효과: boxblur 필터 사용
              const blurAmount = Math.max(1, Math.round(intensity * 5)); // 최대 5로 제한
              effectFilter = `[${currentVideoLabel}]boxblur=${blurAmount}:${blurAmount}[${nextVideoLabel}]`;
              break;
            }
          }
          
          if (effectFilter) {
            filterComplex.push(effectFilter);
            currentVideoLabel = nextVideoLabel;
            videoOutput = nextVideoLabel;
            console.log('효과 필터 적용:', firstEffect.type, effectFilter);
          }
        }
      }

      outputMaps.push('-map', `[${videoOutput}]`);
    }

    // 오디오 트랙 처리
    if (audioClips.length > 0) {
      audioClips.forEach((clip, index) => {
        // 경로 정규화
        let clipPath = clip.path;
        if (clipPath.startsWith('/uploads/')) {
          clipPath = path.join(uploadsDir, clipPath.replace('/uploads/', ''));
        } else if (clipPath.startsWith('/')) {
          clipPath = path.join(__dirname, clipPath.substring(1));
        } else {
          clipPath = path.join(__dirname, clipPath);
        }
        
        const normalizedPath = path.normalize(clipPath);
        
        if (!fs.existsSync(normalizedPath)) {
          throw new Error(`파일을 찾을 수 없습니다: ${normalizedPath}`);
        }
        
        inputFiles.push(normalizedPath);
        ffmpegArgs.push('-i', normalizedPath);
        
        const clipDuration = clip.endTime - clip.startTime;
        const audioIndex = videoClips.length + index;
        // 오디오 클립 길이를 정확히 맞추고, duration보다 길면 잘라내기
        const trimmedDuration = Math.min(clipDuration, duration);
        filterComplex.push(`[${audioIndex}:a]asetpts=PTS-STARTPTS,atrim=0:${trimmedDuration}[a${index}]`);
      });

      // 오디오 믹싱
      if (audioClips.length > 1) {
        const amixInputs = audioClips.map((_, i) => `[a${i}]`).join('');
        // duration=longest 대신 duration=first로 변경하여 모든 오디오를 동일한 길이로 맞춤
        filterComplex.push(`${amixInputs}amix=inputs=${audioClips.length}:duration=longest:dropout_transition=0[outa]`);
        outputMaps.push('-map', '[outa]');
      } else {
        outputMaps.push('-map', '[a0]');
      }
    }

    // FFmpeg 명령어 조립
    if (filterComplex.length > 0) {
      ffmpegArgs.push('-filter_complex', filterComplex.join(';'));
    }
    
    ffmpegArgs.push(...outputMaps);
    // 전체 길이를 duration으로 제한 (초 단위)
    ffmpegArgs.push('-t', String(duration));
    // 오디오 클립이 있으면 shortest 사용 (비디오와 오디오 중 짧은 것 기준)
    // 오디오 클립이 없으면 비디오 길이 기준
    if (audioClips.length > 0) {
      ffmpegArgs.push('-shortest');
    }
    ffmpegArgs.push('-c:v', 'libx264');
    ffmpegArgs.push('-preset', 'medium');
    ffmpegArgs.push('-crf', '23');
    ffmpegArgs.push('-c:a', 'aac');
    ffmpegArgs.push('-b:a', '192k');
    ffmpegArgs.push('-y');
    ffmpegArgs.push(outputPath);

    console.log('FFmpeg 명령어:', ffmpegArgs.join(' '));
    console.log('입력 파일들:', inputFiles);

    ffmpegArgs[0] = ffmpegPath;

    // 텍스트 파일 정리 함수
    const cleanupTextFiles = () => {
      textFilePaths.forEach(textFilePath => {
        try {
          if (fs.existsSync(textFilePath)) {
            fs.unlinkSync(textFilePath);
          }
        } catch (err) {
          console.error('텍스트 파일 삭제 오류:', err);
        }
      });
    };

    // 비동기로 실행 (배열로 전달하여 Windows에서도 안전하게 처리)
    exec(ffmpegArgs.join(' '), { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
      // 텍스트 파일 정리
      cleanupTextFiles();
      
      if (error) {
        console.error('FFmpeg 오류:', error);
        console.error('FFmpeg stderr:', stderr);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg 명령어:', ffmpegArgs.join(' '));
        
        // stderr에서 주요 오류 메시지 추출
        let detailedError = error.message;
        if (stderr) {
          // FFmpeg 오류 메시지에서 중요한 부분 추출
          const errorLines = stderr.split('\n').filter(line => 
            line.includes('Error') || 
            line.includes('error') || 
            line.includes('Invalid') ||
            line.includes('No such file')
          );
          if (errorLines.length > 0) {
            detailedError = errorLines.join('\n');
          }
        }
        
        return sendError(500, `비디오 내보내기 중 오류가 발생했습니다.\n\n${detailedError}\n\n서버 콘솔을 확인해주세요.`);
      }

      if (!fs.existsSync(outputPath)) {
        console.error('출력 파일이 생성되지 않았습니다:', outputPath);
        return sendError(500, '출력 파일이 생성되지 않았습니다.');
      }

      const stats = fs.statSync(outputPath);
      sendSuccess({
        success: true,
        filename: outputFilename,
        path: `/output/${outputFilename}`,
        size: stats.size
      });
    });

  } catch (error) {
    console.error('내보내기 오류:', error);
    console.error('오류 스택:', error.stack);
    sendError(500, '비디오 내보내기 중 오류가 발생했습니다: ' + error.message);
  }
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// FTP 업로드 엔드포인트
app.post('/api/upload/ftp', async (req, res) => {
  try {
    const { 
      host, 
      port = 21, 
      user, 
      password, 
      secure = false, 
      remotePath = '/', 
      filename 
    } = req.body;

    // 필수 파라미터 검증
    if (!host || !user || !password || !filename) {
      return res.status(400).json({ 
        error: '필수 파라미터가 누락되었습니다. (host, user, password, filename 필요)' 
      });
    }

    // 업로드할 파일 경로 확인
    const filePath = path.join(outputDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '업로드할 파일을 찾을 수 없습니다.' });
    }

    // FTP 클라이언트 생성
    const client = new ftp.Client();
    client.ftp.verbose = true; // 디버깅용

    try {
      // FTP 서버 연결
      await client.access({
        host: host,
        port: parseInt(port),
        user: user,
        password: password,
        secure: secure === true || secure === 'true' ? true : false
      });

      console.log(`FTP 연결 성공: ${host}:${port}`);

      // 원격 경로로 이동 (없으면 생성)
      if (remotePath && remotePath !== '/') {
        try {
          await client.ensureDir(remotePath);
        } catch (dirError) {
          console.warn('디렉토리 생성/이동 실패:', dirError.message);
        }
      }

      // 파일 업로드
      const remoteFilePath = remotePath === '/' ? filename : path.join(remotePath, filename).replace(/\\/g, '/');
      await client.uploadFrom(filePath, remoteFilePath);

      console.log(`FTP 업로드 성공: ${remoteFilePath}`);

      // 연결 종료
      client.close();

      res.json({
        success: true,
        message: 'FTP 업로드가 완료되었습니다.',
        remotePath: remoteFilePath,
        filename: filename
      });

    } catch (ftpError) {
      console.error('FTP 업로드 오류:', ftpError);
      client.close();
      res.status(500).json({ 
        error: 'FTP 업로드 중 오류가 발생했습니다: ' + ftpError.message 
      });
    }

  } catch (error) {
    console.error('FTP 업로드 처리 오류:', error);
    res.status(500).json({ 
      error: 'FTP 업로드 처리 중 오류가 발생했습니다: ' + error.message 
    });
  }
});

// FTP 연결 테스트 엔드포인트
app.post('/api/ftp/test', async (req, res) => {
  try {
    const { 
      host, 
      port = 21, 
      user, 
      password, 
      secure = false 
    } = req.body;

    // 필수 파라미터 검증
    if (!host || !user || !password) {
      return res.status(400).json({ 
        error: '필수 파라미터가 누락되었습니다. (host, user, password 필요)' 
      });
    }

    // FTP 클라이언트 생성
    const client = new ftp.Client();
    client.ftp.verbose = false; // 테스트 시에는 상세 로그 비활성화

    try {
      // FTP 서버 연결 테스트
      await client.access({
        host: host,
        port: parseInt(port),
        user: user,
        password: password,
        secure: secure === true || secure === 'true' ? true : false
      });

      // 현재 디렉토리 확인
      const pwd = await client.pwd();

      // 연결 종료
      client.close();

      res.json({
        success: true,
        message: 'FTP 연결 성공',
        currentDirectory: pwd
      });

    } catch (ftpError) {
      console.error('FTP 연결 테스트 오류:', ftpError);
      client.close();
      res.status(500).json({ 
        error: 'FTP 연결 실패: ' + ftpError.message 
      });
    }

  } catch (error) {
    console.error('FTP 연결 테스트 처리 오류:', error);
    res.status(500).json({ 
      error: 'FTP 연결 테스트 처리 중 오류가 발생했습니다: ' + error.message 
    });
  }
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

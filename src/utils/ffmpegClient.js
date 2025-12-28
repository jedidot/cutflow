// FFmpeg.wasm 클라이언트 유틸리티

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let isLoaded = false;

// FFmpeg 인스턴스 초기화
export const initFFmpeg = async (onProgress) => {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  try {
    ffmpegInstance = new FFmpeg();
    
    // 진행률 콜백 설정
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    // 로그 콜백 설정 (디버깅용)
    ffmpegInstance.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // FFmpeg.wasm 파일 로드
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    isLoaded = true;
    console.log('FFmpeg.wasm 로드 완료');
    return ffmpegInstance;
  } catch (error) {
    console.error('FFmpeg 초기화 실패:', error);
    throw error;
  }
};

// 미디어 파일의 duration 추출
export const getMediaDuration = async (file) => {
  // FFmpeg.wasm은 느리므로 MediaElement를 직접 사용 (더 빠름)
  // FFmpeg 초기화 없이 바로 MediaElement 사용
  return await getDurationFromMediaElement(file);
};

// MediaElement를 사용한 duration 추출 (더 정확함)
const getDurationFromMediaElement = (file) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const element = isVideo ? document.createElement('video') : document.createElement('audio');
    
    element.onloadedmetadata = () => {
      const duration = Math.floor(element.duration || 0);
      URL.revokeObjectURL(url);
      resolve(duration || (isVideo ? 30 : 30));
    };

    element.onerror = () => {
      URL.revokeObjectURL(url);
      // 기본값 반환
      resolve(file.type.startsWith('image/') ? 5 : 30);
    };

    element.src = url;
  });
};

// 비디오 내보내기 (FFmpeg.wasm 사용)
export const exportVideo = async (config, onProgress) => {
  const ffmpeg = await initFFmpeg(onProgress);
  
  try {
    const { clips, texts = [], effects = [], duration } = config;
    
    // 클립을 시간순으로 정렬
    const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
    
    // 비디오/이미지 클립과 오디오 클립 분리
    const videoClips = sortedClips.filter(c => c.type === 'video' || c.type === 'image');
    const audioClips = sortedClips.filter(c => c.type === 'audio');
    
    // 입력 파일들을 FFmpeg에 쓰기
    const inputFiles = [];
    let inputIndex = 0;
    
    // 비디오/이미지 파일 먼저 추가
    for (const clip of videoClips) {
      if (clip.file) {
        const ext = getFileExtension(clip.file.name) || 'mp4';
        const fileName = `input_v${inputIndex}.${ext}`;
        await ffmpeg.writeFile(fileName, await fetchFile(clip.file));
        inputFiles.push({ ...clip, fileName, inputIndex });
        inputIndex++;
      }
    }
    
    // 오디오 파일 추가
    for (const clip of audioClips) {
      if (clip.file) {
        const ext = getFileExtension(clip.file.name) || 'mp3';
        const fileName = `input_a${inputIndex}.${ext}`;
        await ffmpeg.writeFile(fileName, await fetchFile(clip.file));
        inputFiles.push({ ...clip, fileName, inputIndex });
        inputIndex++;
      }
    }

    // 텍스트 파일들을 FFmpeg에 쓰기
    const textFileNames = [];
    if (texts && texts.length > 0) {
      for (let textIndex = 0; textIndex < texts.length; textIndex++) {
        const text = texts[textIndex];
        const textClip = [...videoClips, ...audioClips].find(c => c.type === 'text' && c.textId === text.id);
        if (!textClip) continue;

        const textContent = text.content || '';
        const textFileName = `text_${textIndex}.txt`;
        
        // 텍스트 파일을 FFmpeg에 쓰기 (UTF-8 인코딩)
        const textEncoder = new TextEncoder();
        const textData = textEncoder.encode(textContent);
        await ffmpeg.writeFile(textFileName, textData);
        textFileNames.push(textFileName);
      }
    }

    // FFmpeg 명령어 생성
    const args = buildFFmpegArgs(videoClips, audioClips, inputFiles, texts, textFileNames, effects, duration);
    
    console.log('FFmpeg 명령어:', args.join(' '));
    
    // FFmpeg 실행
    await ffmpeg.exec(args);

    // 출력 파일 읽기
    const outputFileName = 'output.mp4';
    const data = await ffmpeg.readFile(outputFileName);
    
    // Blob으로 변환
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    
    // 임시 파일 정리
    for (const input of inputFiles) {
      try {
        await ffmpeg.deleteFile(input.fileName);
      } catch (e) {
        // 무시
      }
    }
    
    // 텍스트 파일 정리
    if (textFileNames.length > 0) {
      for (const textFileName of textFileNames) {
        try {
          await ffmpeg.deleteFile(textFileName);
        } catch (e) {
          // 무시
        }
      }
    }
    
    try {
      await ffmpeg.deleteFile(outputFileName);
    } catch (e) {
      // 무시
    }

    return blob;
  } catch (error) {
    console.error('비디오 내보내기 실패:', error);
    throw error;
  }
};

// FFmpeg 명령어 생성 (서버 로직과 유사)
const buildFFmpegArgs = (videoClips, audioClips, inputFiles, texts, textFileNames, effects, totalDuration) => {
  const args = [];
  const filterComplex = [];
  const outputMaps = [];
  
  // 입력 파일 추가 (이미 FFmpeg에 쓰여진 파일명 사용)
  inputFiles.forEach(input => {
    args.push('-i', input.fileName);
  });

  // 비디오 트랙 처리
  if (videoClips.length > 0) {
    videoClips.forEach((clip, index) => {
      const inputFile = inputFiles.find(f => f.id === clip.id);
      if (!inputFile) return;
      
      const clipDuration = clip.endTime - clip.startTime;
      
      let filter = '';
      if (clip.type === 'image') {
        // 이미지를 비디오로 변환
        filter = `[${inputFile.inputIndex}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,trim=duration=${clipDuration},setpts=PTS-STARTPTS[v${index}]`;
      } else {
        // 비디오 스케일링 및 길이 제한 (오디오 제거)
        filter = `[${inputFile.inputIndex}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,trim=duration=${clipDuration},setpts=PTS-STARTPTS[v${index}]`;
      }
      filterComplex.push(filter);
    });

    // 비디오 클립들을 concat으로 연결
    let videoOutput = 'outv';
    if (videoClips.length > 1) {
      const concatInputs = videoClips.map((_, i) => `[v${i}]`).join('');
      filterComplex.push(`${concatInputs}concat=n=${videoClips.length}:v=1:a=0[${videoOutput}]`);
    } else {
      videoOutput = 'v0';
    }

    // 텍스트 오버레이 추가
    if (texts && texts.length > 0 && textFileNames.length > 0) {
      let currentVideoLabel = videoOutput;
      
      // 텍스트 오버레이 필터 생성
      let textIndex = 0;
      for (const text of texts) {
        const textClip = [...videoClips, ...audioClips].find(c => c.type === 'text' && c.textId === text.id);
        if (!textClip || textIndex >= textFileNames.length) continue;

        const textStart = textClip.startTime;
        const textEnd = textClip.endTime;
        const textFileName = textFileNames[textIndex];
        
        const fontSize = text.fontSize || 48;
        const x = text.x || 100;
        const y = text.y || 100;
        let fontColor = (text.color || 'white').replace(/^#/, '');
        if (!fontColor.startsWith('0x') && fontColor !== 'white' && fontColor !== 'black') {
          fontColor = '0x' + fontColor;
        } else if (fontColor === 'white') {
          fontColor = '0xFFFFFF';
        } else if (fontColor === 'black') {
          fontColor = '0x000000';
        }
        
        const nextVideoLabel = textIndex === texts.length - 1 ? `${videoOutput}_text` : `${videoOutput}_text${textIndex}`;
        
        // drawtext 필터 (textfile 사용)
        const textFilter = `[${currentVideoLabel}]drawtext=textfile=${textFileName}:fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,${textStart},${textEnd})'[${nextVideoLabel}]`;
        filterComplex.push(textFilter);
        
        currentVideoLabel = nextVideoLabel;
        textIndex++;
      }

      if (texts.length > 0) {
        videoOutput = `${videoOutput}_text`;
      }
    }

    // 그래픽 효과 적용 (간소화 버전)
    if (effects && effects.length > 0) {
      const applicableEffects = effects.filter(e => ['zoom', 'fade', 'blur'].includes(e.type));
      if (applicableEffects.length > 0) {
        const firstEffect = applicableEffects[0];
        const effectStart = firstEffect.startTime;
        const effectEnd = firstEffect.endTime;
        const intensity = (firstEffect.intensity || 50) / 100;
        const nextVideoLabel = `${videoOutput}_effect`;
        
        let effectFilter = '';
        switch (firstEffect.type) {
          case 'zoom': {
            const zoomScale = 1.0 + (intensity * 0.2);
            effectFilter = `[${videoOutput}]scale=iw*${zoomScale}:ih*${zoomScale}[${nextVideoLabel}]`;
            break;
          }
          case 'fade': {
            const fadeDuration = Math.min(1.0, (effectEnd - effectStart) / 2);
            effectFilter = `[${videoOutput}]fade=t=in:st=${effectStart}:d=${fadeDuration},fade=t=out:st=${effectEnd - fadeDuration}:d=${fadeDuration}[${nextVideoLabel}]`;
            break;
          }
          case 'blur': {
            const blurAmount = Math.max(1, Math.round(intensity * 5));
            effectFilter = `[${videoOutput}]boxblur=${blurAmount}:${blurAmount}[${nextVideoLabel}]`;
            break;
          }
        }
        
        if (effectFilter) {
          filterComplex.push(effectFilter);
          videoOutput = nextVideoLabel;
        }
      }
    }

    outputMaps.push('-map', `[${videoOutput}]`);
  }

  // 오디오 트랙 처리
  if (audioClips.length > 0) {
    audioClips.forEach((clip, index) => {
      const inputFile = inputFiles.find(f => f.id === clip.id);
      if (!inputFile) return;
      
      const clipDuration = clip.endTime - clip.startTime;
      const trimmedDuration = Math.min(clipDuration, totalDuration);
      filterComplex.push(`[${inputFile.inputIndex}:a]asetpts=PTS-STARTPTS,atrim=0:${trimmedDuration}[a${index}]`);
    });

    // 오디오 믹싱
    if (audioClips.length > 1) {
      const amixInputs = audioClips.map((_, i) => `[a${i}]`).join('');
      filterComplex.push(`${amixInputs}amix=inputs=${audioClips.length}:duration=longest:dropout_transition=0[outa]`);
      outputMaps.push('-map', '[outa]');
    } else {
      outputMaps.push('-map', '[a0]');
    }
  }

  // 필터 복잡도 추가
  if (filterComplex.length > 0) {
    args.push('-filter_complex', filterComplex.join(';'));
  }
  
  // 출력 맵 추가
  args.push(...outputMaps);
  
  // 전체 길이 제한
  args.push('-t', totalDuration.toString());
  
  // 오디오 클립이 있으면 shortest 사용
  if (audioClips.length > 0) {
    args.push('-shortest');
  }
  
  // 출력 설정
  args.push('-c:v', 'libx264');
  args.push('-preset', 'medium');
  args.push('-crf', '23');
  args.push('-c:a', 'aac');
  args.push('-b:a', '192k');
  args.push('-y');
  args.push('output.mp4');

  return args;
};

// 파일 확장자 추출
const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};


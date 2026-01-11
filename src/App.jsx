import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Play, Pause, Download, Trash2, Plus, Image, Music, Video, Sparkles, Type, ZoomIn, ZoomOut } from 'lucide-react';
import { 
  initDB, 
  saveFileToDB, 
  getFilesFromDB, 
  deleteFileFromDB, 
  getFileFromDB,
  getStorageUsage 
} from './utils/indexedDB';
import { getMediaDuration, initFFmpeg, exportVideo } from './utils/ffmpegClient';

const CutFlowApp = () => {
  // 프로덕션 환경에서는 HTTPS 강제 사용
  const getApiBaseUrl = () => {
    // 로컬 개발 환경
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    }
    
    // 프로덕션 환경 (Vercel 배포)에서는 무조건 HTTPS 사용
    // 환경 변수가 HTTPS로 시작하지 않으면 무시하고 HTTPS 사용
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && envUrl.startsWith('https://')) {
      return envUrl;
    }
    
    // 프로덕션에서는 무조건 HTTPS
    return 'https://106.254.252.42:3443';
  };
  
  const API_BASE_URL = getApiBaseUrl();
  
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(150);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [texts, setTexts] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [newTextContent, setNewTextContent] = useState('');
  const [effects, setEffects] = useState([]);
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [snapGuideTime, setSnapGuideTime] = useState(null);
  const [draggingClipTime, setDraggingClipTime] = useState(null); // 드래그 중인 클립의 시간
  const [resizingClipTime, setResizingClipTime] = useState(null); // 리사이즈 중인 클립의 시간
  const [resizingClipId, setResizingClipId] = useState(null); // 리사이즈 중인 클립의 ID
  const [resizingSide, setResizingSide] = useState(null); // 리사이즈 중인 쪽 ('left' | 'right')
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo1234');
  
  // 토스트 팝업 상태
  const [toast, setToast] = useState({ show: false, message: '' });
  
  // 원격 서버 설정 상태 (HTTP 업로드)
  const [showRemoteServerSettings, setShowRemoteServerSettings] = useState(false);
  const [remoteServerConfig, setRemoteServerConfig] = useState({
    url: '',
    apiKey: '',
    enabled: false
  });
  const [remoteServerTesting, setRemoteServerTesting] = useState(false);

  // 타임라인 상태
  const [tracks] = useState([
    { id: 'video', type: 'video', name: '비디오', icon: Video, color: 'bg-blue-500' },
    { id: 'audio', type: 'audio', name: '오디오', icon: Music, color: 'bg-green-500' },
    { id: 'image', type: 'image', name: '이미지', icon: Image, color: 'bg-yellow-500' },
    { id: 'text', type: 'text', name: '텍스트 효과', icon: Type, color: 'bg-purple-500' },
    { id: 'graphics', type: 'graphics', name: '그래픽 효과', icon: Sparkles, color: 'bg-pink-500' }
  ]);
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const timelineRef = useRef(null);
  
  // 패널 리사이즈 상태
  const [leftPanelWidth, setLeftPanelWidth] = useState(256); // 64 * 4 = 256px (w-64)
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // 80 * 4 = 320px (w-80)
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // 리사이즈 핸들러
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setLeftPanelWidth(newWidth);
      } else if (isResizingRight) {
        const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight]);

  // 서버 연결 상태
  const [serverConnected, setServerConnected] = useState(true);

  // 서버 연결 확인
  const checkServerConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
      
      const response = await fetch(`${API_BASE_URL}/api/files`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setServerConnected(response.ok);
      return response.ok;
    } catch (error) {
      console.error('서버 연결 확인 실패:', error);
      setServerConnected(false);
      return false;
    }
  };

  // 미디어 파일 목록 가져오기 (IndexedDB에서)
  const loadMediaFiles = async () => {
    try {
      // IndexedDB 초기화
      await initDB();
      
      // IndexedDB에서 파일 목록 가져오기
      const files = await getFilesFromDB();
      
      // 파일 형식 변환 (서버 응답과 호환되도록)
      const formattedFiles = files.map(file => ({
        id: file.id,
        filename: file.filename || file.originalName,
        originalName: file.originalName,
        path: file.url, // Blob URL 사용
        size: file.size,
        type: file.type,
        duration: file.duration || 0,
        mimetype: file.mimetype,
        url: file.url // 미리보기용 URL
      }));
      
      setMediaFiles(formattedFiles);
      setServerConnected(true); // 로컬 저장소는 항상 사용 가능
    } catch (error) {
      console.error('파일 목록 로드 실패:', error);
      setServerConnected(false);
      // 빈 배열로 설정하여 앱이 계속 작동하도록 함
      setMediaFiles([]);
    }
  };

  // 미디어 파일 목록 로드 (IndexedDB에서)
  useEffect(() => {
    if (currentPage === 'dashboard') {
      // 약간의 지연을 두어 컴포넌트가 완전히 마운트된 후 실행
      const timer = setTimeout(() => {
        loadMediaFiles().catch(err => {
          console.error('파일 목록 로드 실패:', err);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  // 재생 타이머
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return duration; // duration을 초과하지 않도록 제한
          }
          const nextTime = prev + 1;
          return Math.min(nextTime, duration); // duration을 초과하지 않도록 제한
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);


  // 파일 삭제 (IndexedDB에서)
  const handleDeleteFile = async (file) => {
    if (!window.confirm(`"${file.originalName || file.filename}" 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // IndexedDB에서 파일 삭제
      await deleteFileFromDB(file.id);
      
      // Blob URL 해제
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }

      // 파일 목록에서 제거
      setMediaFiles(mediaFiles.filter(f => f.id !== file.id));
      
      // 타임라인에서도 해당 파일을 사용하는 클립 제거 (path 또는 fileId로 매칭)
      setClips(clips.filter(clip => {
        // path로 매칭
        if (clip.path && clip.path === file.path) {
          return false;
        }
        // fileId로 매칭
        if (clip.fileId && clip.fileId === file.id) {
          return false;
        }
        return true;
      }));
      
      // 선택된 파일이 삭제된 경우 선택 해제
      if (selectedVideo === file.id) {
        setSelectedVideo(null);
      }
      
      alert(`✅ "${file.originalName || file.filename}" 파일이 삭제되었습니다.`);
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      alert('❌ 파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // 파일 업로드 (IndexedDB에 저장)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 초기화 단계 (5%)
      setUploadProgress(5);
      await initDB();
      
      setUploadProgress(10);
      // FFmpeg 초기화는 백그라운드에서 진행 (duration 추출 시 필요할 때만)
      let ffmpegInitialized = false;
      const initFFmpegIfNeeded = async () => {
        if (!ffmpegInitialized) {
          try {
            await initFFmpeg();
            ffmpegInitialized = true;
          } catch (ffmpegError) {
            console.warn('FFmpeg 초기화 실패 (기본 duration 사용):', ffmpegError);
          }
        }
      };

      const uploadedFiles = [];
      const totalFiles = files.length;
      const progressPerFile = 80 / totalFiles; // 10% ~ 90% 구간을 파일 처리에 사용

      // 각 파일을 순차적으로 처리
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileStartProgress = 10 + (i * progressPerFile);
        setUploadProgress(fileStartProgress);

        try {
          // 파일 타입 확인
          let fileType = 'unknown';
          if (file.type.startsWith('video/')) fileType = 'video';
          else if (file.type.startsWith('audio/')) fileType = 'audio';
          else if (file.type.startsWith('image/')) fileType = 'image';

          // Duration 추출 (진행률 업데이트)
          setUploadProgress(fileStartProgress + progressPerFile * 0.2);
          let fileDuration = 0;
          try {
            // FFmpeg 초기화 (필요 시)
            await initFFmpegIfNeeded();
            setUploadProgress(fileStartProgress + progressPerFile * 0.4);
            
            // Duration 추출 (MediaElement 사용 - 더 빠름)
            fileDuration = await getMediaDuration(file);
          } catch (durationError) {
            console.warn('Duration 추출 실패, 기본값 사용:', durationError);
            // 기본값 설정
            if (fileType === 'image') fileDuration = 5;
            else fileDuration = 30;
          }

          // IndexedDB에 저장 (진행률 업데이트)
          setUploadProgress(fileStartProgress + progressPerFile * 0.6);
          const savedFile = await saveFileToDB(file, {
            type: fileType,
            duration: fileDuration
          });

          setUploadProgress(fileStartProgress + progressPerFile * 0.9);

          uploadedFiles.push({
            id: savedFile.id,
            filename: savedFile.filename,
            originalName: savedFile.originalName,
            path: savedFile.url || URL.createObjectURL(new Blob([savedFile.data], { type: savedFile.mimetype })),
            size: savedFile.size,
            type: savedFile.type,
            duration: savedFile.duration,
            mimetype: savedFile.mimetype,
            url: savedFile.url
          });
        } catch (fileError) {
          console.error(`파일 ${file.name} 업로드 실패:`, fileError);
          // 개별 파일 실패해도 계속 진행
        }
      }

      // 파일 목록 새로고침 (90%)
      setUploadProgress(90);
      await loadMediaFiles();
      
      // 업로드된 파일들을 타임라인에 자동 추가
      if (uploadedFiles.length > 0) {
        setClips(prev => {
          let lastEndTime = currentTime;
          const newClips = [];
          let firstVideoClipId = null;
          let maxDuration = duration;

          uploadedFiles.forEach((file) => {
            let trackId = 'video';
            if (file.type === 'audio') trackId = 'audio';
            else if (file.type === 'image') trackId = 'image';
            else if (file.type === 'video') trackId = 'video';

            const newClip = {
              id: Date.now() + Math.random() * 1000,
              trackId,
              startTime: lastEndTime,
              endTime: lastEndTime + (file.duration || 10),
              name: file.originalName || file.filename,
              type: file.type,
              path: file.path,
              fileId: file.id
            };

            newClips.push(newClip);
            lastEndTime = newClip.endTime;
            
            // 비디오인 경우 duration 업데이트 및 첫 번째 비디오 선택
            if (file.type === 'video' && file.duration) {
              maxDuration = Math.max(maxDuration, file.duration);
              if (!firstVideoClipId) {
                firstVideoClipId = newClip.id;
              }
            }
          });

          // duration 업데이트
          if (maxDuration > duration) {
            setDuration(maxDuration);
          }

          // 첫 번째 비디오 클립 선택
          if (firstVideoClipId) {
            setTimeout(() => {
              setSelectedClip(firstVideoClipId);
              const firstVideoFile = uploadedFiles.find(f => f.type === 'video');
              if (firstVideoFile) {
                setSelectedVideo(firstVideoFile.id);
              }
            }, 100);
          }

          return [...prev, ...newClips];
        });
      }
      
      setIsUploading(false);
      setUploadProgress(0);
      alert(`✅ ${uploadedFiles.length}개 파일 업로드 완료!\n타임라인에 자동으로 추가되었습니다.`);
    } catch (error) {
      console.error('업로드 오류:', error);
      setIsUploading(false);
      setUploadProgress(0);
      alert(`❌ 업로드 중 오류가 발생했습니다.\n\n${error.message}`);
    }
  };

  // 파일을 타임라인에 추가
  const addFileToTimeline = (file) => {
    let trackId = 'video';
    if (file.type === 'audio') trackId = 'audio';
    else if (file.type === 'image') trackId = 'image';
    else if (file.type === 'video') trackId = 'video';

    const newClip = {
      id: Date.now(),
      trackId,
      startTime: currentTime,
      endTime: currentTime + (file.duration || 10),
      name: file.originalName || file.filename,
      type: file.type,
      path: file.path,
      fileId: file.id
    };

    setClips(prev => [...prev, newClip]);
    setSelectedClip(newClip.id);
    setSelectedVideo(file.id);
    
    // 비디오인 경우 duration 업데이트
    if (file.type === 'video' && file.duration) {
      setDuration(prev => Math.max(prev, file.duration));
    }
  };

  // 현재 재생 중인 비디오 클립 찾기
  const getCurrentVideoClip = () => {
    const videoClips = clips.filter(c => c.type === 'video' && c.path);
    return videoClips.find(clip => 
      currentTime >= clip.startTime && currentTime < clip.endTime
    ) || videoClips[0];
  };

  // 현재 재생 중인 이미지 클립 찾기 (동영상이 끝난 후에만 표시)
  const getCurrentImageClip = () => {
    const imageClips = clips.filter(c => c.type === 'image' && c.path);
    const videoClips = clips.filter(c => c.type === 'video' && c.path);
    
    // 모든 비디오 클립이 끝났는지 확인
    const allVideosEnded = videoClips.length === 0 || videoClips.every(videoClip => 
      currentTime >= videoClip.endTime
    );
    
    // 비디오가 모두 끝났고, 이미지 클립 시간대에 있으면 표시
    if (allVideosEnded) {
      return imageClips.find(clip => 
        currentTime >= clip.startTime && currentTime < clip.endTime
      );
    }
    
    return null;
  };

  const currentVideoClip = getCurrentVideoClip();
  const currentVideoFile = currentVideoClip 
    ? mediaFiles.find(f => f.id === currentVideoClip.fileId || f.path === currentVideoClip.path)
    : null;

  const currentImageClip = getCurrentImageClip();
  const currentImageFile = currentImageClip 
    ? mediaFiles.find(f => f.id === currentImageClip.fileId || f.path === currentImageClip.path)
    : null;

  const handleLogin = (e) => {
    e.preventDefault();
    setUser({ username: 'testuser', email });
    setCurrentPage('dashboard');
  };

  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (clips.length === 0) {
      alert('⚠️ 먼저 타임라인에 오브젝트를 추가해주세요.');
      return;
    }
    setIsPlaying(!isPlaying);
  };

  // 현재 재생 중인 오디오 클립 찾기
  const getCurrentAudioClip = () => {
    const audioClips = clips.filter(c => c.type === 'audio' && c.path);
    return audioClips.find(clip => 
      currentTime >= clip.startTime && currentTime < clip.endTime
    );
  };

  const currentAudioClip = getCurrentAudioClip();
  const currentAudioFile = currentAudioClip 
    ? mediaFiles.find(f => f.id === currentAudioClip.fileId || f.path === currentAudioClip.path)
    : null;

  // 현재 재생 중인 효과 찾기 (메모이제이션)
  const currentEffects = useMemo(() => {
    return effects.filter(effect => 
      currentTime >= effect.startTime && currentTime < effect.endTime
    );
  }, [effects, currentTime]);

  // 현재 재생 중인 텍스트 찾기 (타임라인 클립 기반, 메모이제이션)
  const currentTexts = useMemo(() => {
    return texts.filter(text => {
      const textClip = clips.find(c => c.type === 'text' && c.textId === text.id);
      if (!textClip) return false;
      return currentTime >= textClip.startTime && currentTime < textClip.endTime;
    });
  }, [texts, clips, currentTime]);

  // 반짝임 효과 파티클 생성 및 업데이트
  const [sparkleParticles, setSparkleParticles] = useState({});
  
  useEffect(() => {
    const sparkleEffects = currentEffects.filter(e => e.type === 'sparkles');
    
    // 파티클이 실제로 변경되었는지 확인
    setSparkleParticles(prevParticles => {
      const newParticles = {};
      let hasChanges = false;
      
      sparkleEffects.forEach(effect => {
        const intensity = (effect.intensity || 50) / 100;
        // 강도에 따라 파티클 개수 조정 (최소 5개, 최대 50개)
        const particleCount = Math.max(5, Math.floor(intensity * 50));
        
        // 파티클이 없거나 개수가 변경되면 새로 생성
        if (!prevParticles[effect.id] || prevParticles[effect.id].length !== particleCount) {
          hasChanges = true;
          newParticles[effect.id] = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 100,
            delay: Math.random() * 0.5, // 지연 시간을 0~0.5초로 줄임 (즉시 표시)
            duration: 0.8 + Math.random() * 0.4, // 0.8~1.2초로 짧게
            opacity: 0.5 + (intensity * 0.5) // 0.5 ~ 1.0
          }));
        } else {
          // 기존 파티클 유지하되, opacity 업데이트
          newParticles[effect.id] = prevParticles[effect.id].map(p => ({
            ...p,
            opacity: 0.5 + (intensity * 0.5)
          }));
          hasChanges = true;
        }
      });
      
      // 더 이상 활성화되지 않은 효과의 파티클 제거
      Object.keys(prevParticles).forEach(effectId => {
        if (!sparkleEffects.find(e => e.id.toString() === effectId)) {
          hasChanges = true;
          // 제거 (newParticles에 추가하지 않음)
        } else if (!newParticles[effectId]) {
          // 기존 파티클이 있으면 유지
          newParticles[effectId] = prevParticles[effectId];
        }
      });
      
      // 변경사항이 없으면 이전 상태 반환 (불필요한 리렌더링 방지)
      if (!hasChanges && Object.keys(newParticles).length === Object.keys(prevParticles).length) {
        return prevParticles;
      }
      
      return newParticles;
    });
  }, [currentEffects]);

  // 비디오 재생 제어 (반복 재생 지원)
  useEffect(() => {
    if (videoRef.current && currentVideoFile && currentVideoClip) {
      const video = videoRef.current;
      const clipStart = currentVideoClip.startTime;
      const clipEnd = currentVideoClip.endTime;
      const clipDuration = clipEnd - clipStart;
      const relativeTime = currentTime - clipStart;
      
      // 비디오 파일의 실제 길이
      const videoDuration = video.duration || currentVideoFile.duration || clipDuration;
      
      // 클립이 끝났으면 비디오만 멈추고, 전체 재생은 duration까지 계속
      if (currentTime >= clipEnd) {
        video.pause();
        video.currentTime = Math.min(videoDuration, clipDuration);
        return;
      }
      
      // 클립 길이가 비디오 길이보다 길면 반복 재생
      let videoTime = relativeTime;
      if (videoDuration > 0 && clipDuration > videoDuration) {
        videoTime = relativeTime % videoDuration;
      } else {
        videoTime = Math.min(relativeTime, videoDuration);
      }
      
      if (isPlaying) {
        if (Math.abs(video.currentTime - videoTime) > 0.5) {
          video.currentTime = Math.max(0, videoTime);
        }
        video.play().catch(err => {
          console.error('비디오 재생 오류:', err);
        });
      } else {
        video.pause();
        video.currentTime = Math.max(0, videoTime);
      }
    } else if (videoRef.current && !currentVideoClip) {
      // 비디오 클립이 없으면 비디오만 일시정지 (전체 재생은 계속)
      videoRef.current.pause();
    }
  }, [isPlaying, currentTime, currentVideoFile, currentVideoClip]);

  // 오디오 재생 제어 (반복 재생 지원)
  useEffect(() => {
    if (audioRef.current && currentAudioFile && currentAudioClip) {
      const audio = audioRef.current;
      const clipStart = currentAudioClip.startTime;
      const clipEnd = currentAudioClip.endTime;
      const clipDuration = clipEnd - clipStart;
      const relativeTime = currentTime - clipStart;
      
      // 오디오 파일의 실제 길이
      const audioDuration = audio.duration || currentAudioFile.duration || clipDuration;
      
      // 클립이 끝났으면 오디오만 멈추고, 전체 재생은 duration까지 계속
      if (currentTime >= clipEnd) {
        audio.pause();
        audio.currentTime = Math.min(audioDuration, clipDuration);
        return;
      }
      
      // 클립 길이가 오디오 길이보다 길면 반복 재생
      let audioTime = relativeTime;
      if (audioDuration > 0 && clipDuration > audioDuration) {
        audioTime = relativeTime % audioDuration;
      } else {
        audioTime = Math.min(relativeTime, audioDuration);
      }
      
      if (isPlaying) {
        if (Math.abs(audio.currentTime - audioTime) > 0.5) {
          audio.currentTime = Math.max(0, audioTime);
        }
        audio.play().catch(err => {
          console.error('오디오 재생 오류:', err);
        });
      } else {
        audio.pause();
        audio.currentTime = Math.max(0, audioTime);
      }
    } else if (audioRef.current && !currentAudioClip) {
      // 오디오 클립이 없으면 오디오만 일시정지 (전체 재생은 계속)
      audioRef.current.pause();
    }
  }, [isPlaying, currentTime, currentAudioFile, currentAudioClip]);

  const addText = () => {
    if (newTextContent.trim()) {
      const newText = {
        id: Date.now(),
        content: newTextContent,
        x: 100,
        y: 200,
        fontSize: 32,
        color: '#FFFFFF',
        fontFamily: 'Arial'
      };
      setTexts([...texts, newText]);
      
      // 타임라인에 텍스트 클립 추가
      const textClip = {
        id: Date.now() + 1,
        trackId: 'text',
        startTime: currentTime,
        endTime: Math.min(currentTime + 10, duration),
        name: newTextContent,
        type: 'text',
        textId: newText.id
      };
      setClips([...clips, textClip]);
      
      setNewTextContent('');
      setShowTextInput(false);
      setSelectedText(newText.id);
      setSelectedClip(textClip.id);
    }
  };

  const updateText = (id, updates) => {
    setTexts(texts.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteText = (id) => {
    setTexts(texts.filter(t => t.id !== id));
    // 관련된 타임라인 클립도 삭제
    setClips(clips.filter(c => !(c.type === 'text' && c.textId === id)));
    setSelectedText(null);
  };

  // 원격 서버 연결 테스트
  const testRemoteServer = async () => {
    if (!remoteServerConfig.url) {
      alert('⚠️ 원격 서버 URL을 입력해주세요.');
      return;
    }

    setRemoteServerTesting(true);
    try {
      // 원격 서버가 헬스 체크 엔드포인트를 제공한다고 가정
      const testUrl = `${remoteServerConfig.url}/api/health`;
      const headers = {};
      
      if (remoteServerConfig.apiKey) {
        headers['Authorization'] = `Bearer ${remoteServerConfig.apiKey}`;
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        alert('✅ 원격 서버 연결 성공!');
        setRemoteServerConfig({ ...remoteServerConfig, enabled: true });
      } else {
        alert(`❌ 원격 서버 연결 실패: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('원격 서버 테스트 오류:', error);
      // 연결 실패해도 업로드는 시도할 수 있도록 경고만 표시
      const proceed = confirm('⚠️ 원격 서버 연결 테스트 실패했습니다.\n그래도 업로드를 활성화하시겠습니까?');
      if (proceed) {
        setRemoteServerConfig({ ...remoteServerConfig, enabled: true });
      }
    } finally {
      setRemoteServerTesting(false);
    }
  };

  // 원격 서버에 파일 업로드
  const uploadToRemoteServer = async (file, originalName) => {
    if (!remoteServerConfig.enabled || !remoteServerConfig.url) {
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('file', file, originalName);

      const headers = {};
      if (remoteServerConfig.apiKey) {
        headers['Authorization'] = `Bearer ${remoteServerConfig.apiKey}`;
      }

      const uploadUrl = `${remoteServerConfig.url}/api/upload`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        console.log('원격 서버 업로드 성공:', data);
        return data;
      } else {
        const errorData = await response.json().catch(() => ({ error: '업로드 실패' }));
        console.error('원격 서버 업로드 실패:', errorData);
        return null;
      }
    } catch (error) {
      console.error('원격 서버 업로드 오류:', error);
      return null;
    }
  };

  const handleExport = async () => {
    if (clips.length === 0) {
      alert('⚠️ 타임라인에 클립이 없습니다.');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    
    try {
      // FFmpeg 초기화
      await initFFmpeg((progress) => {
        setExportProgress(progress);
      });

      // 클립에서 파일 가져오기 (IndexedDB에서)
      const clipsWithFiles = await Promise.all(
        clips.map(async (clip) => {
          if (clip.fileId) {
            const fileData = await getFileFromDB(clip.fileId);
            if (fileData && fileData.file) {
              return {
                ...clip,
                file: fileData.file
              };
            }
          }
          // fileId가 없거나 파일을 찾을 수 없는 경우
          return clip;
        })
      );

      // 파일이 있는 클립만 필터링
      const validClips = clipsWithFiles.filter(clip => clip.file);
      
      if (validClips.length === 0) {
        throw new Error('내보낼 수 있는 파일이 없습니다. 파일을 다시 업로드해주세요.');
      }

      // 내보내기 실행
      const blob = await exportVideo({
        clips: validClips,
        texts,
        effects,
        duration
      }, (progress) => {
        setExportProgress(progress);
      });

      // 다운로드
      const filename = `output-${Date.now()}.mp4`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsExporting(false);
      setExportProgress(100);
      
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      alert(`✅ 비디오 내보내기 완료!\n파일: ${filename}\n크기: ${sizeMB}MB`);
    } catch (error) {
      console.error('내보내기 오류:', error);
      setIsExporting(false);
      setExportProgress(0);
      alert(`❌ 비디오 내보내기 중 오류가 발생했습니다.\n\n${error.message}\n\n브라우저 개발자 도구(F12) > Console 탭에서 상세 오류를 확인할 수 있습니다.`);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 타임라인 함수들
  const addClip = (trackId, type) => {
    const newClip = {
      id: Date.now(),
      trackId,
      startTime: currentTime,
      endTime: Math.min(currentTime + 10, duration),
      name: type === 'video' ? '새 비디오' : type === 'audio' ? '새 오디오' : type === 'image' ? '새 이미지' : type === 'text' ? '새 텍스트' : '새 효과',
      type
    };
    setClips([...clips, newClip]);
    setSelectedClip(newClip.id);
  };

  const deleteClip = (clipId) => {
    const clip = clips.find(c => c.id === clipId);
    // 그래픽 효과 클립이면 관련 효과도 삭제
    if (clip && clip.type === 'graphics' && clip.effectId) {
      // effectId로 정확히 매칭하여 삭제
      setEffects(prev => prev.filter(e => e.id !== clip.effectId));
      if (selectedEffect === clip.effectId) setSelectedEffect(null);
    }
    setClips(prev => prev.filter(c => c.id !== clipId));
    if (selectedClip === clipId) setSelectedClip(null);
  };

  const updateClip = (clipId, updates) => {
    setClips(prevClips => prevClips.map(c => c.id === clipId ? { ...c, ...updates } : c));
  };

  const handleClipDrag = (clipId, newStartTime) => {
    setClips(prevClips => {
      const clip = prevClips.find(c => c.id === clipId);
      if (!clip) return prevClips;
      
      const clipDuration = clip.endTime - clip.startTime;
      
      // 스냅 가이드 찾기
      const snapTime = findSnapGuide(newStartTime, 1.0, clipId);
      const finalStartTime = snapTime !== null ? snapTime : newStartTime;
      
      const clampedStart = Math.max(0, Math.min(finalStartTime, duration - clipDuration));
      
      const updatedClips = prevClips.map(c => 
        c.id === clipId 
          ? { ...c, startTime: clampedStart, endTime: clampedStart + clipDuration }
          : c
      );
      
      // 그래픽 효과 클립인 경우 effects 배열도 업데이트
      if (clip.type === 'graphics' && clip.effectId) {
        setEffects(prevEffects => prevEffects.map(e => {
          // effectId로 정확히 매칭
          if (e.id === clip.effectId) {
            return {
              ...e,
              startTime: clampedStart,
              endTime: clampedStart + clipDuration
            };
          }
          return e;
        }));
      }
      
      return updatedClips;
    });
  };

  const handleClipResize = (clipId, side, newTime) => {
    setClips(prevClips => {
      const clip = prevClips.find(c => c.id === clipId);
      if (!clip) return prevClips;
      
      // 최소 길이 제한 (0.5초)
      const minDuration = 0.5;
      
      // 스냅 가이드 찾기
      const snapTime = findSnapGuide(newTime, 1.0, clipId);
      let finalTime = snapTime !== null ? snapTime : newTime;
      
      let updatedClips;
      let newStartTime = clip.startTime;
      let newEndTime = clip.endTime;
      
      if (side === 'left') {
        // 왼쪽 리사이즈: startTime 변경, endTime은 유지
        const maxStart = clip.endTime - minDuration;
        const clampedStart = Math.max(0, Math.min(finalTime, maxStart));
        newStartTime = clampedStart;
        updatedClips = prevClips.map(c => 
          c.id === clipId ? { ...c, startTime: clampedStart } : c
        );
      } else {
        // 오른쪽 리사이즈: endTime 변경, startTime은 유지
        const minEnd = clip.startTime + minDuration;
        const clampedEnd = Math.max(minEnd, Math.min(finalTime, duration));
        newEndTime = clampedEnd;
        updatedClips = prevClips.map(c => 
          c.id === clipId ? { ...c, endTime: clampedEnd } : c
        );
      }
      
      // 그래픽 효과 클립인 경우 effects 배열도 업데이트
      if (clip.type === 'graphics' && clip.effectId) {
        setEffects(prevEffects => prevEffects.map(e => {
          // effectId로 정확히 매칭
          if (e.id === clip.effectId) {
            return {
              ...e,
              startTime: newStartTime,
              endTime: newEndTime
            };
          }
          return e;
        }));
      }
      
      return updatedClips;
    });
  };

  const getClipsForTrack = (trackId) => {
    return clips.filter(c => c.trackId === trackId).sort((a, b) => a.startTime - b.startTime);
  };

  const pixelsPerSecond = 20 * timelineZoom;
  
  // 타임라인 눈금 고정 간격 (초 단위) - duration과 무관하게 고정
  const TIMELINE_GRID_INTERVAL = 5; // 5초 간격으로 고정
  const TIMELINE_MAX_DISPLAY = 300; // 최대 300초(5분)까지 표시
  
  // 타임라인 너비는 고정 (duration과 무관하게 최소 300초 기준)
  // duration이 더 길면 duration 기준으로, 짧으면 최소 300초 기준
  const timelineWidth = Math.max(duration, TIMELINE_MAX_DISPLAY) * pixelsPerSecond;

  const handleTimelineClick = (e) => {
    if (isDraggingPlayhead) return;
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollContainer = e.currentTarget.closest('.overflow-x-auto');
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const x = e.clientX - rect.left + scrollLeft - 128; // 트랙 헤더 너비 제외
    const newTime = Math.max(0, Math.min((x / pixelsPerSecond), duration));
    setCurrentTime(newTime);
  };

  // 타임라인 드래그로 재생 헤드 이동
  const handleTimelineMouseDown = (e) => {
    // 재생 헤드나 클립을 클릭한 경우는 제외
    if (e.target.closest('.cursor-ew-resize') || e.target.closest('.absolute.top-0.bottom-0')) {
      return;
    }
    
    if (!timelineRef.current) return;
    setIsDraggingPlayhead(true);
    setIsPlaying(false);
    
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollContainer = timelineRef.current.closest('.overflow-x-auto');
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const x = e.clientX - rect.left + scrollLeft - 128;
    const newTime = Math.max(0, Math.min((x / pixelsPerSecond), duration));
    setCurrentTime(newTime);
    
    const handleMouseMove = (e2) => {
      if (!timelineRef.current) return;
      const rect2 = timelineRef.current.getBoundingClientRect();
      const scrollContainer2 = timelineRef.current.closest('.overflow-x-auto');
      const scrollLeft2 = scrollContainer2 ? scrollContainer2.scrollLeft : 0;
      const x2 = e2.clientX - rect2.left + scrollLeft2 - 128;
      const newTime2 = Math.max(0, Math.min((x2 / pixelsPerSecond), duration));
      setCurrentTime(newTime2);
    };
    
    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
  };

  // 스냅 가이드 찾기 함수 (더 강력한 스냅)
  const findSnapGuide = (time, threshold = 1.0, excludeClipId = null) => {
    const allTimes = [];
    clips.forEach(clip => {
      // 현재 드래그 중인 클립은 제외
      if (clip.id !== excludeClipId) {
        allTimes.push(clip.startTime);
        allTimes.push(clip.endTime);
      }
    });
    
    // 가장 가까운 스냅 포인트 찾기
    let closestTime = null;
    let minDistance = threshold;
    
    for (const snapTime of allTimes) {
      const distance = Math.abs(time - snapTime);
      if (distance < minDistance) {
        minDistance = distance;
        closestTime = snapTime;
      }
    }
    
    return closestTime;
  };

  // duration 자동 업데이트 (가장 마지막 클립의 endTime 기준)
  useEffect(() => {
    if (clips.length === 0) {
      setDuration(150); // 기본값
      return;
    }
    
    const maxEndTime = Math.max(...clips.map(clip => clip.endTime));
    // 최소 5초, 클립 길이에 정확히 맞춤 (올림 제거, 정확한 값 사용)
    // 0.1초 단위로 반올림하여 정확한 길이 표시
    const newDuration = Math.max(5, Math.round(maxEndTime * 10) / 10);
    // duration을 항상 업데이트 (클립이 짧아져도 반영)
    setDuration(newDuration);
  }, [clips]); // eslint-disable-line react-hooks/exhaustive-deps

  // 토스트 팝업 표시 함수
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3000); // 3초 후 자동으로 사라짐
  };

  // 효과 추가 함수
  const addEffect = (effectType) => {
    // 줌, 페이드, 블러는 프로토타입에서 구현되지 않음
    if (effectType === 'zoom' || effectType === 'fade' || effectType === 'blur') {
      const effectName = effectType === 'zoom' ? '줌' : effectType === 'fade' ? '페이드' : '블러';
      showToast(`${effectName} 기능은 프로토타입에서는 구현되지 않습니다.`);
      return;
    }
    
    const effectId = Date.now();
    const newEffect = {
      id: effectId,
      type: effectType,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      name: effectType === 'sparkles' ? '반짝임' : effectType === 'zoom' ? '줌' : effectType === 'fade' ? '페이드' : '블러',
      intensity: 50,
      color: '#ffffff'
    };
    setEffects(prev => [...prev, newEffect]);
    
    // 타임라인에도 클립 추가 (각 효과마다 독립적인 클립 생성)
    const graphicsTrack = tracks.find(t => t.id === 'graphics');
    if (graphicsTrack) {
      const newClip = {
        id: effectId + 1, // 효과 ID와 다른 고유 ID 사용
        trackId: graphicsTrack.id,
        startTime: currentTime,
        endTime: Math.min(currentTime + 5, duration),
        name: `${newEffect.name} (${effects.filter(e => e.type === effectType).length + 1})`,
        type: 'graphics',
        effectType: effectType,
        effectId: effectId // 효과 ID를 클립에 저장하여 정확히 매칭
      };
      setClips(prev => [...prev, newClip]);
      setSelectedClip(newClip.id);
      setSelectedEffect(effectId);
    }
  };

  const deleteEffect = (effectId) => {
    // effectId로 정확히 매칭하여 관련 타임라인 클립도 삭제
    setClips(prev => prev.filter(c => !(c.type === 'graphics' && c.effectId === effectId)));
    setEffects(prev => prev.filter(e => e.id !== effectId));
    if (selectedEffect === effectId) setSelectedEffect(null);
    if (selectedClip && clips.find(c => c.id === selectedClip && c.effectId === effectId)) {
      setSelectedClip(null);
    }
  };

  const updateEffect = (effectId, updates) => {
    setEffects(effects.map(e => e.id === effectId ? { ...e, ...updates } : e));
  };

  if (currentPage === 'login') {
    return (
      <div 
        className="fixed inset-0 min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4"
        style={{ 
          zIndex: 99999,
          pointerEvents: 'auto',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        }}
        onClick={(e) => {
          // 배경 클릭은 무시
          e.stopPropagation();
        }}
      >
        <div 
          className="max-w-md w-full"
          style={{ 
            zIndex: 100000,
            pointerEvents: 'auto',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8"
            style={{ 
              zIndex: 100001,
              pointerEvents: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-8">
              <div className="inline-block bg-gradient-to-br from-blue-500 to-purple-600 text-white p-4 rounded-lg mb-4">
                <Play size={32} />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">🎬 비디오 에디터</h1>
              <p className="text-gray-600 mt-2 text-lg">캔바 같은 비디오 편집</p>
            </div>

            <form 
              onSubmit={handleLogin} 
              className="space-y-4 mb-6"
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  style={{ pointerEvents: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  style={{ pointerEvents: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition text-lg cursor-pointer"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogin(e);
                }}
              >
                로그인
              </button>
            </form>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">💡 데모 계정으로 로그인하세요:</p>
              <div className="text-sm font-mono text-gray-800 space-y-1">
                <p>📧 demo@example.com</p>
                <p>🔑 demo1234</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
            <Play size={24} className="fill-white" />
          </div>
          <h1 className="text-2xl font-bold">🎬 비디오 에디터</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">👤 {user?.username}</span>
          <button onClick={() => { setCurrentPage('login'); setUser(null); }} className="text-sm text-red-400 hover:text-red-300 font-medium transition">
            로그아웃
          </button>
        </div>
      </div>

      {/* 왼쪽 패널 */}
      <div 
        className="bg-gray-800 border-r border-gray-700 overflow-y-auto mt-16 p-4 shadow-inner"
        style={{ width: `${leftPanelWidth}px` }}
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">📁 미디어 라이브러리</h2>
        
        {/* 서버 연결 상태 표시 */}
        {!serverConnected && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
            <p className="text-xs text-red-200 font-semibold mb-2">⚠️ 서버 연결 실패</p>
            <p className="text-xs text-red-300 mb-2">서버가 실행 중이 아닙니다.</p>
            <p className="text-xs text-red-300 mb-2">터미널에서 다음 명령어를 실행하세요:</p>
            <p className="text-xs text-red-200 font-mono bg-red-950 p-2 rounded mb-2">
              npm run dev:server
            </p>
            <button
              onClick={checkServerConnection}
              className="w-full px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs font-semibold transition"
            >
              다시 연결 시도
        </button>
          </div>
        )}
        
        {/* 파일 업로드 버튼 */}
        <label className={`w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-lg transition flex items-center justify-center gap-2 mb-4 font-semibold shadow ${!serverConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <Upload size={18} />
          <span>{isUploading ? `업로드 중... ${Math.round(uploadProgress)}%` : '파일 업로드'}</span>
          <input
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading || !serverConnected}
          />
        </label>

        {isUploading && (
          <div className="mb-4">
            <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 업로드된 파일 목록 */}
        <div className="space-y-2">
          {mediaFiles.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-sm">업로드된 파일이 없습니다</p>
              <p className="text-xs mt-2">비디오, 오디오, 이미지를 업로드하세요</p>
            </div>
          ) : (
            mediaFiles.map(file => {
              const fileIcon = file.type === 'video' ? '📹' : file.type === 'audio' ? '🎵' : '🖼️';
              const fileSize = (file.size / 1024 / 1024).toFixed(2) + 'MB';
              const fileDuration = formatTime(file.duration || 0);
              
              return (
                <div 
                  key={file.id} 
                  className={`p-3 rounded-lg transition transform cursor-pointer ${
                    selectedVideo === file.id 
                      ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-105' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedVideo(file.id)}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <p className="text-sm font-bold flex items-start gap-1 flex-1 min-w-0">
                      <span className="flex-shrink-0">{fileIcon}</span>
                      <span className="break-words break-all">{file.originalName || file.filename}</span>
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file);
                      }}
                      className="p-1 hover:bg-red-600 rounded transition flex-shrink-0"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 mb-2">{fileSize} • {fileDuration}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addFileToTimeline(file);
                    }}
                    className="w-full px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold transition"
                  >
                    타임라인에 추가
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 왼쪽 리사이즈 핸들 */}
      <div
        className="w-1 bg-gray-700 hover:bg-indigo-500 cursor-ew-resize transition-colors mt-16"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizingLeft(true);
        }}
        style={{ minHeight: 'calc(100vh - 64px)' }}
      />

      <div className="flex-1 flex flex-col bg-gray-950 mt-16 overflow-hidden" style={{ minWidth: 0 }}>
        <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden p-6" style={{ minHeight: 0 }}>
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 rounded-lg overflow-hidden flex items-center justify-center shadow-2xl border-4 border-gray-700" 
                 style={{ 
                   width: 'min(90%, 1280px)', 
                   aspectRatio: '16/9',
                   maxHeight: 'calc(100vh - 200px)'
                 }}>
              {/* 편집 유도 UI - 오브젝트가 없을 때 */}
              {clips.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-900 bg-opacity-80">
                  <div className="text-center p-8">
                    <Video size={64} className="mx-auto mb-4 text-gray-400" />
                    <h3 className="text-2xl font-bold text-white mb-2">패널에서 파일을 업로드하여 편집을 시작하세요</h3>
                    <div className="flex flex-col gap-2 text-sm text-gray-300">
                      <p>📹 비디오 파일 업로드</p>
                      <p>🎵 오디오 트랙 추가</p>
                      <p>✏️ 텍스트 오버레이</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 실제 비디오 재생 */}
              {currentVideoFile && currentVideoFile.type === 'video' && (() => {
                // 현재 활성화된 효과에 따른 비디오 스타일 계산
                const zoomEffect = currentEffects.find(e => e.type === 'zoom' && currentTime >= e.startTime && currentTime < e.endTime);
                const fadeEffect = currentEffects.find(e => e.type === 'fade' && currentTime >= e.startTime && currentTime < e.endTime);
                const blurEffect = currentEffects.find(e => e.type === 'blur' && currentTime >= e.startTime && currentTime < e.endTime);
                
                let videoStyle = {
                  transform: '',
                  opacity: 1,
                  filter: '',
                  transformOrigin: 'center center'
                };
                
                if (zoomEffect) {
                  const effectDuration = zoomEffect.endTime - zoomEffect.startTime;
                  const effectProgress = effectDuration > 0 
                    ? Math.max(0, Math.min(1, (currentTime - zoomEffect.startTime) / effectDuration))
                    : 0;
                  const intensity = (zoomEffect.intensity || 50) / 100;
                  // 줌 효과: 시작 시 1.0에서 끝날 때 (1.0 + intensity * 0.5)까지 확대
                  const scale = 1.0 + (intensity * 0.5 * effectProgress);
                  videoStyle.transform = `scale(${scale})`;
                }
                
                if (fadeEffect) {
                  const effectDuration = fadeEffect.endTime - fadeEffect.startTime;
                  const effectProgress = effectDuration > 0
                    ? Math.max(0, Math.min(1, (currentTime - fadeEffect.startTime) / effectDuration))
                    : 0;
                  const intensity = (fadeEffect.intensity || 50) / 100;
                  // 페이드 효과: 페이드 인/아웃 (시작과 끝에서 투명, 중간에서 불투명)
                  // 효과의 처음 30%와 마지막 30%에서 페이드 처리
                  let opacity = 1.0;
                  if (effectProgress < 0.3) {
                    // 페이드 인: 0 → 1 (처음 30%)
                    opacity = effectProgress / 0.3;
                  } else if (effectProgress > 0.7) {
                    // 페이드 아웃: 1 → 0 (마지막 30%)
                    opacity = (1 - effectProgress) / 0.3;
                  }
                  // intensity에 따라 최소 opacity 조정 (0.1 ~ 1.0)
                  const minOpacity = 0.1 + (intensity * 0.9);
                  opacity = Math.max(minOpacity * opacity, 0.1);
                  videoStyle.opacity = Math.max(0.1, Math.min(1, opacity));
                }
                
                if (blurEffect) {
                  const intensity = (blurEffect.intensity || 50) / 100;
                  // 블러 효과: intensity에 따라 0~10px 블러
                  const blur = intensity * 10;
                  videoStyle.filter = `blur(${blur}px)`;
                }
                
                return (
                  <video
                    key={currentVideoFile.id || currentVideoFile.path}
                    ref={videoRef}
                    src={currentVideoFile.url || currentVideoFile.path}
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{
                      ...videoStyle,
                      transition: 'transform 0.1s ease-out, opacity 0.1s ease-out, filter 0.1s ease-out'
                    }}
                    controls={false}
                    muted={false}
                    loop={false}
                  onLoadedMetadata={(e) => {
                    if (currentVideoClip) {
                      const clipStart = currentVideoClip.startTime;
                      const videoTime = Math.max(0, currentTime - clipStart);
                      if (videoTime < e.target.duration) {
                        e.target.currentTime = videoTime;
                      }
                    }
                  }}
                  onTimeUpdate={(e) => {
                    if (isPlaying && currentVideoClip && !e.target.paused) {
                      const clipStart = currentVideoClip.startTime;
                      const clipEnd = currentVideoClip.endTime;
                      const videoDuration = e.target.duration || 0;
                      const videoTime = e.target.currentTime;
                      
                      // 반복 재생: 클립 길이가 비디오 길이보다 길면 반복
                      if (videoDuration > 0 && (clipEnd - clipStart) > videoDuration) {
                        // 반복 재생 중이므로 계속 재생
                        const relativeTime = currentTime - clipStart;
                        const loopedTime = relativeTime % videoDuration;
                        if (Math.abs(videoTime - loopedTime) > 0.5) {
                          e.target.currentTime = loopedTime;
                        }
                        setCurrentTime(Math.min(clipStart + relativeTime, duration));
                      } else {
                        // 일반 재생 - 클립이 끝나면 비디오만 멈추고, 전체 재생은 계속
                        const absoluteTime = clipStart + videoTime;
                        if (absoluteTime >= clipEnd) {
                          e.target.pause();
                          // 전체 재생은 계속되므로 setIsPlaying(false) 제거
                        } else if (Math.abs(absoluteTime - currentTime) < 1) {
                          setCurrentTime(Math.min(absoluteTime, duration));
                        }
                      }
                    }
                  }}
                  onEnded={() => {
                    // 반복 재생을 위해 onEnded는 처리하지 않음
                    // useEffect에서 반복 재생 처리
                  }}
                  />
                );
              })()}

              {/* 오디오 재생 (숨김) */}
              {currentAudioFile && currentAudioFile.type === 'audio' && (
                <audio
                  key={currentAudioFile.id || currentAudioFile.path}
                  ref={audioRef}
                  src={currentAudioFile.url || currentAudioFile.path}
                  onLoadedMetadata={(e) => {
                    if (currentAudioClip) {
                      const clipStart = currentAudioClip.startTime;
                      const audioTime = Math.max(0, currentTime - clipStart);
                      if (audioTime < e.target.duration) {
                        e.target.currentTime = audioTime;
                      }
                    }
                  }}
                  onTimeUpdate={(e) => {
                    if (isPlaying && currentAudioClip && !e.target.paused) {
                      const clipStart = currentAudioClip.startTime;
                      const clipEnd = currentAudioClip.endTime;
                      const audioDuration = e.target.duration || 0;
                      const audioTime = e.target.currentTime;
                      
                      // 반복 재생: 클립 길이가 오디오 길이보다 길면 반복
                      if (audioDuration > 0 && (clipEnd - clipStart) > audioDuration) {
                        // 반복 재생 중이므로 계속 재생
                        const relativeTime = currentTime - clipStart;
                        const loopedTime = relativeTime % audioDuration;
                        if (Math.abs(audioTime - loopedTime) > 0.5) {
                          e.target.currentTime = loopedTime;
                        }
                      } else {
                        // 일반 재생
                        const absoluteTime = clipStart + audioTime;
                        if (absoluteTime >= clipEnd) {
                          e.target.pause();
                        }
                      }
                    }
                  }}
                  onEnded={() => {
                    // 반복 재생을 위해 onEnded는 처리하지 않음
                    // useEffect에서 반복 재생 처리
                  }}
                />
              )}

              {/* 이미지 표시 - 비디오 뒤에 배경으로 표시 */}
              {currentImageFile && currentImageFile.type === 'image' && (
                <img
                  key={currentImageFile.id || currentImageFile.path}
                  src={currentImageFile.url || currentImageFile.path}
                  alt={currentImageFile.originalName}
                  className="absolute inset-0 w-full h-full object-contain z-0"
                  style={{ zIndex: 1 }}
                />
              )}

              {/* 그래픽 효과 적용 - sparkles만 오버레이로 표시 (zoom, fade, blur는 비디오 요소에 직접 적용) */}
              {currentEffects.filter(e => e.type === 'sparkles').map(effect => {
                return (
                  <div
                    key={effect.id}
                    className="absolute inset-0 pointer-events-none sparkles-effect"
                    style={{
                      zIndex: 15
                    }}
                  />
                );
              })}

              {/* 반짝임 효과 파티클 */}
              {currentEffects.filter(e => e.type === 'sparkles').map(effect => {
                const particles = sparkleParticles[effect.id] || [];
                return (
                  <div
                    key={`sparkles-${effect.id}`}
                    className="absolute inset-0 pointer-events-none"
                    style={{ zIndex: 16 }}
                  >
                    {particles.map(particle => {
                      const intensity = (effect.intensity || 50) / 100;
                      // 강도에 따라 파티클 크기와 밝기 조정
                      const size = 2 + (intensity * 3); // 2px ~ 5px
                      const brightness = 0.5 + (intensity * 0.5); // 0.5 ~ 1.0
                      return (
                        <div
                          key={`${effect.id}-${particle.id}`}
                          className="absolute bg-white rounded-full"
                          style={{
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            width: `${size}px`,
                            height: `${size}px`,
                            opacity: particle.opacity * brightness,
                            boxShadow: `0 0 ${size * 2}px rgba(255, 255, 255, ${brightness})`,
                            animation: `sparklePulse ${particle.duration}s ease-in-out ${particle.delay}s infinite`
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {/* 텍스트 오버레이 - 타임라인 클립 시간 범위 내에서만 표시 */}
              {currentTexts.map(text => {
                const isSelected = selectedText === text.id;
                const isEditing = editingTextId === text.id;
                
                return (
                  <div 
                    key={text.id} 
                    className={`absolute transition font-bold ${
                      isSelected && !isEditing ? 'ring-2 ring-yellow-400 bg-yellow-400 bg-opacity-10' : ''
                    } ${isEditing ? 'cursor-text' : 'cursor-move'}`}
                    style={{
                  left: `${text.x}px`,
                  top: `${text.y}px`,
                  fontSize: `${text.fontSize}px`,
                  color: text.color,
                  fontFamily: text.fontFamily,
                  textShadow: '3px 3px 6px rgba(0,0,0,0.9)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                      zIndex: 20,
                      outline: 'none'
                    }}
                    onClick={() => {
                      if (!isEditing && !isDraggingText) {
                        setSelectedText(text.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTextId(text.id);
                      setSelectedText(text.id);
                    }}
                    onMouseDown={(e) => {
                      if (isEditing) return;
                      
                      e.stopPropagation();
                      setIsDraggingText(true);
                      setSelectedText(text.id);
                      
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startTextX = text.x;
                      const startTextY = text.y;
                      const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
                      
                      const handleMouseMove = (e2) => {
                        const deltaX = e2.clientX - startX;
                        const deltaY = e2.clientY - startY;
                        const newX = Math.max(0, Math.min(startTextX + deltaX, parentRect.width - 100));
                        const newY = Math.max(0, Math.min(startTextY + deltaY, parentRect.height - 40));
                  updateText(text.id, { x: newX, y: newY });
                      };
                      
                      const handleMouseUp = () => {
                        setIsDraggingText(false);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                      document.body.style.cursor = 'grabbing';
                      document.body.style.userSelect = 'none';
                    }}
                    contentEditable={isEditing}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const newContent = e.target.textContent || '';
                      if (newContent.trim()) {
                        updateText(text.id, { content: newContent });
                        // 타임라인 클립 이름도 업데이트
                        const textClip = clips.find(c => c.type === 'text' && c.textId === text.id);
                        if (textClip) {
                          updateClip(textClip.id, { name: newContent });
                        }
                      }
                      setEditingTextId(null);
                    }}
                    onKeyDown={(e) => {
                      if (isEditing && e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.target.blur();
                      }
                      if (isEditing && e.key === 'Escape') {
                        e.target.textContent = text.content;
                        e.target.blur();
                      }
                    }}
                  >
                  {text.content}
                </div>
                );
              })}

              {/* 재생 버튼 - 비디오가 업로드되고 일시정지 중일 때만 표시 */}
              {currentVideoFile && !isPlaying && (
                <button 
                  onClick={togglePlay} 
                  className="absolute text-white rounded-full p-6 transition transform hover:scale-110 shadow-lg z-30 backdrop-blur-sm"
                  style={{ 
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <Play size={48} className="fill-white" />
                </button>
              )}

              {/* 시간 표시 */}
              <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-300 text-center z-30 bg-black bg-opacity-50 px-4 py-2 rounded">
                프리뷰: {formatTime(currentTime)} / {formatTime(duration)}
                {currentVideoClip && (
                  <span className="ml-2 text-gray-400">
                    ({currentVideoClip.name})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border-t border-gray-700 shadow-lg flex flex-col flex-shrink-0" style={{ maxHeight: '40vh', minHeight: '200px' }}>
          {/* 타임라인 UI */}
          <div className="border-b border-gray-700 bg-gray-900 flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-300">타임라인</h3>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.25))}
                    className="p-1 hover:bg-gray-700 rounded transition"
                    title="줌 아웃"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs text-gray-400 px-2">{Math.round(timelineZoom * 100)}%</span>
                  <button 
                    onClick={() => setTimelineZoom(Math.min(3, timelineZoom + 0.25))}
                    className="p-1 hover:bg-gray-700 rounded transition"
                    title="줌 인"
                  >
                    <ZoomIn size={16} />
                  </button>
            </div>
              </div>
              <div className="text-xs text-gray-400">
                {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

            <div 
              className={`flex-1 overflow-x-auto ${tracks.length * 48 > 300 ? 'overflow-y-auto' : ''}`}
              style={{ minHeight: 0 }}
            >
              <div className="flex" style={{ minWidth: `${timelineWidth + 128}px` }}>
                {/* 시간 스케일 */}
                <div className="w-32 bg-gray-800 border-r border-gray-700 flex-shrink-0 sticky left-0 z-20">
                  <div className="h-8 border-b border-gray-700"></div>
                </div>
                <div className="relative" style={{ width: `${timelineWidth}px` }}>
                  {/* 시간 마커 */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-gray-800 border-b border-gray-700 z-10">
                    {/* 고정 간격 눈금 (5초 단위) - 타임라인 전체에 고정 표시 */}
                    {Array.from({ length: Math.ceil(TIMELINE_MAX_DISPLAY / TIMELINE_GRID_INTERVAL) + 1 }, (_, i) => {
                      const sec = i * TIMELINE_GRID_INTERVAL;
                      
                      return (
                        <div
                          key={sec}
                          className="absolute border-l-2 border-gray-500"
                          style={{ left: `${sec * pixelsPerSecond}px`, height: '100%' }}
                        >
                          <span className="absolute top-1 left-1 text-xs text-gray-400">{formatTime(sec)}</span>
                        </div>
                      );
                    })}
                    
                    {/* 1초 단위 얇은 선 (타임라인 전체에 표시) */}
                    {Array.from({ length: Math.ceil(TIMELINE_MAX_DISPLAY) + 1 }, (_, i) => i).map(sec => {
                      // 5초 간격은 이미 표시했으므로 제외
                      if (sec % TIMELINE_GRID_INTERVAL === 0) return null;
                      
                      return (
                        <div
                          key={`thin-${sec}`}
                          className="absolute border-l border-gray-700 opacity-50"
                          style={{ left: `${sec * pixelsPerSecond}px`, height: '100%' }}
                        />
                      );
                    })}
                    
                    {/* 클립 시작/끝 가이드 라인 (시간 마커 영역) */}
                    {tracks.map(track => {
                      const trackClips = getClipsForTrack(track.id);
                      return (
                        <React.Fragment key={`time-guide-${track.id}`}>
                          {trackClips.map(clip => (
                            <React.Fragment key={`time-guide-${clip.id}`}>
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 opacity-40 z-5"
                                style={{ left: `${clip.startTime * pixelsPerSecond}px` }}
                              />
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-40 z-5"
                                style={{ left: `${clip.endTime * pixelsPerSecond}px` }}
                              />
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  
                  {/* 재생 헤드 */}
                  <div
                    className="absolute top-0 bottom-0 z-30 cursor-ew-resize"
                    style={{ left: `${Math.min(currentTime, duration) * pixelsPerSecond}px` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingPlayhead(true);
                      setIsPlaying(false);
                      
                      const handleMouseMove = (e2) => {
                        if (!timelineRef.current) return;
                        const rect = timelineRef.current.getBoundingClientRect();
                        const scrollContainer = timelineRef.current.closest('.overflow-x-auto');
                        const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
                        const x = e2.clientX - rect.left + scrollLeft - 128;
                        const newTime = Math.max(0, Math.min((x / pixelsPerSecond), duration));
                        setCurrentTime(newTime);
                      };
                      
                      const handleMouseUp = () => {
                        setIsDraggingPlayhead(false);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        document.body.style.cursor = '';
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                      document.body.style.cursor = 'ew-resize';
                    }}
                  >
                    <div className="absolute top-0 bottom-0 w-1.5 bg-yellow-400"></div>
                    <div 
                      className="absolute left-1/2 transform -translate-x-1/2"
                      style={{
                        top: '-8px',
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderBottom: '6px solid rgb(250 204 21)'
                      }}
                    ></div>
                  </div>
                  
                  {/* 스냅 가이드 라인 */}
                  {snapGuideTime !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-25 opacity-60"
                      style={{ left: `${snapGuideTime * pixelsPerSecond}px` }}
                    >
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-cyan-400"></div>
                    </div>
                  )}
                  
                  {/* 드래그 중인 클립의 시간 가이드 라인 - 타임라인 전체 높이에 표시 (시간 마커 영역 포함) */}
                  {draggingClipTime !== null && (
                    <div
                      className="absolute w-0.5 bg-indigo-400 z-26 opacity-80"
                      style={{ 
                        left: `${draggingClipTime * pixelsPerSecond}px`,
                        top: '-32px', // 시간 마커 영역까지 포함
                        bottom: 0,
                        pointerEvents: 'none'
                      }}
                    >
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-indigo-400"></div>
                      <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap shadow-lg z-30">
                        {formatTime(draggingClipTime)}
                      </div>
                    </div>
                  )}
                  
                  {/* 리사이즈 중인 클립의 시간 가이드 라인 - 타임라인 전체 높이에 표시 (시간 마커 영역 포함) */}
                  {resizingClipTime !== null && resizingClipId !== null && resizingSide !== null && (() => {
                    const resizingClip = clips.find(c => c.id === resizingClipId);
                    if (!resizingClip) return null;
                    
                    const currentStartTime = resizingSide === 'left' ? resizingClipTime : resizingClip.startTime;
                    const currentEndTime = resizingSide === 'right' ? resizingClipTime : resizingClip.endTime;
                    const clipDuration = currentEndTime - currentStartTime;
                    
                    return (
                      <>
                        {/* 리사이즈 중인 위치의 가이드 라인 */}
                        <div
                          className="absolute w-0.5 bg-orange-400 z-26 opacity-80"
                          style={{ 
                            left: `${resizingClipTime * pixelsPerSecond}px`,
                            top: '-32px', // 시간 마커 영역까지 포함
                            bottom: 0,
                            pointerEvents: 'none'
                          }}
                        >
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-orange-400"></div>
                          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap shadow-lg z-30">
                            {formatTime(resizingClipTime)}
                          </div>
                        </div>
                        
                        {/* 클립의 시작/끝 시간과 길이 정보 표시 */}
                        <div
                          className="absolute bg-orange-500 text-white text-xs px-3 py-1.5 rounded shadow-lg z-30 pointer-events-none"
                          style={{
                            top: '-60px',
                            left: `${((currentStartTime + currentEndTime) / 2) * pixelsPerSecond}px`,
                            transform: 'translateX(-50%)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <div className="font-semibold">
                            {formatTime(currentStartTime)} - {formatTime(currentEndTime)}
                          </div>
                          <div className="text-orange-100 text-xs mt-0.5">
                            길이: {formatTime(clipDuration)}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 트랙들 */}
              <div 
                ref={timelineRef}
                className="relative"
                onClick={handleTimelineClick}
                onMouseDown={handleTimelineMouseDown}
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    setTimelineZoom(Math.max(0.5, Math.min(3, timelineZoom - e.deltaY * 0.001)));
                  }
                }}
                style={{ 
                  cursor: isDraggingPlayhead ? 'ew-resize' : 'pointer',
                  minWidth: `${timelineWidth + 128}px`
                }}
              >
                {tracks.map(track => {
                  const trackClips = getClipsForTrack(track.id);
                  const TrackIcon = track.icon;
                  
                  return (
                    <div key={track.id} className="flex border-b border-gray-700 hover:bg-gray-750 transition">
                      {/* 트랙 헤더 */}
                      <div className="w-32 bg-gray-800 border-r border-gray-700 flex-shrink-0 sticky left-0 z-10 flex items-center gap-2 px-3 py-2">
                        <TrackIcon size={16} className={track.color.replace('bg-', 'text-')} />
                        <span className="text-xs font-semibold text-gray-300 truncate">{track.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // 트랙 타입에 따라 적절한 기능 호출
                            if (track.type === 'video' || track.type === 'audio' || track.type === 'image') {
                              // 파일 선택 다이얼로그 열기
                              const fileInput = document.createElement('input');
                              fileInput.type = 'file';
                              fileInput.multiple = true;
                              fileInput.accept = track.type === 'video' ? 'video/*' : track.type === 'audio' ? 'audio/*' : 'image/*';
                              fileInput.onchange = (event) => {
                                if (event.target.files && event.target.files.length > 0) {
                                  const fakeEvent = { target: { files: event.target.files } };
                                  handleFileUpload(fakeEvent);
                                }
                              };
                              fileInput.click();
                            } else if (track.type === 'text') {
                              // 텍스트 추가 기능 호출
                              setShowTextInput(true);
                            } else if (track.type === 'graphics') {
                              // 효과 추가 기능은 사용자가 직접 선택하도록 유도
                              // 여기서는 기본 효과 추가 (sparkles)
                              addEffect('sparkles');
                            }
                          }}
                          className="ml-auto p-1 hover:bg-gray-700 rounded transition"
                          title={track.type === 'video' || track.type === 'audio' || track.type === 'image' ? '파일 추가' : track.type === 'text' ? '텍스트 추가' : '효과 추가'}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      {/* 트랙 컨텐츠 */}
                      <div className="flex-1 relative h-12 bg-gray-900" style={{ width: `${timelineWidth}px` }}>
                        {/* 클립 시작/끝 가이드 라인 */}
                        {trackClips.map(clip => (
                          <React.Fragment key={`guide-${clip.id}`}>
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-blue-400 opacity-40 z-5"
                              style={{ left: `${clip.startTime * pixelsPerSecond}px` }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-40 z-5"
                              style={{ left: `${clip.endTime * pixelsPerSecond}px` }}
                            />
                          </React.Fragment>
                        ))}
                        
                        {trackClips.map(clip => {
                          const clipLeft = clip.startTime * pixelsPerSecond;
                          const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
                          const isSelected = selectedClip === clip.id;
                          
                          return (
                            <div
                              key={clip.id}
                              className={`absolute top-1 bottom-1 rounded cursor-move transition-all ${
                                isSelected 
                                  ? `${track.color} ring-2 ring-yellow-400 shadow-lg` 
                                  : `${track.color} opacity-80 hover:opacity-100 hover:shadow-md`
                              }`}
                              style={{
                                left: `${clipLeft}px`,
                                width: `${clipWidth}px`,
                                minWidth: '40px',
                                pointerEvents: 'auto'
                              }}
                              onMouseDown={(e) => {
                                // 리사이즈 핸들이 아닐 때만 드래그 시작
                                const target = e.target;
                                const isResizeHandle = target.closest('.resize-handle') || 
                                                      target.classList.contains('resize-handle') ||
                                                      target.closest('.cursor-ew-resize') ||
                                                      target.classList.contains('cursor-ew-resize');
                                
                                // 삭제 버튼 클릭은 무시
                                if (target.closest('button') || target.tagName === 'BUTTON') {
                                  return;
                                }
                                
                                if (isResizeHandle) {
                                  // 리사이즈 핸들 클릭은 클립 드래그를 방지
                                  return;
                                }
                                
                                e.stopPropagation();
                                e.preventDefault();
                                
                                const clipId = clip.id;
                                const startX = e.clientX;
                                const initialStartTime = clip.startTime;
                                const initialEndTime = clip.endTime;
                                const initialDuration = initialEndTime - initialStartTime;
                                
                                setSelectedClip(clipId);
                                setCurrentTime(initialStartTime);
                                
                                let rafId3 = null;
                                let lastUpdateTime = initialStartTime;
                                let lastSnapTime = null;
                                
                                const handleMouseMove = (e2) => {
                                  e2.preventDefault();
                                  
                                  if (rafId3 !== null) return;
                                  
                                  rafId3 = requestAnimationFrame(() => {
                                    // 최신 클립 상태 가져오기
                                    setClips(prevClips => {
                                      const currentClip = prevClips.find(c => c.id === clipId);
                                      if (!currentClip) {
                                        rafId3 = null;
                                        return prevClips;
                                      }
                                      
                                      const currentClipDuration = currentClip.endTime - currentClip.startTime;
                                      const deltaTime = (e2.clientX - startX) / pixelsPerSecond;
                                      let newStartTime = Math.max(0, Math.min(initialStartTime + deltaTime, duration - currentClipDuration));
                                      
                                      // 최소 0.05초 이상 변경되었을 때만 상태 업데이트
                                      if (Math.abs(newStartTime - lastUpdateTime) < 0.05) {
                                        rafId3 = null;
                                        return prevClips;
                                      }
                                      
                                      // 스냅 가이드 찾기
                                      const snapTime = findSnapGuide(newStartTime, 1.0, clipId);
                                      if (snapTime !== null) {
                                        newStartTime = snapTime;
                                        if (snapTime !== lastSnapTime) {
                                          // 상태 업데이트는 setClips 외부에서
                                          setTimeout(() => {
                                            setSnapGuideTime(snapTime);
                                          }, 0);
                                          lastSnapTime = snapTime;
                                        }
                                      } else {
                                        if (lastSnapTime !== null) {
                                          setTimeout(() => {
                                            setSnapGuideTime(null);
                                          }, 0);
                                          lastSnapTime = null;
                                        }
                                      }
                                      
                                      // 드래그 중인 클립의 시간 표시 (시각적 업데이트만)
                                      setTimeout(() => {
                                        setDraggingClipTime(newStartTime);
                                      }, 0);
                                      
                                      // 실제 클립 위치 업데이트
                                      const clampedStart = Math.max(0, Math.min(newStartTime, duration - currentClipDuration));
                                      
                                      lastUpdateTime = newStartTime;
                                      rafId3 = null;
                                      
                                      const updatedClips = prevClips.map(c => 
                                        c.id === clipId 
                                          ? { ...c, startTime: clampedStart, endTime: clampedStart + currentClipDuration }
                                          : c
                                      );
                                      
                                      // 그래픽 효과 클립인 경우 effects 배열도 업데이트
                                      if (currentClip.type === 'graphics' && currentClip.effectId) {
                                        setEffects(prevEffects => prevEffects.map(e => {
                                          // effectId로 정확히 매칭
                                          if (e.id === currentClip.effectId) {
                                            return {
                                              ...e,
                                              startTime: clampedStart,
                                              endTime: clampedStart + currentClipDuration
                                            };
                                          }
                                          return e;
                                        }));
                                      }
                                      
                                      return updatedClips;
                                    });
                                  });
                                };
                                
                                const handleMouseUp = (e) => {
                                  // 마지막 위치 확정
                                  if (rafId3 !== null) {
                                    cancelAnimationFrame(rafId3);
                                    rafId3 = null;
                                  }
                                  
                                  // 이벤트 리스너 제거 (먼저 처리)
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                  
                                  // 마지막 업데이트는 requestAnimationFrame으로 지연 처리
                                  requestAnimationFrame(() => {
                                    const finalX = e ? e.clientX : startX;
                                    const deltaTime = (finalX - startX) / pixelsPerSecond;
                                    
                                    setClips(prevClips => {
                                      const currentClip = prevClips.find(c => c.id === clipId);
                                      if (!currentClip) return prevClips;
                                      
                                      const currentClipDuration = currentClip.endTime - currentClip.startTime;
                                      let finalStartTime = Math.max(0, Math.min(initialStartTime + deltaTime, duration - currentClipDuration));
                                      
                                      const snapTime = findSnapGuide(finalStartTime, 1.0, clipId);
                                      if (snapTime !== null) {
                                        finalStartTime = snapTime;
                                      }
                                      
                                      const clampedStart = Math.max(0, Math.min(finalStartTime, duration - currentClipDuration));
                                      
                                      // 상태 업데이트는 외부에서 처리
                                      setTimeout(() => {
                                        setSnapGuideTime(null);
                                        setDraggingClipTime(null);
                                      }, 0);
                                      
                                      return prevClips.map(c => 
                                        c.id === clipId 
                                          ? { ...c, startTime: clampedStart, endTime: clampedStart + currentClipDuration }
                                          : c
                                      );
                                    });
                                    
                                    document.body.style.cursor = '';
                                    document.body.style.userSelect = '';
                                  });
                                };
                                
                                document.addEventListener('mousemove', handleMouseMove, { passive: false });
                                document.addEventListener('mouseup', handleMouseUp);
                                document.body.style.cursor = 'grabbing';
                                document.body.style.userSelect = 'none';
                              }}
                            >
                              <div className="h-full flex items-center justify-between px-2 text-xs text-white font-semibold relative">
                                <span className="truncate flex-1">{clip.name}</span>
                                <div className="flex items-center gap-1">
                                  {isSelected && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteClip(clip.id);
                                      }}
                                      className="p-0.5 hover:bg-red-600 rounded transition"
                                      title="삭제"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                                
                                {/* 리사이즈 중일 때 클립 위에 시간 정보 표시 */}
                                {resizingClipId === clip.id && resizingClipTime !== null && resizingSide !== null && (() => {
                                  const currentStartTime = resizingSide === 'left' ? resizingClipTime : clip.startTime;
                                  const currentEndTime = resizingSide === 'right' ? resizingClipTime : clip.endTime;
                                  const clipDuration = currentEndTime - currentStartTime;
                                  
                                  return (
                                    <div
                                      className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-xs px-2 py-1 rounded shadow-lg z-40 pointer-events-none whitespace-nowrap"
                                    >
                                      <div className="font-semibold">
                                        {formatTime(currentStartTime)} - {formatTime(currentEndTime)}
                                      </div>
                                      <div className="text-orange-100 text-xs mt-0.5 text-center">
                                        길이: {formatTime(clipDuration)}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                              
                              {/* 리사이즈 핸들 */}
                              {isSelected && (
                                <>
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-yellow-400 bg-yellow-400 bg-opacity-70 z-[100] resize-handle"
                                    style={{ 
                                      pointerEvents: 'auto',
                                      zIndex: 100
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      
                                      const clipId = clip.id;
                                      const startX = e.clientX;
                                      const initialStartTime = clip.startTime;
                                      const initialEndTime = clip.endTime;
                                      
                                      setResizingClipId(clipId);
                                      setResizingClipTime(initialStartTime);
                                      setResizingSide('left');
                                      
                                      let rafId = null;
                                      let lastUpdateTime = initialStartTime;
                                      
                                      const handleMouseMove = (e2) => {
                                        e2.preventDefault();
                                        
                                        if (rafId !== null) return;
                                        
                                        rafId = requestAnimationFrame(() => {
                                          // 최신 클립 상태 가져오기
                                          setClips(prevClips => {
                                            const currentClip = prevClips.find(c => c.id === clipId);
                                            if (!currentClip) {
                                              rafId = null;
                                              return prevClips;
                                            }
                                            
                                            const deltaX = (e2.clientX - startX) / pixelsPerSecond;
                                            let newTime = initialStartTime + deltaX;
                                            
                                            const minDuration = 0.5;
                                            if (newTime >= currentClip.endTime - minDuration) {
                                              newTime = currentClip.endTime - minDuration;
                                            }
                                            
                                            // 최소 0.05초 이상 변경되었을 때만 상태 업데이트
                                            if (Math.abs(newTime - lastUpdateTime) < 0.05) {
                                              rafId = null;
                                              return prevClips;
                                            }
                                            
                                            const snapTime = findSnapGuide(newTime, 1.0, clipId);
                                            if (snapTime !== null && snapTime < currentClip.endTime - minDuration) {
                                              newTime = snapTime;
                                              setTimeout(() => {
                                                setSnapGuideTime(snapTime);
                                              }, 0);
                                            } else {
                                              setTimeout(() => {
                                                setSnapGuideTime(null);
                                              }, 0);
                                            }
                                            
                                            // 시각적 업데이트는 외부에서 처리
                                            setTimeout(() => {
                                              setResizingClipTime(newTime);
                                            }, 0);
                                            
                                            // 실제 클립 크기 업데이트
                                            const maxStart = currentClip.endTime - minDuration;
                                            const clampedStart = Math.max(0, Math.min(newTime, maxStart));
                                            
                                            lastUpdateTime = newTime;
                                            rafId = null;
                                            
                                            const updatedClips = prevClips.map(c => 
                                              c.id === clipId ? { ...c, startTime: clampedStart } : c
                                            );
                                            
                                            // 그래픽 효과 클립인 경우 effects 배열도 업데이트
                                            if (currentClip.type === 'graphics' && currentClip.effectId) {
                                              setEffects(prevEffects => prevEffects.map(e => {
                                                // effectId로 정확히 매칭
                                                if (e.id === currentClip.effectId) {
                                                  return {
                                                    ...e,
                                                    startTime: clampedStart,
                                                    endTime: currentClip.endTime
                                                  };
                                                }
                                                return e;
                                              }));
                                            }
                                            
                                            return updatedClips;
                                          });
                                        });
                                      };
                                      
                                      const handleMouseUp = () => {
                                        if (rafId !== null) {
                                          cancelAnimationFrame(rafId);
                                          rafId = null;
                                        }
                                        setSnapGuideTime(null);
                                        setResizingClipTime(null);
                                        setResizingClipId(null);
                                        setResizingSide(null);
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove, { passive: false });
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-yellow-400 bg-yellow-400 bg-opacity-70 z-[100] resize-handle"
                                    style={{ 
                                      pointerEvents: 'auto',
                                      zIndex: 100
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      
                                      const startX = e.clientX;
                                      const startTime = clip.endTime;
                                      
                                      setResizingClipId(clip.id);
                                      setResizingClipTime(startTime);
                                      setResizingSide('right');
                                      
                                      let rafId = null;
                                      let lastUpdateTime = startTime;
                                      
                                      const handleMouseMove = (e2) => {
                                        e2.preventDefault();
                                        
                                        if (rafId !== null) return;
                                        
                                        rafId = requestAnimationFrame(() => {
                                          // 최신 클립 상태 가져오기
                                          setClips(prevClips => {
                                            const currentClip = prevClips.find(c => c.id === clip.id);
                                            if (!currentClip) {
                                              rafId = null;
                                              return prevClips;
                                            }
                                            
                                            const deltaX = (e2.clientX - startX) / pixelsPerSecond;
                                            let newTime = startTime + deltaX;
                                            
                                            const minDuration = 0.5;
                                            // 최신 startTime 사용
                                            if (newTime <= currentClip.startTime + minDuration) {
                                              newTime = currentClip.startTime + minDuration;
                                            }
                                            
                                            // 최소 0.05초 이상 변경되었을 때만 상태 업데이트
                                            if (Math.abs(newTime - lastUpdateTime) < 0.05) {
                                              rafId = null;
                                              return prevClips;
                                            }
                                            
                                            // 스냅 가이드 찾기 (최신 startTime 사용)
                                            const snapTime = findSnapGuide(newTime, 1.0, clip.id);
                                            if (snapTime !== null && snapTime > currentClip.startTime + minDuration) {
                                              newTime = snapTime;
                                              setTimeout(() => {
                                                setSnapGuideTime(snapTime);
                                              }, 0);
                                            } else {
                                              setTimeout(() => {
                                                setSnapGuideTime(null);
                                              }, 0);
                                            }
                                            
                                            // 시각적 업데이트는 외부에서 처리
                                            setTimeout(() => {
                                              setResizingClipTime(newTime);
                                            }, 0);
                                            
                                            // 실제 클립 크기 업데이트 (최신 startTime 사용)
                                            const minEnd = currentClip.startTime + minDuration;
                                            // duration 제한 제거 - 최대한 늘릴 수 있도록
                                            const clampedEnd = Math.max(minEnd, newTime);
                                            
                                            lastUpdateTime = newTime;
                                            rafId = null;
                                            
                                            const updatedClips = prevClips.map(c => 
                                              c.id === clip.id ? { ...c, endTime: clampedEnd } : c
                                            );
                                            
                                            // 그래픽 효과 클립인 경우 effects 배열도 업데이트
                                            if (currentClip.type === 'graphics' && currentClip.effectId) {
                                              setEffects(prevEffects => prevEffects.map(e => {
                                                // effectId로 정확히 매칭
                                                if (e.id === currentClip.effectId) {
                                                  return {
                                                    ...e,
                                                    startTime: currentClip.startTime,
                                                    endTime: clampedEnd
                                                  };
                                                }
                                                return e;
                                              }));
                                            }
                                            
                                            return updatedClips;
                                          });
                                        });
                                      };
                                      
                                      const handleMouseUp = () => {
                                        if (rafId !== null) {
                                          cancelAnimationFrame(rafId);
                                          rafId = null;
                                        }
                                        setSnapGuideTime(null);
                                        setResizingClipTime(null);
                                        setResizingClipId(null);
                                        setResizingSide(null);
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove, { passive: false });
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 컨트롤 버튼들 */}
          <div className="p-4 flex items-center justify-between">
            <button onClick={togglePlay} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex items-center gap-2 font-semibold shadow">
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="fill-white" />}
              <span>{isPlaying ? '일시정지' : '재생'}</span>
            </button>

            <div className="flex-1 mx-4">
              {isExporting && (
                <div className="w-full">
                  <div className="w-full h-2 bg-gray-700 rounded overflow-hidden mb-1">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all" style={{ width: `${exportProgress}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    처리 중... {exportProgress}%
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleExport} disabled={isExporting} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition flex items-center gap-2 font-semibold shadow">
              {isExporting ? <div className="animate-spin">⚙️</div> : <Download size={20} />}
              <span>{isExporting ? '처리 중' : '내보내기'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 오른쪽 리사이즈 핸들 */}
      <div
        className="w-1 bg-gray-700 hover:bg-indigo-500 cursor-ew-resize transition-colors mt-16"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizingRight(true);
        }}
        style={{ minHeight: 'calc(100vh - 64px)' }}
      />

      {/* 오른쪽 패널 */}
      <div 
        className="bg-gray-800 border-l border-gray-700 overflow-y-auto mt-16 flex flex-col shadow-inner"
        style={{ width: `${rightPanelWidth}px`, height: 'calc(100vh - 64px)' }}
      >
        <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-900">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">✏️ 텍스트 & 효과</h2>
          
          {/* 텍스트 추가 버튼 */}
          <button onClick={() => setShowTextInput(!showTextInput)} className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-lg transition flex items-center justify-center gap-2 font-semibold shadow mb-3">
            <Plus size={18} />
            <span>텍스트 추가</span>
          </button>

          {showTextInput && (
            <div className="mb-4 space-y-2 p-3 bg-gray-700 rounded-lg">
              <input
                type="text"
                value={newTextContent}
                onChange={(e) => setNewTextContent(e.target.value)}
                placeholder="텍스트를 입력하세요..."
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                onKeyPress={(e) => e.key === 'Enter' && addText()}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={addText} className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm transition font-semibold">
                  추가
                </button>
                <button onClick={() => setShowTextInput(false)} className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition font-semibold">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 효과 추가 버튼들 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">✨ 그래픽 효과</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => addEffect('sparkles')} 
                className="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition flex items-center justify-center gap-2 text-sm font-semibold shadow"
              >
                <Sparkles size={16} />
                <span>반짝임</span>
              </button>
              <button 
                onClick={() => addEffect('zoom')} 
                className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-lg transition flex items-center justify-center gap-2 text-sm font-semibold shadow"
              >
                <ZoomIn size={16} />
                <span>줌</span>
              </button>
              <button 
                onClick={() => addEffect('fade')} 
                className="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition flex items-center justify-center gap-2 text-sm font-semibold shadow"
              >
                <span>페이드</span>
              </button>
              <button 
                onClick={() => addEffect('blur')} 
                className="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition flex items-center justify-center gap-2 text-sm font-semibold shadow"
              >
                <span>블러</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {/* 효과 목록 */}
          {effects.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">추가된 효과</h3>
              {effects.map(effect => (
                <div key={effect.id} className={`p-3 rounded-lg transition cursor-pointer border-2 mb-2 ${selectedEffect === effect.id ? 'bg-pink-600 border-pink-400 shadow-lg' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`} onClick={() => setSelectedEffect(effect.id)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold">{effect.name}</p>
                      <p className="text-xs text-gray-400">{formatTime(effect.startTime)} - {formatTime(effect.endTime)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteEffect(effect.id); }} className="ml-2 p-1 hover:bg-red-600 rounded transition" title="삭제">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {selectedEffect === effect.id && (
                    <div className="mt-3 space-y-2 text-xs bg-gray-900 p-3 rounded-lg border border-gray-600">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-gray-300 font-semibold">강도</label>
                          <span className="font-mono bg-gray-700 px-2 py-1 rounded">{effect.intensity}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={effect.intensity} onChange={(e) => updateEffect(effect.id, { intensity: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-purple-500" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 텍스트 목록 */}
          {texts.length === 0 && effects.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-sm">텍스트나 효과를 추가하여 시작하세요</p>
            </div>
          ) : (
            texts.map(text => (
              <div key={text.id} className={`p-4 rounded-lg transition cursor-pointer border-2 ${selectedText === text.id ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`} onClick={() => setSelectedText(text.id)}>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-bold truncate flex-1">{text.content}</p>
                  <button onClick={(e) => { e.stopPropagation(); deleteText(text.id); }} className="ml-2 p-1 hover:bg-red-600 rounded transition" title="삭제">
                    <Trash2 size={14} />
                  </button>
                </div>

                {selectedText === text.id && (
                  <div className="space-y-4 text-xs bg-gray-900 p-4 rounded-lg border border-gray-600 mt-2">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-300 font-semibold">📏 크기</label>
                        <span className="font-mono bg-gray-700 px-2 py-1 rounded">{text.fontSize}px</span>
                      </div>
                      <input type="range" min="12" max="120" value={text.fontSize} onChange={(e) => updateText(text.id, { fontSize: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-indigo-500" />
                    </div>

                    <div>
                      <label className="block text-gray-300 font-semibold mb-2">🎨 색상</label>
                      <div className="flex gap-2">
                        <input type="color" value={text.color} onChange={(e) => updateText(text.id, { color: e.target.value })} className="w-12 h-10 rounded cursor-pointer" />
                        <input type="text" value={text.color} onChange={(e) => updateText(text.id, { color: e.target.value })} className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 font-semibold mb-2">🔤 폰트</label>
                      <select value={text.fontFamily} onChange={(e) => updateText(text.id, { fontFamily: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Comic Sans MS">Comic Sans MS</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-300 font-semibold">📍 위치 X</label>
                        <span className="font-mono bg-gray-700 px-2 py-1 rounded">{text.x}px</span>
                      </div>
                      <input type="range" min="0" max="800" value={text.x} onChange={(e) => updateText(text.id, { x: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-indigo-500" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-300 font-semibold">📍 위치 Y</label>
                        <span className="font-mono bg-gray-700 px-2 py-1 rounded">{text.y}px</span>
                      </div>
                      <input type="range" min="0" max="400" value={text.y} onChange={(e) => updateText(text.id, { y: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 원격 서버 설정 모달 */}
      {showRemoteServerSettings && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowRemoteServerSettings(false)}
        >
          <div 
            className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">원격 서버 설정</h2>
              <button
                onClick={() => setShowRemoteServerSettings(false)}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">
                  서버 URL
                </label>
                <input
                  type="text"
                  value={remoteServerConfig.url}
                  onChange={(e) => setRemoteServerConfig({ ...remoteServerConfig, url: e.target.value })}
                  placeholder="https://api.example.com"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">예: https://api.example.com 또는 http://192.168.1.100:3001</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">
                  API 키 (선택사항)
                </label>
                <input
                  type="password"
                  value={remoteServerConfig.apiKey}
                  onChange={(e) => setRemoteServerConfig({ ...remoteServerConfig, apiKey: e.target.value })}
                  placeholder="API 키가 필요한 경우 입력"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">인증이 필요한 경우에만 입력하세요</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remoteServerEnabled"
                  checked={remoteServerConfig.enabled}
                  onChange={(e) => setRemoteServerConfig({ ...remoteServerConfig, enabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="remoteServerEnabled" className="text-sm text-gray-300">
                  원격 서버 업로드 활성화
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={testRemoteServer}
                  disabled={remoteServerTesting || !remoteServerConfig.url}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition font-semibold"
                >
                  {remoteServerTesting ? '테스트 중...' : '연결 테스트'}
                </button>
                <button
                  onClick={() => setShowRemoteServerSettings(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition font-semibold"
                >
                  닫기
                </button>
              </div>

              {remoteServerConfig.enabled && remoteServerConfig.url && (
                <div className="mt-2 p-2 bg-green-900 bg-opacity-30 border border-green-700 rounded text-sm text-green-300">
                  ✓ 원격 서버 업로드가 활성화되었습니다. 파일 업로드 시 자동으로 원격 서버에도 업로드됩니다.
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded text-xs text-blue-300">
                <p className="font-semibold mb-1">💡 원격 서버 요구사항:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-200">
                  <li>POST /api/upload 엔드포인트 필요</li>
                  <li>multipart/form-data 형식의 파일 업로드 지원</li>
                  <li>CORS 설정 필요 (필요한 경우)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 팝업 */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in">
          <div className="bg-yellow-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => setToast({ show: false, message: '' })}
              className="flex-shrink-0 text-white hover:text-gray-200 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CutFlowApp;
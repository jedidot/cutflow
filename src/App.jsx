import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, Pause, Download, Trash2, Plus, Image, Music, Video, Sparkles, Type, ZoomIn, ZoomOut } from 'lucide-react';

const CutFlowApp = () => {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [videos] = useState([
    { id: 1, name: 'sample-video.mp4', size: '250MB', duration: '2:30' }
  ]);
  const [selectedVideo, setSelectedVideo] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(45);
  const duration = 150;
  const [texts, setTexts] = useState([
    { id: 1, content: 'Hello World', x: 100, y: 80, fontSize: 48, color: '#FFFFFF', fontFamily: 'Arial' }
  ]);
  const [selectedText, setSelectedText] = useState(1);
  const [showTextInput, setShowTextInput] = useState(false);
  const [newTextContent, setNewTextContent] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo1234');
  
  // 타임라인 상태
  const [tracks, setTracks] = useState([
    { id: 'video', type: 'video', name: '비디오', icon: Video, color: 'bg-blue-500' },
    { id: 'audio', type: 'audio', name: '오디오', icon: Music, color: 'bg-green-500' },
    { id: 'image', type: 'image', name: '이미지', icon: Image, color: 'bg-yellow-500' },
    { id: 'text', type: 'text', name: '텍스트 효과', icon: Type, color: 'bg-purple-500' },
    { id: 'graphics', type: 'graphics', name: '그래픽 효과', icon: Sparkles, color: 'bg-pink-500' }
  ]);
  const [clips, setClips] = useState([
    { id: 1, trackId: 'video', startTime: 0, endTime: 30, name: 'sample-video.mp4', type: 'video' },
    { id: 2, trackId: 'audio', startTime: 5, endTime: 25, name: 'background-music.mp3', type: 'audio' },
    { id: 3, trackId: 'text', startTime: 10, endTime: 20, name: 'Hello World', type: 'text' }
  ]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineScroll, setTimelineScroll] = useState(0);
  const timelineRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleLogin = (e) => {
    e.preventDefault();
    setUser({ username: 'testuser', email });
    setCurrentPage('dashboard');
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    setCurrentTime(Math.max(0, Math.min(duration, percentage * duration)));
  };

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

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          alert('✅ 비디오 내보내기 완료!\n파일: output-video.mp4 (285MB)');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
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
    setClips(clips.filter(c => c.id !== clipId));
    if (selectedClip === clipId) setSelectedClip(null);
  };

  const updateClip = (clipId, updates) => {
    setClips(clips.map(c => c.id === clipId ? { ...c, ...updates } : c));
  };

  const handleClipDrag = (clipId, newStartTime) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    const clipDuration = clip.endTime - clip.startTime;
    const clampedStart = Math.max(0, Math.min(newStartTime, duration - clipDuration));
    updateClip(clipId, { 
      startTime: clampedStart, 
      endTime: clampedStart + clipDuration 
    });
  };

  const handleClipResize = (clipId, side, newTime) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    if (side === 'left') {
      const clampedStart = Math.max(0, Math.min(newTime, clip.endTime - 1));
      updateClip(clipId, { startTime: clampedStart });
    } else {
      const clampedEnd = Math.max(clip.startTime + 1, Math.min(newTime, duration));
      updateClip(clipId, { endTime: clampedEnd });
    }
  };

  const getClipsForTrack = (trackId) => {
    return clips.filter(c => c.trackId === trackId).sort((a, b) => a.startTime - b.startTime);
  };

  const pixelsPerSecond = 10 * timelineZoom;
  const timelineWidth = duration * pixelsPerSecond;

  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollContainer = e.currentTarget.closest('.overflow-x-auto');
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const x = e.clientX - rect.left + scrollLeft - 128; // 트랙 헤더 너비 제외
    const newTime = Math.max(0, Math.min((x / pixelsPerSecond), duration));
    setCurrentTime(newTime);
  };

  if (currentPage === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-block bg-gradient-to-br from-blue-500 to-purple-600 text-white p-4 rounded-lg mb-4">
                <Play size={32} />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">🎬 비디오 에디터</h1>
              <p className="text-gray-600 mt-2 text-lg">캔바 같은 비디오 편집</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition text-lg">
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

      <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto mt-16 p-4 shadow-inner">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">📁 미디어 라이브러리</h2>
        <button className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition flex items-center justify-center gap-2 mb-4 font-semibold shadow">
          <Upload size={18} />
          <span>비디오 업로드</span>
        </button>
        <div className="space-y-2">
          {videos.map(video => (
            <div key={video.id} className={`p-4 rounded-lg cursor-pointer transition transform ${selectedVideo === video.id ? 'bg-blue-600 ring-2 ring-blue-400 scale-105' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setSelectedVideo(video.id)}>
              <p className="text-sm font-bold">📹 {video.name}</p>
              <p className="text-xs text-gray-300 mt-1">{video.size} • {video.duration}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-950 mt-16">
        <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden p-4">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-4/5 h-5/6 bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 rounded-lg overflow-hidden flex items-center justify-center shadow-2xl border-4 border-gray-700">
              {texts.map(text => (
                <div key={text.id} onClick={() => setSelectedText(text.id)} className={`absolute cursor-move select-none transition font-bold ${selectedText === text.id ? 'ring-2 ring-yellow-400 bg-yellow-400 bg-opacity-10 scale-110' : 'hover:scale-105'}`} style={{
                  left: `${text.x}px`,
                  top: `${text.y}px`,
                  fontSize: `${text.fontSize}px`,
                  color: text.color,
                  fontFamily: text.fontFamily,
                  textShadow: '3px 3px 6px rgba(0,0,0,0.9)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                }} draggable onDragEnd={(e) => {
                  const rect = e.currentTarget.parentElement.getBoundingClientRect();
                  const newX = Math.max(0, Math.min(e.clientX - rect.left - 50));
                  const newY = Math.max(0, Math.min(e.clientY - rect.top - 20));
                  updateText(text.id, { x: newX, y: newY });
                }}>
                  {text.content}
                </div>
              ))}
              {!isPlaying && (
                <button onClick={togglePlay} className="absolute bg-blue-600 hover:bg-blue-500 text-white rounded-full p-6 transition transform hover:scale-110 shadow-lg z-10">
                  <Play size={48} className="fill-white" />
                </button>
              )}
              <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-300 text-center">
                프리뷰: {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border-t border-gray-700 shadow-lg flex flex-col">
          {/* 타임라인 UI */}
          <div className="border-b border-gray-700 bg-gray-900">
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
            
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '300px' }} onScroll={(e) => setTimelineScroll(e.target.scrollLeft)}>
              <div className="flex" style={{ minWidth: `${timelineWidth + 128}px` }}>
                {/* 시간 스케일 */}
                <div className="w-32 bg-gray-800 border-r border-gray-700 flex-shrink-0 sticky left-0 z-20">
                  <div className="h-8 border-b border-gray-700"></div>
                </div>
                <div className="relative" style={{ width: `${timelineWidth}px` }}>
                  {/* 시간 마커 */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-gray-800 border-b border-gray-700 z-10">
                    {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => i * 5).map(sec => (
                      <div
                        key={sec}
                        className="absolute border-l border-gray-600"
                        style={{ left: `${sec * pixelsPerSecond}px`, height: '100%' }}
                      >
                        <span className="absolute top-1 left-1 text-xs text-gray-400">{formatTime(sec)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 재생 헤드 */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-30 pointer-events-none"
                    style={{ left: `${currentTime * pixelsPerSecond}px` }}
                  >
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-yellow-400"></div>
                  </div>
                </div>
              </div>

              {/* 트랙들 */}
              <div 
                ref={timelineRef}
                className="relative"
                onClick={handleTimelineClick}
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    setTimelineZoom(Math.max(0.5, Math.min(3, timelineZoom - e.deltaY * 0.001)));
                  }
                }}
                style={{ 
                  cursor: 'pointer',
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
                            addClip(track.id, track.type);
                          }}
                          className="ml-auto p-1 hover:bg-gray-700 rounded transition"
                          title="클립 추가"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      {/* 트랙 컨텐츠 */}
                      <div className="flex-1 relative h-16 bg-gray-900" style={{ width: `${timelineWidth}px` }}>
                        {trackClips.map(clip => {
                          const clipLeft = clip.startTime * pixelsPerSecond;
                          const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
                          const isSelected = selectedClip === clip.id;
                          
                          return (
                            <div
                              key={clip.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClip(clip.id);
                                setCurrentTime(clip.startTime);
                              }}
                              className={`absolute top-1 bottom-1 rounded cursor-move transition-all ${
                                isSelected 
                                  ? `${track.color} ring-2 ring-yellow-400 shadow-lg` 
                                  : `${track.color} opacity-80 hover:opacity-100 hover:shadow-md`
                              }`}
                              style={{
                                left: `${clipLeft}px`,
                                width: `${clipWidth}px`,
                                minWidth: '40px'
                              }}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                setSelectedClip(clip.id);
                              }}
                              onDrag={(e) => {
                                if (!timelineRef.current) return;
                                const rect = timelineRef.current.getBoundingClientRect();
                                const scrollContainer = timelineRef.current.closest('.overflow-x-auto');
                                const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
                                const x = e.clientX - rect.left + scrollLeft - 128;
                                const newStartTime = Math.max(0, (x / pixelsPerSecond) - (clip.endTime - clip.startTime) / 2);
                                handleClipDrag(clip.id, newStartTime);
                              }}
                            >
                              <div className="h-full flex items-center justify-between px-2 text-xs text-white font-semibold">
                                <span className="truncate flex-1">{clip.name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs opacity-75">{formatTime(clip.startTime)}</span>
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
                              </div>
                              
                              {/* 리사이즈 핸들 */}
                              {isSelected && (
                                <>
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-400 bg-yellow-400 bg-opacity-50"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      const startX = e.clientX;
                                      const startTime = clip.startTime;
                                      
                                      const handleMouseMove = (e2) => {
                                        const deltaX = (e2.clientX - startX) / pixelsPerSecond;
                                        handleClipResize(clip.id, 'left', startTime + deltaX);
                                      };
                                      
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-400 bg-yellow-400 bg-opacity-50"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      const startX = e.clientX;
                                      const startTime = clip.endTime;
                                      
                                      const handleMouseMove = (e2) => {
                                        const deltaX = (e2.clientX - startX) / pixelsPerSecond;
                                        handleClipResize(clip.id, 'right', startTime + deltaX);
                                      };
                                      
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
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
            <button onClick={togglePlay} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition flex items-center gap-2 font-semibold shadow">
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="fill-white" />}
              <span>{isPlaying ? '일시정지' : '재생'}</span>
            </button>

            <div className="flex-1 mx-4">
              {isExporting && (
                <div className="w-full">
                  <div className="w-full h-2 bg-gray-700 rounded overflow-hidden mb-1">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all" style={{ width: `${exportProgress}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    처리 중... {exportProgress}%
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleExport} disabled={isExporting} className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg transition flex items-center gap-2 font-semibold shadow">
              {isExporting ? <div className="animate-spin">⚙️</div> : <Download size={20} />}
              <span>{isExporting ? '처리 중' : '내보내기'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto mt-16 flex flex-col shadow-inner">
        <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-900">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">✏️ 텍스트 & 효과</h2>
          <button onClick={() => setShowTextInput(!showTextInput)} className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition flex items-center justify-center gap-2 font-semibold shadow">
            <Plus size={18} />
            <span>텍스트 추가</span>
          </button>

          {showTextInput && (
            <div className="mt-4 space-y-2 p-3 bg-gray-700 rounded-lg">
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
                <button onClick={addText} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm transition font-semibold">
                  추가
                </button>
                <button onClick={() => setShowTextInput(false)} className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition font-semibold">
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {texts.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-sm">텍스트를 추가하여 시작하세요</p>
            </div>
          ) : (
            texts.map(text => (
              <div key={text.id} className={`p-4 rounded-lg transition cursor-pointer border-2 ${selectedText === text.id ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`} onClick={() => setSelectedText(text.id)}>
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
                      <input type="range" min="12" max="120" value={text.fontSize} onChange={(e) => updateText(text.id, { fontSize: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-500" />
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
                      <input type="range" min="0" max="800" value={text.x} onChange={(e) => updateText(text.id, { x: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-500" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-300 font-semibold">📍 위치 Y</label>
                        <span className="font-mono bg-gray-700 px-2 py-1 rounded">{text.y}px</span>
                      </div>
                      <input type="range" min="0" max="400" value={text.y} onChange={(e) => updateText(text.id, { y: parseInt(e.target.value) })} className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-500" />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CutFlowApp;
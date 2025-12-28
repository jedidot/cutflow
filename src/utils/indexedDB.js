// IndexedDB 유틸리티 - 파일 저장 및 관리

const DB_NAME = 'CutFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'mediaFiles';

// 데이터베이스 초기화
export const initDB = () => {
  return new Promise((resolve, reject) => {
    try {
      // IndexedDB 지원 여부 확인
      if (!window.indexedDB) {
        reject(new Error('IndexedDB를 지원하지 않는 브라우저입니다.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB 오류:', event);
        reject(new Error('IndexedDB 초기화 실패'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = event.target.result;
          
          // 기존 스토어가 있으면 삭제
          if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
          }
          
          // 새 스토어 생성
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('originalName', 'originalName', { unique: false });
          objectStore.createIndex('type', 'type', { unique: false });
          objectStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        } catch (error) {
          console.error('IndexedDB 업그레이드 실패:', error);
          reject(error);
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB가 차단되었습니다. 다른 탭에서 데이터베이스를 사용 중일 수 있습니다.');
      };
    } catch (error) {
      console.error('IndexedDB 초기화 중 예외:', error);
      reject(error);
    }
  });
};

// 파일을 IndexedDB에 저장
export const saveFileToDB = async (file, metadata = {}) => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const fileData = {
            id: metadata.id || Date.now() + Math.random(),
            originalName: file.name,
            filename: metadata.filename || file.name,
            type: metadata.type || getFileType(file),
            duration: metadata.duration || 0,
            size: file.size,
            mimetype: file.type,
            data: e.target.result, // ArrayBuffer
            uploadedAt: new Date().toISOString(),
            ...metadata
          };

          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(fileData);

          request.onsuccess = () => {
            // Blob URL 생성하여 반환
            try {
              const blob = new Blob([fileData.data], { type: fileData.mimetype });
              fileData.url = URL.createObjectURL(blob);
            } catch (urlError) {
              console.warn('Blob URL 생성 실패:', urlError);
            }
            resolve(fileData);
          };

          request.onerror = (event) => {
            console.error('IndexedDB 저장 오류:', event);
            reject(new Error('파일 저장 실패'));
          };

          transaction.onerror = (event) => {
            console.error('IndexedDB 트랜잭션 오류:', event);
            reject(new Error('파일 저장 실패'));
          };
        } catch (error) {
          console.error('파일 데이터 처리 오류:', error);
          reject(error);
        }
      };

      reader.onerror = (event) => {
        console.error('파일 읽기 오류:', event);
        reject(new Error('파일 읽기 실패'));
      };

      reader.onprogress = (event) => {
        // 큰 파일의 경우 진행률을 추적할 수 있음 (선택사항)
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          // console.log(`파일 읽기 진행률: ${percent.toFixed(1)}%`);
        }
      };

      // 큰 파일도 처리할 수 있도록 설정
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error('IndexedDB 초기화 오류:', error);
    throw error;
  }
};

// IndexedDB에서 파일 목록 가져오기
export const getFilesFromDB = async () => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        try {
          const files = request.result.map(file => {
            // ArrayBuffer를 Blob URL로 변환하여 사용
            let url = null;
            if (file.data) {
              try {
                url = URL.createObjectURL(new Blob([file.data], { type: file.mimetype }));
              } catch (e) {
                console.error('Blob URL 생성 실패:', e);
              }
            }
            return {
              ...file,
              url
            };
          });
          resolve(files);
        } catch (error) {
          console.error('파일 목록 변환 실패:', error);
          resolve([]); // 오류 시 빈 배열 반환
        }
      };

      request.onerror = () => {
        reject(new Error('파일 목록 가져오기 실패'));
      };
    });
  } catch (error) {
    console.error('IndexedDB 접근 실패:', error);
    return []; // 오류 시 빈 배열 반환
  }
};

// IndexedDB에서 파일 가져오기 (ID로)
export const getFileFromDB = async (id) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        const file = request.result;
        // ArrayBuffer를 File 객체로 변환
        const blob = new Blob([file.data], { type: file.mimetype });
        const fileObj = new File([blob], file.originalName, { type: file.mimetype });
        
        resolve({
          ...file,
          file: fileObj,
          url: URL.createObjectURL(blob)
        });
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(new Error('파일 가져오기 실패'));
    };
  });
};

// IndexedDB에서 파일 삭제
export const deleteFileFromDB = async (id) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('파일 삭제 실패'));
    };
  });
};

// IndexedDB 저장 공간 사용량 확인
export const getStorageUsage = async () => {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      usagePercent: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0
    };
  } catch (error) {
    console.error('저장 공간 확인 실패:', error);
    return null;
  }
};

// 오래된 파일 자동 정리 (선택적)
export const cleanupOldFiles = async (daysToKeep = 30) => {
  const db = await initDB();
  const files = await getFilesFromDB();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const filesToDelete = files.filter(file => {
    const uploadedDate = new Date(file.uploadedAt);
    return uploadedDate < cutoffDate;
  });

  await Promise.all(filesToDelete.map(file => deleteFileFromDB(file.id)));
  return filesToDelete.length;
};

// 파일 타입 추론
const getFileType = (file) => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  return 'unknown';
};

// ArrayBuffer를 File 객체로 변환
export const arrayBufferToFile = (arrayBuffer, filename, mimetype) => {
  const blob = new Blob([arrayBuffer], { type: mimetype });
  return new File([blob], filename, { type: mimetype });
};


import * as faceapi from '@vladmandic/face-api';
// 為了避免硬編碼 URL，我們從 request 模組引入伺服器位址
import { SERVER_URL } from './request';

let modelsLoaded = false;

/**
 * 加載人臉識別模型
 */
export const loadFaceModels = async () => {
    if (modelsLoaded) return;
    
    // 指向後端的 public/models 資料夾
    const MODEL_URL = `${SERVER_URL}/public/models`;
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        console.log('[AI] 人臉識別模型加載成功');
    } catch (err) {
        console.error('[AI] 模型加載失敗:', err);
        throw err;
    }
};

/**
 * 從圖像中提取所有人臉的特徵值
 * @param {string|HTMLImageElement} imageSource 圖像 URL 或 DOM 元素
 */
export const detectFacesAndDescriptors = async (imageSource) => {
    await loadFaceModels();
    
    return new Promise(async (resolve, reject) => {
        let img = imageSource;
        
        // 若為字串 (URL)，則建立 Image 物件載入
        if (typeof imageSource === 'string') {
            img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = async () => {
                await processImage(img, resolve, reject);
            };
            img.onerror = (e) => reject(new Error('Image load failed'));
            img.src = imageSource;
        } else {
            await processImage(img, resolve, reject);
        }
    });
};

const processImage = async (img, resolve, reject) => {
    try {
        const detections = await faceapi
            .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        const results = detections.map(d => ({
            descriptor: Array.from(d.descriptor),
            box: {
                x: (d.detection.box.x / img.width) * 100,
                y: (d.detection.box.y / img.height) * 100,
                w: (d.detection.box.width / img.width) * 100,
                h: (d.detection.box.height / img.height) * 100
            }
        }));
        resolve(results);
    } catch (e) {
        reject(e);
    }
};

/**
 * 比對兩個特徵值之間的歐氏距離 (Euclidean Distance)
 * 通常距離 < 0.45 為強匹配，< 0.6 視為疑似同一人
 */
export const compareFaces = (descriptor1, descriptor2) => {
    if (!descriptor1 || !descriptor2) return 1.0;
    return faceapi.euclideanDistance(descriptor1, descriptor2);
};

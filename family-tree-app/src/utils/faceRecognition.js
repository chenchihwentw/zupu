import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

/**
 * 加載人臉識別模型
 */
export const loadFaceModels = async () => {
    if (modelsLoaded) return;
    
    const MODEL_URL = '/models';
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
 * @param {HTMLImageElement|string} imageSource 圖像元素或 URL
 */
export const detectFacesAndDescriptors = async (imageSource) => {
    await loadFaceModels();
    
    let img;
    if (typeof imageSource === 'string') {
        img = await faceapi.fetchImage(imageSource);
    } else {
        img = imageSource;
    }

    const detections = await faceapi
        .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    
    return detections.map(d => ({
        descriptor: Array.from(d.descriptor),
        box: {
            x: (d.detection.box.x / img.width) * 100,
            y: (d.detection.box.y / img.height) * 100,
            w: (d.detection.box.width / img.width) * 100,
            h: (d.detection.box.height / img.height) * 100
        }
    }));
};

/**
 * 比對兩個特徵值之間的歐氏距離 (Euclidean Distance)
 * 距離越小越相似。通常 < 0.6 視為同一人。
 */
export const compareFaces = (descriptor1, descriptor2) => {
    if (!descriptor1 || !descriptor2) return 1.0;
    return faceapi.euclideanDistance(descriptor1, descriptor2);
};

/**
 * 尋找最匹配的人臉
 */
export const findBestMatch = (newDescriptor, knownFaceVectors) => {
    let bestMatch = { member_id: null, distance: 1.0 };
    
    for (const known of knownFaceVectors) {
        const dist = compareFaces(newDescriptor, known.vector);
        if (dist < bestMatch.distance) {
            bestMatch = { member_id: known.member_id, distance: dist };
        }
    }
    
    return bestMatch.distance < 0.6 ? bestMatch : null;
};

/**
 * 圖片工具函數
 * 用於提取圖片 EXIF 數據等
 */

/**
 * 從圖片文件中提取 EXIF 日期
 * @param {File} file - 圖片文件
 * @returns {Promise<string>} - ISO 格式的日期字符串 (YYYY-MM-DD)
 */
export function extractDateFromImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            
            try {
                // 簡單的 EXIF 日期提取
                // 查找 EXIF 日期標記 (DateTimeOriginal, DateTimeDigitized, DateTime)
                const datePatterns = [
                    { marker: [0x90, 0x03], name: 'DateTimeOriginal' }, // 0x9003
                    { marker: [0x90, 0x04], name: 'DateTimeDigitized' }, // 0x9004
                    { marker: [0x01, 0x32], name: 'DateTime' } // 0x0132
                ];
                
                const view = new DataView(arrayBuffer);
                let offset = 0;
                
                // 檢查 SOI 標記
                if (view.getUint16(0) !== 0xFFD8) {
                    reject(new Error('Not a valid JPEG'));
                    return;
                }
                
                offset = 2;
                
                // 遍歷 JPEG 段
                while (offset < view.byteLength) {
                    const marker = view.getUint16(offset);
                    
                    // APP1 段 (EXIF)
                    if (marker === 0xFFE1) {
                        const segmentLength = view.getUint16(offset + 2);
                        const segmentEnd = offset + 2 + segmentLength;
                        
                        // 檢查 EXIF 標識
                        const exifId = String.fromCharCode(
                            view.getUint8(offset + 4),
                            view.getUint8(offset + 5),
                            view.getUint8(offset + 6),
                            view.getUint8(offset + 7),
                            view.getUint8(offset + 8),
                            view.getUint8(offset + 9)
                        );
                        
                        if (exifId === 'Exif\x00\x00') {
                            // 查找 TIFF 頭
                            const tiffOffset = offset + 10;
                            const byteOrder = view.getUint16(tiffOffset);
                            const isLittleEndian = byteOrder === 0x4949; // 'II'
                            
                            // 獲取 IFD0 偏移
                            const ifdOffset = view.getUint32(tiffOffset + 4, isLittleEndian);
                            const ifdPosition = tiffOffset + ifdOffset;
                            
                            // 讀取條目數量
                            const numEntries = view.getUint16(ifdPosition, isLittleEndian);
                            
                            // 遍歷 IFD0 條目
                            for (let i = 0; i < numEntries; i++) {
                                const entryOffset = ifdPosition + 2 + (i * 12);
                                const tag = view.getUint16(entryOffset, isLittleEndian);
                                
                                // 檢查日期標記
                                for (const pattern of datePatterns) {
                                    const tagValue = (pattern.marker[0] << 8) | pattern.marker[1];
                                    if (tag === tagValue) {
                                        const type = view.getUint16(entryOffset + 2, isLittleEndian);
                                        const count = view.getUint32(entryOffset + 4, isLittleEndian);
                                        const valueOffset = view.getUint32(entryOffset + 8, isLittleEndian);
                                        
                                        // ASCII 字符串類型 (2)
                                        if (type === 2) {
                                            let dateStr = '';
                                            const stringOffset = count > 4 ? tiffOffset + valueOffset : entryOffset + 8;
                                            
                                            for (let j = 0; j < count - 1; j++) {
                                                const char = view.getUint8(stringOffset + j);
                                                if (char === 0) break;
                                                dateStr += String.fromCharCode(char);
                                            }
                                            
                                            // 解析 EXIF 日期格式: 兼容 "2023:10:15", "2023-10-15", "2023/10/15" 等
                                            const match = dateStr.match(/(\d{4})[:\-\/](\d{2})[:\-\/](\d{2})/);
                                            if (match) {
                                                const [, year, month, day] = match;
                                                resolve(`${year}-${month}-${day}`);
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        offset = segmentEnd;
                    } else if ((marker & 0xFF00) === 0xFF00) {
                        // 其他標記段
                        const segmentLength = view.getUint16(offset + 2);
                        offset += 2 + segmentLength;
                    } else {
                        break;
                    }
                }
                
                reject(new Error('No EXIF date found'));
                
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * 格式化日期為本地字符串
 * @param {string} dateStr - ISO 日期字符串
 * @returns {string} - 本地格式化的日期
 */
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * 計算兩個日期之間的年數
 * @param {string} birthDate - 出生日期
 * @param {string} targetDate - 目標日期
 * @returns {number|null} - 年齡
 */
export function calculateAge(birthDate, targetDate) {
    if (!birthDate || !targetDate) return null;
    
    const birth = new Date(birthDate);
    const target = new Date(targetDate);
    
    if (isNaN(birth.getTime()) || isNaN(target.getTime())) return null;
    
    let age = target.getFullYear() - birth.getFullYear();
    const monthDiff = target.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && target.getDate() < birth.getDate())) {
        age--;
    }
    
    return age >= 0 ? age : null;
}

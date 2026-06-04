import * as OpenCC from 'opencc-js';

// 建立轉換器 (繁體 tw 轉 簡體 cn)
let converter = null;
try {
  converter = OpenCC.Converter({ from: 'tw', to: 'cn' });
} catch (e) {
  console.warn('OpenCC init failed in mobile:', e);
}

export const setupI18n = (app) => {
  const currentLang = uni.getStorageSync('language') || 'zh-TW';

  // 定義全域翻譯函數 $t
  app.config.globalProperties.$t = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    if (currentLang === 'zh-CN' && converter) {
      return converter(text);
    }
    return text;
  };

  // 定義全域語言切換函數
  app.config.globalProperties.$setLanguage = (lang) => {
    uni.setStorageSync('language', lang);
    
    // 重新載入應用以套用翻譯
    // #ifdef H5
    window.location.reload();
    // #endif
    
    // #ifndef H5
    uni.reLaunch({
      url: '/pages/index/index'
    });
    // #endif
  };
  
  // 暴露當前語言屬性給元件使用
  app.config.globalProperties.$currentLanguage = currentLang;
};

// 用於更新底部 TabBar 的翻譯
export const translateTabBar = () => {
  const currentLang = uni.getStorageSync('language') || 'zh-TW';
  if (currentLang !== 'zh-CN' || !converter) return;

  const tabs = ['家族', '族譜', '祭殿', '探索'];
  tabs.forEach((text, index) => {
    uni.setTabBarItem({
      index: index,
      text: converter(text)
    });
  });
};

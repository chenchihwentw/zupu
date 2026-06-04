import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as OpenCC from 'opencc-js';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // 從 localStorage 讀取預設語言，預設為繁體 (true)
  const [isTraditional, setIsTraditional] = useState(() => {
    const saved = localStorage.getItem('isTraditional');
    return saved !== null ? saved === 'true' : true;
  });

  const restoreFunc = useRef(null);

  useEffect(() => {
    localStorage.setItem('isTraditional', isTraditional);

    if (!isTraditional) {
      // 轉換為簡體
      try {
        const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });
        
        // 初始化 HTMLConverter
        const htmlConverter = OpenCC.HTMLConverter(
          converter, 
          document.documentElement, 
          'zh-TW', 
          'zh-CN'
        );
        
        // 初始轉換
        htmlConverter.convert();

        // 為了支援 React 動態渲染，加入 MutationObserver
        let timeout;
        const observer = new MutationObserver(() => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            // 暫停監聽以避免無限迴圈
            observer.disconnect();
            
            try {
              document.documentElement.lang = 'zh-TW';
              htmlConverter.convert();
            } catch (e) {
              console.error('Dynamic OpenCC conversion failed', e);
            } finally {
              // 重新掛載監聽
              observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
            }
          }, 100);
        });

        // 啟動監聽
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

        // 儲存還原與清理函數
        restoreFunc.current = () => {
          observer.disconnect();
          clearTimeout(timeout);
          htmlConverter.restore();
        };
      } catch (e) {
        console.error('OpenCC conversion failed', e);
      }
    } else {
      // 恢復繁體
      if (restoreFunc.current) {
        restoreFunc.current();
        restoreFunc.current = null;
      }
    }

    // cleanup: component unmount 時恢復
    return () => {
      if (restoreFunc.current) {
        restoreFunc.current();
        restoreFunc.current = null;
      }
    };
  }, [isTraditional]);

  const toggleLanguage = () => {
    setIsTraditional(prev => !prev);
  };

  return (
    <LanguageContext.Provider value={{ isTraditional, setIsTraditional, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

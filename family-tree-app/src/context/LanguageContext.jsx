import React, { createContext, useState, useContext } from 'react';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [isTraditional, setIsTraditional] = useState(false);

  const toggleLanguage = () => {
    setIsTraditional(!isTraditional);
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

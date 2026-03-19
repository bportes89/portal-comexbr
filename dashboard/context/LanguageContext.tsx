'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('pt');

  // Load saved language preference
  useEffect(() => {
    const id = window.setTimeout(() => {
      const savedLang = window.localStorage.getItem('language') as Language;
      if (savedLang && (savedLang === 'pt' || savedLang === 'en')) {
        setLanguage(savedLang);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Save language preference
  useEffect(() => {
    window.localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string) => {
    const keys = key.split('.');
    let value: unknown = translations[language];
    
    for (const k of keys) {
      if (!value || typeof value !== 'object') return key;
      const record = value as Record<string, unknown>;
      if (!(k in record)) return key;
      value = record[k];
      }
    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

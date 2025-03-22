// context/AppContext.tsx (例)
import React, { createContext, useState, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  // 他の設定項目も追加
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false); // 初期値は仮
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

    // 初期化処理
    React.useEffect(() => {
      const loadSettings = async () => {
        try {
          const darkModeValue = await AsyncStorage.getItem('isDarkMode');
          const fontSizeValue = await AsyncStorage.getItem('fontSize');

          if (darkModeValue !== null) {
            setIsDarkMode(darkModeValue === 'true'); // 文字列を真偽値に変換
          }
          if(fontSizeValue !== null){
            setFontSize(fontSizeValue as 'small' | 'medium' | 'large')
          }
        } catch (error) {
          console.error('Failed to load settings from AsyncStorage', error);
        }
      };
        loadSettings();
    }, []);


  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      await AsyncStorage.setItem('isDarkMode', String(newMode)); // 真偽値を文字列で保存
    } catch (error) {
      console.error('Failed to save isDarkMode to AsyncStorage', error);
    }
  };

  const handleSetFontSize = async (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    try{
      await AsyncStorage.setItem('fontSize', size)
    } catch (error) {
      console.error('Failed to save fontSize to AsyncStorage', error)
    }
  }

  return (
    <AppContext.Provider value={{ isDarkMode, toggleDarkMode, fontSize, setFontSize: handleSetFontSize }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
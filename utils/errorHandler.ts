import { Alert } from 'react-native';

export const handleError = (error: unknown, customMessage?: string) => {
  console.error('エラーが発生しました:', error);
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : customMessage || '予期せぬエラーが発生しました';
  
  Alert.alert('エラー', errorMessage);
};

export const handleApiError = (error: unknown, operation: string) => {
  console.error(`${operation}の実行中にエラーが発生しました:`, error);
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : `${operation}の実行中に予期せぬエラーが発生しました`;
  
  Alert.alert('エラー', errorMessage);
}; 
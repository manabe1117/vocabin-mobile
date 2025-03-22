// app/settings.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useColorScheme } from '../hooks/useColorScheme'; // または直接 React Native の useColorScheme を使う
import { Picker } from '@react-native-picker/picker';


const SettingsScreen = () => {
  // React Native の useColorScheme を直接使う場合
  // const colorScheme = useColorScheme(); // 'light' | 'dark' | null
  const colorScheme = useColorScheme(); // カスタムフックを使う場合

  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [language, setLanguage] = useState<'en' | 'ja'>('ja');


  // ダークモードの切り替え
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
    // 実際には、ここで AsyncStorage などに設定を保存し、
    // アプリ全体の色テーマを切り替える処理が必要
  }, []);

  // 通知のオン/オフ
  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev) => !prev);
    // 実際には、ここでプッシュ通知の設定などを変更
  }, []);

  // フォントサイズの変更
  const handleFontSizeChange = (value: 'small' | 'medium' | 'large') => {
    setFontSize(value);
    // 実際には、ここで AsyncStorage などに設定を保存し、
    // アプリ全体のフォントサイズを変更する処理が必要
  };

    // 言語設定の変更
    const handleLanguageChange = (value: 'en' | 'ja') => {
      setLanguage(value);
    // 実際にはi18nライブラリと連携し、言語を切り替える
    };


  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示設定</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>ダークモード</Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isDarkMode ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>フォントサイズ</Text>
          <Picker
            selectedValue={fontSize}
            style={styles.picker}
            onValueChange={handleFontSizeChange}>
            <Picker.Item label="小" value="small" />
            <Picker.Item label="中" value="medium" />
            <Picker.Item label="大" value="large" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>通知設定</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>通知</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={notificationsEnabled ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
      </View>
       <View style={styles.section}>
        <Text style={styles.sectionTitle}>言語設定</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>言語</Text>
           <Picker
              selectedValue={language}
              style={styles.picker}
              onValueChange={handleLanguageChange}
            >
            <Picker.Item label="English" value="en" />
            <Picker.Item label="日本語" value="ja" />
          </Picker>
        </View>
      </View>


      {/* その他の設定項目をここに追加 */}

      <View style={styles.section}>
       <Text style={styles.settingLabel}>バージョン情報</Text>
        <Text>1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  settingLabel: {
    fontSize: 16,
  },
  picker: {
    width: 150,
  },
});

export default SettingsScreen;
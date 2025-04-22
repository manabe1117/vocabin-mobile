import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Keyboard, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VocabularyResult {
  id: number;
  vocabulary: string;
  meaning: string;
  pronunciation: string;
  part_of_speech: string;
  examples: { en: string; ja: string }[];
  synonyms: string[];
  notes: string;
  audio_url?: string;
}

interface DictionaryBannerProps {
  visible: boolean;
  vocabularies: VocabularyResult[];
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const DictionaryBanner: React.FC<DictionaryBannerProps> = ({ visible, vocabularies, onClose }) => {
  const [expanded, setExpanded] = useState<{ [id: number]: boolean }>({});
  const [isSaved, setIsSaved] = useState<{ [id: number]: boolean }>({});
  // バナーが表示されるたびに展開状態をリセット
  useEffect(() => {
    setExpanded({});
  }, [visible, vocabularies && vocabularies[0]?.id]);
  if (!visible || !vocabularies || vocabularies.length === 0) return null;
  // 1単語のみ表示前提
  const v = vocabularies[0];
  const isExpanded = expanded[v.id] === true;
  const saved = isSaved[v.id] === true;
  const handleSave = () => {
    setIsSaved(prev => ({ ...prev, [v.id]: !prev[v.id] }));
  };
  return (
    <View style={[styles.bannerContainer, isExpanded && styles.bannerContainerExpanded]} pointerEvents={isExpanded ? 'box-none' : 'auto'}>
      {isExpanded && (
        <TouchableOpacity
          style={styles.closeArea}
          activeOpacity={1}
          onPress={onClose}
        />
      )}
      <View style={[styles.card, isExpanded && styles.cardExpanded]}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.word}>{v.vocabulary}</Text>
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => {
              setExpanded((prev) => {
                const next = { ...prev, [v.id]: !prev[v.id] };
                if (!prev[v.id]) Keyboard.dismiss();
                return next;
              });
            }}
          >
            <Text style={styles.detailButtonText}>{isExpanded ? '閉じる' : '詳細'}</Text>
          </TouchableOpacity>
        </View>
        {/* 未展開時は意味のみ2行まで表示 */}
        {!isExpanded && (
          <Text style={styles.meaning} numberOfLines={2}>{v.meaning}</Text>
        )}
        {/* 展開時のみ詳細情報を表示 */}
        {isExpanded && (
          <>
            <ScrollView style={styles.detailScroll} contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={styles.pronunciation}>{v.pronunciation}</Text>
              <Text style={styles.partOfSpeech}>{v.part_of_speech}</Text>
              <View style={styles.section}><Text style={styles.sectionTitle}>意味</Text><Text style={styles.sectionText}>{v.meaning}</Text></View>
              {v.synonyms.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>類義語</Text>
                  <Text style={styles.sectionText}>{v.synonyms.join(', ')}</Text>
                </View>
              )}
              {v.examples.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>例文</Text>
                  {v.examples.slice(0, 3).map((ex, i) => (
                    <View key={i} style={styles.exampleContainer}>
                      <Text style={styles.exampleEn}>{ex.en}</Text>
                      <Text style={styles.exampleJa}>{ex.ja}</Text>
                    </View>
                  ))}
                </View>
              )}
              {v.notes && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>補足</Text>
                  <Text style={styles.sectionText}>{v.notes}</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saved && styles.savedButton]}
              onPress={handleSave}
            >
              <Ionicons
                name={saved ? 'checkmark-circle' : 'bookmark-outline'}
                size={20}
                color={saved ? '#4CAF50' : '#1976d2'}
                style={styles.saveButtonIcon}
              />
              <Text style={[styles.saveButtonText, saved && styles.savedButtonText]}>
                {saved ? '保存済み' : '保存'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  bannerContainerExpanded: {
    top: 0,
    bottom: 0,
    height: '100%',
    justifyContent: 'center',
    backgroundColor: undefined,
  },
  closeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 10000,
  },
  card: {
    width: width - 24,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 10001,
    minHeight: 48,
    maxHeight: 180,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardExpanded: {
    maxHeight: height * 0.7,
    minHeight: 180,
    padding: 18,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 8,
    zIndex: 10,
    padding: 2,
  },
  closeText: {
    fontSize: 20,
    color: '#888',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  word: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginRight: 8,
  },
  detailButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  detailButtonText: {
    color: '#1976d2',
    fontSize: 13,
    fontWeight: '500',
  },
  meaning: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  detailArea: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailScroll: {
    marginTop: 6,
    maxHeight: height * 0.7 - 80,
  },
  pronunciation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  partOfSpeech: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  section: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 1,
  },
  exampleContainer: {
    marginBottom: 2,
  },
  exampleEn: {
    fontSize: 12,
    color: '#444',
  },
  exampleJa: {
    fontSize: 11,
    color: '#888',
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    height: 44,
  },
  savedButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  savedButtonText: {
    color: '#4CAF50',
    lineHeight: 20,
  },
});

export default DictionaryBanner; 
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// VocabularyResult型の簡易定義（必要に応じてimportに変更可）
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

interface DictionaryModalProps {
  visible: boolean;
  onClose: () => void;
  vocabularies: VocabularyResult[];
}

const DictionaryModal: React.FC<DictionaryModalProps> = ({ visible, onClose, vocabularies }) => {
  if (!vocabularies || vocabularies.length === 0) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <ScrollView>
            {vocabularies.map((vocabulary, idx) => (
              <View key={vocabulary.id} style={idx > 0 ? styles.wordBlock : undefined}>
                <Text style={styles.word}>{vocabulary.vocabulary}</Text>
                <Text style={styles.pronunciation}>{vocabulary.pronunciation}</Text>
                <Text style={styles.partOfSpeech}>{vocabulary.part_of_speech}</Text>
                <Text style={styles.meaning}>{vocabulary.meaning}</Text>
                {vocabulary.examples.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>例文</Text>
                    {vocabulary.examples.map((ex, i) => (
                      <View key={i} style={styles.exampleContainer}>
                        <Text style={styles.exampleEn}>{ex.en}</Text>
                        <Text style={styles.exampleJa}>{ex.ja}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {vocabulary.synonyms.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>類義語</Text>
                    <Text>{vocabulary.synonyms.join(', ')}</Text>
                  </View>
                )}
                {vocabulary.notes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>補足</Text>
                    <Text>{vocabulary.notes}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  word: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#222',
  },
  wordBlock: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  pronunciation: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  partOfSpeech: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  meaning: {
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 4,
  },
  exampleContainer: {
    marginBottom: 6,
  },
  exampleEn: {
    fontSize: 15,
    color: '#444',
  },
  exampleJa: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
});

export default DictionaryModal; 
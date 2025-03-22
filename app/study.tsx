// app/study.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Flashcard {
  id: number;
  front: string; // 表面 (問題)
  back: string;  // 裏面 (解答)
}

const StudyScreen = () => {
  // ダミーのフラッシュカードデータ (本来はAPIやストレージから読み込む)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { id: 1, front: 'Hello', back: 'こんにちは' },
    { id: 2, front: 'Thank you', back: 'ありがとう' },
    { id: 3, front: 'Good morning', back: 'おはようございます' },
    { id: 4, front: "Good bye", back: "さようなら"}
  ]);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const currentCard = flashcards[currentCardIndex];

  const handleNextCard = () => {
    // 次のカードへ (最後のカードなら最初に戻る)
    setCurrentCardIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
    setShowBack(false); // 裏面を非表示に戻す
  };
  const handlePrevCard = () => {
    // 前のカードに戻る。
    setCurrentCardIndex((prevIndex) => prevIndex === 0 ? flashcards.length - 1: prevIndex - 1);
    setShowBack(false);
  }

  const handleFlipCard = () => {
    setShowBack(!showBack);
  };

  return (
    <View style={styles.container}>
      {flashcards.length > 0 ? (
        <>
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={[styles.card, showBack ? styles.cardBack : styles.cardFront]}
              onPress={handleFlipCard}
            >
              <Text style={styles.cardText}>
                {showBack ? currentCard.back : currentCard.front}
              </Text>
            </TouchableOpacity>
            <Text style={styles.cardIndexText}>{currentCardIndex + 1} / {flashcards.length}</Text>
          </View>
          <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handlePrevCard}>
              <Text style={styles.buttonText}>前へ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleNextCard}>
              <Text style={styles.buttonText}>次へ</Text>
            </TouchableOpacity>

          </View>
        </>
      ) : (
        <Text style={styles.emptyText}>登録されたフレーズがありません</Text>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    height: 250, // カードの高さを固定
    marginBottom: 20,
  },
  card: {
    flex: 1, // cardContainer の高さいっぱいにする
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    padding: 20,
    // 影をつける (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // 影をつける (Android)
    elevation: 5,
  },
  cardFront: {
    backgroundColor: 'white',
  },
  cardBack: {
    backgroundColor: '#e0f7fa', // 裏面の色を変える
  },
  cardText: {
    fontSize: 24,
    textAlign: 'center', // テキストを中央揃え
  },
  cardIndexText:{
    textAlign: 'center',
    marginTop: 5,
    color: 'gray',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
  emptyText: {
    fontSize: 18,
    color: '#777',
  },
});

export default StudyScreen;
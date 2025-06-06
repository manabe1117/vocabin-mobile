import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ANIMATION } from '../constants/animation';
import { COMMON_STYLES, COLORS } from '../constants/styles';
import { useSpeech } from '../hooks/useSpeech';
import { router } from 'expo-router';

// フラッシュカードの型定義
interface Flashcard {
    id: number;
    vocabulary_id: number;
    vocabulary: string;
    part_of_speech: string;
    meanings: string[];
    examples: { en: string; ja: string }[];
    synonyms: string[];
    antonyms: string[];
    box_level: number;
    lastStudied: string;
    reviewCount: number;
    isCorrect: boolean;
    audioData: string;
    hasBeenWrong: boolean;
}

const StudyScreen = () => {
  const { session } = useAuth();
  const { speakText } = useSpeech();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const flashcardsRef = useRef(flashcards);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [showMeaningOnFront, setShowMeaningOnFront] = useState(false);

  const fetchFlashcards = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('fetchFlashcards: session', session);
      if (!session?.access_token) {
        throw new Error('認証トークンがありません');
      }
      const { data, error } = await supabase.functions.invoke('get-flashcards');
      console.log('fetchFlashcards: API response', { data, error });
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
          const errorDetail = await error.context.json();
          console.log('fetchFlashcards: error.context.json()', errorDetail);
        }
        throw error;
      }
      console.log('fetchFlashcards: data', data);
      const fetchedFlashcards = (data || []).map((card: any) => ({
        ...card,
        reviewCount: card.reviewCount || 0,
        isCorrect: false,
        hasBeenWrong: false,
      }));
      console.log('fetchFlashcards: fetchedFlashcards', fetchedFlashcards);
      setFlashcards(fetchedFlashcards);
      flashcardsRef.current = fetchedFlashcards;

      // 最初のカードの音声を再生
      if (fetchedFlashcards.length > 0) {
        speakText(fetchedFlashcards[0].vocabulary, '英語');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '予期せぬエラーが発生しました';
      setError(errorMessage);
      console.log('fetchFlashcards error', err);
      flashcardsRef.current = [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchFlashcards();
    } else {
        setIsLoading(false);
        flashcardsRef.current = [];
    }
  }, [session?.access_token]);

  useEffect(() => {
    flashcardsRef.current = flashcards;
  }, [flashcards]);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; color: string; position: 'topLeft' | 'topRight' } | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current; // フリップアニメーション用
  const swipeValue = useRef(new Animated.ValueXY()).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  // currentCardIndexの参照を追加
  const currentCardIndexRef = useRef(currentCardIndex);

  // currentCardIndexが更新されたときにrefも更新
  useEffect(() => {
    currentCardIndexRef.current = currentCardIndex;
  }, [currentCardIndex]);

  useEffect(() => {
    console.log('Current card index updated:', {
      state: currentCardIndex,
      ref: currentCardIndexRef.current
    });
  }, [currentCardIndex]);

  const showFeedback = (text: string, color: string, position: 'topLeft' | 'topRight') => {
    setFeedbackMessage({ text, color, position });
    feedbackOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 200,
        delay: 800,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleCardAction = (isCorrect: boolean) => {
    if (isAnimating || isFlipping) return;
    setIsAnimating(true);
    showFeedback(isCorrect ? 'Good!' : 'Try again', isCorrect ? '#77dd77' : '#ff6961', isCorrect ? 'topRight' : 'topLeft');

    try {
      const currentIndex = currentCardIndexRef.current;
      const currentCard = flashcardsRef.current[currentIndex];
      if (!currentCard) return;

      // 音声再生を削除し、学習状態の更新のみを実行
      supabase.functions.invoke('update-study-status', {
        method: 'PUT',
        body: {
          vocabularyId: currentCard.vocabulary_id,
          isCorrect,
          studyDate: new Date().toISOString(),
        }
      }).catch(err => {
        console.error('学習状態の更新に失敗しました:', err);
      });

      // カードの正解状態を更新
      setFlashcards(prev => {
        const newFlashcards = [...prev];
        const currentCardData = newFlashcards[currentIndex];
        newFlashcards[currentIndex] = {
          ...currentCardData,
          isCorrect,
          hasBeenWrong: currentCardData.hasBeenWrong || !isCorrect,
        };
        return newFlashcards;
      });

      Animated.parallel([
        Animated.timing(swipeValue, {
          toValue: { x: isCorrect ? screenWidth : -screenWidth, y: 0 },
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        // 次のカードのインデックスを計算
        const currentLength = flashcardsRef.current.length;
        let nextIndex = (currentIndex + 1) % currentLength;
        let count = 0;

        // 次の未正解のカードを探す
        while (count < currentLength) {
          if (!flashcardsRef.current[nextIndex].isCorrect) {
            break;
          }
          nextIndex = (nextIndex + 1) % currentLength;
          count++;
        }

        // すべてのカードが正解になったかチェック
        const allCorrect = flashcardsRef.current.every(card => card.isCorrect);
        if (allCorrect) {
          setShowCompletionMessage(true);
          return;
        }

        // カードの状態をリセット
        setFeedbackMessage(null);
        feedbackOpacity.setValue(0);
        setShowBack(false);
        animatedValue.setValue(0);
        
        // 状態の更新を確実に行う
        requestAnimationFrame(() => {
          currentCardIndexRef.current = nextIndex;
          setCurrentCardIndex(nextIndex);
          swipeValue.setValue({ x: 0, y: 0 });
          setIsAnimating(false);
        });
      });
    } catch (err) {
      console.error('学習状態の更新に失敗しました:', err);
      setIsAnimating(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isAnimating && !isFlipping,
      onMoveShouldSetPanResponder: () => !isAnimating && !isFlipping,
      onPanResponderGrant: (evt, gestureState) => {
        if (isAnimating || isFlipping) return;
        setSwipeDistance(0);
        setIsSwiping(false);
        setTouchStartTime(Date.now());
        setTouchStartX(gestureState.x0);
        setTouchStartY(gestureState.y0);
        swipeValue.setOffset({ x: 0, y: 0 });
        setShowMeaningOnFront(true);
        
        const currentIndex = currentCardIndexRef.current;
        const currentCard = flashcardsRef.current[currentIndex];
        console.log('Current card on swipe start:', {
          index: currentIndex,
          card: currentCard,
          vocabulary: currentCard?.vocabulary,
          meanings: currentCard?.meanings
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isAnimating || isFlipping) return;
        const dx = Math.abs(gestureState.moveX - touchStartX);
        const dy = Math.abs(gestureState.moveY - touchStartY);
        setSwipeDistance(dx);
        if (dx > 10 || dy > 10) {
          setIsSwiping(true);
        }
        swipeValue.setValue({
          x: gestureState.dx,
          y: gestureState.dy
        });
      },
      onPanResponderRelease: (evt, gestureState) => {
        console.log('onPanResponderRelease');
        if (isAnimating || isFlipping) return;
        setSwipeDistance(0);
        setIsSwiping(false);

        const SWIPE_THRESHOLD = screenWidth / 3;
        const dx = gestureState.dx;
        const vx = gestureState.vx;

        let direction = 0;
        if (dx > SWIPE_THRESHOLD || vx > 0.5) {
          direction = 1;
        } else if (dx < -SWIPE_THRESHOLD || vx < -0.5) {
          direction = -1;
        }

        if (direction !== 0) {
          handleCardAction(direction === 1);
        } else {
          Animated.spring(swipeValue, {
            toValue: { x: 0, y: 0 },
            friction: 9,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleNextCard = () => {
    handleCardAction(true);
  };

  const handleUnknown = () => {
    handleCardAction(false);
  };

  const currentCard = flashcards[currentCardIndex];

  const flipCard = () => {
    if (!currentCard || isAnimating || isFlipping || isSwiping) {
      console.log('Cannot flip card now.');
      return;
    }

    if (swipeDistance > ANIMATION.THRESHOLD.SWIPE) {
      console.log('Cannot flip while swiping.');
      return;
    }

    if (Date.now() - touchStartTime > ANIMATION.THRESHOLD.TAP_DURATION) {
      console.log('Not a tap.');
      return;
    }

    setIsFlipping(true);
    Animated.timing(animatedValue, {
      toValue: showBack ? ANIMATION.VALUES.FLIP.START : ANIMATION.VALUES.FLIP.END,
      duration: ANIMATION.DURATION.SHORT,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setShowBack(!showBack);
      setIsFlipping(false);
    });
  };

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
    shadowOpacity: isAnimating || isFlipping ? 0 : 0.2,
    shadowColor: isAnimating || isFlipping ? 'transparent' : '#000',
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
    shadowOpacity: isAnimating || isFlipping ? 0 : 0.2,
    shadowColor: isAnimating || isFlipping ? 'transparent' : '#000',
  };

  const cardTransitionStyle = {
    transform: [
      { translateX: swipeValue.x },
      { translateY: swipeValue.y },
    ],
    opacity: 1, // ★コメントアウト継続
  };

  useEffect(() => {
    setFeedbackMessage(null);
    feedbackOpacity.setValue(0);
    setShowBack(false);
    animatedValue.setValue(0);
    setShowMeaningOnFront(false);

    // 新しいカードがセットされたときに音声を再生
    if (currentCard?.vocabulary) {
      speakText(currentCard.vocabulary, '英語');
    }
  }, [currentCardIndex]);

  if (showCompletionMessage) {
    return (
      <View style={[COMMON_STYLES.container, styles.completionContainer]}>
        <Text style={styles.completionText}>You Did It!</Text>
        <Text style={styles.completionDescription}>
          すべての学習が終了しました！
        </Text>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={() => {
            if (flashcards.length >= 50) {
              // 続けて学習するの場合は、同じ画面に再度遷移する
              // これにより、コンポーネントが再マウントされ、最初から始まる
              router.replace('/study');
            } else {
              router.push('/');
            }
          }}
        >
          <Text style={styles.reloadButtonText}>
            {flashcards.length >= 50 ? '続けて学習する' : 'ホーム画面に戻る'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={COMMON_STYLES.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={COMMON_STYLES.loadingText}>フラッシュカードを読み込み中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={COMMON_STYLES.errorContainer}>
        <Text style={COMMON_STYLES.errorText}>{error}</Text>
        <TouchableOpacity
          style={COMMON_STYLES.retryButton}
          onPress={fetchFlashcards}
        >
          <Text style={COMMON_STYLES.retryButtonText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isLoading && (!flashcards || flashcards.length === 0)) {
    return (
      <View style={COMMON_STYLES.container}>
        <Text style={COMMON_STYLES.emptyText}>登録されたフレーズがありません</Text>
      </View>
    );
  }

  if (!currentCard) {
    console.error("Error: currentCard is invalid. Index:", currentCardIndex, "Flashcards length:", flashcards.length);
    setCurrentCardIndex(0);
    return null;
  }

  return (
    <View style={[COMMON_STYLES.container, styles.studyContainer]}>
      <View style={styles.topBar}>
        <Text style={styles.progressText}>
          {flashcards.filter(card => card.isCorrect).length}/{flashcards.length}
        </Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              { width: `${(flashcards.filter(card => card.isCorrect).length / flashcards.length) * 100}%` }
            ]}
          />
        </View>
      </View>

      <Animated.View style={[styles.cardContainer, cardTransitionStyle, {opacity: 1}]} {...panResponder.panHandlers}>
        {/* カードの表面 */}
        <Animated.View
          style={[styles.card, styles.cardFront, frontAnimatedStyle]}
          onTouchEnd={flipCard}
        >
          <Text style={styles.cardWord}>{currentCard.vocabulary}</Text>
          {showMeaningOnFront ? (
            <Text style={styles.meaningText}>{currentCard.meanings.join('、')}</Text>
          ) : (
            (currentCard.reviewCount > 0 || currentCard.hasBeenWrong) && (
              <Text style={styles.cardExample}>{currentCard.examples[0]?.en || ''}</Text>
            )
          )}
        </Animated.View>

        {/* カードの裏面 */}
        <Animated.View
          style={[styles.card, styles.cardBack, backAnimatedStyle]}
          onTouchEnd={flipCard}
        >
          <View style={styles.cardBackContent}>
            <View style={styles.meaningContainer}>
              <Text style={styles.meaningText} numberOfLines={2}>
                {currentCard.meanings.join('、')}
              </Text>
              <Text style={styles.partOfSpeech}>{currentCard.part_of_speech}</Text>
            </View>

            {currentCard.synonyms.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>類義語</Text>
                <View style={styles.synonymContainer}>
                  {currentCard.synonyms.map((synonym, index) => (
                    <View key={index} style={styles.synonym}>
                      <Text style={styles.synonymText}>{synonym}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {currentCard.examples.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>例文</Text>
                <View style={styles.examplesContainer}>
                  {(() => {
                    // 最初の2つの例文の日本語の文字数をチェック
                    const firstExampleLength = currentCard.examples[0]?.ja?.length || 0;
                    const secondExampleLength = currentCard.examples[1]?.ja?.length || 0;
                    
                    // 両方とも20文字を超える場合は1つ目のみ表示
                    if (firstExampleLength > 20 && secondExampleLength > 20) {
                      return (
                        <View style={styles.exampleItem}>
                          <Text style={styles.exampleEn}>{currentCard.examples[0].en}</Text>
                          <Text style={styles.exampleJa}>{currentCard.examples[0].ja}</Text>
                        </View>
                      );
                    }
                    
                    // それ以外の場合は2つ表示
                    return currentCard.examples.slice(0, 2).map((example, index) => (
                      <View key={index} style={styles.exampleItem}>
                        <Text style={styles.exampleEn}>{example.en}</Text>
                        <Text style={styles.exampleJa}>{example.ja}</Text>
                      </View>
                    ));
                  })()}
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>

      {/* フィードバックメッセージ */}
      {feedbackMessage && (
        <Animated.View
          style={[
            styles.feedbackContainer,
            {
              opacity: feedbackOpacity,
              top: 100,
              [feedbackMessage.position === 'topLeft' ? 'left' : 'right']: 40,
            }
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.feedbackText, { color: feedbackMessage.color }]}>
            {feedbackMessage.text}
          </Text>
        </Animated.View>
      )}

      {/* 操作ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonRed]}
          onPress={handleUnknown}
          disabled={isAnimating || isFlipping}
        >
          <Text style={styles.buttonText}>？</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonGreen]}
          onPress={handleNextCard}
          disabled={isAnimating || isFlipping}
        >
          <Ionicons name="checkmark-circle" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  studyContainer: {
    // スタディ画面固有のスタイル
  },
  topBar: {
    width: '100%',
    paddingTop: 10,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    color: '#666',
  },
  cardContainer: {
    width: '100%',
    height: 400,
    marginBottom: 20,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  cardFront: {
    backgroundColor: 'white',
  },
  cardBack: {
    backgroundColor: 'white',
    transform: [{ rotateY: '180deg' }],
  },
  cardWord: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  cardExample: {
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
    marginBottom: 40,
  },
  cardBackContent: {
    flex: 1,
    width: '100%',
    padding: 16,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  wordContainer: {
    flex: 1,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  pronunciation: {
    fontSize: 16,
    color: '#6c757d',
  },
  soundButton: {
    padding: 8,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 16,
    color: '#212529',
    lineHeight: 20,
  },
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    overflow: 'hidden',
    maxHeight: 28, // 1行分の高さに制限
  },
  synonym: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    height: 28,
    justifyContent: 'center',
  },
  synonymText: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
  },
  exampleItem: {
    marginBottom: 8,
  },
  exampleEn: {
    fontSize: 16,
    color: '#212529',
    marginBottom: 2,
  },
  exampleJa: {
    fontSize: 14,
    color: '#6c757d',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  buttonRed: {
    backgroundColor: '#ff6961',
  },
  buttonGreen: {
    backgroundColor: '#77dd77',
  },
  buttonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 18,
    color: '#777',
    marginTop: 50,
  },
  progressBarContainer: {
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 2,
  },
  feedbackContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  feedbackText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  completionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completionText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 20,
  },
  completionDescription: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  reloadButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  reloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  meaningContainer: {
    marginBottom: 16,
  },
  meaningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  partOfSpeech: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 4,
  },
  examplesContainer: {
    overflow: 'hidden',
  },
});

export default StudyScreen;
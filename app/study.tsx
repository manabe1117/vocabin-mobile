import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useAudio } from '../hooks/useAudio';
import { ANIMATION } from '../constants/animation';
import { COMMON_STYLES, COLORS } from '../constants/styles';
import { handleApiError } from '../utils/errorHandler';

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
}

const StudyScreen = () => {
  const { session } = useAuth();
  const { playSound } = useAudio();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const flashcardsRef = useRef(flashcards);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlashcards = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!session?.access_token) {
        throw new Error('認証トークンがありません');
      }
      const { data, error } = await supabase.functions.invoke('get-flashcards', {
        body: { type: 3 }
      });
      if (error) throw error;
      const fetchedFlashcards = (data || []).map((card: Flashcard) => ({
        ...card,
        isCorrect: false
      }));
      setFlashcards(fetchedFlashcards);
      flashcardsRef.current = fetchedFlashcards;
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

      // 音声再生とエッジ関数の呼び出しを並列実行
      Promise.all([
        supabase.functions.invoke('update-study-status', {
          method: 'PUT',
          body: {
            vocabularyId: currentCard.vocabulary_id,
            isCorrect,
            studyDate: new Date().toISOString(),
            type: 3
          }
        }).catch(err => {
          console.error('学習状態の更新に失敗しました:', err);
        }),
        playSound(currentCard.vocabulary).catch(err => {
          console.error('音声再生に失敗しました:', err);
        })
      ]);

      // カードの正解状態を更新
      setFlashcards(prev => {
        const newFlashcards = [...prev];
        newFlashcards[currentIndex] = {
          ...newFlashcards[currentIndex],
          isCorrect
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
        setCurrentCardIndex(prevIndex => {
          const currentLength = flashcardsRef.current.length;
          let count = 0;
          let newIndex = 0;

          // 次のisCorrect=falseのカードを探す
          for (let i = (prevIndex + 1) % currentLength; count < currentLength; i = (i + 1) % currentLength) {
            if (!flashcardsRef.current[i].isCorrect) {
              newIndex = i;
              break;
            }
            count++;
          }

          return newIndex;
        });
        swipeValue.setValue({ x: 0, y: 0 });
        if (showBack) {
          setShowBack(false);
          animatedValue.setValue(0);
        }
        setIsAnimating(false);
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
    setShowBack(false); // カードが切り替わった時に必ず表面を表示
    animatedValue.setValue(0); // アニメーションの値もリセット
  }, [currentCardIndex]);

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
          style={[styles.card, styles.cardFront, frontAnimatedStyle/*, showBack ? styles.hidden : {}*/]} // hidden はコメントアウト
          onTouchEnd={flipCard}
        >
          <Text style={styles.cardWord}>{currentCard.vocabulary}</Text>
          <Text style={styles.cardPronunciation}>{currentCard.part_of_speech}</Text>
          <Text style={styles.cardExample}>{currentCard.examples[0]?.en || '例文なし'}</Text>
        </Animated.View>

        {/* カードの裏面 */}
        <Animated.View
          style={[styles.card, styles.cardBack, backAnimatedStyle/*, !showBack ? styles.hidden : {}*/]} // hidden はコメントアウト
          onTouchEnd={flipCard}
        >
          <Text style={styles.cardBackText}>{currentCard.meanings[0] || '意味なし'}</Text>
          {currentCard.synonyms.length > 0 && (
            <View style={styles.synonymsContainer}>
              <Text style={styles.synonymsTitle}>類義語:</Text>
              <Text style={styles.synonymsText}>{currentCard.synonyms.join(', ')}</Text>
            </View>
          )}
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
  cardPronunciation: {
    fontSize: 20,
    color: '#666',
    marginBottom: 20,
  },
  cardExample: {
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
    marginBottom: 40,
  },
  cardBackText: {
    fontSize: 36,
    textAlign: 'center',
    color: '#333',
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
  synonymsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  synonymsTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  synonymsText: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
});

export default StudyScreen;
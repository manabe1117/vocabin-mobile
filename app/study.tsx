import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { router } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ANIMATION } from '../constants/animation';
import { COMMON_STYLES, COLORS } from '../constants/styles';
import { useSpeech } from '../hooks/useSpeech';
import { ThemedText } from '../components/ThemedText';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

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
  const [randomExampleIndex, setRandomExampleIndex] = useState(0);

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
    showFeedback(isCorrect ? 'Good!' : 'Try again', isCorrect ? COLORS.SUCCESS.DEFAULT : COLORS.ERROR.DEFAULT, isCorrect ? 'topRight' : 'topLeft');

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
    opacity: 1,
  };

  useEffect(() => {
    setFeedbackMessage(null);
    feedbackOpacity.setValue(0);
    setShowBack(false);
    animatedValue.setValue(0);
    setShowMeaningOnFront(false);

    // 新しいカードの例文をランダムに選択
    if (currentCard?.examples && currentCard.examples.length > 0) {
      const randomIndex = Math.floor(Math.random() * currentCard.examples.length);
      setRandomExampleIndex(randomIndex);
    }

    // 新しいカードがセットされたときに音声を再生
    if (currentCard?.vocabulary) {
      speakText(currentCard.vocabulary, '英語');
    }
  }, [currentCardIndex]);

  if (showCompletionMessage) {
    return (
      <View style={styles.completionContainer}>
        <Card style={styles.completionCard}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.SUCCESS.DEFAULT} style={styles.completionIcon} />
          <ThemedText type="title" style={styles.completionTitle}>You Did It!</ThemedText>
          <ThemedText style={styles.completionDescription}>
            すべての学習が終了しました！{'\n'}お疲れ様でした。
          </ThemedText>
          <Button
            title={flashcards.length >= 50 ? '続けて学習する' : 'ホーム画面に戻る'}
            onPress={() => {
              if (flashcards.length >= 50) {
                router.replace('/study');
              } else {
                router.push('/');
              }
            }}
            type="primary"
            size="large"
            style={styles.completionButton}
          />
        </Card>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={COMMON_STYLES.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <ThemedText style={COMMON_STYLES.loadingText}>フラッシュカードを読み込み中...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={COMMON_STYLES.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={COLORS.ERROR.DEFAULT} style={styles.errorIcon} />
        <ThemedText style={COMMON_STYLES.errorText}>{error}</ThemedText>
        <Button
          title="再試行"
          onPress={fetchFlashcards}
          type="primary"
          style={styles.retryButton}
        />
      </View>
    );
  }

  if (!isLoading && (!flashcards || flashcards.length === 0)) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="book-outline" size={80} color={COLORS.TEXT.LIGHTER} style={styles.emptyIcon} />
        <ThemedText style={styles.emptyTitle}>学習する単語がありません</ThemedText>
        <ThemedText style={styles.emptyDescription}>
          辞書検索で新しい単語を保存するか、{'\n'}時間をおいてから再度確認してください
        </ThemedText>
        <ThemedText style={styles.emptySubDescription}>
          保存した単語は一定間隔で復習対象になります
        </ThemedText>
        <View style={styles.emptyButtonContainer}>
          <Button
            title="辞書を見る"
            onPress={() => router.push('/dictionary')}
            type="primary"
            style={styles.emptyButton}
          />
          <Button
            title="再読み込み"
            onPress={fetchFlashcards}
            type="secondary"
            style={styles.emptyButton}
          />
        </View>
      </View>
    );
  }

  if (!currentCard) {
    console.error("Error: currentCard is invalid. Index:", currentCardIndex, "Flashcards length:", flashcards.length);
    setCurrentCardIndex(0);
    return null;
  }

  return (
    <View style={styles.studyContainer}>
      {/* プログレスヘッダー */}
             <View style={styles.progressHeader}>
         <View style={styles.progressInfo}>
           <ThemedText type="defaultSemiBold" style={styles.progressText}>
             {flashcards.filter(card => card.isCorrect).length} / {flashcards.length}
           </ThemedText>
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
      </View>

      {/* フラッシュカード */}
      <View style={styles.cardSection}>
        <Animated.View style={[styles.cardContainer, cardTransitionStyle]} {...panResponder.panHandlers}>
          {/* カードの表面 */}
          <Animated.View
            style={[styles.flashCard, styles.cardFront, frontAnimatedStyle]}
            onTouchEnd={flipCard}
          >
            <Card style={styles.cardContent}>
              <ThemedText type="title" style={styles.vocabularyText}>
                {currentCard.vocabulary}
              </ThemedText>
              {showMeaningOnFront ? (
                <ThemedText style={styles.meaningPreviewText}>
                  {currentCard.meanings.join('、')}
                </ThemedText>
              ) : (
                (currentCard.reviewCount > 0 || currentCard.hasBeenWrong) && currentCard.examples[randomExampleIndex] && (
                  <ThemedText style={styles.examplePreviewText}>
                    {currentCard.examples[randomExampleIndex].en}
                  </ThemedText>
                )
              )}
              <View style={styles.flipHint}>
                <Ionicons name="refresh" size={16} color={COLORS.TEXT.LIGHTER} />
                <ThemedText style={styles.flipHintText}>タップして詳細を表示</ThemedText>
              </View>
            </Card>
          </Animated.View>

          {/* カードの裏面 */}
          <Animated.View
            style={[styles.flashCard, styles.cardBack, backAnimatedStyle]}
            onTouchEnd={flipCard}
          >
            <Card style={styles.cardContent}>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.cardBackScrollView} contentContainerStyle={styles.cardBackScrollContent}>
                <View style={styles.cardBackContent}>
                  <View style={styles.meaningSection}>
                    <ThemedText style={styles.meaningText}>
                      {currentCard.meanings.join('、')}
                    </ThemedText>
                    <ThemedText style={styles.partOfSpeechText}>
                      {currentCard.part_of_speech}
                    </ThemedText>
                  </View>

                  {currentCard.examples.length > 0 && (
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionTitle}>例文</ThemedText>
                      <View style={styles.examplesContainer}>
                        {(() => {
                          const firstExampleLength = currentCard.examples[0]?.ja?.length || 0;
                          const secondExampleLength = currentCard.examples[1]?.ja?.length || 0;
                          
                          if (firstExampleLength > 20 && secondExampleLength > 20) {
                            return (
                              <View style={styles.exampleItem}>
                                <ThemedText style={styles.exampleEn}>{currentCard.examples[0].en}</ThemedText>
                                <ThemedText style={styles.exampleJa}>{currentCard.examples[0].ja}</ThemedText>
                              </View>
                            );
                          }
                          
                          return currentCard.examples.slice(0, 2).map((example, index) => (
                            <View key={index} style={styles.exampleItem}>
                              <ThemedText style={styles.exampleEn}>{example.en}</ThemedText>
                              <ThemedText style={styles.exampleJa}>{example.ja}</ThemedText>
                            </View>
                          ));
                        })()}
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            </Card>
          </Animated.View>
        </Animated.View>
      </View>

      {/* フィードバックメッセージ */}
      {feedbackMessage && (
        <Animated.View
          style={[
            styles.feedbackContainer,
            {
              opacity: feedbackOpacity,
              top: 120,
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

      {/* アクションボタン */}
      <View style={styles.actionSection}>
        <View style={styles.swipeHints}>
          <View style={styles.swipeHint}>
            <Ionicons name="arrow-back" size={20} color={COLORS.ERROR.DEFAULT} />
            <ThemedText style={styles.swipeHintText}>分からない</ThemedText>
          </View>
          <View style={styles.swipeHint}>
            <ThemedText style={styles.swipeHintText}>知っている</ThemedText>
            <Ionicons name="arrow-forward" size={20} color={COLORS.SUCCESS.DEFAULT} />
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
                    <Button
            onPress={handleUnknown}
            disabled={isAnimating || isFlipping}
            type="error"
            size="large"
            style={styles.unknownActionButton}
          >
            <Ionicons name="close" size={28} color={COLORS.WHITE} />
          </Button>
          
          <Button
            onPress={handleNextCard}
            disabled={isAnimating || isFlipping}
            type="success"
            size="large"
            style={styles.knownActionButton}
          >
            <Ionicons name="checkmark" size={28} color={COLORS.WHITE} />
          </Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  studyContainer: {
    flex: 1,
    paddingTop: 10,
    backgroundColor: COLORS.WHITE,
  },
  
  // プログレスヘッダー
  progressHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 24,
    color: COLORS.PRIMARY,
    marginRight: 8,
  },
  progressLabel: {
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: COLORS.BACKGROUND.GRAY_LIGHT,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 5,
  },

  // カードセクション
  cardSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 20,
  },
  cardContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  flashCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    zIndex: 2,
  },
  cardBack: {
    transform: [{ rotateY: '180deg' }],
    zIndex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
    paddingBottom: 30,
    borderRadius: 16,
    elevation: 4,
  },
  
  // カード表面
  vocabularyText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.TEXT.DARKER,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 50,
  },
  meaningPreviewText: {
    fontSize: 18,
    color: COLORS.TEXT.SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  examplePreviewText: {
    fontSize: 16,
    color: COLORS.TEXT.LIGHT,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
    lineHeight: 24,
  },
  flipHint: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flipHintText: {
    fontSize: 12,
    color: COLORS.TEXT.LIGHTER,
    marginLeft: 4,
  },

  // カード裏面
  cardBackScrollView: {
    flex: 1,
  },
  cardBackScrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  cardBackContent: {
    flex: 1,
  },
  meaningSection: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  meaningText: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    textAlign: 'left',
    marginBottom: 8,
    lineHeight: 30,
  },
  partOfSpeechText: {
    fontSize: 15,
    color: COLORS.TEXT.LIGHT_GRAY,
    fontWeight: '500',
    textAlign: 'left',
  },
  
  // セクション
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: 8,
    textAlign: 'left',
  },
  
  // 類義語
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  synonymChip: {
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  synonymText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: '500',
  },
  
  // 例文
  examplesContainer: {
    gap: 16,
  },
  exampleItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
    marginBottom: 4,
  },
  exampleEn: {
    fontSize: 15,
    color: COLORS.TEXT.DARKER,
    lineHeight: 22,
    marginBottom: 6,
    fontWeight: '500',
    textAlign: 'left',
  },
  exampleJa: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    lineHeight: 20,
    textAlign: 'left',
  },

  // フィードバック
  feedbackContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  feedbackText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // アクションセクション
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  swipeHintText: {
    fontSize: 12,
    color: COLORS.TEXT.LIGHT,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
       unknownActionButton: {
    flex: 1,
    borderRadius: 16,
    minHeight: 60,
    shadowColor: COLORS.ERROR.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  knownActionButton: {
    flex: 1,
    borderRadius: 30,
    minHeight: 60,
    shadowColor: COLORS.SUCCESS.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // 完了画面
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.WHITE,
  },
  completionCard: {
    alignItems: 'center',
    padding: 40,
    width: '100%',
    maxWidth: 320,
  },
  completionIcon: {
    marginBottom: 20,
  },
  completionTitle: {
    color: COLORS.SUCCESS.DEFAULT,
    marginBottom: 16,
    textAlign: 'center',
  },
  completionDescription: {
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  completionButton: {
    width: '100%',
  },

  // エラー・空状態
  errorIcon: {
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.WHITE,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: COLORS.TEXT.SECONDARY,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  emptySubDescription: {
    fontSize: 14,
    color: COLORS.TEXT.LIGHT,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  emptyButton: {
    paddingHorizontal: 24,
    minWidth: 120,
  },
});

export default StudyScreen;
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
}

const StudyScreen = () => {
  const { session } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フラッシュカードデータを取得
  const fetchFlashcards = async () => {
    try {
      if (!session?.access_token) {
        throw new Error('認証トークンがありません');
      }

      const { data, error } = await supabase.functions.invoke('get-flashcards', {
        body: { type: 3 }
      });

      if (error) throw error;

      setFlashcards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      console.log('fetchFlashcards error', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchFlashcards();
    }
  }, [session?.access_token]);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);  // 現在表示中のカードのインデックス
  const [showBack, setShowBack] = useState(false);  // カードの裏面を表示するかどうか
  const [isAnimating, setIsAnimating] = useState(false);  // スワイプアニメーション中かどうか
  const [isFlipping, setIsFlipping] = useState(false);  // カードをめくっているかどうか
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; color: string; position: 'topLeft' | 'topRight' } | null>(null);  // フィードバックメッセージ
  const animatedValue = useRef(new Animated.Value(0)).current;  // カードの回転アニメーション用
  const swipeValue = useRef(new Animated.ValueXY()).current;    // カードのスワイプアニメーション用
  const opacityValue = useRef(new Animated.Value(1)).current;   // 透明度アニメーション用
  const feedbackOpacity = useRef(new Animated.Value(0)).current;  // フィードバックメッセージの透明度
  const screenWidth = Dimensions.get('window').width;
  // No more cardTransitionValue

  // フィードバックメッセージを表示する関数
  const showFeedback = (text: string, color: string, position: 'topLeft' | 'topRight') => {
    setFeedbackMessage({ text, color, position });
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

  // スワイプジェスチャーの設定
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        swipeValue.extractOffset();
      },
      onPanResponderMove: (evt, gestureState) => {
        const VISIBILITY_THRESHOLD = screenWidth / 20;  // 非表示にする閾値

        console.log('スワイプ移動中:', {
          dx: gestureState.dx,
          dy: gestureState.dy,
          vx: gestureState.vx,
          vy: gestureState.vy,
          isAnimating
        });

        // スワイプの移動量が閾値を超えたら非表示にする
        if (Math.abs(gestureState.dx) > VISIBILITY_THRESHOLD && !isAnimating) {
          console.log('閾値を超えたため非表示処理を開始');
          setIsAnimating(true);
          Animated.timing(opacityValue, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }

        // アニメーションの更新
        swipeValue.setValue({
          x: gestureState.dx,
          y: gestureState.dy
        });
      },
      onPanResponderRelease: (evt, gestureState) => {
        const SWIPE_THRESHOLD = screenWidth / 4;  // スワイプ判定の閾値
        const VELOCITY_THRESHOLD = 0.2;           // 速度判定の閾値

        console.log('スワイプ終了:', {
          dx: gestureState.dx,
          vx: gestureState.vx,
          threshold: SWIPE_THRESHOLD,
          velocityThreshold: VELOCITY_THRESHOLD,
          currentCard: currentCard ? '存在する' : '存在しない'
        });

        if (!currentCard) {
          console.log('現在のカードが存在しないため、スワイプ処理を中断');
          Animated.parallel([
            Animated.spring(swipeValue, {
              toValue: { x: 0, y: 0 },
              friction: 9,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.timing(opacityValue, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            })
          ]).start(() => {
            setIsAnimating(false);
          });
          return;
        }

        if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > VELOCITY_THRESHOLD) {
          console.log('右スワイプを検出');
          // 右スワイプ
          showFeedback('Good!', '#77dd77', 'topRight');
          animateCardTransition(1, gotoNextCard);  // 右方向にアニメーション
        } else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -VELOCITY_THRESHOLD) {
          console.log('左スワイプを検出');
          // 左スワイプ
          showFeedback('Try again', '#ff6961', 'topLeft');
          animateCardTransition(-1, gotoNextCard);  // 左方向にアニメーション
        } else {
          console.log('閾値未満のため元の位置に戻す');
          // 閾値未満の場合は元の位置に戻す
          Animated.parallel([
            Animated.spring(swipeValue, {
              toValue: { x: 0, y: 0 },
              friction: 9,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.timing(opacityValue, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            })
          ]).start(() => {
            setIsAnimating(false);
          });
        }
      },
    })
  ).current;

  const currentCard = flashcards[currentCardIndex];

  // カードをめくるアニメーション
  const flipCard = () => {
    if (!currentCard) {
      console.log('現在のカードが存在しません');
      return;
    }
    setIsFlipping(true);
    Animated.timing(animatedValue, {
      toValue: showBack ? 0 : 180,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setShowBack(!showBack);
      setIsFlipping(false);
    });
  };

  // カードの表裏の回転アニメーション用の補間値
  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  // カードの表裏のスタイル
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

  // カード操作のハンドラー
  const handleNextCard = () => {
    if (!currentCard) {
      console.log('現在のカードが存在しません');
      return;
    }
    showFeedback('Good!', '#77dd77', 'topRight');
    animateCardTransition(1, gotoNextCard);
  };

  const handleUnknown = () => {
    if (!currentCard) {
      console.log('現在のカードが存在しません');
      return;
    }
    showFeedback('Try again', '#ff6961', 'topLeft');
    animateCardTransition(-1, gotoNextCard);
  }

  const handlePrevCard = () => {
    if (flashcards.length === 0) {
      console.log('フラッシュカードが存在しません');
      return;
    }
    setCurrentCardIndex(prevIndex => {
      const newIndex = prevIndex === 0 ? flashcards.length - 1 : prevIndex - 1;
      resetCardAnimation();
      return newIndex;
    });
  }

  const gotoNextCard = () => {
    if (flashcards.length === 0) {
      console.log('フラッシュカードが存在しません');
      return;
    }
    setCurrentCardIndex(prevIndex => {
      const newIndex = (prevIndex + 1) % flashcards.length;
      resetCardAnimation();
      return newIndex;
    });
  }

  // カードのアニメーション状態をリセット
  const resetCardAnimation = () => {
    setShowBack(false);
    animatedValue.setValue(0);
    swipeValue.setValue({ x: 0, y: 0 });
    // No need to reset cardTransitionValue
  };

  // カードの遷移アニメーション
  const animateCardTransition = (direction: number, callback: () => void) => {
    console.log('カード遷移アニメーション開始:', {
      direction,
      currentIndex: currentCardIndex,
      nextIndex: (currentCardIndex + 1) % flashcards.length
    });

    setIsAnimating(true);
    Animated.parallel([
      Animated.timing(swipeValue, {
        toValue: { x: direction * screenWidth, y: 0 },
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      console.log('アニメーション完了、コールバック実行');
      callback();
      // アニメーション値をリセット
      swipeValue.setValue({ x: 0, y: 0 });
      opacityValue.setValue(1);
      setIsAnimating(false);
    });
  };

  // カードの遷移スタイル
  const cardTransitionStyle = {
    transform: [
      { translateX: swipeValue.x },
      { translateY: swipeValue.y },
    ],
  };

  // currentCardIndexが変更された後に再表示する
  useEffect(() => {
    console.log('currentCardIndexが変更:', {
      newIndex: currentCardIndex,
      card: flashcards[currentCardIndex]
    });
    
    if (isAnimating) {
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });
    }
    // カードが切り替わったらフィードバックメッセージを非表示にする
    setFeedbackMessage(null);
  }, [currentCardIndex]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.progressText}>{currentCardIndex + 1}/{flashcards.length}</Text>
      </View>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>フラッシュカードを読み込み中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setIsLoading(true);
              setError(null);
              fetchFlashcards();
            }}
          >
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : flashcards.length > 0 ? (
        <>
          {/* プログレスバー */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((currentCardIndex + 1) / flashcards.length) * 100}%`
                  }
                ]} 
              />
            </View>
          </View>

          <Animated.View style={[styles.cardContainer, cardTransitionStyle, { opacity: opacityValue }]} {...panResponder.panHandlers}>
            {/* カードの表面 */}
            <Animated.View 
              style={[styles.card, styles.cardFront, frontAnimatedStyle, showBack ? styles.hidden : {}]}
              onTouchEnd={flipCard}
            >
              <Text style={styles.cardWord}>{currentCard.vocabulary}</Text>
              <Text style={styles.cardPronunciation}>{currentCard.part_of_speech}</Text>
              <Text style={styles.cardExample}>{currentCard.examples[0]?.en || '例文なし'}</Text>
            </Animated.View>

            {/* カードの裏面 */}
            <Animated.View 
              style={[styles.card, styles.cardBack, backAnimatedStyle, !showBack ? styles.hidden : {}]}
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
              disabled={isAnimating}
            >
              <Text style={styles.buttonText}>？</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.buttonGreen]} 
              onPress={handleNextCard}
              disabled={isAnimating}
            >
              <Ionicons name="checkmark-circle" size={24} color="white" />
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
        backgroundColor: '#f8f8ff',
        padding: 20,
        alignItems: 'center',
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
    hidden: {
        opacity: 0,
        pointerEvents: 'none',
    },
    invisible: {
        opacity: 0,
        pointerEvents: 'none',
    },
    emptyText: {
        fontSize: 18,
        color: '#777',
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#ff6961',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#4a90e2',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
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
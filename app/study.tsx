import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// フラッシュカードの型定義
interface Flashcard {
  id: number;
  front: string;      // 英単語
  pronunciation: string;  // 発音記号
  example: string;    // 例文
  back: string;       // 日本語訳
}

const StudyScreen = () => {
  // サンプルのフラッシュカードデータ
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { id: 1, front: 'work', pronunciation: 'wɜːrk', example: 'She is always busy with work.', back: '仕事' },
    { id: 2, front: 'apple', pronunciation: 'ˈæpl', example: 'An apple a day keeps the doctor away.', back: 'りんご' },
    { id: 3, front: 'dog', pronunciation: 'dɔːɡ', example: 'The dog is barking.', back: '犬' },
  ]);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);  // 現在表示中のカードのインデックス
  const [showBack, setShowBack] = useState(false);  // カードの裏面を表示するかどうか
  const [isAnimating, setIsAnimating] = useState(false);  // スワイプアニメーション中かどうか
  const [isFlipping, setIsFlipping] = useState(false);  // カードをめくっているかどうか
  const animatedValue = useRef(new Animated.Value(0)).current;  // カードの回転アニメーション用
  const swipeValue = useRef(new Animated.ValueXY()).current;    // カードのスワイプアニメーション用
  const opacityValue = useRef(new Animated.Value(1)).current;   // 透明度アニメーション用
  const screenWidth = Dimensions.get('window').width;
  // No more cardTransitionValue

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

        // スワイプの移動量が閾値を超えたら非表示にする
        if (Math.abs(gestureState.dx) > VISIBILITY_THRESHOLD && !isAnimating) {
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

        if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > VELOCITY_THRESHOLD) {
          animateCardTransition(1, handlePrevCard);  // 右スワイプで前のカードへ
        } else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -VELOCITY_THRESHOLD) {
          animateCardTransition(-1, handleNextCard);  // 左スワイプで次のカードへ
        } else {
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
    animateCardTransition(1, gotoNextCard);  // 右にスワイプ
  };

  const handleUnknown = () => {
    animateCardTransition(-1, gotoNextCard);  // 左にスワイプ
  }

  const handlePrevCard = () => {
    setCurrentCardIndex(prevIndex => {
      const newIndex = prevIndex === 0 ? flashcards.length - 1 : prevIndex - 1;
      resetCardAnimation();
      return newIndex;
    });
  }

  const gotoNextCard = () => {
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
      callback();
    });
  };

  // カードの遷移スタイル
  const cardTransitionStyle = {
    // opacity: cardTransitionValue, // Remove opacity animation
    transform: [
      { translateX: swipeValue.x },
      { translateY: swipeValue.y },
      // { scale: cardTransitionValue } // Remove scaling
    ],
  };

  // currentCardIndexが変更された後に再表示する
  useEffect(() => {
    if (isAnimating) {
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });
    }
  }, [currentCardIndex]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.progressText}>{currentCardIndex + 1}/{flashcards.length}</Text>
      </View>
      {flashcards.length > 0 ? (
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
              <Text style={styles.cardWord}>{currentCard.front}</Text>
              <Text style={styles.cardPronunciation}>{currentCard.pronunciation}</Text>
              <Text style={styles.cardExample}>{currentCard.example}</Text>
            </Animated.View>

            {/* カードの裏面 */}
            <Animated.View 
              style={[styles.card, styles.cardBack, backAnimatedStyle, !showBack ? styles.hidden : {}]}
              onTouchEnd={flipCard}
            >
              <Text style={styles.cardBackText}>{currentCard.back}</Text>
            </Animated.View>
          </Animated.View>

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
});

export default StudyScreen;
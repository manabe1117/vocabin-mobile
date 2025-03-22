import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Flashcard {
  id: number;
  front: string;
  pronunciation: string;
  example: string;
  back: string;
}

const StudyScreen = () => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { id: 1, front: 'work', pronunciation: 'wɜːrk', example: 'She is always busy with work.', back: '仕事' },
    { id: 2, front: 'apple', pronunciation: 'ˈæpl', example: 'An apple a day keeps the doctor away.', back: 'りんご' },
    { id: 3, front: 'dog', pronunciation: 'dɔːɡ', example: 'The dog is barking.', back: '犬' },
  ]);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const swipeValue = useRef(new Animated.ValueXY()).current;
  const screenWidth = Dimensions.get('window').width;
  // No more cardTransitionValue

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        swipeValue.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: swipeValue.x, dy: swipeValue.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (evt, gestureState) => {
        const SWIPE_THRESHOLD = screenWidth / 4;
        const VELOCITY_THRESHOLD = 0.2;

        if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > VELOCITY_THRESHOLD) {
          animateCardTransition(1, handlePrevCard);
        } else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -VELOCITY_THRESHOLD) {
          animateCardTransition(-1, handleNextCard);
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

  const currentCard = flashcards[currentCardIndex];

  const flipCard = () => {
    Animated.timing(animatedValue, {
      toValue: showBack ? 0 : 180,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setShowBack(!showBack);
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
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  const handleNextCard = () => {
    gotoNextCard();
  };

  const handleUnknown = () => {
    gotoNextCard();
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

    const resetCardAnimation = () => {
        setShowBack(false);
        animatedValue.setValue(0);
        swipeValue.setValue({ x: 0, y: 0 });
        // No need to reset cardTransitionValue
    };

    // Animate card transition with direction (only opacity and movement)
    const animateCardTransition = (direction: number, callback: () => void) => {
        Animated.timing(swipeValue, { // Only animate swipeValue
          toValue: { x: direction * screenWidth, y: 0 },
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
            callback();
        });
    };


  const cardTransitionStyle = {
    // opacity: cardTransitionValue, // Remove opacity animation
    transform: [
      { translateX: swipeValue.x },
      { translateY: swipeValue.y },
      // { scale: cardTransitionValue } // Remove scaling
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.progressText}>{currentCardIndex + 1}/{flashcards.length}</Text>
      </View>
      {flashcards.length > 0 ? (
        <>
          <Animated.View style={[styles.cardContainer, cardTransitionStyle]} {...panResponder.panHandlers}>
            <Animated.View style={[styles.card, styles.cardFront, frontAnimatedStyle, showBack ? styles.hidden : {}]}>
              <Text style={styles.cardWord}>{currentCard.front}</Text>
              <Text style={styles.cardPronunciation}>{currentCard.pronunciation}</Text>
              <Text style={styles.cardExample}>{currentCard.example}</Text>
              <TouchableOpacity style={styles.flipHint} onPress={flipCard}>
                <Text style={styles.flipHintText}>タップしてめくる</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle, !showBack ? styles.hidden : {}]}>
              <Text style={styles.cardBackText}>{currentCard.back}</Text>
              <TouchableOpacity style={styles.flipHint} onPress={flipCard}>
                <Text style={styles.flipHintText}>タップしてめくる</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.buttonRed]} onPress={handleUnknown}>
              <Text style={styles.buttonText}>？</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={handleNextCard}>
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
        backgroundColor: '#f0f8ff',
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
    flipHint: {
        position: 'absolute',
        bottom: 20,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 5,
    },
    flipHintText: {
        fontSize: 14,
        color: '#888',
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
        display: 'none',
    },
    emptyText: {
        fontSize: 18,
        color: '#777',
    },
});

export default StudyScreen;
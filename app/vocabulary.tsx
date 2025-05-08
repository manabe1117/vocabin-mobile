import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  RefreshControl,
  Modal,
  Dimensions,
  Alert,
  Pressable
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { COMMON_STYLES, COLORS } from '@/constants/styles';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSpeech } from '@/hooks/useSpeech';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useLocalSearchParams } from 'expo-router';

// 単語の型定義
/**
 * 単語アイテムの型定義
 * meaningsは意味の配列
 */
interface VocabularyItem {
  id: number;
  vocabulary: string;
  meanings: string[];
  partOfSpeech: string;
  pronunciation: string;
  examples: { en: string; ja: string }[];
  synonyms: string[];
  notes: string;
  date_added?: string; // 追加日
  learningStatus: 'known' | 'unknown'; // 知ってるか知らないかの状態
  appliedStudyStatus?: StudyStatusType; // 適用された学習状態フィルター
  box_level?: number; // box_levelの追加
}

// フィルタータイプの定義
type FilterType = 'all' | '名詞' | '動詞' | '形容詞' | '副詞';

// 学習状態フィルターの定義
type StudyStatusType = '未学習' | '学習中' | '学習済み' | null;

// ソート順の定義
type SortOrder = 'alphabetical_asc' | 'alphabetical_desc' | 'random';

// box_levelの色を取得する関数
const getBoxLevelColor = (level: number) => {
  switch (level) {
    case 0:
      return '#9e9e9e'; // グレー - 未学習
    case 1:
    case 2:
      return '#fb8c00'; // オレンジ色 - 学習開始
    case 3:
    case 4:
      return '#fdd835'; // 黄色 - 少し覚えてきた
    case 5:
      return '#43a047'; // 緑色 - かなり覚えた
    case 6:
      return '#2e7d32'; // 濃い緑色 - 完全に習得
    default:
      return '#9e9e9e';
  }
};

// box_levelの説明を表示するモーダル
const BoxLevelInfoModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={styles.boxLevelInfoContent}>
        <View style={styles.boxLevelInfoHeader}>
          <ThemedText style={styles.boxLevelInfoTitle}>習熟度レベルについて</ThemedText>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.ICON.DEFAULT} />
          </TouchableOpacity>
        </View>
        <View style={styles.boxLevelInfoBody}>
          <ThemedText style={styles.boxLevelInfoText}>
            習熟度レベルは、単語の理解度を表す指標です。数字が大きいほど、その単語をよく覚えていることを示します。
          </ThemedText>
          <View style={styles.boxLevelInfoList}>
            <View style={styles.boxLevelInfoItem}>
              <View style={[styles.boxLevelInfoBox, { backgroundColor: getBoxLevelColor(0) }]}>
                <ThemedText style={styles.boxLevelInfoBoxText}>0</ThemedText>
              </View>
              <ThemedText style={styles.boxLevelInfoItemText}>未学習</ThemedText>
            </View>
            <View style={styles.boxLevelInfoItem}>
              <View style={[styles.boxLevelInfoBox, { backgroundColor: getBoxLevelColor(1) }]}>
                <ThemedText style={styles.boxLevelInfoBoxText}>1~2</ThemedText>
              </View>
              <ThemedText style={styles.boxLevelInfoItemText}>学習開始</ThemedText>
            </View>
            <View style={styles.boxLevelInfoItem}>
              <View style={[styles.boxLevelInfoBox, { backgroundColor: getBoxLevelColor(3) }]}>
                <ThemedText style={styles.boxLevelInfoBoxText}>3~4</ThemedText>
              </View>
              <ThemedText style={styles.boxLevelInfoItemText}>少し覚えてきた</ThemedText>
            </View>
            <View style={styles.boxLevelInfoItem}>
              <View style={[styles.boxLevelInfoBox, { backgroundColor: getBoxLevelColor(5) }]}>
                <ThemedText style={styles.boxLevelInfoBoxText}>5</ThemedText>
              </View>
              <ThemedText style={styles.boxLevelInfoItemText}>かなり覚えた</ThemedText>
            </View>
            <View style={styles.boxLevelInfoItem}>
              <View style={[styles.boxLevelInfoBox, { backgroundColor: getBoxLevelColor(6) }]}>
                <ThemedText style={styles.boxLevelInfoBoxText}>6</ThemedText>
              </View>
              <ThemedText style={styles.boxLevelInfoItemText}>完全に習得</ThemedText>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  </Modal>
);

export default function VocabularyScreen() {
  const { session } = useAuth();
  const { speakText } = useSpeech();
  const params = useLocalSearchParams<{ studyStatus?: string }>();
  const initialStudyStatus = params.studyStatus as StudyStatusType | undefined;
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [filteredVocabulary, setFilteredVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>(['all']);
  const [studyStatus, setStudyStatus] = useState<StudyStatusType>(() => {
    if (initialStudyStatus && ['未学習', '学習中', '学習済み'].includes(initialStudyStatus)) {
      return initialStudyStatus as StudyStatusType;
    }
    return '未学習';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical_asc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 30; // 1ページあたりのアイテム数
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  // スワイプで削除された単語IDリスト
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  // スワイプで削除中のIDリスト
  const [removingIds, setRemovingIds] = useState<number[]>([]);
  const [randomSeed, setRandomSeed] = useState<string | null>(null);
  // 一時的なフィルター状態
  const [tempActiveFilters, setTempActiveFilters] = useState<FilterType[]>(activeFilters);
  const [tempStudyStatus, setTempStudyStatus] = useState<StudyStatusType>(studyStatus);
  const [boxLevelInfoVisible, setBoxLevelInfoVisible] = useState(false);
  
  // useRefで前回値を保持
  const prevFiltersRef = useRef(activeFilters);
  const prevStatusRef = useRef(studyStatus);
  const prevModalVisibleRef = useRef(filterModalVisible);
  
  // 初回データロード
  // studyStatus変更時に自動でfetchしないように変更
  useEffect(() => {
    fetchVocabulary(true);
  }, []);
  
  // ページが変わったときの追加ロード
  useEffect(() => {
    if (page > 1) {
      fetchVocabulary(false);
    }
  }, [page]);
  
  const screenWidth = Dimensions.get('window').width;
  
  // スワイプ操作のために各アイテムのアニメーション値を保持するマップ
  const itemAnimations = useRef<{[key: number]: Animated.Value}>({}).current;
  // 削除アニメーション用の値を保持するマップ
  const removingAnims = useRef<{[key: number]: Animated.Value}>({}).current;
  const getRemovingAnimValue = (id: number): Animated.Value => {
    if (!removingAnims[id]) {
      removingAnims[id] = new Animated.Value(1);
    }
    return removingAnims[id];
  };
  
  // アイテムのアニメーション値を取得または作成
  const getItemAnimationValue = (id: number): Animated.Value => {
    if (!itemAnimations[id]) {
      itemAnimations[id] = new Animated.Value(0);
    }
    return itemAnimations[id];
  };
  
  // アイテムを削除し学習状態も同時に更新する関数
  const removeAndUpdateStatus = async (id: number, status: 'known' | 'unknown') => {
    try {
      if (!session?.access_token) {
        throw new Error('認証トークンがありません');
      }
      const { error } = await supabase.functions.invoke('swipe-update-study-status', {
        method: 'POST',
        body: {
          vocabularyId: id,
          direction: status
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('エラー', err.message || '学習状態の更新に失敗しました');
    }
    setVocabulary(prev =>
      prev.reduce((acc, item) => {
        if (item.id === id) {
          // 削除対象は追加しない
          return acc;
        }
        return [...acc, item];
      }, [] as VocabularyItem[])
    );
    setRemovedIds(prev => [...prev, id]);
    // アニメーション値のクリーンアップ
    delete itemAnimations[id];
  };
  
  // スワイプイベントハンドラーを生成（メモ化）
  const gestureHandlers = useRef<{[key: number]: {
    onGestureEvent: any;
    onHandlerStateChange: any;
    removingAnim: Animated.Value;
  }}>({}).current;
  
  // 各アイテムのハンドラーを取得またはキャッシュ
  const getGestureHandler = (item: VocabularyItem) => {
    if (!gestureHandlers[item.id]) {
      const translateX = getItemAnimationValue(item.id);
      // 高さ・透明度アニメーション用
      const removingAnim = getRemovingAnimValue(item.id);
      // スワイプジェスチャーのハンドラー
      const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX } }],
        { useNativeDriver: true }
      );
      const handleStateChange = async (event: any) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
          const { translationX, velocityX } = event.nativeEvent;
          const translateThreshold = 120; // スワイプのしきい値
          if (translationX > translateThreshold || velocityX > 800) {
            // 右スワイプ（知ってる）
            setTimeout(() => removeAndUpdateStatus(item.id, 'known'), 0);
            Animated.timing(translateX, {
              toValue: screenWidth,
              duration: 10,
              useNativeDriver: true,
            }).start();
            Animated.timing(removingAnim, {
              toValue: 0,
              duration: 10,
              useNativeDriver: false,
            }).start();
          } else if (translationX < -translateThreshold || velocityX < -800) {
            // 左スワイプ（知らない）
            setTimeout(() => removeAndUpdateStatus(item.id, 'unknown'), 0);
            Animated.timing(translateX, {
              toValue: -screenWidth,
              duration: 50,
              useNativeDriver: true,
            }).start();
            Animated.timing(removingAnim, {
              toValue: 0,
              duration: 50,
              useNativeDriver: false,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true
            }).start();
          }
        }
      };
      gestureHandlers[item.id] = { onGestureEvent, onHandlerStateChange: handleStateChange, removingAnim };
    }
    return gestureHandlers[item.id];
  };

  // ユーザーがページをスクロールしたときに次のページを読み込む関数
  const loadMoreItems = () => {
    if (hasMore && !loading) {
      setPage(prevPage => prevPage + 1);
    }
  };

  // 初期データロード時にページネーションを考慮
  const fetchVocabulary = async (reset = false, customSortOrder?: SortOrder, customRandomSeed?: string | null) => {
    if (reset) {
      setLoading(true);
      setPage(1);
      setHasMore(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    // activeFiltersからAPI用filtersを組み立て
    let partOfSpeech: string[] = [];
    if (!activeFilters.includes('all')) {
      partOfSpeech = activeFilters.filter(f => ['名詞', '動詞', '形容詞', '副詞'].includes(f));
    }
    const filters: any = {
      partOfSpeech: partOfSpeech.length > 0 ? partOfSpeech : undefined,
    };
    if (studyStatus) {
      filters.studyStatus = studyStatus;
    }

    try {
      if (!session?.access_token) {
        throw new Error('認証トークンがありません');
      }
      const requestBody: any = {
        page: reset ? 1 : page,
        pageSize: pageSize,
        sortOrder: customSortOrder ?? sortOrder,
        filters,
        randomSeed: (customSortOrder ?? sortOrder) === 'random' ? (customRandomSeed ?? randomSeed) : undefined,
      };
      if (studyStatus === '未学習') {
        requestBody.unregistered = true;
      }

      const { data, error } = await supabase.functions.invoke('get-vocabulary', {
        method: 'POST',
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) throw new Error(error.message || 'APIエラー');
      console.log('APIレスポンス（単語リスト）:', data);

      const mapped: VocabularyItem[] = (data || []).map((v: any) => ({
        id: v.id,
        vocabulary: v.vocabulary,
        meanings: Array.isArray(v.meanings)
          ? v.meanings
          : typeof v.meanings === 'string' && v.meanings.includes(';')
            ? v.meanings.split(';').map((t: string) => t.trim()).filter(Boolean)
            : typeof v.meanings === 'string'
              ? [v.meanings]
              : [],
        partOfSpeech: v.part_of_speech,
        pronunciation: v.pronunciation || '',
        examples: Array.isArray(v.examples)
          ? v.examples.map((ex: any) => ({ en: ex.english || ex.en || '', ja: ex.japanese || ex.ja || '' }))
          : [],
        synonyms: v.synonyms || [],
        notes: v.notes || '',
        date_added: v.date_added,
        learningStatus: v.box_level > 0 ? 'known' : 'unknown',
        appliedStudyStatus: studyStatus,
        box_level: v.box_level || 0, // box_levelの追加
      }));

      if ((data || []).length < pageSize) {
        setHasMore(false);
      }

      if (reset || page === 1) {
        setVocabulary(mapped);
      } else {
        setVocabulary(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = mapped.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '予期せぬエラーが発生しました';
      setError(errorMessage);
      console.log('fetchVocabulary error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 音声を再生する関数
  const handlePlaySound = (text: string) => {
    speakText(text, '英語');
  };

  // 単語項目をタップして展開/折りたたむ関数
  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // 単語帳の項目をレンダリングする関数
  const renderItem = ({ item }: { item: VocabularyItem }) => {
    const isExpanded = expandedId === item.id;
    const translateX = getItemAnimationValue(item.id);
    const { removingAnim } = getGestureHandler(item);
    
    // スワイプ方向のヒントを動的に表示
    const opacityRight = translateX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp'
    });
    
    const opacityLeft = translateX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp'
    });
    
    return (
      <View style={styles.swipeContainer}>
        {/* スワイプ時のヒント表示 - 左（わからない） */}
        <Animated.View
          style={[
            styles.swipeHint,
            styles.unknownSwipeHint,
            {
              opacity: opacityLeft,
            },
          ]}
        >
          <Ionicons name="help-circle" size={24} color={COLORS.WHITE} />
          <Text style={styles.swipeHintText}>わからない</Text>
        </Animated.View>
        
        {/* スワイプ時のヒント表示 - 右（知ってる） */}
        <Animated.View
          style={[
            styles.swipeHint,
            styles.knownSwipeHint,
            {
              opacity: opacityRight,
            },
          ]}
        >
          <Feather name="check-circle" size={24} color={COLORS.WHITE} />
          <Text style={styles.swipeHintText}>知ってる</Text>
        </Animated.View>
        
        <Animated.View
          style={{
            opacity: removingAnim,
            transform: [{ scaleY: removingAnim }],
          }}
        >
          <PanGestureHandler
            onGestureEvent={getGestureHandler(item).onGestureEvent}
            onHandlerStateChange={getGestureHandler(item).onHandlerStateChange}
            activeOffsetX={
              item.appliedStudyStatus === '学習中'
                ? [-9999, 0] // 右スワイプのみ許可
                : item.appliedStudyStatus === '学習済み'
                  ? [0, 9999] // 左スワイプのみ許可
                  : [-20, 20] // 両方向許可
            }
            failOffsetY={[-20, 20]}
          >
            <Animated.View
              style={{ transform: [{ translateX }] }}
            >
              <TouchableOpacity
                style={[
                  styles.itemContainer,
                  item.learningStatus === 'known' && styles.knownItemBorder,
                  item.learningStatus === 'unknown' && styles.unknownItemBorder,
                  {borderColor: COLORS.BORDER.LIGHT},
                ]}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.wordContainer}>
                    <ThemedText style={styles.word}>{item.vocabulary}</ThemedText>
                    <View style={styles.wordInfoContainer}>
                      <ThemedText style={styles.partOfSpeech}>
                        {item.partOfSpeech === 'noun' ? '名詞' : 
                        item.partOfSpeech === 'verb' ? '動詞' : 
                        item.partOfSpeech === 'adjective' ? '形容詞' : 
                        item.partOfSpeech === 'adverb' ? '副詞' : item.partOfSpeech}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.rightContainer}>
                    <View style={styles.actionButtonsContainerColumn}>
                      <TouchableOpacity 
                        style={styles.soundButton}
                        onPress={() => handlePlaySound(item.vocabulary)}
                      >
                        <Ionicons 
                          name="volume-high" 
                          size={24} 
                          color={
                            item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.TEXT :
                            item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.TEXT :
                            COLORS.PRIMARY
                          } 
                        />
                      </TouchableOpacity>
                      {item.appliedStudyStatus === '学習中' && (
                        <Pressable 
                          style={[styles.boxLevelContainerWide, { backgroundColor: getBoxLevelColor(item.box_level || 0) }]}
                          onPress={() => setBoxLevelInfoVisible(true)}
                        > 
                          <Ionicons name="layers" size={14} color={COLORS.WHITE} style={styles.boxLevelIcon} />
                          <ThemedText style={[styles.boxLevelText, { color: COLORS.WHITE }]}>{item.box_level}</ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
                
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />
                    {/* 展開時のみ意味を表示 */}
                    {item.meanings.length > 0 && (
                      <View style={styles.section}>
                        <ThemedText style={[
                          styles.sectionTitle,
                          {
                            color: 
                              item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.TEXT :
                              item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.TEXT :
                              COLORS.PRIMARY
                          }
                        ]}>意味</ThemedText>
                        <ThemedText style={styles.sectionText}>{item.meanings.join('、')}</ThemedText>
                      </View>
                    )}
                    
                    {item.synonyms.length > 0 && (
                      <View style={styles.section}>
                        <ThemedText style={[
                          styles.sectionTitle,
                          {
                            color: 
                              item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.TEXT :
                              item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.TEXT :
                              COLORS.PRIMARY
                          }
                        ]}>類義語</ThemedText>
                        <View style={styles.synonymContainer}>
                          {item.synonyms.map((synonym, index) => (
                            <View
                              key={index}
                              style={[
                                styles.synonym,
                                {
                                  backgroundColor: 
                                    item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.BACKGROUND :
                                    item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.BACKGROUND :
                                    '#e3f2fd'
                                }
                              ]}
                            >
                              <ThemedText 
                                style={[
                                  styles.synonymText,
                                  {
                                    color: 
                                      item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.TEXT :
                                      item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.TEXT :
                                      COLORS.PRIMARY
                                  }
                                ]}
                              >
                                {synonym}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    
                    {item.examples.length > 0 && (
                      <View style={styles.section}>
                        <ThemedText style={[
                          styles.sectionTitle,
                          {
                            color: 
                              item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.TEXT :
                              item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.TEXT :
                              COLORS.PRIMARY
                          }
                        ]}>例文</ThemedText>
                        {item.examples.map((example, index) => (
                          <View key={index} style={[
                            styles.exampleContainer,
                            {
                              backgroundColor: 
                                // item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.BACKGROUND_LIGHT :
                                // item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.BACKGROUND_LIGHT :
                                COLORS.BACKGROUND.MAIN
                            }
                          ]}>
                            <ThemedText style={styles.example}>{example.en}</ThemedText>
                            <ThemedText style={styles.exampleTranslation}>{example.ja}</ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    {item.notes && (
                      <View style={styles.section}>
                        <ThemedText style={[
                          styles.sectionTitle,
                          {
                            color: 
                              item.appliedStudyStatus === '学習済み' ? COLORS.STUDY_STATUS.COMPLETED.TEXT :
                              item.appliedStudyStatus === '学習中' ? COLORS.STUDY_STATUS.IN_PROGRESS.TEXT :
                              COLORS.PRIMARY
                          }
                        ]}>補足</ThemedText>
                        <ThemedText style={styles.sectionText}>{item.notes}</ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </View>
    );
  };

  // 並び替えオプション
  const sortOptions: { label: string; value: SortOrder }[] = [
    { label: 'Aから順', value: 'alphabetical_asc' },
    { label: 'Zから順', value: 'alphabetical_desc' },
    { label: 'ランダム', value: 'random' }
  ];

  // 現在のソートラベル取得
  const getSortLabel = () => {
    const found = sortOptions.find(opt => opt.value === sortOrder);
    return found ? found.label : '';
  };

  // 並び替えモーダル
  const renderSortModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={sortModalVisible}
      onRequestClose={() => setSortModalVisible(false)}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalOverlay}
        onPress={() => setSortModalVisible(false)}
      >
        <View style={styles.modalContent} pointerEvents="box-none">
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: COLORS.TEXT.DARKER }]}>並び替えを選択</ThemedText>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setSortModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.ICON.DEFAULT} />
            </TouchableOpacity>
          </View>
          <View style={styles.filtersContainer}>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterOption,
                  sortOrder === option.value && styles.filterItemActive
                ]}
                onPress={() => handleSortSelect(option)}
              >
                <ThemedText
                  style={[
                    styles.filterItemText,
                    sortOrder === option.value && styles.filterItemTextActive
                  ]}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // フィルターとソートのオプションバーをレンダリングする関数
  const renderOptionBar = () => {
    // アクティブなフィルターの表示名を取得
    const getActiveFiltersLabel = () => {
      if (activeFilters.includes('all')) {
        return 'すべて';
      }
      const labels = [];
      if (activeFilters.includes('名詞')) labels.push('名詞');
      if (activeFilters.includes('動詞')) labels.push('動詞');
      if (activeFilters.includes('形容詞')) labels.push('形容詞');
      if (activeFilters.includes('副詞')) labels.push('副詞');
      if (labels.length === 0) return 'すべて';
      if (labels.length <= 2) return labels.join('・');
      return `${labels.length}個の条件`;
    };
    
    return (
      <View style={styles.optionBarContainer}>
        <View style={styles.optionsRow}>
          {/* 並び替えボタン */}
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={() => setSortModalVisible(true)}
          >
            <ThemedText style={styles.filterButtonLabel}>並び替え: </ThemedText>
            <ThemedText style={styles.activeFilterLabel}>{getSortLabel()}</ThemedText>
            <Ionicons name="swap-vertical" size={18} color={COLORS.ICON.LIGHT} />
          </TouchableOpacity>

          {/* フィルターボタン */}
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={() => {
              setTempActiveFilters(activeFilters);
              setTempStudyStatus(studyStatus);
              setFilterModalVisible(true);
            }}
          >
            <ThemedText style={styles.filterButtonLabel}>絞り込み: </ThemedText>
            <ThemedText style={styles.activeFilterLabel}>{getActiveFiltersLabel()}</ThemedText>
            <Ionicons name="funnel" size={18} color={COLORS.ICON.LIGHT} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // フィルターモーダルをレンダリングする関数
  const renderFilterModal = () => {
    const filters: { label: string; value: FilterType; icon: string }[] = [
      { label: 'すべて', value: 'all', icon: 'apps' },
      { label: '名詞', value: '名詞', icon: 'cube' },
      { label: '動詞', value: '動詞', icon: 'bicycle' },
      { label: '形容詞', value: '形容詞', icon: 'color-palette' },
      { label: '副詞', value: '副詞', icon: 'speedometer' },
    ];

    // フィルターを切り替える関数
    const toggleFilter = (value: FilterType) => {
      if (value === 'all') {
        setTempActiveFilters(['all']);
      } else {
        setTempActiveFilters(prev => {
          const newFilters = prev.includes('all') ? [] : [...prev];
          if (newFilters.includes(value)) {
            const filtered = newFilters.filter(f => f !== value);
            return filtered.length === 0 ? ['all'] : filtered;
          } else {
            return [...newFilters.filter(f => f !== 'all'), value];
          }
        });
      }
    };

    // 学習状態フィルターのUI
    const studyStatusOptions: { label: string; value: StudyStatusType }[] = [
      { label: '未学習', value: '未学習' },
      { label: '学習中', value: '学習中' },
      { label: '学習済み', value: '学習済み' },
    ];

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: COLORS.TEXT.DARKER }]}>絞り込み条件を選択</ThemedText>
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.ICON.DEFAULT} />
              </TouchableOpacity>
            </View>

            {/* 学習状態フィルター */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              {studyStatusOptions.map(option => {
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 8,
                      marginHorizontal: 4,
                      borderRadius: 16,
                      backgroundColor: tempStudyStatus === option.value ? COLORS.BACKGROUND.BLUE_LIGHT : COLORS.BACKGROUND.GRAY_MEDIUM,
                      borderWidth: tempStudyStatus === option.value ? 1 : 0,
                      borderColor: tempStudyStatus === option.value ? COLORS.BORDER.BLUE : 'transparent',
                    }}
                    onPress={() => {
                      const newStatus = tempStudyStatus === option.value ? null : option.value;
                      setTempStudyStatus(newStatus);
                    }}
                  >
                    <Ionicons
                      name={tempStudyStatus === option.value ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={tempStudyStatus === option.value ? COLORS.PRIMARY : COLORS.ICON.DEFAULT}
                    />
                    <ThemedText style={{
                      marginLeft: 6,
                      color: tempStudyStatus === option.value ? COLORS.PRIMARY : COLORS.TEXT.DARK,
                      fontWeight: tempStudyStatus === option.value ? 'bold' : 'normal',
                    }}>{option.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 品詞フィルター */}
            <View style={styles.filtersContainer}>
              {filters.map(filter => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterOption,
                    tempActiveFilters.includes(filter.value) && styles.filterItemActive
                  ]}
                  onPress={() => toggleFilter(filter.value)}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={24} 
                    color={tempActiveFilters.includes(filter.value) ? COLORS.PRIMARY : COLORS.ICON.DEFAULT} 
                  />
                  <ThemedText 
                    style={[
                      styles.filterItemText,
                      tempActiveFilters.includes(filter.value) && styles.filterItemTextActive
                    ]}
                  >
                    {filter.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={() => {
                  setTempActiveFilters(['all']);
                  setTempStudyStatus('未学習');
                }}
              >
                <ThemedText style={styles.resetButtonText}>リセット</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={() => {
                  setActiveFilters(tempActiveFilters);
                  setStudyStatus(tempStudyStatus);
                  setFilterModalVisible(false);
                }}
              >
                <ThemedText style={styles.applyButtonText}>適用</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // 並び替えモーダルの選択肢タップ時
  const handleSortSelect = (option: { label: string; value: SortOrder }) => {
    setSortOrder(option.value);
    setSortModalVisible(false);
    if (option.value === 'random') {
      // 新しいランダムシードを生成
      const newSeed = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setRandomSeed(newSeed);
      fetchVocabulary(true, option.value, newSeed);
    } else {
      setRandomSeed(null);
      fetchVocabulary(true, option.value);
    }
  };

  // useEffectでactiveFilters, studyStatus, filterModalVisibleを監視し、モーダルが閉じた直後にfetchVocabularyを呼ぶ
  useEffect(() => {
    if (
      prevModalVisibleRef.current && !filterModalVisible &&
      (prevFiltersRef.current !== activeFilters || prevStatusRef.current !== studyStatus)
    ) {
      fetchVocabulary(true);
    }
    prevFiltersRef.current = activeFilters;
    prevStatusRef.current = studyStatus;
    prevModalVisibleRef.current = filterModalVisible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, studyStatus, filterModalVisible]);

  // ローディング中の表示
  if (loading && page === 1) {
    return (
      <View style={COMMON_STYLES.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={COMMON_STYLES.loadingText}>単語帳を読み込んでいます...</Text>
      </View>
    );
  }

  // エラー表示
  if (error && vocabulary.length === 0) {
    return (
      <View style={COMMON_STYLES.errorContainer}>
        <Text style={COMMON_STYLES.errorText}>{error}</Text>
        <TouchableOpacity 
          style={COMMON_STYLES.retryButton}
          onPress={() => fetchVocabulary(true)}
        >
          <Text style={COMMON_STYLES.retryButtonText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // メインコンテンツ表示
  return (
    <ThemedView style={styles.container}>
      {/* フィルターとソートオプション */}
      {renderOptionBar()}
      {/* 並び替えモーダル */}
      {renderSortModal()}
      {/* フィルターモーダル */}
      {renderFilterModal()}
      <BoxLevelInfoModal 
        visible={boxLevelInfoVisible}
        onClose={() => setBoxLevelInfoVisible(false)}
      />
      
      {/* 単語リスト */}
      <FlatList
        data={vocabulary}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchVocabulary(true)}
            colors={[COLORS.PRIMARY]}
            tintColor={COLORS.PRIMARY}
          />
        }
        onEndReached={loadMoreItems}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              <ThemedText style={styles.loadingMoreText}>さらに読み込み中...</ThemedText>
            </View>
          ) : vocabulary.length > 0 ? (
            <ThemedText style={styles.endOfList}>リストの終わりです</ThemedText>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color={COLORS.TEXT_SECONDARY} />
            <ThemedText style={styles.emptyText}>
              {activeFilters.length > 1 ? '条件に一致する単語はありません' : '単語がありません'}
            </ThemedText>
          </View>
        }
        removeClippedSubviews={true}
        windowSize={5}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={16}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 10 : 20,
  },
  optionBarContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHT,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  optionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: COLORS.BACKGROUND.GRAY,
  },
  activeOptionButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  optionText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  activeOptionText: {
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.BACKGROUND.GRAY,
    borderRadius: 16,
  },
  filterButtonLabel: {
    fontSize: 14,
    color: COLORS.TEXT.LIGHT,
    marginRight: 4,
  },
  activeFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT.DARKER,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.EFFECTS.SHADOW,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  closeModalButton: {
    padding: 4,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%', // 2列レイアウト
    padding: 12,
    marginBottom: 10,
    marginHorizontal: '1%',
    backgroundColor: COLORS.BACKGROUND.GRAY,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER.GRAY,
  },
  filterItemActive: {
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    borderColor: COLORS.BORDER.BLUE,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterItemText: {
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
  },
  filterItemTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  itemContainer: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
    padding: 16,
    marginBottom: 6,
    elevation: 1,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  wordInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  word: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  partOfSpeech: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'normal',
  },
  boxLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  boxLevelIcon: {
    marginRight: 2,
  },
  boxLevelText: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  translation: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginRight: 12,
  },
  soundButton: {
    padding: 6,
    marginRight: 4,
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER.LIGHT,
    marginVertical: 12,
  },
  pronunciation: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 24,
  },
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  synonym: {
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  synonymText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '500',
  },
  exampleContainer: {
    backgroundColor: COLORS.BACKGROUND.MAIN,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  example: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 24,
    marginBottom: 4,
  },
  exampleTranslation: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  loadingMore: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  endOfList: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.TEXT_SECONDARY,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  resetButton: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.BACKGROUND.GRAY,
    borderWidth: 1,
    borderColor: COLORS.BORDER.GRAY,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT.DARK,
  },
  applyButton: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.WHITE,
  },
  knownItemBorder: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.SUCCESS.DARK,
  },
  unknownItemBorder: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.WARNING.DEFAULT,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonsContainerColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
  },
  boxLevelContainerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    minWidth: 48,
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    borderWidth: 1,
  },
  activeKnownButton: {
    backgroundColor: COLORS.SUCCESS.DARK,
    borderColor: COLORS.SUCCESS.DARKER,
  },
  activeUnknownButton: {
    backgroundColor: COLORS.WARNING.DEFAULT,
    borderColor: COLORS.WARNING.DARK,
  },
  swipeContainer: {
    position: 'relative',
  },
  swipeHint: {
    position: 'absolute',
    height: 88,
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHintText: {
    color: COLORS.WHITE,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  unknownSwipeHint: {
    left: 0,
    backgroundColor: COLORS.ERROR.DARK,
  },
  knownSwipeHint: {
    right: 0,
    backgroundColor: COLORS.SUCCESS.LIGHT,
  },
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  knownFeedback: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  unknownFeedback: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
  },
  feedbackText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statusIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  knownStatusIcon: {
    backgroundColor: COLORS.SUCCESS.DARK,
  },
  unknownStatusIcon: {
    backgroundColor: COLORS.WARNING.DEFAULT,
  },
  boxLevelInfoContent: {
    backgroundColor: COLORS.WHITE,
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  boxLevelInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  boxLevelInfoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT.DARKER,
  },
  boxLevelInfoBody: {
    marginBottom: 20,
  },
  boxLevelInfoText: {
    fontSize: 16,
    color: COLORS.TEXT.DARK,
    lineHeight: 24,
    marginBottom: 20,
  },
  boxLevelInfoList: {
    gap: 16,
  },
  boxLevelInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  boxLevelInfoBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  boxLevelInfoBoxText: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  boxLevelInfoItemText: {
    fontSize: 16,
    color: COLORS.TEXT.DARK,
  },
}); 
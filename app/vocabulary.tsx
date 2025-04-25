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
  Dimensions
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { COMMON_STYLES, COLORS } from '@/constants/styles';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSpeech } from '@/hooks/useSpeech';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

// 単語の型定義
interface VocabularyItem {
  id: number;
  word: string;
  translation: string;
  partOfSpeech: string;
  pronunciation: string;
  examples: { en: string; ja: string }[];
  synonyms: string[];
  notes: string;
  isSaved: boolean;
  date_added?: string; // 追加日
  learningStatus: 'known' | 'unknown'; // 知ってるか知らないかの状態
}

// フィルタータイプの定義
type FilterType = 'all' | 'saved' | 'unsaved' | 'noun' | 'verb' | 'adjective' | 'adverb' | 'known' | 'unknown';

// ソート順の定義
type SortOrder = 'alphabetical_asc' | 'alphabetical_desc';

export default function VocabularyScreen() {
  const { session } = useAuth();
  const { speakText } = useSpeech();
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [filteredVocabulary, setFilteredVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>(['all']);
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical_asc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 30; // 1ページあたりのアイテム数
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // スワイプで削除された単語IDリスト
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  // スワイプで削除中のIDリスト
  const [removingIds, setRemovingIds] = useState<number[]>([]);
  
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
  const removeAndUpdateStatus = (id: number, status: 'known' | 'unknown') => {
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
      const handleStateChange = (event: any) => {
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
  const fetchVocabulary = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
      setHasMore(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    // 実際のアプリでは、以下のようにAPIからデータを取得します
    // try {
    //   if (!session?.access_token) {
    //     throw new Error('認証トークンがありません');
    //   }
    //   const { data, error } = await supabase.functions.invoke('get-vocabulary', {
    //     body: { 
    //       userId: session.user.id,
    //       page: page,
    //       pageSize: pageSize,
    //       sortOrder: sortOrder
    //     }
    //   });
    //   if (error) throw error;
    //   
    //   if (data.length < pageSize) {
    //     setHasMore(false);
    //   }
    //   
    //   if (reset) {
    //     setVocabulary(data || []);
    //   } else {
    //     setVocabulary(prev => [...prev, ...data]);
    //   }
    // } catch (err) {
    //   const errorMessage = err instanceof Error ? err.message : '予期せぬエラーが発生しました';
    //   setError(errorMessage);
    //   console.log('fetchVocabulary error', err);
    // } finally {
    //   setLoading(false);
    //   setRefreshing(false);
    // }

    // ダミーデータを使用（実際のアプリではAPIからデータを取得します）
    setTimeout(() => {
      // ダミーデータを生成
      const generateDummyData = (currentPage: number, perPage: number) => {
        const partOfSpeechOptions = ['noun', 'verb', 'adjective', 'adverb'];
        
        const items: VocabularyItem[] = [];
        const startIdx = (currentPage - 1) * perPage;
        
        // 最大5ページまで（現実的なサンプル用）
        if (currentPage > 5) {
          setHasMore(false);
          setRefreshing(false);
          return [];
        }
        
        for (let i = 0; i < perPage; i++) {
          const idx = startIdx + i;
          // ランダムな日付（過去30日以内）
          const daysAgo = Math.floor(Math.random() * 30);
          const date = new Date();
          date.setDate(date.getDate() - daysAgo);
          
          items.push({
            id: idx + 1,
            word: `word${idx + 1}`,
            translation: `単語${idx + 1}`,
            partOfSpeech: partOfSpeechOptions[idx % partOfSpeechOptions.length],
            pronunciation: `/wɜːrd${idx + 1}/`,
            examples: [
              { en: `This is a sample sentence for word${idx + 1}.`, ja: `これは単語${idx + 1}のサンプル文です。` },
              { en: `We use word${idx + 1} in many contexts.`, ja: `私たちは多くの文脈で単語${idx + 1}を使います。` }
            ],
            synonyms: [`synonym${idx + 1}`, `similar${idx + 1}`],
            notes: `単語${idx + 1}に関する補足説明です。`,
            isSaved: idx % 3 === 0, // 3つに1つは保存済み
            date_added: date.toISOString(),
            learningStatus: idx % 2 === 0 ? 'known' : 'unknown'
          });
        }
        return items;
      };

      const dummyData = generateDummyData(page, pageSize);
      
      if (dummyData.length < pageSize) {
        setHasMore(false);
      }
      
      if (reset || page === 1) {
        setVocabulary(dummyData);
      } else {
        setVocabulary(prev => [...prev, ...dummyData]);
      }
      
      setLoading(false);
      setRefreshing(false);
    }, 800); // 読み込み時間をシミュレート
  };

  // 初回ロード
  useEffect(() => {
    fetchVocabulary(true);
  }, []);

  // ページが変わったときの追加ロード
  useEffect(() => {
    if (page > 1) {
      fetchVocabulary(false);
    }
  }, [page]);

  // フィルタリングとソートを適用
  useEffect(() => {
    let filtered = vocabulary.filter(item => !removedIds.includes(item.id));
    
    // フィルタリングロジック
    if (activeFilters.includes('all')) {
      // 「すべて」が選択されている場合は全件表示
    } else {
      // 保存状態によるフィルタリング
      const savedFilter = activeFilters.includes('saved');
      const unsavedFilter = activeFilters.includes('unsaved');
      
      if (savedFilter && !unsavedFilter) {
        // 「保存済み」のみ選択されている場合
        filtered = filtered.filter(item => item.isSaved);
      } else if (!savedFilter && unsavedFilter) {
        // 「未保存」のみ選択されている場合
        filtered = filtered.filter(item => !item.isSaved);
      } else if (!savedFilter && !unsavedFilter) {
        // どちらも選択されていない場合は品詞フィルターだけを適用
      }
      
      // 学習状態（知ってる/知らない）によるフィルタリング
      const knownFilter = activeFilters.includes('known');
      const unknownFilter = activeFilters.includes('unknown');
      
      if (knownFilter && !unknownFilter) {
        // 「知ってる」のみ選択されている場合
        filtered = filtered.filter(item => item.learningStatus === 'known');
      } else if (!knownFilter && unknownFilter) {
        // 「知らない」のみ選択されている場合
        filtered = filtered.filter(item => item.learningStatus === 'unknown');
      } else if (!knownFilter && !unknownFilter) {
        // どちらも選択されていない場合は他のフィルターだけを適用
      }
      
      // 品詞によるフィルタリング
      const partOfSpeechFilters = activeFilters.filter(f => 
        ['noun', 'verb', 'adjective', 'adverb'].includes(f)
      );
      
      if (partOfSpeechFilters.length > 0) {
        filtered = filtered.filter(item => 
          partOfSpeechFilters.includes(item.partOfSpeech as FilterType)
        );
      }
    }
    
    // ソート順を適用
    filtered.sort((a, b) => {
      if (sortOrder === 'alphabetical_asc') {
        return a.word.localeCompare(b.word);
      } else { // alphabetical_desc
        return b.word.localeCompare(a.word);
      }
    });
    
    setFilteredVocabulary(filtered);
  }, [vocabulary, activeFilters, sortOrder, removedIds]);

  // リフレッシュハンドラー
  const onRefresh = useCallback(() => {
    fetchVocabulary(true);
  }, []);

  // 単語の保存状態を切り替える関数
  const toggleSave = (id: number) => {
    setVocabulary(prevVocabulary => 
      prevVocabulary.map(item => 
        item.id === id ? { ...item, isSaved: !item.isSaved } : item
      )
    );
    
    // 実際のアプリでは、以下のようにAPIを呼び出して保存状態を更新します
    // supabase.functions.invoke('update-vocabulary-save-status', {
    //   body: { 
    //     vocabularyId: id,
    //     isSaved: !vocabulary.find(item => item.id === id)?.isSaved
    //   }
    // }).catch(err => {
    //   console.error('単語の保存状態の更新に失敗しました:', err);
    // });
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
          <Ionicons name="help-circle" size={24} color="#fff" />
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
          <Feather name="check-circle" size={24} color="#fff" />
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
            activeOffsetX={[-20, 20]}
            failOffsetY={[-20, 20]}
          >
            <Animated.View
              style={{ transform: [{ translateX }] }}
            >
              <TouchableOpacity
                style={[
                  styles.itemContainer,
                  item.learningStatus === 'known' && styles.knownItemBorder,
                  item.learningStatus === 'unknown' && styles.unknownItemBorder
                ]}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.wordContainer}>
                    <ThemedText style={styles.word}>{item.word}</ThemedText>
                    <ThemedText style={styles.partOfSpeech}>
                      {item.partOfSpeech === 'noun' ? '名詞' : 
                      item.partOfSpeech === 'verb' ? '動詞' : 
                      item.partOfSpeech === 'adjective' ? '形容詞' : 
                      item.partOfSpeech === 'adverb' ? '副詞' : item.partOfSpeech}
                    </ThemedText>
                  </View>
                  <View style={styles.rightContainer}>
                    <ThemedText style={styles.translation}>{item.translation}</ThemedText>
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity 
                        style={styles.soundButton}
                        onPress={() => handlePlaySound(item.word)}
                      >
                        <Ionicons name="volume-high" size={24} color={COLORS.PRIMARY} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.saveButton}
                        onPress={() => toggleSave(item.id)}
                      >
                        <Ionicons
                          name={item.isSaved ? "bookmark" : "bookmark-outline"}
                          size={24}
                          color={COLORS.PRIMARY}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />
                    
                    <ThemedText style={styles.pronunciation}>{item.pronunciation}</ThemedText>
                    
                    {item.synonyms.length > 0 && (
                      <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>類義語</ThemedText>
                        <View style={styles.synonymContainer}>
                          {item.synonyms.map((synonym, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.synonym}
                              onPress={() => handlePlaySound(synonym)}
                            >
                              <ThemedText style={styles.synonymText}>{synonym}</ThemedText>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                    
                    {item.examples.length > 0 && (
                      <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>例文</ThemedText>
                        {item.examples.map((example, index) => (
                          <View key={index} style={styles.exampleContainer}>
                            <ThemedText style={styles.example}>{example.en}</ThemedText>
                            <ThemedText style={styles.exampleTranslation}>{example.ja}</ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    {item.notes && (
                      <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>補足</ThemedText>
                        <ThemedText style={styles.notes}>{item.notes}</ThemedText>
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

  // フィルターとソートのオプションバーをレンダリングする関数
  const renderOptionBar = () => {
    const sortOptions: { label: string; value: SortOrder }[] = [
      { label: 'Aから順', value: 'alphabetical_asc' },
      { label: 'Zから順', value: 'alphabetical_desc' }
    ];
    
    // アクティブなフィルターの表示名を取得
    const getActiveFiltersLabel = () => {
      if (activeFilters.includes('all')) {
        return 'すべて';
      }
      
      const labels = [];
      if (activeFilters.includes('saved')) labels.push('保存済み');
      if (activeFilters.includes('unsaved')) labels.push('未保存');
      if (activeFilters.includes('known')) labels.push('知ってる');
      if (activeFilters.includes('unknown')) labels.push('知らない');
      if (activeFilters.includes('noun')) labels.push('名詞');
      if (activeFilters.includes('verb')) labels.push('動詞');
      if (activeFilters.includes('adjective')) labels.push('形容詞');
      if (activeFilters.includes('adverb')) labels.push('副詞');
      
      if (labels.length === 0) return 'すべて';
      if (labels.length <= 2) return labels.join('・');
      return `${labels.length}個の条件`;
    };
    
    return (
      <View style={styles.optionBarContainer}>
        <View style={styles.optionsRow}>
          {/* 並び替えボタン */}
          <View style={styles.sortButtonsContainer}>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  sortOrder === option.value && styles.activeOptionButton
                ]}
                onPress={() => setSortOrder(option.value)}
              >
                <ThemedText 
                  style={[
                    styles.optionText, 
                    sortOrder === option.value && styles.activeOptionText
                  ]}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* フィルターボタン */}
          <TouchableOpacity 
            style={styles.filterIconButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <ThemedText style={styles.filterButtonLabel}>絞り込み: </ThemedText>
            <ThemedText style={styles.activeFilterLabel}>{getActiveFiltersLabel()}</ThemedText>
            <Ionicons name="funnel" size={18} color={COLORS.PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // フィルターモーダルをレンダリングする関数
  const renderFilterModal = () => {
    const filters: { label: string; value: FilterType; icon: string }[] = [
      { label: 'すべて', value: 'all', icon: 'apps' },
      { label: '保存済み', value: 'saved', icon: 'bookmark' },
      { label: '未保存', value: 'unsaved', icon: 'bookmark-outline' },
      { label: '名詞', value: 'noun', icon: 'cube' },
      { label: '動詞', value: 'verb', icon: 'bicycle' },
      { label: '形容詞', value: 'adjective', icon: 'color-palette' },
      { label: '副詞', value: 'adverb', icon: 'speedometer' },
      { label: '知ってる', value: 'known', icon: 'thumbs-up' },
      { label: '知らない', value: 'unknown', icon: 'thumbs-down' }
    ];
    
    // フィルターを切り替える関数
    const toggleFilter = (value: FilterType) => {
      if (value === 'all') {
        // 「すべて」を選択した場合は他のフィルターをクリア
        setActiveFilters(['all']);
      } else {
        setActiveFilters(prev => {
          // 現在「すべて」が選択されている場合はクリア
          const newFilters = prev.includes('all') ? [] : [...prev];
          
          // 選択された値を切り替え
          if (newFilters.includes(value)) {
            // 値を削除
            const filtered = newFilters.filter(f => f !== value);
            // フィルターが空になった場合は「すべて」を選択
            return filtered.length === 0 ? ['all'] : filtered;
          } else {
            // 値を追加し、「すべて」を削除
            return [...newFilters.filter(f => f !== 'all'), value];
          }
        });
      }
    };
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>絞り込み条件を選択</ThemedText>
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filtersContainer}>
              {filters.map(filter => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterOption,
                    activeFilters.includes(filter.value) && styles.filterItemActive
                  ]}
                  onPress={() => {
                    toggleFilter(filter.value);
                  }}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={24} 
                    color={activeFilters.includes(filter.value) ? '#fff' : COLORS.TEXT_PRIMARY} 
                  />
                  <ThemedText 
                    style={[
                      styles.filterItemText,
                      activeFilters.includes(filter.value) && styles.filterItemTextActive
                    ]}
                  >
                    {filter.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <ThemedText style={styles.applyButtonText}>適用</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

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
      
      {/* フィルターモーダル */}
      {renderFilterModal()}
      
      {/* 単語リスト */}
      <FlatList
        data={filteredVocabulary}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
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
    borderBottomColor: COLORS.BORDER,
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
    backgroundColor: '#f0f0f0',
  },
  activeOptionButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  optionText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  activeOptionText: {
    color: '#fff',
    fontWeight: '500',
  },
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  filterButtonLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginRight: 4,
  },
  activeFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.PRIMARY,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterItemActive: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterItemText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  filterItemTextActive: {
    color: '#fff',
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
    borderColor: COLORS.BORDER,
    padding: 16,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
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
  word: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  partOfSpeech: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  saveButton: {
    padding: 6,
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: 12,
  },
  pronunciation: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  synonymContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  synonym: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  synonymText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
  },
  exampleContainer: {
    marginBottom: 12,
  },
  example: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  exampleTranslation: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  notes: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
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
    justifyContent: 'flex-end',
    padding: 16,
  },
  applyButton: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  knownItemBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  unknownItemBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#4caf50',
    borderColor: '#388e3c',
  },
  activeUnknownButton: {
    backgroundColor: '#ff9800',
    borderColor: '#f57c00',
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
    color: '#fff',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  unknownSwipeHint: {
    left: 0,
    backgroundColor: '#e74c3c',
  },
  knownSwipeHint: {
    right: 0,
    backgroundColor: '#27ae60',
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
    color: '#fff',
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
    backgroundColor: '#4caf50',
  },
  unknownStatusIcon: {
    backgroundColor: '#ff9800',
  },
}); 
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Markdown from 'react-native-markdown-display';

import { ThemedView } from '../components/ThemedView';
import { useSpeech } from '../hooks/useSpeech';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/styles';

// メッセージの型定義
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  examples?: Example[];
  richContent?: RichContent;
  contentBlocks?: ContentBlock[];
  sessionId?: string;
}

// 例文の型定義
interface Example {
  id: string;
  japanese: string;
  english: string;
  saved: boolean;
  note?: string;
  sentence_id?: number;
}

// リッチコンテンツの型定義
interface RichContent {
  title?: string;
  description?: string;
  sections?: ContentSection[];
}

// コンテンツセクションの型定義
interface ContentSection {
  title: string;
  items: ContentItem[];
}

// コンテンツアイテムの型定義
interface ContentItem {
  japaneseText: string;
  englishText: string;
  description?: string;
  examples?: {
    japanese: string;
    english: string;
  }[];
}

// 新しいコンテンツブロック型定義
interface ContentBlock {
  type: 'text' | 'example' | 'note' | 'header' | 'section';
  id: string;
  content: any;
}

// Markdown用のスタイル定義（dictionary.tsxから流用）
const markdownStyle = {
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.TEXT.PRIMARY,
  },
};

const ChatScreen = () => {
  const { session } = useAuth();
  const { speakText } = useSpeech();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { id: sessionIdFromParams } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  // カスタムメニュー用 state
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0 });
  const menuButtonRef = useRef<View>(null);

  // テキスト選択モーダル用 state
  const [textSelectionModalVisible, setTextSelectionModalVisible] = useState(false);
  const [selectedMessageText, setSelectedMessageText] = useState('');
  
  // メッセージ操作モーダル用 state
  const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    const fetchHistoryMessages = async (sessionId: string) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-chat-session-messages', {
          body: { sessionId }
        });
        if (error) throw error;
        if (Array.isArray(data)) {
          // 例文の保存状態を取得
          const loadedMessages: Message[] = await Promise.all(
            data.map(async (msg: any) => {
              let examples = msg.examples;
              if (examples && Array.isArray(examples) && examples.length > 0) {
                examples = await fetchExamplesSavedStatus(examples);
              }
              return {
                id: msg.id,
                text: msg.text,
                sender: msg.sender,
                timestamp: new Date(msg.timestamp),
                examples,
                richContent: msg.richContent,
                contentBlocks: msg.contentBlocks,
                sessionId: msg.sessionId,
              };
            })
          );
          setMessages(loadedMessages);
          setCurrentSessionId(sessionId);
        }
      } catch (e) {
        setMessages([
          {
            id: 'error',
            text: '履歴の取得に失敗しました。',
            sender: 'ai',
            timestamp: new Date(),
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    if (session && sessionIdFromParams) {
      fetchHistoryMessages(sessionIdFromParams as string);
    } else if (session && !sessionIdFromParams && currentSessionId === null) {
      setMessages([
        {
          id: 'initial-ai-message',
          text: 'こんにちは！英語に関する質問や、日本語を英語に訳してほしいことがあれば教えてください。',
          sender: 'ai',
          timestamp: new Date(),
        }
      ]);
    } else if (!session) {
      setMessages([]);
      setCurrentSessionId(null);
    }
  }, [session, sessionIdFromParams, currentSessionId]);

  // 会話履歴をAIに渡す形式で生成する関数
  const getChatHistoryForAI = (currentMessages: Message[]): { role: 'user' | 'model'; parts: { text: string }[] }[] => {
    return currentMessages
      .filter(msg => msg.id !== 'initial-ai-message' && !msg.id.endsWith('-error'))
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
  };

  // 例文ごとの保存状態を一括取得し反映する
  const fetchExamplesSavedStatus = async (examples: Example[]) => {
    if (!session || !examples || examples.length === 0) return examples;
    const sentenceIds = examples
      .map((ex) => ex.sentence_id)
      .filter((id): id is number => typeof id === 'number');
    if (sentenceIds.length === 0) return examples;
    try {
      const { data, error } = await supabase.functions.invoke('get-study-status-sentence-bulk', {
        method: 'POST',
        body: { sentenceIds },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (error || !data) {
        return examples.map((ex) => ({ ...ex, saved: false }));
      }
      return examples.map((ex) => ({
        ...ex,
        saved: ex.sentence_id && data[ex.sentence_id] ? true : false,
      }));
    } catch {
      return examples.map((ex) => ({ ...ex, saved: false }));
    }
  };

  // メッセージを送信する関数
  const sendMessage = async () => {
    if (!inputText.trim() || !session?.user) return;

    const userMessage: Message = {
      id: Date.now().toString() + '-user',
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      sessionId: currentSessionId ?? undefined,
    };

    const currentInput = inputText;
    setInputText('');

    // UIにユーザーメッセージを即時反映
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // スクロール
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const chatHistoryForAI = getChatHistoryForAI(messages);

      // Supabase Edge Function を呼び出す
      const { data: aiResponseMessageData, error: functionError } = await supabase.functions.invoke('get-chat-response', {
        body: {
          userInput: currentInput,
          history: chatHistoryForAI,
          sessionId: currentSessionId,
        },
      });

      if (functionError) {
        throw functionError;
      }

      if (aiResponseMessageData) {
        // ここでAIレスポンスをログ出力
        console.log('AIレスポンス:', aiResponseMessageData);
        const newSessionIdFromServer = aiResponseMessageData.sessionId;
        if (newSessionIdFromServer) {
          setCurrentSessionId(newSessionIdFromServer);
        }

        if (aiResponseMessageData.text) {
          let examples = aiResponseMessageData.examples?.map((ex: any) => ({
            id: ex.id || `client-temp-${Date.now()}`,
            japanese: ex.japanese,
            english: ex.english,
            note: ex.note,
            saved: false,
            sentence_id: ex.sentence_id,
          })) || undefined;

          // 例文ごとに保存状態を取得
          if (examples && examples.length > 0) {
            examples = await fetchExamplesSavedStatus(examples);
          }

          const aiMessage: Message = {
            id: aiResponseMessageData.id,
            text: aiResponseMessageData.text,
            sender: 'ai',
            timestamp: new Date(aiResponseMessageData.timestamp),
            examples,
            richContent: aiResponseMessageData.richContent,
            contentBlocks: aiResponseMessageData.contentBlocks,
            sessionId: newSessionIdFromServer,
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          const fallbackErrorMsg: Message = {
            id: Date.now().toString() + '-ai-error',
            text: '申し訳ありません。AIからの応答を正しく処理できませんでした。',
            sender: 'ai',
            timestamp: new Date(),
            sessionId: newSessionIdFromServer,
          };
          setMessages(prev => [...prev, fallbackErrorMsg]);
        }
      } else {
        const fallbackErrorMsg: Message = {
          id: Date.now().toString() + '-ai-error-nodata',
          text: '申し訳ありません。AIからの応答がありませんでした。',
          sender: 'ai',
          timestamp: new Date(),
          sessionId: currentSessionId ?? undefined,
        };
        setMessages(prev => [...prev, fallbackErrorMsg]);
      }

    } catch (error) {
      console.error('get-chat-response 呼び出しエラー:', error);
      const errorMessageText = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        text: `申し訳ありません。エラーが発生しました。(${errorMessageText})`,
        sender: 'ai',
        timestamp: new Date(),
        sessionId: currentSessionId ?? undefined,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // テキストを音声で読み上げる
  const handleSpeakText = (text: string, language: '英語' | '日本語' = '英語') => {
    speakText(text, language);
  };

  // テキストをクリップボードにコピーする
  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    // Alert.alert('コピー完了', 'テキストをクリップボードにコピーしました'); // Alertの代わりにToastなどを検討
    console.log('Text copied to clipboard');
  };

  // メッセージの全コンテンツをプレーンテキストに変換
  const getFullMessageText = (message: Message): string => {
    let fullText = message.text;

    // 例文を追加
    if (message.examples && message.examples.length > 0) {
      fullText += '\n\n【例文】\n';
      message.examples.forEach((example, index) => {
        fullText += `${index + 1}. ${example.english}\n   ${example.japanese}`;
        if (example.note) {
          fullText += `\n   注：${example.note}`;
        }
        fullText += '\n\n';
      });
    }

    // リッチコンテンツを追加
    if (message.richContent) {
      if (message.richContent.title) {
        fullText += `\n【${message.richContent.title}】\n`;
      }
      if (message.richContent.description) {
        fullText += `${message.richContent.description}\n\n`;
      }
      
      message.richContent.sections?.forEach((section) => {
        fullText += `■ ${section.title}\n`;
        section.items.forEach((item, index) => {
          fullText += `${index + 1}. ${item.japaneseText}\n   ${item.englishText}\n`;
          if (item.description) {
            fullText += `   ${item.description}\n`;
          }
          item.examples?.forEach((example, exIndex) => {
            fullText += `   例${exIndex + 1}: ${example.japanese}\n        ${example.english}\n`;
          });
          fullText += '\n';
        });
        fullText += '\n';
      });
    }

    // コンテンツブロックを追加
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      message.contentBlocks.forEach((block) => {
        switch (block.type) {
          case 'header':
            fullText += `\n【${block.content}】\n`;
            break;
          case 'text':
            fullText += `${block.content}\n\n`;
            break;
          case 'note':
            fullText += `注：${block.content}\n\n`;
            break;
          case 'section':
            const section = block.content;
            fullText += `${section.number}. ${section.title}\n`;
            if (section.example) {
              fullText += `例：${section.example.context}\n`;
              fullText += `💬 ${section.example.english}\n`;
              fullText += `   ${section.example.translation}\n\n`;
            }
            break;
          case 'example':
            const example = block.content as Example;
            fullText += `${example.english}\n${example.japanese}`;
            if (example.note) {
              fullText += `\n注：${example.note}`;
            }
            fullText += '\n\n';
            break;
        }
      });
    }

    return fullText.trim();
  };

    // メッセージ長押し時のアクションメニューを表示
  const handleMessageLongPress = (message: Message) => {
    setSelectedMessage(message);
    setMessageActionModalVisible(true);
  };

  // メッセージ操作の実行
  const handleMessageAction = (action: 'copy' | 'select') => {
    if (!selectedMessage) return;
    
    setMessageActionModalVisible(false);
    
    if (action === 'copy') {
      copyToClipboard(getFullMessageText(selectedMessage));
      Alert.alert('コピー完了', 'テキストをクリップボードにコピーしました');
    } else if (action === 'select') {
      setSelectedMessageText(getFullMessageText(selectedMessage));
      setTextSelectionModalVisible(true);
    }
    
    setSelectedMessage(null);
  };

  // リッチコンテンツの例文を保存する
  const saveRichExample = (sectionIndex: number, itemIndex: number, exampleIndex: number) => {
    // Alert.alert('保存機能', '単語帳に保存する機能は今後実装予定です');
    console.log('Save rich example action triggered');
  };

  // リッチコンテンツをレンダリングする関数
  const renderRichContent = (content: RichContent, messageId: string) => {
    return (
      <View style={styles.richContentContainer}>
        {content.title && (
          <View style={styles.richContentTitleContainer}>
            <Text style={styles.richContentTitle}>{content.title}</Text>
          </View>
        )}
        
        {content.description && (
          <Text style={styles.richContentDescription}>{content.description}</Text>
        )}
        
        {content.sections?.map((section, sectionIndex) => (
          <View key={`section-${sectionIndex}`} style={styles.contentSection}>
            <Text style={styles.contentSectionTitle}>{section.title}</Text>
            
            {section.items.map((item, itemIndex) => (
              <View key={`item-${sectionIndex}-${itemIndex}`} style={styles.contentItem}>
                <View style={styles.contentItemHeader}>
                  <Text style={styles.contentItemNumber}>{itemIndex + 1}.</Text>
                  <View style={styles.contentItemHeaderText}>
                    <Text style={styles.contentItemJapanese}>{item.japaneseText}</Text>
                    <Text style={styles.contentItemEnglish}>{item.englishText}</Text>
                  </View>
                </View>
                
                {item.examples?.map((example, exampleIndex) => (
                  <View key={`example-${sectionIndex}-${itemIndex}-${exampleIndex}`} style={styles.contentExample}>
                    <Text style={styles.contentExampleLabel}>例：</Text>
                    <View style={styles.contentExampleContent}>
                      <Text style={styles.contentExampleJapanese}>{example.japanese}</Text>
                      <View style={styles.contentExampleEnglishContainer}>
                        <Text style={styles.contentExampleEnglish}>{example.english}</Text>
                        <View style={styles.contentExampleActions}>
                          <TouchableOpacity
                            onPress={() => handleSpeakText(example.english)}
                            style={styles.contentExampleAction}
                          >
                            <Ionicons name="volume-medium-outline" size={18} color={COLORS.PRIMARY} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
                
                {item.description && (
                  <View style={styles.contentItemDescription}>
                    <Text style={styles.contentItemDescriptionText}>{item.description}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  // コンテンツブロックをレンダリングする関数
  const renderContentBlock = (block: ContentBlock, messageId: string) => {
    switch (block.type) {
      case 'header':
        return (
          <View key={block.id} style={styles.situationHeader}>
            <Text style={styles.situationHeaderText}>{block.content}</Text>
          </View>
        );
      case 'text':
        return (
          <View key={block.id} style={styles.situationText}>
            <Text style={styles.situationTextContent}>{block.content}</Text>
          </View>
        );
      case 'note':
        return (
          <View key={block.id} style={styles.situationNote}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.TEXT.DARKER} />
            <Text style={styles.situationNoteText}>{block.content}</Text>
          </View>
        );
      case 'section':
        const section = block.content;
        return (
          <View key={block.id} style={styles.situationSection}>
            <View style={styles.situationSectionHeader}>
              <Text style={styles.situationSectionNumber}>{section.number}.</Text>
              <Text style={styles.situationSectionTitle}>{section.title}</Text>
            </View>
            
            <View style={styles.situationExample}>
              <Text style={styles.situationExampleContextText}>例：{section.example.context}</Text>
              <View style={styles.situationExampleSentenceContainer}>
                <View style={styles.englishSentenceContainer}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.PRIMARY} style={styles.sentenceIcon} />
                  <Text style={styles.situationExampleEnglish}>{section.example.english}</Text>
                </View>
                <Text style={styles.situationExampleTranslation}>{section.example.translation}</Text>
              </View>
            </View>
          </View>
        );
      case 'example':
        const example = block.content as Example;
        return (
          <View key={block.id} style={styles.exampleItem}>
            <View style={styles.exampleHeader}>
              {example.saved && <Text style={styles.savedLabel}>保存済み</Text>}
            </View>
            
            <View style={styles.exampleTexts}>
              <View style={styles.languageSection}>
                <Text style={styles.exampleJapanese}>{example.japanese}</Text>
              </View>
              
              {example.note && (
                <View style={styles.noteContainer}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.TEXT.DARKER} />
                  <Text style={styles.exampleNote}>{example.note}</Text>
                </View>
              )}
              
              <View style={styles.languageSection}>
                <Text style={styles.exampleEnglish}>{example.english}</Text>
              </View>
            </View>
            
            <View style={styles.exampleActions}>
              <TouchableOpacity
                onPress={() => handleSpeakText(example.english)}
                style={styles.exampleActionButton}
              >
                <Ionicons name="volume-medium-outline" size={18} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  // 例文保存処理
  const handleSaveExample = async (example: Example, messageIdx: number, exampleIdx: number) => {
    if (!session) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }
    if (!example.sentence_id) {
      Alert.alert('エラー', '保存できる例文IDがありません');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('update-study-status-sentence', {
        method: 'POST',
        body: {
          sentenceId: example.sentence_id
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (error) throw error;
      // 保存状態をUIに反映
      setMessages(prevMsgs => {
        const newMsgs = [...prevMsgs];
        const msg = newMsgs[messageIdx];
        if (msg && msg.examples && msg.examples[exampleIdx]) {
          msg.examples[exampleIdx] = {
            ...msg.examples[exampleIdx],
            saved: data.isSaved,
          };
        }
        return newMsgs;
      });
    } catch (err) {
      Alert.alert('エラー', '例文の保存に失敗しました');
    }
  };

  // 例文をすべて保存する関数
  const handleSaveAllExamples = async (messageId: string, messageIdx: number) => {
    const targetMessage = messages[messageIdx];
    if (!targetMessage || !targetMessage.examples) return;
    const unsavedExamples = targetMessage.examples
      .map((ex, idx) => ({ ex, idx }))
      .filter(({ ex }) => !ex.saved);
    for (const { ex, idx } of unsavedExamples) {
      await handleSaveExample(ex, messageIdx, idx);
    }
  };

  // メッセージアイテムのレンダリング
  const renderMessage = (message: Message, messageIdx?: number) => {
    const isUserMessage = message.sender === 'user';
    
    return (
      <TouchableOpacity
        key={message.id}
        style={[
          styles.messageBubble,
          isUserMessage ? styles.userBubble : styles.aiBubble,
        ]}
        onLongPress={() => handleMessageLongPress(message)}
        activeOpacity={0.7}
      >
        {isUserMessage ? (
          <Text style={[
            styles.messageText,
            { color: COLORS.WHITE }
          ]}>
            {message.text}
          </Text>
        ) : (
          <View style={styles.markdownContainer}>
            <Markdown style={markdownStyle}>
              {message.text}
            </Markdown>
          </View>
        )}
        
        {!isUserMessage && (
          <View style={styles.messageActions}>
            {/*
            <TouchableOpacity
              onPress={() => handleSpeakText(message.text, '日本語')}
              style={styles.actionButton}
            >
              <Ionicons name="volume-medium-outline" size={20} color={COLORS.TEXT.PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => copyToClipboard(message.text)}
              style={styles.actionButton}
            >
              <Ionicons name="copy-outline" size={20} color={COLORS.TEXT.PRIMARY} />
            </TouchableOpacity>
            */}
          </View>
        )}
        
        {/* リッチコンテンツがある場合はそれを表示 */}
        {!isUserMessage && message.richContent && renderRichContent(message.richContent, message.id)}
        
        {/* 新しいコンテンツブロックがある場合 */}
        {!isUserMessage && message.contentBlocks && message.contentBlocks.length > 0 && (
          <View style={styles.contentBlocksContainer}>
            {message.contentBlocks.map(block => renderContentBlock(block, message.id))}
          </View>
        )}

        {/* 従来の例文リストがある場合も新しいスタイルで表示 */}
        {!isUserMessage && message.examples && message.examples.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => handleSaveAllExamples(message.id, messageIdx ?? 0)}
              style={styles.saveAllButton}
            >
              <Ionicons name="bookmark" size={16} color={COLORS.WHITE} style={{marginRight: 8}} />
              <Text style={styles.saveAllButtonText}>例文をすべて保存</Text>
            </TouchableOpacity>
            <View style={styles.contentBlocksContainer}>
              {message.examples.map((example, index) => (
                <View
                  key={example.id}
                  style={[
                    styles.compactExampleItem,
                    index < message.examples!.length - 1 && styles.exampleItemSeparator
                  ]}
                >
                  <View style={styles.compactExampleContent}>
                    <Text style={styles.compactExampleEnglish}>{example.english}</Text>
                    <Text style={styles.compactExampleJapanese}>{example.japanese}</Text>
                    
                    {example.note && (
                      <View style={styles.compactNoteContainer}>
                        <Ionicons name="information-circle-outline" size={12} color={COLORS.TEXT.DARKER} />
                        <Text style={styles.compactExampleNote}>{example.note}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.compactExampleActions}>
                    <TouchableOpacity
                      onPress={() => handleSpeakText(example.english)}
                      style={styles.compactActionButton}
                    >
                      <Ionicons name="volume-medium-outline" size={16} color={COLORS.PRIMARY} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSaveExample(example, messageIdx ?? 0, index)}
                      style={[
                        styles.compactActionButton,
                        example.saved && styles.savedExampleButton
                      ]}
                    >
                      <Ionicons
                        name={example.saved ? "bookmark" : "bookmark-outline"}
                        size={16}
                        color={example.saved ? COLORS.WHITE : COLORS.PRIMARY}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const closeMenu = () => {
    setMenuVisible(false);
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    router.push('/chat');
    closeMenu();
  };

  const handleChatHistory = () => {
    if (currentSessionId) {
      router.push({ pathname: '/chat-history', params: { id: currentSessionId } });
    } else {
      router.push('/chat-history');
    }
    closeMenu();
  };

  const handleMenuPress = () => {
    if (menuVisible) {
      closeMenu();
      return;
    }
    menuButtonRef.current?.measure((fx: number, fy: number, width: number, height: number, px: number, py: number) => {
      const menuPopupWidth = 160; 
      const estimatedMenuHeight = 95; // MenuItemの高さ(約45px) * 2 + Separator(約1px) + 微調整。実際の高さに基づいて調整してください。
      const screenWidth = Dimensions.get('window').width;
      const screenHeight = Dimensions.get('window').height; // 画面の高さを取得

      let adjustedX = px;
      if (px + menuPopupWidth > screenWidth) {
        adjustedX = screenWidth - menuPopupWidth - 10; 
      }
      if (adjustedX < 10) adjustedX = 10; 

      let adjustedY = py - estimatedMenuHeight - 5; // ボタンの上に表示するよう変更
      if (adjustedY < 10) { // 画面上部からはみ出す場合の調整
        adjustedY = 10;
      }
      // ボタンの下に十分なスペースがなく、上に表示すると画面上部をはみ出るほどボタンが上にある場合は、
      // ボタンの下に表示するフォールバックも検討できますが、ここではシンプルに上表示を優先します。

      setMenuPosition({ x: adjustedX, y: adjustedY, width: menuPopupWidth });
      setMenuVisible(true);
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onLayout={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 50)}
          onContentSizeChange={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 50)}
        >
          {(messages || []).map((msg, idx) => renderMessage(msg, idx))}
          
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY} />
            </View>
          )}
        </ScrollView>
        
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            ref={menuButtonRef}
            style={styles.historyButton}
            onPress={handleMenuPress}
          >
            <Ionicons name="menu-outline" size={28} color={COLORS.PRIMARY} />
          </TouchableOpacity>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="英語に関する質問を入力..."
            style={styles.textInput}
            multiline
            returnKeyType="default"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (Platform.OS === 'android' && inputText.trim()) {
                // sendMessage();
              }
            }}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? COLORS.WHITE : COLORS.ICON.DISABLED}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        transparent={true}
        visible={menuVisible}
        onRequestClose={closeMenu}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.modalOverlay}>
            <View 
              style={[
                styles.menuContainer, 
                { top: menuPosition.y, left: menuPosition.x, width: menuPosition.width }
              ]}
              onStartShouldSetResponder={() => true} 
            >
              <TouchableOpacity style={styles.menuItem} onPress={handleNewChat}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.TEXT.PRIMARY} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>新規チャット</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuItem} onPress={handleChatHistory}>
                <Ionicons name="time-outline" size={20} color={COLORS.TEXT.PRIMARY} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>チャット履歴</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* テキスト選択モーダル */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={textSelectionModalVisible}
        onRequestClose={() => setTextSelectionModalVisible(false)}
      >
        <View style={styles.textSelectionModalOverlay}>
          <View style={styles.textSelectionModalContent}>
            <View style={styles.textSelectionModalHeader}>
              <Text style={styles.textSelectionModalTitle}>テキストを選択</Text>
              <TouchableOpacity
                onPress={() => setTextSelectionModalVisible(false)}
                style={styles.textSelectionModalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.TEXT.PRIMARY} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.textSelectionModalTextContainer}>
              <Text style={styles.textSelectionModalText} selectable>
                {selectedMessageText}
              </Text>
            </ScrollView>
            
            <View style={styles.textSelectionModalActions}>
              <TouchableOpacity
                style={styles.textSelectionModalCopyButton}
                onPress={async () => {
                  await copyToClipboard(selectedMessageText);
                  setTextSelectionModalVisible(false);
                  Alert.alert('コピー完了', 'テキストをクリップボードにコピーしました');
                }}
              >
                <Ionicons name="copy-outline" size={20} color={COLORS.WHITE} />
                <Text style={styles.textSelectionModalCopyButtonText}>全文をコピー</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* メッセージ操作モーダル */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={messageActionModalVisible}
        onRequestClose={() => setMessageActionModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMessageActionModalVisible(false)}>
          <View style={styles.messageActionModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.messageActionModalContent}>
                <View style={styles.messageActionModalHeader}>
                  <Text style={styles.messageActionModalTitle}>メッセージ操作</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.messageActionOption}
                  onPress={() => handleMessageAction('copy')}
                >
                  <Ionicons name="copy-outline" size={24} color={COLORS.TEXT.PRIMARY} />
                  <Text style={styles.messageActionOptionText}>テキストをコピー</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.messageActionOption}
                  onPress={() => handleMessageAction('select')}
                >
                  <Ionicons name="text-outline" size={24} color={COLORS.TEXT.PRIMARY} />
                  <Text style={styles.messageActionOptionText}>テキストを選択</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.messageActionOption, styles.messageActionCancelOption]}
                  onPress={() => setMessageActionModalVisible(false)}
                >
                  <Ionicons name="close-outline" size={24} color={COLORS.TEXT.SECONDARY} />
                  <Text style={[styles.messageActionOptionText, styles.messageActionCancelText]}>キャンセル</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.MAIN,
  },
  historyButton: {
    padding: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    maxWidth: '95%',
    elevation: 1,
    shadowColor: COLORS.EFFECTS.SHADOW,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: COLORS.PRIMARY,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.WHITE,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    maxWidth: '95%',
    width: '95%',
  },
  markdownContainer: {
    flex: 1,
    maxWidth: '100%',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginBottom: Platform.OS === 'ios' ? 0 : 8,
    borderRadius: 24,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: COLORS.TEXT.PRIMARY,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.BACKGROUND.GRAY,
  },
  examplesContainer: {
    marginTop: 16,
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  examplesHeader: {
    backgroundColor: COLORS.PRIMARY,
    padding: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  badgeContainer: {
    backgroundColor: COLORS.WHITE,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
    fontSize: 14,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  examplesSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  examplesList: {
    padding: 12,
  },
  exampleItem: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
  },
  exampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
    paddingBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  savedLabel: {
    fontSize: 12,
    color: COLORS.SUCCESS.DARKER,
    backgroundColor: COLORS.SUCCESS.DEFAULT + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  exampleTexts: {
    flex: 1,
  },
  languageSection: {
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
  },
  languageHeader: {
    marginBottom: 4,
  },
  languageLabel: {
    fontSize: 12,
    color: COLORS.TEXT.SECONDARY,
    fontWeight: '500',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  exampleJapanese: {
    fontSize: 15,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 4,
  },
  exampleNote: {
    fontSize: 13,
    color: COLORS.TEXT.LIGHT,
    fontStyle: 'italic',
  },
  exampleEnglish: {
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
    fontWeight: '500',
    marginBottom: 6,
  },
  exampleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  exampleActionButton: {
    padding: 6,
    marginLeft: 10,
  },
  savedExampleButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  richContentContainer: {
    marginTop: 16,
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  richContentTitleContainer: {
    backgroundColor: COLORS.PRIMARY,
    padding: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  richContentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  richContentDescription: {
    fontSize: 14,
    color: COLORS.TEXT.PRIMARY,
    lineHeight: 20,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHT,
  },
  contentSection: {
    padding: 14,
  },
  contentSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    marginBottom: 14,
  },
  contentItem: {
    marginBottom: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
    shadowColor: COLORS.EFFECTS.SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  contentItemHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  contentItemNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginRight: 8,
    width: 20,
  },
  contentItemHeaderText: {
    flex: 1,
  },
  contentItemJapanese: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 4,
  },
  contentItemEnglish: {
    fontSize: 14,
    color: COLORS.TEXT.PRIMARY,
  },
  contentExample: {
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contentExampleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT.SECONDARY,
    marginRight: 8,
  },
  contentExampleContent: {
    flex: 1,
  },
  contentExampleJapanese: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 8,
    lineHeight: 20,
  },
  contentExampleEnglishContainer: {
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    borderRadius: 10,
    padding: 10,
  },
  contentExampleEnglish: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    lineHeight: 22,
  },
  contentExampleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  contentExampleAction: {
    padding: 6,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
    marginRight: 8,
  },
  contentItemDescription: {
    marginTop: 8,
    backgroundColor: COLORS.BACKGROUND.GRAY_LIGHT,
    borderRadius: 8,
    padding: 10,
    marginLeft: 28,
  },
  contentItemDescriptionText: {
    fontSize: 14,
    color: COLORS.TEXT.DARKER,
  },
  contentBlocksContainer: {
    marginTop: 12,
  },
  situationHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  situationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
  },
  situationText: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  situationTextContent: {
    fontSize: 15,
    color: COLORS.TEXT.PRIMARY,
    lineHeight: 22,
  },
  situationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  situationNoteText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.TEXT.DARKER,
    marginLeft: 8,
    lineHeight: 20,
  },
  situationSection: {
    marginBottom: 16,
    paddingLeft: 4,
  },
  situationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  situationSectionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginRight: 6,
  },
  situationSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.TEXT.PRIMARY,
    flex: 1,
  },
  situationExample: {
    marginLeft: 24,
    marginBottom: 4,
  },
  situationExampleContextText: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    lineHeight: 20,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  situationExampleSentenceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  englishSentenceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sentenceIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  situationExampleEnglish: {
    fontSize: 15,
    color: COLORS.TEXT.PRIMARY,
    flex: 1,
    lineHeight: 22,
  },
  situationExampleTranslation: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    marginLeft: 24,
    lineHeight: 20,
  },
  compactExampleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  compactExampleContent: {
    flex: 1,
    marginRight: 8,
  },
  compactExampleJapanese: {
    fontSize: 15,
    color: COLORS.TEXT.SECONDARY,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 2,
  },
  compactExampleEnglish: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    lineHeight: 24,
  },
  compactNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  compactExampleNote: {
    fontSize: 12,
    color: COLORS.TEXT.DARKER,
    marginLeft: 6,
    lineHeight: 16,
  },
  compactExampleActions: {
    flexDirection: 'column',
  },
  compactActionButton: {
    padding: 6,
    marginVertical: 4,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  saveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4, 
    marginTop: 16, 
    marginBottom: 8, 
  },
  saveAllButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  exampleItemSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  modalOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    elevation: 5,
    shadowColor: COLORS.EFFECTS.SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // minWidth: 160, // widthは動的に設定するためminWidthは削除またはコメントアウト
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemIcon: {
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.BORDER.LIGHT, // DEFAULTからLIGHTに変更
    marginHorizontal: 0,
  },
  // テキスト選択モーダル用スタイル
  textSelectionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSelectionModalContent: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  textSelectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  textSelectionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT.PRIMARY,
  },
  textSelectionModalCloseButton: {
    padding: 8,
  },
  textSelectionModalTextContainer: {
    maxHeight: 400,
    marginBottom: 20,
  },
  textSelectionModalText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.TEXT.PRIMARY,
    padding: 16,
    backgroundColor: COLORS.BACKGROUND.LIGHTER,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
  },
  textSelectionModalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  textSelectionModalCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  textSelectionModalCopyButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  // メッセージ操作モーダル用スタイル
  messageActionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageActionModalContent: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 8,
    width: 280,
    shadowColor: COLORS.EFFECTS.SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageActionModalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER.LIGHTER,
  },
  messageActionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT.PRIMARY,
    textAlign: 'center',
  },
  messageActionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageActionOptionText: {
    fontSize: 16,
    color: COLORS.TEXT.PRIMARY,
    marginLeft: 12,
    flex: 1,
    textAlign: 'left',
  },
  messageActionCancelOption: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER.LIGHTER,
  },
  messageActionCancelText: {
    color: COLORS.TEXT.SECONDARY,
  },
});

export default ChatScreen;
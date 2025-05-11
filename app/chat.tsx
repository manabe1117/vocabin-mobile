import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Text,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';

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
  richContent?: RichContent; // リッチコンテンツの追加
  contentBlocks?: ContentBlock[]; // 新しい柔軟なコンテンツブロック構造
}

// 例文の型定義
interface Example {
  id: string;
  japanese: string;
  english: string;
  saved: boolean;
  note?: string;
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
  content: any; // テキスト、例文、ノートなど様々なコンテンツを入れられるように
}

const ChatScreen = () => {
  const { session } = useAuth();
  const { speakText } = useSpeech();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'initial-ai-message',
      text: 'こんにちは！英語に関する質問や、日本語を英語に訳してほしいことがあれば教えてください。',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // 会話履歴を生成する関数
  const getChatHistory = (currentMessages: Message[]): { role: 'user' | 'model'; parts: { text: string }[] }[] => {
    return currentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
  };

  // メッセージを送信する関数
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    // ユーザーメッセージを現在のメッセージリストに追加
    const updatedMessages = [...(messages || []), userMessage];
    setMessages(updatedMessages);
    const currentInput = inputText; // Edge Functionに渡すため、state更新前の値を保持
    setInputText('');
    setIsLoading(true);

    // スクロールビューを一番下にスクロール
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Edge Functionに渡す会話履歴を取得 (AIの初期メッセージは含めない場合もあるので調整が必要)
      // ここでは、ユーザーの現在のメッセージの前までの履歴を渡すことを想定
      const chatHistory = getChatHistory(messages || []);

      // Supabase Edge Function を呼び出す
      const { data, error } = await supabase.functions.invoke('get-chat-response', {
        body: { message: currentInput, history: chatHistory }, // 会話履歴を渡す
      });

      if (error) {
        throw error; // エラーをキャッチブロックで処理
      }

      console.log('Edge Function の応答:', data);

      let aiResponse: Message;
      if (data && data.reply) {
        aiResponse = {
          id: Date.now().toString() + '-ai',
          text: data.reply, // Edge Functionからの応答テキスト
          sender: 'ai',
          timestamp: new Date(),
          examples: data.examples && data.examples.length > 0 ? data.examples : undefined, // examples を追加
          // contentBlocks は現状AIから返されない想定
        };
      } else {
        // Edge Functionから期待した応答が得られなかった場合のエラーメッセージ
        aiResponse = {
          id: Date.now().toString() + '-ai-error',
          text: '申し訳ありません。AIからの応答を取得できませんでした。' + (data?.error ? ` (${data.error})` : ''),
          sender: 'ai',
          timestamp: new Date(),
        };
      }
      setMessages(prev => [...(prev || []), aiResponse]);

    } catch (error) {
      console.error('Edge Function 呼び出しエラー:', error);
      const errorMessageText = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        text: `申し訳ありません。エラーが発生しました。(${errorMessageText})`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...(prev || []), errorMessage]);
    } finally {
      setIsLoading(false);
      // スクロールビューを一番下にスクロール
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // テキストを音声で読み上げる
  const handleSpeakText = (text: string, language: '英語' | '日本語' = '英語') => {
    speakText(text, language);
  };

  // テキストをクリップボードにコピーする
  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('コピー完了', 'テキストをクリップボードにコピーしました');
  };

  // 例文を保存済みリストに追加するヘルパー関数
  // const addExampleToSavedList = (exampleToAdd: Example) => { // 例文保存機能は後で実装
  //   setSavedExamples(prev => {
  //     const isAlreadySaved = prev.some(ex => ex.id === exampleToAdd.id && ex.japanese === exampleToAdd.japanese);
  //     if (!isAlreadySaved) {
  //       return [...prev, { ...exampleToAdd, saved: true }];
  //     }
  //     return prev;
  //   });
  // };

  // 例文を保存済みリストから削除するヘルパー関数
  // const removeExampleFromSavedList = (exampleToRemove: Example) => { // 例文保存機能は後で実装
  //   setSavedExamples(prev => prev.filter(ex => !(ex.id === exampleToRemove.id && ex.japanese === exampleToRemove.japanese)));
  // };

  // 例文を保存する
  // const saveExample = (messageId: string, exampleId: string) => { // 例文保存機能は後で実装
    // let foundExample: Example | null = null;
    // setMessages(prev =>
    //   prev.map(message => {
    //     if (message.id === messageId && message.examples) {
    //       const updatedExamples = message.examples.map(example => {
    //         if (example.id === exampleId) {
    //           foundExample = { ...example, saved: !example.saved };
    //           return foundExample;
    //         }
    //         return example;
    //       });
    //       return { ...message, examples: updatedExamples };
    //     }
    //     // contentBlocks内のexampleも対応
    //     if (message.id === messageId && message.contentBlocks) {
    //       const updatedBlocks = message.contentBlocks.map(block => {
    //         if (block.type === 'example' && block.id === exampleId) {
    //           const currentExample = block.content as Example;
    //           foundExample = { ...currentExample, saved: !currentExample.saved };
    //           return { ...block, content: foundExample };
    //         }
    //         return block;
    //       });
    //       return { ...message, contentBlocks: updatedBlocks };
    //     }
    //     return message;
    //   })
    // );
    // if (foundExample) {
    //   const currentExample: Example = foundExample;
    //   if (currentExample.saved) {
    //     addExampleToSavedList(currentExample);
    //     Alert.alert('保存完了', '例文を単語帳に追加しました');
    //   } else {
    //     removeExampleFromSavedList(currentExample);
    //     Alert.alert('解除完了', '例文を単語帳から削除しました');
    //   }
    // }
  // };

  // メッセージ内のすべての例文を保存する
  // const handleSaveAllExamples = (messageId: string) => { // 例文保存機能は後で実装
    // const targetMessage = messages.find(m => m.id === messageId);
    // if (!targetMessage || !targetMessage.examples) return;
    // let newExamplesAdded = false;
    // const examplesToSave = targetMessage.examples.filter(ex => !ex.saved);
    // if (examplesToSave.length === 0) {
    //   Alert.alert('保存済み', 'すべての例文は既に単語帳に保存されています。');
    //   return;
    // }
    // // メッセージ内の例文の保存状態を更新
    // setMessages(prev =>
    //   prev.map(message => {
    //     if (message.id === messageId && message.examples) {
    //       return {
    //         ...message,
    //         examples: message.examples.map((ex: Example) => ({
    //           id: ex.id,
    //           japanese: ex.japanese,
    //           english: ex.english,
    //           saved: true, 
    //           note: ex.note,
    //           // richContent や contentBlocks を持つ Example は現状ないと想定
    //         })),
    //       };
    //     }
    //     return message;
    //   })
    // );
    // // 保存済み例文リストを更新
    // examplesToSave.forEach(example => {
    //   addExampleToSavedList({ ...example, saved: true });
    //   newExamplesAdded = true;
    // });
    // if (newExamplesAdded) {
    //   Alert.alert('すべて保存完了', '選択された例文を単語帳に追加しました。');
    // }
  // };

  // リッチコンテンツの例文を保存する
  // const saveRichExample = (sectionIndex: number, itemIndex: number, exampleIndex: number) => { // 例文保存機能は後で実装
    // // 実装予定
    // Alert.alert('保存機能', '単語帳に保存する機能は今後実装予定です');
  // };

  // リッチコンテンツをレンダリングする関数
  const renderRichContent = (content: RichContent) => {
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
                          {/* <TouchableOpacity
                            style={styles.contentExampleAction}
                          >
                            <Ionicons name="bookmark-outline" size={18} color={COLORS.PRIMARY} />
                          </TouchableOpacity> */}
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
        const example = block.content;
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
              {/* <TouchableOpacity
                style={styles.exampleActionButton}
              >
                <Ionicons name="bookmark-outline" size={18} color={COLORS.PRIMARY} />
              </TouchableOpacity> */}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  // メッセージアイテムのレンダリング
  const renderMessage = (message: Message) => {
    const isUserMessage = message.sender === 'user';
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageBubble,
          isUserMessage ? styles.userBubble : styles.aiBubble,
        ]}
      >
        <Text style={[
          styles.messageText,
          { color: isUserMessage ? COLORS.WHITE : COLORS.TEXT.PRIMARY }
        ]}>
          {message.text}
        </Text>
        
        {!isUserMessage && (
          <View style={styles.messageActions}>
            <TouchableOpacity
              onPress={() => handleSpeakText(message.text, '日本語')}
              style={styles.actionButton}
            >
            </TouchableOpacity>
          </View>
        )}
        
        {/* リッチコンテンツがある場合はそれを表示 */}
        {!isUserMessage && message.richContent && renderRichContent(message.richContent)}
        
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
              // onPress={() => handleSaveAllExamples(message.id)} // 一時的にコメントアウト
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
                    // 最後の要素以外には下に線を引く
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
                      // onPress={() => saveExample(message.id, example.id)} // 一時的にコメントアウト
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
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // iPhoneの場合のオフセット調整
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* messages が undefined の可能性を考慮 */}
          {(messages || []).map(renderMessage)}
          
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY} />
            </View>
          )}
        </ScrollView>
        
        <View style={styles.inputContainer}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="英語に関する質問を入力..."
            style={styles.textInput}
            multiline
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={() => {
              if (inputText.trim()) {
                sendMessage();
              }
            }}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? COLORS.WHITE : COLORS.ICON.DISABLED}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND.MAIN,
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
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 8,
    marginBottom: 8,
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
    paddingVertical: 8,
    color: COLORS.TEXT.PRIMARY,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 14,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'column',
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
    backgroundColor: COLORS.SUCCESS.DEFAULT + '20', // 20% opacity
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
    fontWeight: '500',
    lineHeight: 22,
  },
  exampleNote: {
    fontSize: 12,
    color: COLORS.TEXT.DARKER,
    marginLeft: 6,
    flex: 1,
  },
  exampleEnglish: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
    lineHeight: 24,
  },
  exampleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 8,
    marginTop: 8,
  },
  exampleActionButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHTER,
  },
  savedExampleButton: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
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
    color: COLORS.TEXT.LIGHT,
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
    marginLeft: 8,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER.LIGHT,
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
    color: COLORS.TEXT.LIGHT,
  },
  contentBlocksContainer: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
  },
  situationHeader: {
    marginBottom: 16,
    marginTop: 8,
  },
  situationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT.PRIMARY,
  },
  situationText: {
    marginBottom: 16,
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
    marginBottom: 16,
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
    padding: 4,
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
  situationExampleLabel: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    marginBottom: 6,
  },
  situationExampleContext: {
    padding: 8,
    backgroundColor: COLORS.BACKGROUND.GRAY_LIGHT,
    borderRadius: 8,
    marginBottom: 8,
  },
  situationExampleContextText: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    lineHeight: 20,
    marginBottom: 10,
  },
  situationExampleContent: {
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    borderRadius: 8,
    padding: 12,
    marginLeft: 0,
  },
  situationExampleSentenceContainer: {
    // 必要に応じて追加のスタイリング
  },
  englishSentenceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sentenceIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  situationExampleEnglish: {
    fontSize: 15,
    fontWeight: 'normal',
    color: COLORS.TEXT.PRIMARY,
    flex: 1,
    lineHeight: 22,
  },
  situationExampleTranslation: {
    fontSize: 14,
    color: COLORS.TEXT.SECONDARY,
    fontStyle: 'normal',
    marginLeft: 24,
    lineHeight: 20,
  },
  compactExampleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  compactExampleContent: {
    flex: 1,
  },
  compactExampleJapanese: {
    fontSize: 15,
    color: COLORS.TEXT.SECONDARY,
    fontWeight: '500',
    lineHeight: 22,
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
    marginVertical: 6,
    backgroundColor: COLORS.BACKGROUND.BLUE_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  compactExampleNote: {
    fontSize: 12,
    color: COLORS.TEXT.DARKER,
    marginLeft: 6,
    flex: 1,
    marginRight: 8,
    textAlignVertical: 'center',
    lineHeight: 16,
  },
  compactExampleActions: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
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
    marginHorizontal: 4, // contentBlocksContainerのpaddingを考慮
    marginTop: 16, // 上の要素とのマージン
    marginBottom: 8, // 下の例文リストとのマージン
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
});

export default ChatScreen;
// context/AuthContext.tsx (修正後)

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean; // ★ isLoading を追加
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

// ★ Context の初期値を定義 (undefined を避ける)
const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true, // ★ 初期値は true
  signInWithGoogle: async () => { console.warn('AuthProvider not ready'); },
  signOut: async () => { console.warn('AuthProvider not ready'); },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // ★ isLoading state を追加、初期値 true

  useEffect(() => {
    let isMounted = true; // マウント状態を追跡するフラグ

    // Google Signin の設定 (アプリ起動時に一度だけ実行)
    const configureGoogleSignIn = async () => {
        try {
            await GoogleSignin.configure({
                webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
                iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
                scopes: ['profile', 'email'],
            });
            console.log("Google Sign-In Configured");
        } catch (error) {
            console.error("Error configuring Google Sign-In:", error);
        }
    };
    configureGoogleSignIn();

    // 初回のセッション取得
    console.log("AuthContext: Getting initial session...");
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (isMounted) {
          console.log("AuthContext: Initial session fetched", currentSession ? 'Session found' : 'No session');
          setSession(currentSession);
        }
      })
      .catch(error => {
          console.error("AuthContext: Error getting initial session:", error);
      })
      .finally(() => {
          // ★ セッション取得試行が完了したらローディングを解除
          if (isMounted) {
              console.log("AuthContext: Finished initial session check, setting isLoading to false");
              setIsLoading(false);
          }
      });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log("AuthContext: Auth state changed:", _event, currentSession ? 'Got session' : 'No session');
      if (isMounted) {
          setSession(currentSession);
          // ★ 状態変更時にも isLoading は false になっているはずだが、念のため確認・設定
          if (isLoading && !isMounted) { // もし isMounted が false になってから呼ばれた場合、 or isLoading が true のままだった場合
             setIsLoading(false);
          }
      }
    });

    // クリーンアップ関数
    return () => {
      console.log("AuthContext: Unmounting, unsubscribing auth listener.");
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // 依存配列は空でOK

  // signInWithGoogle, signOut 関数 (変更なし、前回の修正を適用済みとする)
  const signInWithGoogle = async () => { /* ... 実装 ... */ };
  const signOut = async () => { /* ... 実装 ... */ };

  // ★ isLoading を value に含める
  const value = { session, isLoading, signInWithGoogle, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth フック (変更なし)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // このエラーは AuthProvider の外で useAuth を呼んだ場合に発生
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
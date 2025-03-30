import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

      // Google認証の設定
      await GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        // offlineAccess: true,
        scopes: ['profile', 'email'],
        // forceCodeForRefreshToken: true,
      });

      // Google認証を実行
      const userInfo = await GoogleSignin.signIn();
      console.log('userInfo', userInfo);

      // ユーザー提供のログ形式 {"data": {"idToken": "..."}} に基づいて idToken を取得
      const idToken = userInfo.data?.idToken;

      if (typeof idToken === 'string' && idToken) { // idToken が文字列で、かつ空でないことを確認
        console.log('ID Token received:', idToken);

        // Supabase で Google 認証を実行 (取得した idToken を使用)
        console.log('Attempting Supabase sign in with ID Token...');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken, // 正しい idToken を渡す
        });

        if (error) {
          console.error('Supabase signInWithIdToken Error:', error);
          // Supabase エラーの詳細を出力してみる
          if (error instanceof Error) { // Error オブジェクトか確認
            console.error('Supabase Error Details:', error.message, error.stack);
          }
          throw error;
        }

        console.log('Supabase Sign In Success:', data);
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ session, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
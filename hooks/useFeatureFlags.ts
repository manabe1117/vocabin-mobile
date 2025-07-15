import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 機能名の定義
 */
export type FeatureName = 'dictionary' | 'study' | 'vocabulary' | 'translate' | 'chat' | 'chat-history';

/**
 * プロフィール情報の型定義
 */
export interface Profile {
  id: string;
  username: string;
  is_admin: boolean;
}

/**
 * 完了済みの機能リスト
 */
const COMPLETED_FEATURES: FeatureName[] = ['dictionary', 'study', 'vocabulary'];

/**
 * 機能フラグフック
 */
export function useFeatureFlags() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 管理者権限とプロフィール情報を確認
   */
  const checkAdminStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setIsAdmin(false);
        setProfile(null);
        return;
      }

      // Edge Functionを使用して管理者権限とプロフィール情報を確認
      const { data, error } = await supabase.functions.invoke('is-admin', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('管理者権限の確認でエラーが発生しました:', error);
        setError('管理者権限の確認に失敗しました');
        setIsAdmin(false);
        setProfile(null);
        return;
      }

      setIsAdmin(data?.isAdmin === true);
      setProfile(data?.profile || null);
    } catch (err) {
      console.error('管理者権限の確認でエラーが発生しました:', err);
      setError('管理者権限の確認に失敗しました');
      setIsAdmin(false);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 機能にアクセス可能かどうかを確認
   */
  const canAccessFeature = useCallback((featureName: FeatureName): boolean => {
    // 完了済みの機能は全員がアクセス可能
    if (COMPLETED_FEATURES.includes(featureName)) {
      return true;
    }
    
    // 未完了の機能は管理者のみアクセス可能
    return isAdmin;
  }, [isAdmin]);

  /**
   * 機能フラグの初期化
   */
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  /**
   * 認証状態の変更を監視
   */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  return {
    isAdmin,
    profile,
    loading,
    error,
    canAccessFeature,
    refreshAdminStatus: checkAdminStatus,
  };
} 
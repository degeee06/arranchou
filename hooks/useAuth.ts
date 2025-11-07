

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
// Fix: Use imports from @supabase/auth-js as some versions of supabase-js do not export Session and User directly.
import { Session, User } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (user: User | null) => {
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires an event immediately on page load with the initial session data.
    // This single listener handles the initial session check, login, logout, and token refreshes.
    // Fix: Cast to `any` to bypass incorrect V1 type definitions that cause a compilation error.
    const { data: authListener } = (supabase.auth as any).onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setSession(session);
        await fetchProfile(session?.user ?? null);
        // Once the session is processed and profile is fetched, the initial auth check is complete.
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);
  
  const logout = async () => {
      // Fix: Cast to `any` to bypass incorrect V1 type definitions that cause a compilation error.
      const { error } = await (supabase.auth as any).signOut();
      if (error) {
        console.error('Error logging out:', error.message);
      }
      // The onAuthStateChange listener will handle all state updates automatically.
  }

  return { session, profile, user: session?.user ?? null, loading, logout };
}
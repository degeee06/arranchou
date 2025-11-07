import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: authListener } = (supabase.auth as any).onAuthStateChange(
      async (_event: string, session: Session | null) => {
        try {
          setSession(session);
          if (session?.user) {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
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
        } catch (e) {
            console.error("An error occurred in onAuthStateChange callback", e);
            setProfile(null);
            setSession(null);
        } finally {
          // Esta é a correção definitiva. O carregamento é finalizado
          // independentemente de sucesso ou falha dentro do bloco try.
          setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
      const { error } = await (supabase.auth as any).signOut();
      if (error) {
        console.error('Error logging out:', error.message);
      }
  }

  return { session, profile, user: session?.user ?? null, loading, logout };
}

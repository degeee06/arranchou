import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      try {
        // 1. Pega a sessão inicial. Isso é mais rápido e confiável no carregamento da página.
        const { data: { session } } = await (supabase.auth as any).getSession();
        setUser(session?.user ?? null);

        if (session?.user) {
          // 2. Se houver uma sessão, busca o perfil.
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('Error fetching profile on initial load:', error);
            setProfile(null);
          } else {
            setProfile(data);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error in initial session fetch:', error);
        setUser(null);
        setProfile(null);
      } finally {
        // 3. GARANTE que o loading termine, aconteça o que acontecer.
        setLoading(false);
      }
    };

    fetchSessionAndProfile();

    // 4. Agora, escuta por mudanças (login/logout) DEPOIS da carga inicial.
    const { data: authListener } = (supabase.auth as any).onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setUser(session?.user ?? null);

        if (session?.user) {
           const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(error ? null : data);
        } else {
          setProfile(null);
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
      // O listener onAuthStateChange cuidará de limpar os estados.
  }

  return { user, profile, loading, logout };
}

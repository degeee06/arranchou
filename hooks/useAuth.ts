// useAuth.ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedProfile = useRef(false); // 🔹 Novo: controla se já buscou o perfil

  useEffect(() => {
    async function loadInitialSession() {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        setUser(session?.user ?? null);

        if (session?.user && !hasFetchedProfile.current) {
          hasFetchedProfile.current = true;
          
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!error) setProfile(profileData);
        }
      } catch (e) {
        console.error('Erro ao carregar sessão inicial:', e);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    loadInitialSession();

    // 🔹 Listener melhorado
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        console.log('Auth event:', event); // Para debug
        
        setUser(session?.user ?? null);

        // 🔹 Só busca perfil em eventos específicos e se não buscou antes
        if (session?.user && !hasFetchedProfile.current) {
          hasFetchedProfile.current = true;
          
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!error) setProfile(data);
        } else if (!session?.user) {
          // 🔹 Reset quando desloga
          hasFetchedProfile.current = false;
          setProfile(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    hasFetchedProfile.current = false; // 🔹 Reset no logout
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Erro ao sair:', error.message);
  };

  return { user, profile, loading, logout };
}
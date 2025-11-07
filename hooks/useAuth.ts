import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitialSession() {
      try {
        // 🔹 1. Verifica se há sessão salva no navegador
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        setUser(session?.user ?? null);

        if (session?.user) {
          // 🔹 2. Busca o perfil do usuário logado
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
        // 🔹 3. Agora pode renderizar a tela
        setLoading(false);
      }
    }

    loadInitialSession();

    // 🔹 4. Listener que atualiza o estado se o usuário logar/deslogar
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!error) setProfile(data);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Erro ao sair:', error.message);
  };

  return { user, profile, loading, logout };
}

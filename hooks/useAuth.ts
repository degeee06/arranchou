import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Este efeito é executado apenas uma vez na montagem do componente para configurar o listener de autenticação.
    const { data: authListener } = (supabase.auth as any).onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setSession(session);
        
        // Se uma sessão existir, busca o perfil do usuário.
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
          // Se não houver sessão, garante que o perfil seja nulo.
          setProfile(null);
        }

        // Independentemente do resultado, a verificação inicial de autenticação está completa.
        // Finaliza o estado de carregamento. Esta é a parte crucial que impede o loop.
        setLoading(false);
      }
    );

    return () => {
      // Limpa o listener quando o componente é desmontado.
      authListener.subscription.unsubscribe();
    };
  }, []); // O array de dependências vazio garante que este efeito seja executado apenas UMA VEZ.

  const logout = async () => {
      const { error } = await (supabase.auth as any).signOut();
      if (error) {
        console.error('Error logging out:', error.message);
      }
      // O listener onAuthStateChange acima cuidará da atualização do estado automaticamente,
      // definindo a sessão e o perfil como nulos.
  }

  return { session, profile, user: session?.user ?? null, loading, logout };
}

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/auth-js';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Começa como true

  useEffect(() => {
    // onAuthStateChange é a única fonte de verdade.
    // Ele é acionado uma vez no carregamento da página com a sessão inicial e, em seguida, para quaisquer alterações de autenticação.
    const { data: authListener } = (supabase.auth as any).onAuthStateChange(
      async (event: string, session: Session | null) => {
        try {
          setUser(session?.user ?? null);

          if (session?.user) {
            // Se houver um usuário, busca o perfil dele.
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (error) {
              // Se a busca do perfil falhar, é um erro crítico.
              // Isso pode acontecer se o perfil não foi criado corretamente
              // ou se o token é válido, mas o usuário não existe no banco de dados.
              // Devemos tratar isso como um estado de "não logado".
              console.error('Erro ao buscar perfil:', error);
              setProfile(null);
            } else {
              setProfile(data);
            }
          } else {
            // Se não há sessão, não há perfil.
            setProfile(null);
          }
        } catch (e) {
          console.error("Um erro crítico ocorreu no onAuthStateChange:", e);
          setUser(null);
          setProfile(null);
        } finally {
          // Não importa o que aconteça (sucesso, sem sessão, erro),
          // a verificação inicial de autenticação está agora completa. Finaliza o estado de carregamento.
          setLoading(false);
        }
      }
    );

    // Função de limpeza para cancelar a inscrição quando o componente for desmontado.
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // O array de dependências vazio significa que isso roda apenas uma vez na montagem.

  const logout = async () => {
    const { error } = await (supabase.auth as any).signOut();
    if (error) {
      console.error('Erro ao fazer logout:', error.message);
    }
    // O listener onAuthStateChange irá lidar automaticamente com a atualização do estado
    // ao receber uma sessão nula. Não há necessidade de definir estados manualmente aqui.
  };

  return { user, profile, loading, logout };
}

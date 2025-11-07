
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Button, Input } from './ui';
import { UserRole } from '../types';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Supabase doesn't support sign-in with metadata directly.
        // We fetch the email associated with the badge number first.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('auth_email')
          .eq('badge_number', badgeNumber)
          .single();

        if (profileError || !profile) {
          throw new Error('Nº do Crachá ou senha inválidos.');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: profile.auth_email,
          password,
        });

        if (signInError) throw signInError;
      } else {
        // For sign-up, we generate a unique email from the badge number.
        const email = `${badgeNumber}@arranchou.app`;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              badge_number: badgeNumber,
              role: UserRole.EMPLOYEE,
            },
          },
        });

        if (signUpError) throw signUpError;
        
        // We also store the generated email in profiles for login purposes.
        if (data.user) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ auth_email: email })
              .eq('id', data.user.id);

            if (profileError) {
              // If this fails, we should ideally roll back the user creation
              // For now, we log the error
              console.error("Failed to update profile with email:", profileError);
            }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center text-white">
          Arranchou - {isLogin ? 'Login' : 'Cadastro'}
        </h2>
        {error && <p className="text-red-400 text-center">{error}</p>}
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm font-medium text-gray-300">Nome Completo</label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-300">Nº do Crachá</label>
            <Input
              type="text"
              value={badgeNumber}
              onChange={(e) => setBadgeNumber(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>
        <p className="text-sm text-center text-gray-400">
          {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <button
            onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
            }}
            className="ml-1 font-semibold text-blue-400 hover:underline"
          >
            {isLogin ? 'Cadastre-se' : 'Faça login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;


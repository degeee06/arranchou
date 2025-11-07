import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Button, Input } from './ui';

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
        // Construct the email from the badge number, same as in sign-up
        const email = `${badgeNumber}@arranchou.app`;

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password,
        });
        
        // Make error generic to prevent user enumeration
        if (signInError) {
            throw new Error('Nº do Crachá ou senha inválidos.');
        }

      } else {
        // For sign-up, we generate a unique email from the badge number.
        const email = `${badgeNumber}@arranchou.app`;
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              badge_number: badgeNumber,
              auth_email: email, // Provide email for the backend trigger
              // Role must be set by a server-side trigger, not from the client.
            },
          },
        });

        if (signUpError) throw signUpError;
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
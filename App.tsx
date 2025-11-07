import React from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const { profile, loading, logout } = useAuth();

  // 🔹 Mostra tela de carregamento enquanto verifica sessão
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-600"></div>
      </div>
    );
  }

  // 🔹 Após o carregamento, se há perfil, o usuário está logado
  if (profile) {
    return <Dashboard profile={profile} logout={logout} />;
  }

  // 🔹 Caso contrário, mostra a tela de login
  return <Login />;
};

export default App;

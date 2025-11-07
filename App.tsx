
import React from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const { profile, loading, logout } = useAuth();

  // Exibe o spinner SOMENTE durante a verificação inicial de autenticação.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-600"></div>
      </div>
    );
  }

  // Após o carregamento, se houver um perfil, o usuário está logado.
  if (profile) {
    return <Dashboard profile={profile} logout={logout} />;
  }
  
  // Se não houver perfil, exibe a tela de login.
  return <Login />;
};

export default App;

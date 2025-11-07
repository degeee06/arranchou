
import React from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const { session, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-600"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return <Login />;
  }

  return <Dashboard profile={profile} logout={logout} />;
};

export default App;

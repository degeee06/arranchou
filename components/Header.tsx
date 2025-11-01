import React from 'react';
import { Session } from '@supabase/supabase-js';

interface HeaderProps {
    session: Session | null;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ session, onLogout }) => {
  return (
    <header className="p-4 my-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Arranchou
        </h1>
        <p className="text-md text-gray-400 mt-2">
          Gerencie o arranchamento da semana de forma simples e rápida.
        </p>
      </div>
      {session && (
        <div className="mt-4 flex justify-center items-center gap-3 text-sm">
            <span className="text-gray-300">Logado como: <strong>{session.user.email}</strong></span>
            <button 
                onClick={onLogout}
                className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded-md transition-colors"
            >
                Sair
            </button>
        </div>
      )}
    </header>
  );
};

export default Header;

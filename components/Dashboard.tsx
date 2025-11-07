
import React from 'react';
import { Profile } from '../types';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

interface DashboardProps {
  profile: Profile;
  logout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ profile, logout }) => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className='flex items-center space-x-3'>
            <svg className="h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Painel de Almoço
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:block">Olá, <span className="font-semibold">{profile.full_name}</span>!</span>
            <button
              onClick={logout}
              className="flex items-center space-x-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {profile.role === 'admin' ? <AdminDashboard profile={profile} /> : <EmployeeDashboard profile={profile} />}
      </main>
    </div>
  );
};

export default Dashboard;

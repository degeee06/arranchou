
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';
import EmployeeDashboard from './EmployeeDashboard';
import AdminDashboard from './AdminDashboard';
import { Button, LogOutIcon } from './ui';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold text-white">Arranchou</h1>
            <p className="text-gray-400">Olá, {user?.full_name}</p>
        </div>
        <Button onClick={signOut} variant="secondary" className="flex items-center gap-2">
            <LogOutIcon />
            Sair
        </Button>
      </header>
      <main>
        {user?.role === UserRole.ADMIN ? <AdminDashboard /> : <EmployeeDashboard />}
      </main>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile, Attendance, AttendanceStatus } from '../types';
import { generateAdminHistoryPDF } from '../utils/pdfGenerator';

interface AdminDashboardProps {
  profile: Profile;
}

const statusOptions: AttendanceStatus[] = [
  AttendanceStatus.Pendente,
  AttendanceStatus.Confirmado,
  AttendanceStatus.Ausente,
  AttendanceStatus.Falta,
];

const roleOptions: ('admin' | 'employee')[] = ['admin', 'employee'];

type AdminAttendanceRecord = Attendance & { profiles: { full_name: string } | null };

const AdminDashboard: React.FC<AdminDashboardProps> = ({ profile }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'history', 'users'

  // State for the new user modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', badgeNumber: '', password: '' });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);

    const usersPromise = supabase.from('profiles').select('*').order('full_name');
    const attendancePromise = supabase.from('attendance').select('*, profiles(full_name)').order('date', { ascending: false });

    const [{ data: usersData, error: usersError }, { data: attendanceData, error: attendanceError }] = await Promise.all([usersPromise, attendancePromise]);

    if (usersError) {
      console.error("Error fetching users:", usersError);
    } else {
      setUsers(usersData || []);
    }

    if (attendanceError) {
      console.error("Error fetching attendance:", attendanceError.message);
    } else {
      setAttendance(attendanceData as AdminAttendanceRecord[] || []);
    }

    if (usersData && attendanceData) {
      const today = getTodayString();
      const usersWithoutTodayAttendance = usersData.filter(user => 
        !attendanceData.some(att => att.user_id === user.id && att.date === today)
      );

      if (usersWithoutTodayAttendance.length > 0) {
        const newAttendanceRecords = usersWithoutTodayAttendance.map(user => ({
          user_id: user.id,
          date: today,
          status: AttendanceStatus.Pendente
        }));
        await supabase.from('attendance').insert(newAttendanceRecords);
        // After creating missing records, refetch to get the latest state.
        // We call without isInitial to avoid the loading spinner.
        if (isInitial) await fetchData(false);
      }
    }

    if (isInitial) setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const handleUpdateStatus = async (attendanceId: number, status: AttendanceStatus) => {
    const { data, error } = await supabase.from('attendance').update({ status }).eq('id', attendanceId).select('*, profiles(full_name)').single();
    if (error) {
      console.error("Error updating status:", error);
    } else {
      setAttendance(prev => prev.map(att => att.id === attendanceId ? data as AdminAttendanceRecord : att));
    }
  };
  
  const handleUpdateRole = async (userId: string, role: 'admin' | 'employee') => {
      const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select().single();
      if (error) {
          console.error("Error updating role:", error);
      } else {
          setUsers(prev => prev.map(u => u.id === userId ? data : u));
      }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setCreationError(null);

    const { data, error } = await supabase.functions.invoke('create-user', {
        body: newUser,
    });
    
    setIsCreatingUser(false);

    // This handles network errors or if the function itself crashes
    if (error) {
        setCreationError('Falha na comunicação com o servidor. Tente novamente.');
        return;
    }
    
    // This handles custom errors returned from the function logic (e.g., user exists)
    if (data.error) {
        setCreationError(data.error);
        return;
    }

    // Success
    setIsModalOpen(false);
    setNewUser({ fullName: '', badgeNumber: '', password: '' });
    await fetchData(false); // Refresh data
  };

  const filteredAttendance = attendance.filter(att => att.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredUsers = users.filter(user => user.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const todayRecords = filteredAttendance.filter(att => att.date === getTodayString());

  const renderContent = () => {
    if (loading) return <div className="text-center p-8">Carregando dados...</div>;

    switch(activeTab) {
      case 'today':
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status Hoje</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {todayRecords.map(att => (
                  <tr key={att.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{att.profiles?.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select value={att.status} onChange={(e) => handleUpdateStatus(att.id, e.target.value as AttendanceStatus)} className="p-2 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 focus:ring-blue-500 focus:border-blue-500">
                        {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'history':
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAttendance.map(att => (
                  <tr key={att.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{new Date(att.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{att.profiles?.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{att.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'users':
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Crachá</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cargo</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.map(user => (
                    <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.badge_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <select value={user.role} onChange={(e) => handleUpdateRole(user.id, e.target.value as 'admin' | 'employee')} className="p-2 rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 focus:ring-blue-500 focus:border-blue-500">
                            {roleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 mb-4">
          <div className="flex space-x-1 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <button onClick={() => setActiveTab('today')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'today' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Hoje</button>
            <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Histórico Geral</button>
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Usuários</button>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"/>
            {activeTab === 'history' && <button onClick={() => generateAdminHistoryPDF(filteredAttendance)} className="p-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">PDF</button>}
            {activeTab === 'users' && <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Adicionar Funcionário</button>}
          </div>
        </div>
        {renderContent()}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Novo Funcionário</h3>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4">
                <input type="text" placeholder="Nome Completo" required value={newUser.fullName} onChange={(e) => setNewUser({...newUser, fullName: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                <input type="text" placeholder="Número do Crachá" required value={newUser.badgeNumber} onChange={(e) => setNewUser({...newUser, badgeNumber: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                <input type="password" placeholder="Senha Inicial" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
              </div>
              {creationError && <p className="text-red-500 text-sm mt-4">{creationError}</p>}
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" disabled={isCreatingUser} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400">
                  {isCreatingUser ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
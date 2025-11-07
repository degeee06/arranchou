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

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const { data: usersData, error: usersError } = await supabase.from('profiles').select('*').order('full_name');
    if (usersError) console.error("Error fetching users:", usersError);
    else setUsers(usersData || []);

    const { data: attendanceData, error: attendanceError } = await supabase.from('attendance').select('*, profiles(full_name)').order('date', { ascending: false });
    if (attendanceError) console.error("Error fetching attendance:", attendanceError);
    else setAttendance(attendanceData as AdminAttendanceRecord[] || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleStatusChange = async (userId: string, date: string, newStatus: AttendanceStatus) => {
    const existingRecord = attendance.find(a => a.user_id === userId && a.date === date);
    
    let result;
    if (existingRecord) {
        result = await supabase.from('attendance').update({ status: newStatus }).eq('id', existingRecord.id).select('*, profiles(full_name)').single();
    } else {
        result = await supabase.from('attendance').insert({ user_id: userId, date, status: newStatus }).select('*, profiles(full_name)').single();
    }
    
    const { data, error } = result;

    if (error) {
        console.error('Error updating status:', error);
        alert('Falha ao atualizar o status.');
    } else if (data) {
        const newRecord = data as AdminAttendanceRecord;
        setAttendance(prev => {
            const index = prev.findIndex(a => a.id === newRecord.id);
            if (index > -1) {
                const newAttendance = [...prev];
                newAttendance[index] = newRecord;
                return newAttendance;
            } else {
                return [newRecord, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            }
        });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'employee') => {
    if (userId === profile.id && newRole === 'employee') {
      alert("Você não pode remover seu próprio acesso de administrador.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating role:', error);
      alert('Erro ao atualizar o cargo do usuário.');
    } else {
      setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert('Cargo do usuário atualizado com sucesso!');
    }
  };

  const today = getTodayString();
  const todayAttendanceMap = new Map<string, AdminAttendanceRecord>();
  attendance.filter(a => a.date === today).forEach(a => {
      todayAttendanceMap.set(a.user_id, a);
  });

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = attendance.filter(record => 
    record.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const TabButton = ({ tabName, label }: { tabName: string; label: string }) => {
    const isActive = activeTab === tabName;
    return (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`${
                isActive
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
        >
            {label}
        </button>
    )
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-blue-600"></div>
        </div>
      );
    }
    switch (activeTab) {
      case 'today':
        return (
          <div className="overflow-x-auto mt-6">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Funcionário</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status de Hoje</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map(user => {
                  const userAttendance = todayAttendanceMap.get(user.id);
                  const currentStatus = userAttendance?.status || AttendanceStatus.Pendente;
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <select
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(user.id, today, e.target.value as AttendanceStatus)}
                          className="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
                        >
                          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        );
      case 'history':
        const printableHistory = filteredHistory.filter(h => h.profiles) as (Attendance & { profiles: { full_name: string } })[];
        return (
          <div className="mt-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => generateAdminHistoryPDF(printableHistory)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Baixar Relatório PDF
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Funcionário</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredHistory.map(record => (
                     <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{record.profiles?.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{record.status}</td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'users':
        return (
            <div className="overflow-x-auto mt-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Funcionário</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Crachá</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cargo</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredUsers.map(user => (
                          <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.badge_number}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <select
                                      value={user.role}
                                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'employee')}
                                      className="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
                                      disabled={user.id === profile.id}
                                  >
                                      {roleOptions.map(opt => <option key={opt} value={opt}>{opt === 'admin' ? 'Administrador' : 'Funcionário'}</option>)}
                                  </select>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <TabButton tabName='today' label='Presença de Hoje' />
              <TabButton tabName='history' label='Histórico Geral' />
              <TabButton tabName='users' label='Gerenciar Usuários' />
          </nav>
      </div>
      
      <div className="mt-6">
          <input 
              type="text" 
              placeholder="Buscar por nome do funcionário..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:text-white"
          />
      </div>

      {renderContent()}
    </div>
  );
};

export default AdminDashboard;

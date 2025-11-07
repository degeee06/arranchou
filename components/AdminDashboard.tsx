
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, AttendanceRecord, AttendanceStatus, WeekData, UserRole } from '../types';
import { getWeekStartDate, getWeekDates, formatDate, formatDisplayDate, generatePdfReport } from '../utils/helpers';
import { LoadingSpinner, Button, Tabs, Modal, DownloadIcon, ChevronDownIcon, CheckIcon, XIcon, UsersIcon } from './ui';

// --- Current Week Tab ---
const CurrentWeekTab: React.FC<{ users: UserProfile[] }> = ({ users }) => {
    const [weekDates, setWeekDates] = useState<Date[]>([]);
    const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
    const [loading, setLoading] = useState(true);
    const [isSubstituteModalOpen, setSubstituteModalOpen] = useState(false);
    const [substituteInfo, setSubstituteInfo] = useState<{ userId: string; date: string } | null>(null);
    const [selectedSubstitute, setSelectedSubstitute] = useState<string>('');

    const fetchAttendance = useCallback(async () => {
        setLoading(true);
        const today = new Date();
        const startDate = getWeekStartDate(today);
        const dates = getWeekDates(startDate);
        setWeekDates(dates);
        const startDateString = formatDate(startDate);

        const { data, error } = await supabase
            .from('attendance')
            .select('*, profiles(*)')
            .eq('week_start_date', startDateString);

        if (error) {
            console.error(error);
        } else {
            const attendanceMap = new Map<string, AttendanceRecord>();
            data.forEach(record => {
                attendanceMap.set(`${record.user_id}-${record.date}`, record as AttendanceRecord);
            });
            setAttendance(attendanceMap);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAttendance();

        const subscription = supabase
            .channel('public:attendance')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, payload => {
                console.log('Change received!', payload);
                fetchAttendance();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [fetchAttendance]);
    
    const handleStatusChange = async (userId: string, date: Date, status: AttendanceStatus) => {
        const dateString = formatDate(date);
        const { error } = await supabase
            .from('attendance')
            .upsert({
                user_id: userId,
                date: dateString,
                status: status,
                week_start_date: formatDate(getWeekStartDate(date))
            }, { onConflict: 'user_id, date' });

        if (error) console.error(error);
    };

    const openSubstituteModal = (userId: string, date: string) => {
        setSubstituteInfo({ userId, date });
        setSelectedSubstitute('');
        setSubstituteModalOpen(true);
    };

    const handleSubstitute = async () => {
        if (!substituteInfo || !selectedSubstitute) return;

        const { userId, date } = substituteInfo;

        // Using an RPC call to handle the transaction on the backend is safer
        const { error } = await supabase.rpc('perform_substitution', {
            original_user_id: userId,
            substitute_user_id: selectedSubstitute,
            attendance_date: date,
            p_week_start_date: formatDate(getWeekStartDate(new Date(date)))
        });


        if (error) {
            alert('Falha ao realizar substituição.');
            console.error(error);
        }

        setSubstituteModalOpen(false);
        setSubstituteInfo(null);
    };

    if (loading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
    
    return (
        <div className="overflow-x-auto bg-gray-800 p-4 rounded-lg">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Funcionário</th>
                        {weekDates.map(date => (
                            <th key={formatDate(date)} className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                {formatDisplayDate(date)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{user.full_name}</td>
                            {weekDates.map(date => {
                                const dateString = formatDate(date);
                                const record = attendance.get(`${user.id}-${dateString}`);
                                return (
                                    <td key={dateString} className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                        <div className="flex items-center justify-center space-x-1">
                                            <button onClick={() => handleStatusChange(user.id, date, AttendanceStatus.PRESENT)} className={`p-1 rounded-full ${record?.status === AttendanceStatus.PRESENT ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`}><CheckIcon className="h-4 w-4"/></button>
                                            <button onClick={() => handleStatusChange(user.id, date, AttendanceStatus.ABSENT)} className={`p-1 rounded-full ${record?.status === AttendanceStatus.ABSENT ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`}><XIcon className="h-4 w-4"/></button>
                                            <button onClick={() => openSubstituteModal(user.id, dateString)} className={`p-1 rounded-full text-gray-400 hover:bg-gray-600`}><UsersIcon className="h-4 w-4" /></button>
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <Modal isOpen={isSubstituteModalOpen} onClose={() => setSubstituteModalOpen(false)} title="Substituir Funcionário">
                <div className="space-y-4">
                    <p>Selecione um funcionário para substituir {users.find(u => u.id === substituteInfo?.userId)?.full_name} em {substituteInfo?.date}.</p>
                    <select
                        value={selectedSubstitute}
                        onChange={(e) => setSelectedSubstitute(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Selecione...</option>
                        {users.filter(u => u.id !== substituteInfo?.userId).map(user => (
                            <option key={user.id} value={user.id}>{user.full_name}</option>
                        ))}
                    </select>
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setSubstituteModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubstitute} disabled={!selectedSubstitute}>Confirmar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};


// --- History Tab ---
const HistoryTab: React.FC<{ users: UserProfile[] }> = ({ users }) => {
    const [history, setHistory] = useState<WeekData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('attendance')
                .select('*, profiles(*)')
                .order('week_start_date', { ascending: false });

            if (error) {
                console.error(error);
            } else {
                const groupedByWeek: { [key: string]: AttendanceRecord[] } = {};
                (data as AttendanceRecord[]).forEach(record => {
                    if (!groupedByWeek[record.week_start_date]) {
                        groupedByWeek[record.week_start_date] = [];
                    }
                    groupedByWeek[record.week_start_date].push(record);
                });

                const weekData: WeekData[] = Object.keys(groupedByWeek).map(weekStartDate => ({
                    week_start_date: weekStartDate,
                    records: groupedByWeek[weekStartDate],
                })).sort((a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime());
                setHistory(weekData);
            }
            setLoading(false);
        };
        fetchHistory();
    }, []);
    
    if (loading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;

    return (
        <div className="space-y-4">
            {history.map(week => {
                 const weekStartDate = new Date(week.week_start_date);
                 const weekDates = getWeekDates(weekStartDate);
                 const isExpanded = expandedWeek === week.week_start_date;
                return (
                    <div key={week.week_start_date} className="bg-gray-800 rounded-lg">
                        <button 
                            onClick={() => setExpandedWeek(isExpanded ? null : week.week_start_date)}
                            className="w-full flex justify-between items-center p-4 text-left"
                        >
                            <span className="font-semibold">Semana de {weekStartDate.toLocaleDateString('pt-BR')}</span>
                             <div className="flex items-center gap-4">
                                <Button
                                    variant="secondary"
                                    onClick={(e) => { e.stopPropagation(); generatePdfReport(week, users); }}
                                    className="flex items-center gap-2"
                                >
                                    <DownloadIcon /> PDF
                                </Button>
                                <ChevronDownIcon className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                             </div>
                        </button>
                        {isExpanded && (
                             <div className="p-4 border-t border-gray-700 overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-700">
                                     <thead className="bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Funcionário</th>
                                            {weekDates.map(d => <th key={formatDate(d)} className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">{formatDisplayDate(d)}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{user.full_name}</td>
                                            {weekDates.map(date => {
                                                const record = week.records.find(r => r.user_id === user.id && r.date === formatDate(date));
                                                let statusChar = <span className="text-gray-500">-</span>;
                                                if (record?.status === AttendanceStatus.PRESENT) statusChar = <CheckIcon className="h-5 w-5 text-green-400 mx-auto"/>;
                                                if (record?.status === AttendanceStatus.ABSENT) statusChar = <XIcon className="h-5 w-5 text-red-400 mx-auto"/>;
                                                return <td key={formatDate(date)} className="px-4 py-3 text-center">{statusChar}</td>
                                            })}
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// --- Manage Users Tab ---
const ManageUsersTab: React.FC<{ users: UserProfile[], fetchUsers: () => void }> = ({ users, fetchUsers }) => {
    const [loading, setLoading] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

    const handleRoleChange = async (user: UserProfile) => {
        setLoading(true);
        const newRole = user.role === UserRole.ADMIN ? UserRole.EMPLOYEE : UserRole.ADMIN;
        
        // This should be an Edge Function for security
        const { error } = await supabase.functions.invoke('set-user-role', {
            body: { user_id: user.id, role: newRole }
        });
        
        if (error) {
            alert('Erro ao alterar permissão: ' + error.message);
        } else {
            fetchUsers();
        }
        setLoading(false);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setLoading(true);

        // This should be an Edge Function for security
        const { error } = await supabase.functions.invoke('delete-user', {
            body: { user_id: userToDelete.id }
        });

        if (error) {
            alert('Erro ao remover usuário: ' + error.message);
        } else {
            fetchUsers();
            setUserToDelete(null);
        }
        setLoading(false);
    };
    
    return (
        <div className="bg-gray-800 rounded-lg shadow p-4">
            <ul className="divide-y divide-gray-700">
                {users.map(user => (
                    <li key={user.id} className="py-3 flex items-center justify-between">
                        <div>
                            <p className="font-medium text-white">{user.full_name}</p>
                            <p className="text-sm text-gray-400">{user.badge_number} - {user.role}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                             <Button variant="secondary" onClick={() => handleRoleChange(user)} disabled={loading}>
                                {user.role === UserRole.ADMIN ? 'Rebaixar' : 'Promover'}
                             </Button>
                             <Button variant="danger" onClick={() => setUserToDelete(user)} disabled={loading}>Remover</Button>
                        </div>
                    </li>
                ))}
            </ul>

            <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Confirmar Remoção">
                <p>Tem certeza que deseja remover permanentemente o usuário <strong>{userToDelete?.full_name}</strong>? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end space-x-2 mt-4">
                    <Button variant="secondary" onClick={() => setUserToDelete(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={handleDeleteUser} disabled={loading}>
                        {loading ? 'Removendo...' : 'Remover'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

// --- Admin Dashboard ---
const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Semana Atual');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name');
        
        if (data) setUsers(data as UserProfile[]);
        setLoadingUsers(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const TABS = ['Semana Atual', 'Histórico', 'Gerenciar Usuários'];

  return (
    <div className="space-y-6">
      <Tabs tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
      <div>
        {loadingUsers ? <div className="flex justify-center p-8"><LoadingSpinner /></div> : (
             <>
                {activeTab === 'Semana Atual' && <CurrentWeekTab users={users} />}
                {activeTab === 'Histórico' && <HistoryTab users={users} />}
                {activeTab === 'Gerenciar Usuários' && <ManageUsersTab users={users} fetchUsers={fetchUsers} />}
             </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

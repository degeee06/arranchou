
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile, Attendance, AttendanceStatus } from '../types';
import { generateHistoryPDF } from '../utils/pdfGenerator';

interface EmployeeDashboardProps {
  profile: Profile;
}

const statusConfig = {
    [AttendanceStatus.Pendente]: { text: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    [AttendanceStatus.Confirmado]: { text: 'Confirmado', color: 'bg-green-100 text-green-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    [AttendanceStatus.Falta]: { text: 'Falta', color: 'bg-red-100 text-red-800', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
    [AttendanceStatus.Ausente]: { text: 'Ausente', color: 'bg-gray-100 text-gray-800', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
};

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ profile }) => {
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  
  const getTodayString = () => new Date().toISOString().split('T')[0];

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    const today = getTodayString();
    
    // Fetch today's attendance
    const { data: todayData, error: todayError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle();

    if (todayError) console.error("Error fetching today's attendance:", todayError.message);
    else if (!todayData) {
      // If no record for today, create one
      const { data: newData } = await supabase.from('attendance').insert({ user_id: profile.id, date: today, status: AttendanceStatus.Pendente }).select().single();
      setTodayAttendance(newData);
    } else {
      setTodayAttendance(todayData);
    }
    
    // Fetch history
    const { data: historyData, error: historyError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile.id)
      .order('date', { ascending: false });
      
    if (historyError) console.error("Error fetching history:", historyError.message);
    else setHistory(historyData || []);

    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const updateStatus = async (status: AttendanceStatus) => {
    if (!todayAttendance) return;
    const { data, error } = await supabase
      .from('attendance')
      .update({ status })
      .eq('id', todayAttendance.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating status:', error);
    } else {
      setTodayAttendance(data);
      // Also update history view
      setHistory(prev => prev.map(h => h.id === data.id ? data : h));
    }
  };
  
  const currentStatus = todayAttendance?.status || AttendanceStatus.Pendente;
  const config = statusConfig[currentStatus];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Seu status para o almoço de hoje:</h2>
        {loading ? (
            <div className="h-10 bg-gray-200 rounded animate-pulse w-1/2"></div>
        ) : (
        <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${config.color}`}>
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={config.icon}></path></svg>
          {config.text}
        </div>
        )}
        <div className="mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <button onClick={() => updateStatus(AttendanceStatus.Confirmado)} className="flex-1 justify-center inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400" disabled={currentStatus === AttendanceStatus.Confirmado}>Confirmar Presença</button>
          <button onClick={() => updateStatus(AttendanceStatus.Ausente)} className="flex-1 justify-center inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Informar Ausência</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Seu Histórico</h2>
          <button 
            onClick={() => generateHistoryPDF(history, profile.full_name)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Baixar PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {history.map(record => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusConfig[record.status].color}`}>
                      {statusConfig[record.status].text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;


import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { getWeekStartDate, getWeekDates, formatDate, formatDisplayDate } from '../utils/helpers';
import { LoadingSpinner, CheckIcon } from './ui';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date();
    const startDate = getWeekStartDate(today);
    const dates = getWeekDates(startDate);
    setWeekDates(dates);
    
    const startDateString = formatDate(startDate);
    const endDateString = formatDate(dates[6]);

    const { data, error } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('user_id', user.id)
      .gte('date', startDateString)
      .lte('date', endDateString);

    if (error) {
      setError('Erro ao carregar dados de presença.');
      console.error(error);
    } else {
      const attendanceMap = new Map<string, AttendanceStatus>();
      data.forEach(record => {
        attendanceMap.set(record.date, record.status as AttendanceStatus);
      });
      setAttendance(attendanceMap);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleToggleAttendance = async (date: Date) => {
    if (!user) return;

    const dateString = formatDate(date);
    const currentStatus = attendance.get(dateString);
    const newStatus = currentStatus === AttendanceStatus.PRESENT ? AttendanceStatus.UNMARKED : AttendanceStatus.PRESENT;

    const { error } = await supabase
      .from('attendance')
      .upsert({
        user_id: user.id,
        date: dateString,
        status: newStatus,
        week_start_date: formatDate(getWeekStartDate(date))
      }, { onConflict: 'user_id, date' });

    if (error) {
      alert('Não foi possível atualizar a presença.');
    } else {
      const newAttendance = new Map(attendance);
      newAttendance.set(dateString, newStatus);
      setAttendance(newAttendance);
    }
  };
  
  const todayString = formatDate(new Date());

  if (loading) {
    return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
  }
  
  if (error) {
    return <div className="text-center text-red-400 p-8">{error}</div>
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-white">Minha Semana</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
        {weekDates.map(date => {
          const dateString = formatDate(date);
          const isPast = dateString < todayString;
          const status = attendance.get(dateString);
          const isPresent = status === AttendanceStatus.PRESENT;

          return (
            <button
              key={dateString}
              disabled={isPast}
              onClick={() => handleToggleAttendance(date)}
              className={`p-4 rounded-lg text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                ${isPast ? 'bg-gray-700' : 'bg-gray-700 hover:bg-gray-600'}
                ${isPresent ? 'ring-2 ring-green-500' : ''}`}
            >
              <p className="font-bold text-lg">{formatDisplayDate(date)}</p>
              <div className="mt-2 h-8 flex items-center justify-center">
                 {isPresent && <CheckIcon className="h-8 w-8 text-green-400" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeDashboard;

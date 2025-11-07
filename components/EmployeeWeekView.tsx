import React from 'react';
import { supabase } from '../supabase';
import { Profile, DayKey, Attendance, AttendanceRecord } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { CheckIcon, XIcon } from './icons';
import { getDatesForWeekId } from '../utils';

interface EmployeeWeekViewProps {
  profile: Profile;
  attendance: Attendance;
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentWeekId: string;
}

const EmployeeWeekView: React.FC<EmployeeWeekViewProps> = ({ profile, attendance, attendanceRecords, setAttendanceRecords, currentWeekId }) => {
    const jsTodayIndex = new Date().getDay();
    const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1;
    const weekDates = getDatesForWeekId(currentWeekId);

    const handleToggleAttendance = async (day: DayKey) => {
        const dayIndex = DAYS_OF_WEEK.indexOf(day);
        if (dayIndex < todayIndex) {
            alert("Não é possível alterar o status de dias que já passaram.");
            return;
        }

        const dateForDay = weekDates[dayIndex].toISOString().split('T')[0];
        const currentStatus = attendance[profile.id]?.[dateForDay];
        const originalRecords = attendanceRecords;

        // New Cycle for employees: (undefined | 'Ausente' | 'Pendente') -> 'Presente' -> delete
        if (currentStatus === 'Presente') {
            // Optimistic update: From present to not marked (delete)
            setAttendanceRecords(prev => prev.filter(r => !(r.user_id === profile.id && r.date === dateForDay)));
            
            // DB operation
            const { error } = await supabase.from('attendance').delete().match({ user_id: profile.id, date: dateForDay });
            if (error) {
                alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
                console.error("Falha ao deletar:", error);
                setAttendanceRecords(originalRecords); // Rollback
            }
        } else {
            // Optimistic update: From not marked/absent to present (upsert)
            setAttendanceRecords(prev => [...prev.filter(r => !(r.user_id === profile.id && r.date === dateForDay)), { user_id: profile.id, date: dateForDay, status: 'Presente' }]);
            
            // DB operation
            const { error } = await supabase.from('attendance').upsert(
                { user_id: profile.id, date: dateForDay, status: 'Presente' },
                { onConflict: 'user_id,date' }
            ).select();

            if (error) {
                alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
                console.error("Falha no upsert (presente):", error);
                setAttendanceRecords(originalRecords); // Rollback
            }
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-1 text-white">Minha Presença na Semana</h2>
            <p className="text-gray-400 mb-6">Marque os dias que você irá comparecer. Você só pode alterar dias futuros.</p>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <tbody className="divide-y divide-gray-700">
                        {DAYS_OF_WEEK.map((day, dayIndex) => {
                            const isPast = dayIndex < todayIndex;
                            const dateForDay = weekDates[dayIndex].toISOString().split('T')[0];
                            const status = attendance[profile.id]?.[dateForDay];

                            return (
                                <tr key={day} className={`hover:bg-gray-700/50 ${isPast ? 'opacity-60' : ''}`}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{day}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <button
                                            onClick={() => handleToggleAttendance(day)}
                                            disabled={isPast}
                                            className={`p-2 rounded-full transition-all duration-200 transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                                                status === 'Presente'
                                                ? 'bg-green-900 text-green-300 hover:bg-green-800'
                                                : status === 'Ausente'
                                                ? 'bg-red-900 text-red-300 hover:bg-red-800'
                                                : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                                            }`}
                                            aria-label={`Marcar presença para ${day}`}
                                        >
                                            {status === 'Presente' ? <CheckIcon /> : status === 'Ausente' ? <XIcon /> : <span className="h-5 w-5 flex items-center justify-center font-bold">-</span>}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
             <p className="text-xs text-gray-500 mt-4 flex items-center gap-4 flex-wrap">
                <span>Legenda:</span>
                <span className="inline-flex items-center gap-1"><span className="text-green-400"><CheckIcon /></span> Presente</span>
                <span className="inline-flex items-center gap-1"><span className="text-red-400"><XIcon /></span> Ausente</span>
                <span className="inline-flex items-center gap-1"><span className="text-gray-500 font-bold">-</span> Não marcado</span>
            </p>
        </div>
    );
};
export default EmployeeWeekView;

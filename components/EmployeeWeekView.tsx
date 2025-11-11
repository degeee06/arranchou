import React from 'react';
import { supabase } from '../supabase';
import { Profile, DayKey, Attendance, AttendanceRecord } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { CheckIcon, XIcon } from './icons';

interface EmployeeWeekViewProps {
  profile: Profile;
  attendance: Attendance;
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentWeekId: string;
}

const EmployeeWeekView: React.FC<EmployeeWeekViewProps> = ({ profile, attendance, attendanceRecords, setAttendanceRecords, currentWeekId }) => {

    const handleToggleAttendance = async (day: DayKey) => {
        const originalRecords = attendanceRecords;
        const currentStatus = attendance[profile.id]?.[day];

        // New Cycle for employees: (undefined | false) -> true -> undefined
        if (currentStatus === true) {
            // Optimistic update: From present to not marked (delete)
            setAttendanceRecords(prev => prev.filter(r => !(r.user_id === profile.id && r.week_id === currentWeekId && r.day === day)));
            
            // DB operation
            const { error } = await supabase.from('attendances').delete().match({ user_id: profile.id, week_id: currentWeekId, day });
            if (error) {
                alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
                console.error("Falha ao deletar:", error);
                setAttendanceRecords(originalRecords); // Rollback
            }
        } else {
            // Optimistic update: From not marked/absent to present (upsert)
            setAttendanceRecords(prev => [...prev.filter(r => !(r.user_id === profile.id && r.week_id === currentWeekId && r.day === day)), { user_id: profile.id, week_id: currentWeekId, day, is_present: true }]);
            
            // DB operation
            const { data, error } = await supabase.from('attendances').upsert(
                { user_id: profile.id, week_id: currentWeekId, day, is_present: true },
                { onConflict: 'user_id,week_id,day' }
            ).select();

            if (error || !data || data.length === 0) {
                alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
                console.error("Falha no upsert (presente):", error, data);
                setAttendanceRecords(originalRecords); // Rollback
            }
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-1 text-white">Minha Presença na Semana</h2>
            <p className="text-gray-400 mb-6">Marque os dias que você irá comparecer. As alterações são salvas automaticamente.</p>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <tbody className="divide-y divide-gray-700">
                        {DAYS_OF_WEEK.map((day) => {
                            const status = attendance[profile.id]?.[day];

                            return (
                                <tr key={day} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{day}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <button
                                            onClick={() => handleToggleAttendance(day)}
                                            className={`p-2 rounded-full transition-all duration-200 transform active:scale-95 ${
                                                status === true
                                                ? 'bg-green-900 text-green-300 hover:bg-green-800'
                                                : status === false
                                                ? 'bg-red-900 text-red-300 hover:bg-red-800'
                                                : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                                            }`}
                                            aria-label={`Marcar presença para ${day}`}
                                        >
                                            {status === true ? <CheckIcon /> : status === false ? <XIcon /> : <span className="h-5 w-5 flex items-center justify-center font-bold">-</span>}
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
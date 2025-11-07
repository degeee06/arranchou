import React, { useState } from 'react';
import { DayKey, Profile, Attendance, AttendanceRecord } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import DaySelector from './DaySelector';
import AttendanceTable from './AttendanceTable';
import Summary from './Summary';
import { SearchIcon, CheckIcon, XIcon } from './icons';
import Modal from './Modal';
import { supabase } from '../supabase';
import { getDatesForWeekId } from '../utils';

interface CurrentWeekViewProps {
  profiles: Profile[];
  attendance: Attendance;
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentWeekId: string;
  isAdmin: boolean;
  adminProfile: Profile; // The profile of the logged-in admin
}

const AdminPersonalAttendance: React.FC<{
  profile: Profile;
  attendance: Attendance;
  currentWeekId: string;
  onToggle: (day: DayKey) => void;
}> = ({ profile, attendance, currentWeekId, onToggle }) => {
    const jsTodayIndex = new Date().getDay();
    const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1;
    const weekDates = getDatesForWeekId(currentWeekId);

    return (
        <section className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-200">Minha Presença</h2>
            <div className="flex flex-wrap justify-center gap-3">
                {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const isPast = dayIndex < todayIndex;
                    const dateForDay = weekDates[dayIndex].toISOString().split('T')[0];
                    const status = attendance[profile.id]?.[dateForDay];
                    return (
                        <div key={day} className={`text-center p-3 rounded-md w-24 ${isPast ? 'bg-gray-700/50 opacity-60' : 'bg-gray-700'}`}>
                            <p className="font-semibold text-sm text-white">{day}</p>
                             <button
                                onClick={() => onToggle(day)}
                                disabled={isPast}
                                className={`mt-3 p-2 w-full flex justify-center rounded-full transition-all duration-200 transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
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
                        </div>
                    );
                })}
            </div>
        </section>
    );
};


const CurrentWeekView: React.FC<CurrentWeekViewProps> = ({ profiles, attendance, attendanceRecords, setAttendanceRecords, currentWeekId, isAdmin, adminProfile }) => {
  const jsTodayIndex = new Date().getDay(); // 0 for Sunday, 1 for Monday...
  const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1; 
  
  const [currentDay, setCurrentDay] = useState<DayKey>(DAYS_OF_WEEK[todayIndex]);
  const [substituteModal, setSubstituteModal] = useState<{isOpen: boolean, person: Profile | null}>({isOpen: false, person: null});
  const [substituteId, setSubstituteId] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const handleToggleAttendance = async (personId: string, day: DayKey) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    if (dayIndex < todayIndex && personId !== adminProfile.id) { // Admin can change their own past days if needed, but not others
        alert("Não é possível alterar o status de dias que já passaram para outros usuários.");
        return;
    }
    
    const dateForDay = getDatesForWeekId(currentWeekId)[dayIndex].toISOString().split('T')[0];
    const currentStatus = attendance[personId]?.[dateForDay];
    const originalRecords = attendanceRecords; // Save for rollback

    // Cycle: undefined -> 'Presente' -> 'Ausente' -> (delete)
    if (currentStatus === undefined) {
        // Optimistic update
        setAttendanceRecords(prev => [...prev.filter(r => !(r.user_id === personId && r.date === dateForDay)), { user_id: personId, date: dateForDay, status: 'Presente' }]);
        
        // DB operation
        const { error } = await supabase.from('attendance').upsert(
            { user_id: personId, date: dateForDay, status: 'Presente' },
            { onConflict: 'user_id,date' }
        ).select();

        if (error) {
            alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
            console.error("Falha no upsert (presente):", error);
            setAttendanceRecords(originalRecords); // Rollback
        }
    } else if (currentStatus === 'Presente') {
        // Optimistic update
        setAttendanceRecords(prev => prev.map(r => (r.user_id === personId && r.date === dateForDay) ? { ...r, status: 'Ausente' } : r));

        // DB operation
        const { error } = await supabase.from('attendance').upsert(
            { user_id: personId, date: dateForDay, status: 'Ausente' },
            { onConflict: 'user_id,date' }
        ).select();
        
        if (error) {
            alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
            console.error("Falha no upsert (ausente):", error);
            setAttendanceRecords(originalRecords); // Rollback
        }
    } else { // status is 'Ausente' or 'Pendente'
        // Optimistic update
        setAttendanceRecords(prev => prev.filter(r => !(r.user_id === personId && r.date === dateForDay)));

        // DB operation
        const { error } = await supabase.from('attendance').delete().match({ user_id: personId, date: dateForDay });
        
        if (error) {
            alert("Falha ao salvar. A alteração foi desfeita. Verifique sua conexão com a internet. Se o problema persistir, pode ser uma questão de permissão no banco de dados (RLS).");
            console.error("Falha ao deletar:", error);
            setAttendanceRecords(originalRecords); // Rollback
        }
    }
  };

  const handleOpenSubstituteModal = (person: Profile) => {
    setSubstituteModal({ isOpen: true, person });
  };

  const handleCloseSubstituteModal = () => {
    setSubstituteModal({ isOpen: false, person: null });
    setSubstituteId('');
  };

  const handleSubstitutePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!substituteModal.person || !substituteId) return;

    const originalPerson = substituteModal.person;
    const dateForDay = getDatesForWeekId(currentWeekId)[DAYS_OF_WEEK.indexOf(currentDay)].toISOString().split('T')[0];

    if (originalPerson.id === substituteId) {
        alert("O substituto não pode ser a mesma pessoa.");
        return;
    }

    const originalRecords = attendanceRecords;
    // Optimistic Update
    setAttendanceRecords(prev => {
        const withoutOriginal = prev.filter(r => !(r.user_id === originalPerson.id && r.date === dateForDay));
        const withoutSub = withoutOriginal.filter(r => !(r.user_id === substituteId && r.date === dateForDay));
        return [
            ...withoutSub,
            { user_id: originalPerson.id, date: dateForDay, status: 'Ausente' },
            { user_id: substituteId, date: dateForDay, status: 'Presente' }
        ];
    });

    // DB Operations in parallel
    const [originalResult, substituteResult] = await Promise.all([
        supabase.from('attendance').upsert({ user_id: originalPerson.id, date: dateForDay, status: 'Ausente' }, { onConflict: 'user_id,date' }).select(),
        supabase.from('attendance').upsert({ user_id: substituteId, date: dateForDay, status: 'Presente' }, { onConflict: 'user_id,date' }).select()
    ]);

    // Check for errors
    if (originalResult.error || substituteResult.error) {
        alert("Falha ao salvar a substituição. A alteração foi desfeita. Verifique sua conexão e as permissões do banco de dados (RLS).");
        console.error("Erro na substituição:", { original: originalResult, substitute: substituteResult });
        setAttendanceRecords(originalRecords); // Rollback
    } else {
        handleCloseSubstituteModal();
    }
  };
  
  const filteredPeople = profiles.filter(person => {
    const query = searchQuery.toLowerCase();
    return person.full_name.toLowerCase().includes(query) || (person.badge_number && person.badge_number.toLowerCase().includes(query));
  });

  return (
    <div className="flex flex-col gap-6">
       {isAdmin && (
         <AdminPersonalAttendance 
            profile={adminProfile}
            attendance={attendance}
            currentWeekId={currentWeekId}
            onToggle={(day) => handleToggleAttendance(adminProfile.id, day)}
         />
       )}
      
      <section className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Visão Geral do Dia</h2>
        <DaySelector currentDay={currentDay} onSelectDay={setCurrentDay} daysToDisplay={DAYS_OF_WEEK} />
      </section>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          <section className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-200">Participantes do Dia</h2>
              <div className="flex items-center gap-2">
                {isSearchVisible && (
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-40 sm:w-48 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm transition-all duration-300"
                        autoFocus
                        onBlur={() => { if(!searchQuery) setIsSearchVisible(false); }}
                    />
                )}
                <button
                    onClick={() => setIsSearchVisible(prev => !prev)}
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-primary"
                    aria-label="Pesquisar pessoa"
                >
                    <SearchIcon />
                </button>
              </div>
            </div>
            <AttendanceTable
              people={filteredPeople}
              attendance={attendance}
              currentDay={currentDay}
              currentWeekId={currentWeekId}
              isAdmin={isAdmin}
              onToggleAttendance={handleToggleAttendance}
              onSubstitute={handleOpenSubstituteModal}
            />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <Summary people={profiles} attendance={attendance} currentDay={currentDay} currentWeekId={currentWeekId} />
        </aside>
      </div>

      <Modal isOpen={substituteModal.isOpen} onClose={handleCloseSubstituteModal} title={`Substituir ${substituteModal.person?.full_name}`}>
        <form onSubmit={handleSubstitutePerson} className="flex flex-col gap-4 mt-4">
            <p className="text-sm text-gray-400">
                Selecione um substituto da lista. A pessoa original será marcada com falta e o substituto com presença.
            </p>
            <select
                value={substituteId}
                onChange={e => setSubstituteId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
            >
                <option value="" disabled>Selecione uma pessoa</option>
                {profiles.filter(p => p.id !== substituteModal.person?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
            </select>
            <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300">
                Confirmar Substituição
            </button>
        </form>
      </Modal>
    </div>
  );
};

export default CurrentWeekView;

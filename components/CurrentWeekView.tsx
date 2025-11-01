import React, { useState } from 'react';
import { DayKey, Profile, Attendance, AttendanceRecord } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import DaySelector from './DaySelector';
import AttendanceTable from './AttendanceTable';
import Summary from './Summary';
import { SearchIcon, CheckIcon, XIcon } from './icons';
import Modal from './Modal';
import { supabase } from '../supabase';

interface CurrentWeekViewProps {
  profiles: Profile[];
  attendance: Attendance;
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentWeekId: string;
  isAdmin: boolean;
  adminProfile: Profile; // The profile of the logged-in admin
}

const AdminPersonalAttendance: React.FC<{
  profile: Profile;
  attendance: Attendance;
  onToggle: (day: DayKey) => void;
}> = ({ profile, attendance, onToggle }) => {
    const jsTodayIndex = new Date().getDay();
    const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1;

    return (
        <section className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-200">Minha Presença</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {DAYS_OF_WEEK.map((day) => {
                    const dayIndex = DAYS_OF_WEEK.indexOf(day);
                    const isPast = dayIndex < todayIndex;
                    const status = attendance[profile.id]?.[day];
                    return (
                        <div key={day} className={`text-center p-3 rounded-md ${isPast ? 'bg-gray-700/50 opacity-60' : 'bg-gray-700'}`}>
                            <p className="font-semibold text-sm text-white">{day}</p>
                             <button
                                onClick={() => onToggle(day)}
                                disabled={isPast}
                                className={`mt-3 p-2 w-full flex justify-center rounded-full transition-colors duration-200 ${
                                    status === true
                                    ? 'bg-green-900 text-green-300'
                                    : status === false
                                    ? 'bg-red-900 text-red-300'
                                    : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                                } ${isPast ? 'cursor-not-allowed' : ''}`}
                                aria-label={`Marcar presença para ${day}`}
                            >
                                {status === true ? <CheckIcon /> : status === false ? <XIcon /> : <span className="h-5 w-5 flex items-center justify-center font-bold">-</span>}
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};


const CurrentWeekView: React.FC<CurrentWeekViewProps> = ({ profiles, attendance, setAttendanceRecords, currentWeekId, isAdmin, adminProfile }) => {
  const jsTodayIndex = new Date().getDay(); // 0 for Sunday, 1 for Monday...
  const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1; 
  
  const [currentDay, setCurrentDay] = useState<DayKey>(DAYS_OF_WEEK[todayIndex]);
  const [substituteModal, setSubstituteModal] = useState<{isOpen: boolean, person: Profile | null}>({isOpen: false, person: null});
  const [substituteId, setSubstituteId] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const handleToggleAttendance = async (personId: string, day: DayKey) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    if (dayIndex < todayIndex) {
        alert("Não é possível alterar o status de dias que já passaram.");
        return;
    }
    
    const currentStatus = attendance[personId]?.[day];
    
    // Cycle: undefined -> true -> false -> undefined (by deleting)
    if (currentStatus === undefined) {
      // Set to present
      const { error } = await supabase.from('attendances').upsert(
        { user_id: personId, week_id: currentWeekId, day, is_present: true },
        { onConflict: 'user_id,week_id,day' }
      );
      if (error) {
        alert("Erro ao atualizar presença.");
        return;
      }
      setAttendanceRecords(prev => [...prev.filter(r => !(r.user_id === personId && r.week_id === currentWeekId && r.day === day)), { user_id: personId, week_id: currentWeekId, day, is_present: true }]);
    } else if (currentStatus === true) {
      // Set to absent
      const { error } = await supabase.from('attendances').upsert(
        { user_id: personId, week_id: currentWeekId, day, is_present: false },
        { onConflict: 'user_id,week_id,day' }
      );
      if (error) {
        alert("Erro ao atualizar presença.");
        return;
      }
      setAttendanceRecords(prev => prev.map(r => (r.user_id === personId && r.week_id === currentWeekId && r.day === day) ? { ...r, is_present: false } : r));
    } else {
      // Set to not marked by deleting the record
      const { error } = await supabase.from('attendances').delete().match({ user_id: personId, week_id: currentWeekId, day });
      if (error) {
        alert("Erro ao atualizar presença.");
        return;
      }
      setAttendanceRecords(prev => prev.filter(r => !(r.user_id === personId && r.week_id === currentWeekId && r.day === day)));
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

    if (originalPerson.id === substituteId) {
        alert("O substituto não pode ser a mesma pessoa.");
        return;
    }

    // Set original person to absent
    await supabase.from('attendances').upsert({ user_id: originalPerson.id, week_id: currentWeekId, day: currentDay, is_present: false }, { onConflict: 'user_id,week_id,day' });
    
    // Set substitute to present
    await supabase.from('attendances').upsert({ user_id: substituteId, week_id: currentWeekId, day: currentDay, is_present: true }, { onConflict: 'user_id,week_id,day' });
    
    // Optimistically update local state
    setAttendanceRecords(prev => {
        const withoutOriginal = prev.filter(r => !(r.user_id === originalPerson.id && r.week_id === currentWeekId && r.day === currentDay));
        const withoutSub = withoutOriginal.filter(r => !(r.user_id === substituteId && r.week_id === currentWeekId && r.day === currentDay));
        return [
            ...withoutSub,
            { user_id: originalPerson.id, week_id: currentWeekId, day: currentDay, is_present: false },
            { user_id: substituteId, week_id: currentWeekId, day: currentDay, is_present: true }
        ];
    });

    handleCloseSubstituteModal();
  };
  
  const filteredPeople = profiles.filter(person =>
    person.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
       {isAdmin && (
         <AdminPersonalAttendance 
            profile={adminProfile}
            attendance={attendance}
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
            <div className="flex justify-between items-center mb-4">
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
              isAdmin={isAdmin}
              onToggleAttendance={handleToggleAttendance}
              onSubstitute={handleOpenSubstituteModal}
            />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <Summary people={profiles} attendance={attendance} currentDay={currentDay} />
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
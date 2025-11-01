import React, { useState } from 'react';
import { DayKey, Profile, Attendance, AttendanceRecord } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import DaySelector from './DaySelector';
import AttendanceTable from './AttendanceTable';
import Summary from './Summary';
import { SearchIcon } from './icons';
import Modal from './Modal';
import { supabase } from '../supabase';
import AddPersonForm from './AddPersonForm';

interface CurrentWeekViewProps {
  profiles: Profile[];
  attendance: Attendance;
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentWeekId: string;
  isAdmin: boolean;
  onAddPerson: (name: string, email: string, password: string, selectedDays: DayKey[]) => Promise<void>;
}

const CurrentWeekView: React.FC<CurrentWeekViewProps> = ({ profiles, attendance, setAttendanceRecords, currentWeekId, isAdmin, onAddPerson }) => {
  const jsTodayIndex = new Date().getDay(); // 0 for Sunday, 1 for Monday...
  const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1; // Monday is 0, Sunday is 6
  
  const remainingDays = DAYS_OF_WEEK.slice(todayIndex);
  
  const [currentDay, setCurrentDay] = useState<DayKey>(remainingDays[0] || DAYS_OF_WEEK[todayIndex]);
  const [substituteModal, setSubstituteModal] = useState<{isOpen: boolean, person: Profile | null}>({isOpen: false, person: null});
  const [substituteId, setSubstituteId] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  const [removePersonConfirm, setRemovePersonConfirm] = useState<{
    isOpen: boolean;
    person: Profile | null;
  }>({ isOpen: false, person: null });


  const handleToggleAttendance = async (personId: string, day: DayKey) => {
    const isPresent = !!attendance[personId]?.[day];
    const newStatus = !isPresent;

    const { error } = await supabase
      .from('attendances')
      .upsert(
        { user_id: personId, week_id: currentWeekId, day: day, is_present: newStatus },
        { onConflict: 'user_id,week_id,day' }
      );
    
    if (error) {
        console.error("Error toggling attendance", error);
        alert("Erro ao atualizar presença.");
        return;
    }

    setAttendanceRecords(prev => {
        const existingRecord = prev.find(r => r.user_id === personId && r.week_id === currentWeekId && r.day === day);
        if (existingRecord) {
            return prev.map(r => r.id === existingRecord.id ? { ...r, is_present: newStatus } : r);
        } else {
            return [...prev, { user_id: personId, week_id: currentWeekId, day: day, is_present: newStatus }];
        }
    });
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

    // Mark original person as absent
    await handleToggleAttendance(originalPerson.id, currentDay);
    // Mark substitute as present
    await handleToggleAttendance(substituteId, currentDay);

    handleCloseSubstituteModal();
  };

  const handleOpenRemoveModal = (person: Profile) => {
    setRemovePersonConfirm({ isOpen: true, person });
  };

  const proceedWithRemovePerson = async () => {
    if (!removePersonConfirm.person) return;

    // This is a sensitive operation, ideally done via an admin interface
    // For now, we delete from profiles table, Supabase cascade will handle the rest
    const { error } = await supabase
      .from('profiles')
      .delete()
      .match({ id: removePersonConfirm.person!.id });

    if (error) {
        alert("Erro ao remover pessoa. Verifique o console para detalhes.");
        console.error("Remove person error:", error);
    } else {
        alert("Pessoa removida. A remoção da conta de autenticação deve ser feita no painel do Supabase.");
        // Refetch data from parent is needed here, or manually update state
    }
    
    setRemovePersonConfirm({ isOpen: false, person: null });
  };

  const filteredPeople = profiles.filter(person =>
    person.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Selecione o Dia</h2>
        <DaySelector currentDay={currentDay} onSelectDay={setCurrentDay} daysToDisplay={remainingDays} />
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
              onRemovePerson={handleOpenRemoveModal}
            />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          {isAdmin && <AddPersonForm onAddPerson={onAddPerson} />}
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

      <Modal 
        isOpen={removePersonConfirm.isOpen} 
        onClose={() => setRemovePersonConfirm({ isOpen: false, person: null })}
        title="Confirmar Remoção"
      >
        <div className="mt-4">
            <p className="text-sm text-gray-400">
                Tem certeza que deseja remover <strong>{removePersonConfirm.person?.full_name}</strong>?
            </p>
            <p className="text-sm text-gray-400 mt-2">
                Esta ação removerá o perfil da pessoa. A conta de usuário associada deverá ser removida manualmente no painel do Supabase.
            </p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemovePersonConfirm({ isOpen: false, person: null })} type="button" className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 border border-gray-500 rounded-md shadow-sm hover:bg-gray-700">
                    Cancelar
                </button>
                <button onClick={proceedWithRemovePerson} type="button" className="px-4 py-2 text-sm font-medium text-white bg-status-absent border border-transparent rounded-md shadow-sm hover:bg-red-700">
                    Remover
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default CurrentWeekView;
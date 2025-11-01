import React, { useState, useCallback } from 'react';
import { Profile, Attendance, DayKey, AttendanceRecord } from '../types';
import { supabase } from '../supabase';
import { DAYS_OF_WEEK } from '../constants';
import DaySelector from './DaySelector';
import AttendanceTable from './AttendanceTable';
import Summary from './Summary';
import AddPersonForm from './AddPersonForm';
import Modal from './Modal';

interface CurrentWeekViewProps {
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  attendance: Attendance;
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentWeekId: string;
  isAdmin: boolean;
  onAddPerson: (name: string, email: string, password: string, selectedDays: DayKey[]) => Promise<void>;
}

const CurrentWeekView: React.FC<CurrentWeekViewProps> = ({
  profiles,
  setProfiles,
  attendance,
  setAttendanceRecords,
  currentWeekId,
  isAdmin,
  onAddPerson,
}) => {
  const [currentDay, setCurrentDay] = useState<DayKey>(() => {
    const jsTodayIndex = new Date().getDay();
    // Sunday is 0 in JS, but we want it to be 6. Monday is 1 -> 0.
    const todayIndex = jsTodayIndex === 0 ? 6 : jsTodayIndex - 1;
    return DAYS_OF_WEEK[todayIndex] || 'Segunda';
  });

  const [personToSubstitute, setPersonToSubstitute] = useState<Profile | null>(null);
  const [personToRemove, setPersonToRemove] = useState<Profile | null>(null);

  const setPersonAttendance = useCallback(async (personId: string, day: DayKey, is_present: boolean) => {
    const { data, error } = await supabase
        .from('attendances')
        .upsert(
            { user_id: personId, week_id: currentWeekId, day: day, is_present },
            { onConflict: 'user_id,week_id,day' }
        ).select().single();

    if (error) {
        console.error("Error setting attendance", error);
        alert("Erro ao atualizar presença.");
        throw error;
    }

    if (data) {
        setAttendanceRecords(prev => {
            const recordIndex = prev.findIndex(r => r.user_id === personId && r.week_id === currentWeekId && r.day === day);
            if (recordIndex > -1) {
                const newRecords = [...prev];
                newRecords[recordIndex] = data as AttendanceRecord;
                return newRecords;
            } else {
                return [...prev, data as AttendanceRecord];
            }
        });
    }
  }, [currentWeekId, setAttendanceRecords]);

  const handleToggleAttendance = useCallback(async (personId: string, day: DayKey) => {
    const isPresent = !!attendance[personId]?.[day];
    await setPersonAttendance(personId, day, !isPresent);
  }, [attendance, setPersonAttendance]);
  
  const handleSubstitute = (person: Profile) => {
    setPersonToSubstitute(person);
  };

  const confirmSubstitute = async (substitutePersonId: string) => {
    if (!personToSubstitute) return;
    try {
        // Mark original person as absent.
        await setPersonAttendance(personToSubstitute.id, currentDay, false);
        // Mark substitute as present.
        await setPersonAttendance(substitutePersonId, currentDay, true);

        alert(`${profiles.find(p => p.id === substitutePersonId)?.full_name} foi adicionado como substituto para ${personToSubstitute.full_name} em ${currentDay}.`);
        setPersonToSubstitute(null);
    } catch (e) {
        // Error already alerted in setPersonAttendance
    }
  };
  
  const handleRemovePerson = (person: Profile) => {
    setPersonToRemove(person);
  };

  const confirmRemovePerson = async () => {
    if (!personToRemove) return;
    if (!window.confirm(`Tem certeza que deseja remover ${personToRemove.full_name} do sistema? O perfil será removido permanentemente.`)) {
        setPersonToRemove(null);
        return;
    }
    
    // This only removes the profile, not the auth user for security reasons.
    // That must be done manually in the Supabase dashboard.
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', personToRemove.id);

    if (error) {
      alert(`Erro ao remover o perfil: ${error.message}. O usuário ainda pode existir no sistema de autenticação.`);
    } else {
      alert(`${personToRemove.full_name} foi removido.`);
      setProfiles(prev => prev.filter(p => p.id !== personToRemove!.id));
      setAttendanceRecords(prev => prev.filter(record => record.user_id !== personToRemove!.id));
    }
    setPersonToRemove(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-2/3 flex flex-col gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <DaySelector
            currentDay={currentDay}
            onSelectDay={setCurrentDay}
            daysToDisplay={DAYS_OF_WEEK}
          />
        </div>
        <AttendanceTable
          people={profiles}
          attendance={attendance}
          currentDay={currentDay}
          isAdmin={isAdmin}
          onToggleAttendance={handleToggleAttendance}
          onSubstitute={handleSubstitute}
          onRemovePerson={handleRemovePerson}
        />
      </div>
      <div className="lg:w-1/3 flex flex-col gap-6">
        <Summary
          people={profiles.filter(p => p.default_days.includes(currentDay))}
          attendance={attendance}
          currentDay={currentDay}
        />
        {isAdmin && <AddPersonForm onAddPerson={onAddPerson} />}
      </div>

      <Modal
        isOpen={!!personToSubstitute}
        onClose={() => setPersonToSubstitute(null)}
        title={`Substituir ${personToSubstitute?.full_name}`}
      >
        <div className="mt-4">
          <p className="text-sm text-gray-400 mb-4">
            Selecione quem irá substituir {personToSubstitute?.full_name} em {currentDay}.
            A pessoa original será marcada como <strong>ausente</strong> e a substituta como <strong>presente</strong>.
          </p>
          <div className="max-h-60 overflow-y-auto">
            <ul className="divide-y divide-gray-700">
              {profiles
                .filter(p => p.id !== personToSubstitute?.id)
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => confirmSubstitute(p.id)}
                      className="w-full text-left p-3 hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {p.full_name}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!personToRemove}
        onClose={() => setPersonToRemove(null)}
        title={`Remover ${personToRemove?.full_name}?`}
      >
        <div className="mt-4">
          <p className="text-sm text-gray-300">
            Esta ação é irreversível e removerá o perfil de <strong>{personToRemove?.full_name}</strong>.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Nota: A conta de usuário associada (login) <strong>NÃO</strong> será removida por segurança. Isso deve ser feito manualmente no painel do Supabase.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setPersonToRemove(null)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-md transition duration-300"
            >
              Cancelar
            </button>
            <button
              onClick={confirmRemovePerson}
              className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white font-bold rounded-md transition duration-300"
            >
              Confirmar Remoção
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CurrentWeekView;

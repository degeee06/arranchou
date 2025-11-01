import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile, AttendanceRecord, Attendance, DayKey } from './types';
import AuthView from './components/AuthView';
import Header from './components/Header';
import CurrentWeekView from './components/CurrentWeekView';
import HistoryView from './components/HistoryView';
import EmployeeWeekView from './components/EmployeeWeekView';
import { CalendarIcon, HistoryIcon } from './components/icons';

// Function to get ISO week number (e.g., 2024-W42)
export const getWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  // Return string
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekId] = useState<string>(getWeekId(new Date()));
  const [view, setView] = useState<'current' | 'history'>('current');

  const fetchData = useCallback(async (currentSession: Session) => {
    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();
      if (profileError) throw profileError;
      setProfile(userProfile);

      if (userProfile.role === 'admin') {
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        if (profilesError) throw profilesError;
        setProfiles(allProfiles);
      } else {
        setProfiles([userProfile]);
      }

      const { data: allAttendances, error: attendancesError } = await supabase
        .from('attendances')
        .select('*');
      if (attendancesError) throw attendancesError;
      setAttendanceRecords(allAttendances);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Falha ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchData(session);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchData(session);
        } else {
          setProfile(null);
          setProfiles([]);
          setAttendanceRecords([]);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchData]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
  };

  const handleAddPerson = async (name: string, email: string, password: string, selectedDays: DayKey[]) => {
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    if (!adminSession) {
      alert("Sessão de administrador não encontrada. Por favor, faça login novamente.");
      return;
    }

    // SignUp cria um novo usuário e o loga, substituindo a sessão atual.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    });

    if (signUpError) {
        alert(`Erro ao criar usuário: ${signUpError.message}`);
        // Restaura a sessão do admin em caso de falha.
        await supabase.auth.setSession(adminSession);
        return;
    }

    if (signUpData.user) {
        // O trigger já criou um perfil. Agora atualizamos com os dias corretos.
        // Esta atualização usa a sessão do usuário recém-criado para autorização.
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ default_days: selectedDays })
            .eq('id', signUpData.user.id);

        if (updateError) {
            alert(`Usuário criado, mas falha ao definir os dias padrão: ${updateError.message}`);
        } else {
            alert(`Usuário "${name}" criado com sucesso!`);
        }

        // Restaura a sessão do administrador.
        await supabase.auth.setSession(adminSession);
        
        // Busca novamente todos os dados para atualizar a visão do administrador.
        await fetchData(adminSession);
    } else {
        alert("Ocorreu um erro inesperado ao criar o usuário.");
        await supabase.auth.setSession(adminSession);
    }
  };


  const attendance: Attendance = useMemo(() => {
    return attendanceRecords.reduce((acc, record) => {
      if (!acc[record.user_id]) {
        acc[record.user_id] = {};
      }
      acc[record.user_id][record.day] = record.is_present;
      return acc;
    }, {} as Attendance);
  }, [attendanceRecords]);

  if (loading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Arranchou</h1>
          <p className="text-lg mt-2">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthView />;
  }

  const NavButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
  }> = ({ label, icon, active, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-brand-primary text-white'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <Header session={session} onLogout={handleLogout} />
      <main className="container mx-auto p-4 max-w-7xl">
        {profile.role === 'admin' ? (
          <div className="flex flex-col gap-6">
            <nav className="flex flex-wrap gap-2 bg-gray-800 p-2 rounded-lg shadow">
              <NavButton label="Semana Atual" icon={<CalendarIcon />} active={view === 'current'} onClick={() => setView('current')} />
              <NavButton label="Histórico" icon={<HistoryIcon />} active={view === 'history'} onClick={() => setView('history')} />
            </nav>

            {view === 'current' && (
              <CurrentWeekView
                profiles={profiles}
                attendance={attendance}
                setAttendanceRecords={setAttendanceRecords}
                currentWeekId={currentWeekId}
                isAdmin={true}
                onAddPerson={handleAddPerson}
              />
            )}
            {view === 'history' && <HistoryView allProfiles={profiles} allAttendances={attendanceRecords} />}
          </div>
        ) : (
          <EmployeeWeekView
            profile={profile}
            attendance={attendance}
            setAttendanceRecords={setAttendanceRecords}
            currentWeekId={currentWeekId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
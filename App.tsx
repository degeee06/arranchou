import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile, AttendanceRecord, Attendance, DayKey } from './types';
import AuthView from './components/AuthView';
import Header from './components/Header';
import CurrentWeekView from './components/CurrentWeekView';
import HistoryView from './components/HistoryView';
import EmployeeWeekView from './components/EmployeeWeekView';
import ManageUsersView from './components/ManageUsersView';
import AccessControlView from './components/AccessControlView';
import PredictiveAnalysisView from './components/PredictiveAnalysisView'; // Importar
import { CalendarIcon, HistoryIcon, UsersIcon, ShieldCheckIcon, ChartBarIcon } from './components/icons'; // Importar

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
  const [view, setView] = useState<'current' | 'history' | 'manage_users' | 'access_control' | 'predictive_analysis'>('current'); // Adicionar novo estado de view

  const fetchData = useCallback(async (currentSession: Session) => {
    try {
      setLoading(true);
      const { data: userProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle(); // Use maybeSingle() to prevent error on missing profile
      if (profileError) throw profileError;

      if (!userProfileData) {
        console.error(`Inconsistent state: User ${currentSession.user.id} authenticated but profile is missing.`);
        alert("Erro: Seu perfil não foi encontrado. Por favor, tente se cadastrar novamente ou contate o suporte. Você será desconectado.");
        await supabase.auth.signOut();
        setLoading(false); 
        return; 
      }

      setProfile(userProfileData);

      if (userProfileData.role === 'admin' || userProfileData.role === 'super_admin') {
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        if (profilesError) throw profilesError;
        setProfiles(allProfiles);
      } else {
        setProfiles([userProfileData]);
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

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchData(session);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchData(session);
      } else {
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  // Realtime listener for profile changes (for admin)
  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return;

    const channel = supabase
      .channel('profiles-changes')
      .on<Profile>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
            if (payload.eventType === 'INSERT') {
                setProfiles((currentProfiles) => 
                  [...currentProfiles, payload.new]
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                );
            } else if (payload.eventType === 'UPDATE') {
                setProfiles((currentProfiles) =>
                    currentProfiles.map(p => p.id === payload.new.id ? payload.new : p)
                );
            } else if (payload.eventType === 'DELETE') {
                const deletedProfileId = (payload.old as { id: string }).id;
                setProfiles((currentProfiles) =>
                    currentProfiles.filter(p => p.id !== deletedProfileId)
                );
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Realtime listener for attendance changes
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('attendances-changes')
      .on<AttendanceRecord>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendances' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAttendanceRecords(prev => 
              [...prev.filter(r => !(r.user_id === payload.new.user_id && r.week_id === payload.new.week_id && r.day === payload.new.day)), payload.new]
            );
          } else if (payload.eventType === 'UPDATE') {
            setAttendanceRecords(prev =>
              prev.map(r => (r.user_id === payload.new.user_id && r.week_id === payload.new.week_id && r.day === payload.new.day) ? payload.new : r)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRecord = payload.old as { user_id: string; week_id: string; day: DayKey };
            if (deletedRecord.user_id && deletedRecord.week_id && deletedRecord.day) {
                setAttendanceRecords(prev =>
                  prev.filter(r => !(r.user_id === deletedRecord.user_id && r.week_id === deletedRecord.week_id && r.day === deletedRecord.day))
                );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);


  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      if (error.name === 'AuthSessionMissingError') {
        console.warn('Session was already missing on sign out. Clearing state manually.');
        setSession(null);
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
      } else {
        alert("Ocorreu um erro ao sair. Por favor, tente novamente.");
      }
    }
  };
  
  const attendanceData: Attendance = useMemo(() => {
    return attendanceRecords.reduce<Attendance>((acc, record) => {
      if (!acc[record.user_id]) {
        acc[record.user_id] = {};
      }
      acc[record.user_id][record.day] = record.is_present;
      return acc;
    }, {});
  }, [attendanceRecords]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthView />;
  }
  
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <Header session={session} profile={profile} onLogout={handleLogout} />
      <main>
        {isAdmin ? (
          <>
            <nav className="mb-6 flex justify-around sm:justify-center border-b border-gray-700">
              <button
                onClick={() => setView('current')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'current' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                <span className="flex items-center gap-2"><CalendarIcon /> <span className="hidden sm:inline">Semana</span></span>
              </button>
              <button
                onClick={() => setView('history')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'history' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                 <span className="flex items-center gap-2"><HistoryIcon /> <span className="hidden sm:inline">Histórico</span></span>
              </button>
              <button
                onClick={() => setView('manage_users')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'manage_users' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                 <span className="flex items-center gap-2"><UsersIcon /> <span className="hidden sm:inline">Usuários</span></span>
              </button>
               <button
                onClick={() => setView('access_control')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'access_control' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                 <span className="flex items-center gap-2"><ShieldCheckIcon /> <span className="hidden sm:inline">Acesso</span></span>
              </button>
              <button
                onClick={() => setView('predictive_analysis')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'predictive_analysis' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                 <span className="flex items-center gap-2"><ChartBarIcon className="h-5 w-5" /> <span className="hidden sm:inline">Análise IA</span></span>
              </button>
            </nav>
            {view === 'current' && (
              <CurrentWeekView
                profiles={profiles}
                attendance={attendanceData}
                attendanceRecords={attendanceRecords}
                setAttendanceRecords={setAttendanceRecords}
                currentWeekId={currentWeekId}
                isAdmin={isAdmin}
                adminProfile={profile}
              />
            )}
            {view === 'history' && <HistoryView allProfiles={profiles} allAttendances={attendanceRecords} />}
            {view === 'manage_users' && (
              <ManageUsersView
                profiles={profiles}
                setProfiles={setProfiles}
                currentUserProfile={profile}
              />
            )}
            {view === 'access_control' && <AccessControlView />}
            {view === 'predictive_analysis' && <PredictiveAnalysisView />}
          </>
        ) : (
          <EmployeeWeekView 
            profile={profile}
            attendance={attendanceData}
            attendanceRecords={attendanceRecords}
            setAttendanceRecords={setAttendanceRecords}
            currentWeekId={currentWeekId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
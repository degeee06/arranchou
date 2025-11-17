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
import SettingsView from './components/SettingsView'; // Importar a nova view
import { CalendarIcon, HistoryIcon, UsersIcon, SettingsIcon } from './components/icons';
import { getWeekId, getPastWeeksIds } from './utils';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false); // For subsequent data fetches
  const [isBootstrapping, setIsBootstrapping] = useState(true); // For initial app load
  const [currentWeekId] = useState<string>(getWeekId(new Date()));
  const [view, setView] = useState<'current' | 'history' | 'manage_users' | 'settings'>('current');
  const [companyName, setCompanyName] = useState<string>('Arranchou');


const fetchData = useCallback(async (currentSession: Session) => {
  try {
    setLoading(true);
    
    // 1. Primeiro busca APENAS o próprio perfil (sempre funciona com RLS)
    const { data: userProfileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw profileError;
    }
    
    if (!userProfileData) {
      console.error(`Inconsistent state: User ${currentSession.user.id} authenticated but profile is missing.`);
      alert("Erro: Seu perfil não foi encontrado. Por favor, tente se cadastrar novamente ou contate o suporte. Você será desconectado.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    setProfile(userProfileData);

    // 2. Se for admin, tenta buscar dados adicionais
    if (userProfileData.role === 'admin' || userProfileData.role === 'super_admin') {
      try {
        // Tenta buscar todos os profiles (se política de admin funcionar)
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        
        if (profilesError) {
          console.warn('Admin cannot fetch all profiles, using own profile only:', profilesError);
          setProfiles([userProfileData]);
        } else {
          setProfiles(allProfiles || []);
        }

        // 🔥 OPTIMIZATION: Only fetch the current week's data on initial load for admins.
        // History is now loaded on-demand in the HistoryView.
        const { data: currentWeekAttendances, error: attendancesError } = await supabase
            .from('attendances')
            .select('*')
            .eq('week_id', currentWeekId);

        if (attendancesError) {
          console.warn('Admin cannot fetch current week attendances:', attendancesError);
          setAttendanceRecords([]);
        } else {
          setAttendanceRecords(currentWeekAttendances || []);
        }

      } catch (adminError) {
        console.error('Admin data fetch failed, using fallback:', adminError);
        // Fallback: usa apenas dados básicos
        setProfiles([userProfileData]);
        setAttendanceRecords([]);
      }
    } else {
      // 3. Usuário normal - apenas seus dados (sempre funciona com RLS)
      setProfiles([userProfileData]);
      
      // Apenas suas próprias attendances
      const recentWeeks = getPastWeeksIds(8);
      const { data: userAttendances, error: attendancesError } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', currentSession.user.id)  // 🔥 CRÍTICO: filtra por user_id
        .in('week_id', recentWeeks);

      if (attendancesError) {
        console.error('User attendances fetch error:', attendancesError);
        setAttendanceRecords([]);
      } else {
        setAttendanceRecords(userAttendances || []);
      }
    }

  } catch (error) {
    console.error('Error fetching data:', error);
    alert('Falha ao carregar os dados.');
  } finally {
    setLoading(false);
  }
}, [currentWeekId]);


  // Effect for INITIAL APP LOAD
  useEffect(() => {
    const initializeApp = async () => {
      // Fetch company name and session in parallel to be efficient
      const [companyNameResponse, sessionResponse] = await Promise.all([
        supabase
          .from('company_settings')
          .select('setting_value')
          .eq('setting_key', 'company_name')
          .single(),
        supabase.auth.getSession(),
      ]);

      // Process company name
      if (companyNameResponse.data?.setting_value) {
        setCompanyName(companyNameResponse.data.setting_value);
      } else if (companyNameResponse.error) {
        console.warn('Could not fetch company name setting:', companyNameResponse.error.message);
      }

      // Process session
      const currentSession = sessionResponse.data.session;
      setSession(currentSession);

      if (currentSession) {
        // If there's a session, we need to fetch all associated user data
        await fetchData(currentSession);
      }

      // After all initial data is fetched (or attempted), stop the bootstrap loading state
      setIsBootstrapping(false);
    };

    initializeApp();
  }, [fetchData]); // fetchData is stable due to useCallback

  // Auth listener for SUBSEQUENT changes (login/logout after initial load)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchData(session);
      } else {
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
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
    // FIX: Only subscribe after the initial load is complete and we have a session.
    // This prevents a race condition where realtime updates are overwritten by the initial fetch.
    if (isBootstrapping || !session) {
      return;
    }

    // 🔥 OPTIMIZATION: Disable mass realtime updates for admins to prevent performance issues.
    // An admin managing 2000+ users would be flooded with events.
    // The data will be fresh on each load/navigation instead.
    // Employees will still get their own updates via RLS.
    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      return;
    }

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
  }, [session, isBootstrapping, profile]); // Depend on 'profile' to correctly apply the role-based rule.


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
    return attendanceRecords
      .filter(record => record.week_id === currentWeekId)
      .reduce<Attendance>((acc, record) => {
      if (!acc[record.user_id]) {
        acc[record.user_id] = {};
      }
      acc[record.user_id][record.day] = record.is_present;
      return acc;
    }, {});
  }, [attendanceRecords, currentWeekId]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthView companyName={companyName} />;
  }
  
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const isSuperAdmin = profile.role === 'super_admin';

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <Header session={session} profile={profile} onLogout={handleLogout} companyName={companyName} />
      <main>
        {isAdmin ? (
          <>
            <nav className="mb-6 flex justify-around sm:justify-center border-b border-gray-700">
              <button
                onClick={() => setView('current')}
                className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'current' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
              >
                <span className="flex items-center gap-2"><CalendarIcon /> <span className="hidden sm:inline">Semana Atual</span></span>
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
                 <span className="flex items-center gap-2"><UsersIcon /> <span className="hidden sm:inline">Gerenciar Usuários</span></span>
              </button>
              {isSuperAdmin && (
                 <button
                    onClick={() => setView('settings')}
                    className={`px-2 sm:px-4 py-2 font-semibold transition-colors ${view === 'settings' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}
                  >
                    <span className="flex items-center gap-2"><SettingsIcon /> <span className="hidden sm:inline">Configurações</span></span>
                </button>
              )}
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
            {view === 'history' && <HistoryView allProfiles={profiles} currentUserProfile={profile} />}
            {view === 'manage_users' && (
              <ManageUsersView
                profiles={profiles}
                setProfiles={setProfiles}
                currentUserProfile={profile}
              />
            )}
            {view === 'settings' && isSuperAdmin && (
              <SettingsView 
                initialCompanyName={companyName}
                setCompanyName={setCompanyName}
              />
            )}
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

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
import SettingsView from './components/SettingsView';
import { CalendarIcon, HistoryIcon, UsersIcon, SettingsIcon } from './components/icons';
import { getWeekId, getPastWeeksIds } from './utils';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentWeekId] = useState<string>(getWeekId(new Date()));
  const [view, setView] = useState<'current' | 'history' | 'manage_users' | 'settings'>('current');
  const [companyName, setCompanyName] = useState<string>('Arranchou');

  const fetchData = useCallback(async (currentSession: Session) => {
    try {
      setLoading(true);
      
      // 1. Busca o Perfil (Já filtrado pelo RLS por empresa se configurado no SQL)
      const { data: userProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();

      if (profileError || !userProfileData) {
        throw new Error('Perfil não encontrado.');
      }

      setProfile(userProfileData);

      // 2. Busca Nome Personalizado da Empresa
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', userProfileData.company_id)
        .eq('setting_key', 'company_name')
        .maybeSingle();

      if (settingsData) {
        setCompanyName(settingsData.setting_value);
      } else {
        setCompanyName(`Arranchou - ${userProfileData.company_id}`);
      }

      // 3. Busca Dados (Funcionários e Presenças)
      if (userProfileData.role === 'admin' || userProfileData.role === 'super_admin') {
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        
        setProfiles(allProfiles || []);

        const { data: currentWeekAttendances } = await supabase
            .from('attendances')
            .select('*')
            .eq('week_id', currentWeekId);

        setAttendanceRecords(currentWeekAttendances || []);
      } else {
        // Funcionário comum vê apenas a si mesmo
        setProfiles([userProfileData]);
        const recentWeeks = getPastWeeksIds(8);
        const { data: userAttendances } = await supabase
          .from('attendances')
          .select('*')
          .eq('user_id', currentSession.user.id)
          .in('week_id', recentWeeks);

        setAttendanceRecords(userAttendances || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWeekId]);

  useEffect(() => {
    const initializeApp = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession) {
        await fetchData(currentSession);
      }
      setIsBootstrapping(false);
    };
    initializeApp();
  }, [fetchData]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  const attendanceData: Attendance = useMemo(() => {
    return attendanceRecords
      .filter(record => record.week_id === currentWeekId)
      .reduce<Attendance>((acc, record) => {
      if (!acc[record.user_id]) acc[record.user_id] = {};
      acc[record.user_id][record.day] = {
        is_present: record.is_present,
        validated: record.validated
      };
      return acc;
    }, {});
  }, [attendanceRecords, currentWeekId]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-brand-primary shadow-xl"></div>
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
            <nav className="mb-8 flex justify-around sm:justify-center border-b border-gray-700">
              <button onClick={() => setView('current')} className={`px-4 py-3 font-bold transition-all ${view === 'current' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-gray-300'}`}>
                <span className="flex items-center gap-2"><CalendarIcon /> <span className="hidden sm:inline uppercase text-sm tracking-widest">Painel</span></span>
              </button>
              <button onClick={() => setView('history')} className={`px-4 py-3 font-bold transition-all ${view === 'history' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-gray-300'}`}>
                 <span className="flex items-center gap-2"><HistoryIcon /> <span className="hidden sm:inline uppercase text-sm tracking-widest">Relatórios</span></span>
              </button>
              <button onClick={() => setView('manage_users')} className={`px-4 py-3 font-bold transition-all ${view === 'manage_users' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-gray-300'}`}>
                 <span className="flex items-center gap-2"><UsersIcon /> <span className="hidden sm:inline uppercase text-sm tracking-widest">Equipe</span></span>
              </button>
              {isSuperAdmin && (
                 <button onClick={() => setView('settings')} className={`px-4 py-3 font-bold transition-all ${view === 'settings' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-gray-300'}`}>
                    <span className="flex items-center gap-2"><SettingsIcon /> <span className="hidden sm:inline uppercase text-sm tracking-widest">Ajustes</span></span>
                </button>
              )}
            </nav>
            
            <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
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
                  profile={profile}
                />
              )}
            </div>
          </>
        ) : (
          <div className="animate-in zoom-in-95 duration-300">
            <EmployeeWeekView
              profile={profile}
              attendance={attendanceData}
              attendanceRecords={attendanceRecords}
              setAttendanceRecords={setAttendanceRecords}
              currentWeekId={currentWeekId}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;


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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async (currentSession: Session, retryCount = 0) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const { data: userProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      if (profileError) {
          // Se for erro de esquema, tenta novamente com delay
          if (profileError.message?.includes("schema") && retryCount < 3) {
              setTimeout(() => fetchData(currentSession, retryCount + 1), 1500);
              return;
          }
          throw new Error("Erro de conexão com o banco de dados. Execute o reparo via SQL.");
      }
      
      if (!userProfileData) {
        // Fallback: Tenta buscar de novo se o usuário acabou de ser criado
        if (retryCount < 5) {
            setTimeout(() => fetchData(currentSession, retryCount + 1), 2000);
            return;
        }
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(userProfileData);

      if (userProfileData.company_id) {
          const { data: settingsData } = await supabase
            .from('company_settings')
            .select('setting_value')
            .eq('company_id', userProfileData.company_id)
            .eq('setting_key', 'company_name')
            .maybeSingle();

          setCompanyName(settingsData?.setting_value || `Unidade: ${userProfileData.company_id}`);

          const isAdmin = userProfileData.role === 'admin' || userProfileData.role === 'super_admin';

          if (isAdmin) {
            const { data: allProfiles } = await supabase
              .from('profiles')
              .select('*')
              .order('full_name', { ascending: true });
            
            setProfiles(allProfiles || [userProfileData]);

            const { data: currentWeekAttendances } = await supabase
                .from('attendances')
                .select('*')
                .eq('week_id', currentWeekId);

            setAttendanceRecords(currentWeekAttendances || []);
          } else {
            setProfiles([userProfileData]);
            const recentWeeks = getPastWeeksIds(8);
            const { data: userAttendances } = await supabase
              .from('attendances')
              .select('*')
              .eq('user_id', currentSession.user.id)
              .in('week_id', recentWeeks);

            setAttendanceRecords(userAttendances || []);
          }
      }

    } catch (error: any) {
      console.error('Fetch Error:', error);
      setErrorMessage(error.message || 'Erro de conexão.');
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session && event === 'SIGNED_IN') {
        fetchData(session);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
        setErrorMessage(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
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
      <div className="min-h-screen bg-[#0a0c10] flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <AuthView companyName={companyName} />;
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex flex-col justify-center items-center p-6 text-center">
          <div className="bg-slate-900 border border-red-500/30 p-8 rounded-3xl max-w-md shadow-2xl">
              <h1 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Falha Técnica</h1>
              <p className="text-slate-400 mb-6 text-sm leading-relaxed">{errorMessage}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => fetchData(session)} className="w-full bg-brand-primary text-white font-bold py-4 rounded-2xl shadow-lg">Tentar Novamente</button>
                <button onClick={handleLogout} className="w-full bg-slate-800 text-slate-400 font-bold py-3 rounded-2xl">Sair</button>
              </div>
          </div>
      </div>
    );
  }

  if (!profile && !loading) {
      return (
          <div className="min-h-screen bg-[#0a0c10] flex flex-col justify-center items-center p-6 text-center">
              <div className="bg-slate-900 border border-brand-primary/30 p-8 rounded-3xl max-w-md shadow-2xl">
                  <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-6"></div>
                  <h1 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Sincronizando...</h1>
                  <p className="text-slate-400 mb-6 text-sm">O banco de dados está processando seu acesso. Aguarde.</p>
                  <button onClick={handleLogout} className="w-full bg-slate-800 text-slate-500 font-bold py-3 rounded-2xl text-[10px] uppercase tracking-widest">Cancelar e Sair</button>
              </div>
          </div>
      );
  }

  if (profile && !profile.company_id) {
      return (
          <div className="min-h-screen bg-[#0a0c10] flex flex-col justify-center items-center p-6 text-center">
              <div className="bg-slate-900 border border-amber-500/30 p-8 rounded-3xl max-w-md shadow-2xl">
                  <h1 className="text-xl font-bold text-white mb-4 uppercase tracking-widest">Aguardando Unidade</h1>
                  <p className="text-slate-400 mb-6 text-sm leading-relaxed">Conta ativa, mas não vinculada a uma unidade.</p>
                  <button onClick={handleLogout} className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg">Sair</button>
              </div>
          </div>
      );
  }

  if (!profile) return null;
  
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const isSuperAdmin = profile.role === 'super_admin';

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl animate-in fade-in duration-700">
      <Header session={session} profile={profile} onLogout={handleLogout} companyName={companyName} />
      <main>
        {loading && (
           <div className="fixed top-6 right-6 z-50">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary"></div>
           </div>
        )}
        {isAdmin ? (
          <>
            <nav className="mb-10 flex justify-around sm:justify-center border-b border-slate-800/60">
              <button onClick={() => setView('current')} className={`px-6 py-4 font-bold transition-all relative ${view === 'current' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}>
                <span className="flex items-center gap-2"><CalendarIcon /> <span className="hidden sm:inline uppercase text-[11px] tracking-[0.2em]">Painel</span></span>
                {view === 'current' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-primary rounded-t-full shadow-[0_-4px_10px_rgba(13,71,161,0.5)]"></div>}
              </button>
              <button onClick={() => setView('history')} className={`px-6 py-4 font-bold transition-all relative ${view === 'history' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}>
                 <span className="flex items-center gap-2"><HistoryIcon /> <span className="hidden sm:inline uppercase text-[11px] tracking-[0.2em]">Relatórios</span></span>
                 {view === 'history' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-primary rounded-t-full shadow-[0_-4px_10px_rgba(13,71,161,0.5)]"></div>}
              </button>
              <button onClick={() => setView('manage_users')} className={`px-6 py-4 font-bold transition-all relative ${view === 'manage_users' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}>
                 <span className="flex items-center gap-2"><UsersIcon /> <span className="hidden sm:inline uppercase text-[11px] tracking-[0.2em]">Equipe</span></span>
                 {view === 'manage_users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-primary rounded-t-full shadow-[0_-4px_10px_rgba(13,71,161,0.5)]"></div>}
              </button>
              {isSuperAdmin && (
                 <button onClick={() => setView('settings')} className={`px-6 py-4 font-bold transition-all relative ${view === 'settings' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}>
                    <span className="flex items-center gap-2"><SettingsIcon /> <span className="hidden sm:inline uppercase text-[11px] tracking-[0.2em]">Ajustes</span></span>
                    {view === 'settings' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-primary rounded-t-full shadow-[0_-4px_10px_rgba(13,71,161,0.5)]"></div>}
                </button>
              )}
            </nav>
            
            <div className="transition-all duration-300">
              {profiles.length <= 1 && !loading && (
                  <div className="bg-brand-primary/5 border border-brand-primary/20 p-8 rounded-[2rem] text-center mb-10 backdrop-blur-sm">
                      <p className="text-brand-light font-black uppercase tracking-[0.2em] text-xs mb-3">Sincronização Necessária</p>
                      <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                          As regras do banco foram atualizadas para suportar multi-unidades. 
                          Se os dados não carregarem, limpe o cache e entre novamente.
                      </p>
                      <button onClick={() => fetchData(session)} className="mt-6 bg-brand-primary px-10 py-3 rounded-2xl font-bold shadow-xl hover:bg-brand-secondary transition-all active:scale-95">Recarregar Agora</button>
                  </div>
              )}
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
          <div className="animate-in zoom-in-95 duration-500">
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

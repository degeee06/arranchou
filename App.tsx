
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

  const fetchData = useCallback(async (currentSession: Session) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      // 1. Busca perfil individual do usuário logado
      // Usamos .maybeSingle() para evitar erro se o RLS bloquear
      const { data: userProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      if (profileError) {
          console.error("Erro ao buscar perfil:", profileError);
          throw new Error("Erro de permissão no banco (RLS). Tente sair e entrar novamente.");
      }
      
      if (!userProfileData) {
        setProfile(null);
        return; // Vai cair na tela de "Aguardando Vinculação"
      }

      setProfile(userProfileData);

      if (!userProfileData.company_id) {
          setLoading(false);
          return;
      }

      // 2. Carrega Nome da Empresa
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', userProfileData.company_id)
        .eq('setting_key', 'company_name')
        .maybeSingle();

      setCompanyName(settingsData?.setting_value || `Unidade: ${userProfileData.company_id}`);

      const isAdmin = userProfileData.role === 'admin' || userProfileData.role === 'super_admin';

      // 3. Busca lista da equipe
      if (isAdmin) {
        const { data: allProfiles, error: fetchProfilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        
        if (fetchProfilesError) {
            console.error("Erro RLS Perfis Equipe:", fetchProfilesError);
            // Se falhar a lista total, mostramos apenas o próprio admin para não quebrar o app
            setProfiles([userProfileData]); 
        } else {
            setProfiles(allProfiles || []);
        }

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

    } catch (error: any) {
      console.error('Fetch Error:', error);
      setErrorMessage(error.message || 'Erro de conexão com o servidor.');
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
      if (session) {
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <AuthView companyName={companyName} />;
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-6 text-center">
          <div className="bg-gray-800 border border-red-500/50 p-8 rounded-2xl max-w-md shadow-2xl">
              <h1 className="text-xl font-bold text-white mb-2">Erro de Acesso</h1>
              <p className="text-gray-400 mb-6 text-sm">{errorMessage}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => fetchData(session)} className="w-full bg-brand-primary text-white font-bold py-3 rounded-xl">Tentar Novamente</button>
                <button onClick={handleLogout} className="w-full bg-gray-700 text-white font-bold py-2 rounded-xl">Sair da Conta</button>
              </div>
          </div>
      </div>
    );
  }

  // Se logou mas o perfil não veio (RLS barrou ou usuário não existe no profiles)
  if (!profile && !loading) {
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-6 text-center">
              <div className="bg-gray-800 border border-brand-primary/50 p-8 rounded-2xl max-w-md shadow-xl">
                  <h1 className="text-xl font-bold text-white mb-4">Sincronizando Acesso</h1>
                  <p className="text-gray-400 mb-6 text-sm">Estamos finalizando a configuração do seu acesso. Se esta mensagem persistir, clique em Sair e entre novamente.</p>
                  <div className="flex flex-col gap-3">
                    <div className="animate-pulse bg-brand-primary/20 h-2 w-full rounded-full mb-4"></div>
                    <button onClick={handleLogout} className="w-full bg-brand-primary text-white font-bold py-3 rounded-xl shadow-lg">Reiniciar Sessão (Sair)</button>
                  </div>
              </div>
          </div>
      );
  }

  if (profile && !profile.company_id) {
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-6 text-center">
              <div className="bg-gray-800 border border-yellow-500/50 p-8 rounded-2xl max-w-md shadow-xl">
                  <h1 className="text-xl font-bold text-white mb-4">Aguardando Vinculação</h1>
                  <p className="text-gray-400 mb-6 text-sm">Sua conta foi criada, mas não está vinculada a nenhuma unidade de serviço.</p>
                  <button onClick={handleLogout} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">Sair</button>
              </div>
          </div>
      );
  }

  if (!profile) return null;
  
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const isSuperAdmin = profile.role === 'super_admin';

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <Header session={session} profile={profile} onLogout={handleLogout} companyName={companyName} />
      <main>
        {loading && (
           <div className="fixed top-4 right-4 z-50">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary"></div>
           </div>
        )}
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
              {profiles.length <= 1 && !loading && (
                  <div className="bg-brand-primary/10 border border-brand-primary/40 p-6 rounded-xl text-center mb-8">
                      <p className="text-brand-light font-bold mb-2">Sincronização Necessária</p>
                      <p className="text-gray-400 text-sm max-w-sm mx-auto">
                          As regras de segurança do banco de dados foram atualizadas. 
                          Para visualizar sua equipe, você precisa <strong>Sair e Entrar novamente</strong> agora.
                      </p>
                      <button onClick={handleLogout} className="mt-4 bg-brand-primary px-8 py-2 rounded-lg font-bold shadow-lg hover:bg-brand-secondary transition-all">Sair e Entrar Agora</button>
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

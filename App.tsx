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
import { CalendarIcon, HistoryIcon, UsersIcon } from './components/icons';
import { getWeekId } from './utils';


function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekId] = useState<string>(getWeekId(new Date()));
  const [view, setView] = useState<'current' | 'history' | 'manage_users'>('current');

  const fetchData = useCallback(async (currentSession: Session) => {
    try {
      setLoading(true);
      const { data: userProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      let currentProfile = userProfileData;

      // Handle new user sign-up: profile needs to be created in a second step.
      if (!currentProfile) {
        const pendingProfileJSON = localStorage.getItem('pending_profile_data');
        if (pendingProfileJSON) {
          localStorage.removeItem('pending_profile_data'); // Consume the item to prevent re-creation
          try {
            const pendingProfile = JSON.parse(pendingProfileJSON);
            console.log("No profile found for new user, creating one now:", currentSession.user.id);
            
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: currentSession.user.id,
                full_name: pendingProfile.full_name,
                badge_number: pendingProfile.badge_number,
                // role defaults to 'employee' in the database schema
              })
              .select()
              .single();

            if (insertError) {
              alert(`Falha ao finalizar o cadastro e criar seu perfil: ${insertError.message}. Você será desconectado.`);
              await supabase.auth.signOut();
              return; // Stop execution
            }
            currentProfile = newProfile; // Assign the newly created profile to continue the flow
          } catch (e) {
            alert("Ocorreu um erro ao finalizar seu cadastro. Você será desconectado.");
            await supabase.auth.signOut();
            return; // Stop execution
          }
        } else {
          // This is a true inconsistent state: user is logged in but has no profile, and it wasn't a sign-up flow.
          alert("Erro: Seu perfil não foi encontrado. Você será desconectado.");
          await supabase.auth.signOut();
          return; // Stop execution
        }
      }
      
      // If we've reached here, currentProfile is valid (either fetched or newly created)
      setProfile(currentProfile);

      if (currentProfile.role === 'admin' || currentProfile.role === 'super_admin') {
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        if (profilesError) throw profilesError;
        setProfiles(allProfiles);
      } else {
        setProfiles([currentProfile]);
      }

      // Fetch all attendance records. Realtime will keep it in sync.
      const { data: allAttendances, error: attendancesError } = await supabase
        .from('attendance')
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
      .channel('attendance-changes')
      .on<AttendanceRecord>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAttendanceRecords(prev => 
              [...prev.filter(r => !(r.user_id === payload.new.user_id && r.date === payload.new.date)), payload.new]
            );
          } else if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new;
            setAttendanceRecords(prev =>
              prev.map(r => (r.id === newRecord.id) ? newRecord : r)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRecord = payload.old as { id: number };
            if (deletedRecord.id) {
                setAttendanceRecords(prev =>
                  prev.filter(r => r.id !== deletedRecord.id)
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
      // Handle the case where the session is already gone client-side.
      // This is not a critical error for the user, as the goal is to be logged out.
      // We can manually clear the state to ensure the UI updates correctly.
      if (error.name === 'AuthSessionMissingError') {
        console.warn('Session was already missing on sign out. Clearing state manually.');
        // Manually clear all user-related state, since the onAuthStateChange
        // listener won't fire if the session was already gone.
        setSession(null);
        setProfile(null);
        setProfiles([]);
        setAttendanceRecords([]);
      } else {
        alert("Ocorreu um erro ao sair. Por favor, tente novamente.");
      }
    }
    // On success, the onAuthStateChange listener will clear the state.
  };
  
  // Transform attendance records into a more usable format
  const attendanceData: Attendance = useMemo(() => {
    return attendanceRecords.reduce<Attendance>((acc, record) => {
      if (!acc[record.user_id]) {
        acc[record.user_id] = {};
      }
      acc[record.user_id][record.date] = record.status;
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
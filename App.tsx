import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { Profile, AttendanceRecord, Attendance } from './types';
import Header from './components/Header';
import CurrentWeekView from './components/CurrentWeekView';
import HistoryView from './components/HistoryView';
import AuthView from './components/AuthView';
import { CalendarIcon, HistoryIcon } from './components/icons';

// Helper to get a unique ID for a week (e.g., "2024-W34")
export const getWeekId = (d: Date): string => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return date.getFullYear() + "-W" + (1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7));
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchData();
    } else {
      setProfile(null);
      setProfiles([]);
      setAttendanceRecords([]);
    }
  }, [session]);

  const fetchData = async () => {
    if (!session?.user) return;
    setLoading(true);

    try {
      // Fetch current user's profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError) throw profileError;
      setProfile(userProfile);

      if (userProfile?.role === 'admin') {
        const { data: allProfiles, error: profilesError } = await supabase.from('profiles').select('*');
        if (profilesError) throw profilesError;
        setProfiles(allProfiles || []);

        const { data: allAttendances, error: attendancesError } = await supabase.from('attendances').select('*');
        if (attendancesError) throw attendancesError;
        setAttendanceRecords(allAttendances || []);
      } else {
        // Non-admin users see only their data
        setProfiles([userProfile]);
        const { data: userAttendances, error: attendancesError } = await supabase
            .from('attendances')
            .select('*')
            .eq('user_id', session.user.id);
        if (attendancesError) throw attendancesError;
        setAttendanceRecords(userAttendances || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
      return (
          <div className="bg-gray-900 min-h-screen flex items-center justify-center text-center p-4">
              <div className="bg-yellow-900 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg">
                  <h2 className="font-bold text-lg mb-2">Configuração Incompleta</h2>
                  <p>As credenciais do Supabase não foram definidas.</p>
                  <p>Por favor, abra o arquivo <strong>supabase.ts</strong> e adicione sua URL e Chave Anon do projeto.</p>
              </div>
          </div>
      );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }
  
  const currentWeekId = getWeekId(new Date());

  // Filter and transform data for the current week view
  const currentWeekAttendanceRecords = attendanceRecords.filter(r => r.week_id === currentWeekId);
  const currentAttendance: Attendance = currentWeekAttendanceRecords.reduce((acc, record) => {
    if (!acc[record.user_id]) acc[record.user_id] = {};
    acc[record.user_id][record.day] = record.is_present;
    return acc;
  }, {} as Attendance);

  return (
    <div className="bg-gray-900 min-h-screen font-sans text-gray-100">
      <div className="container mx-auto p-4 max-w-4xl">
        <Header session={session} onLogout={handleLogout} />

        <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === 'current'
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              <CalendarIcon /> Semana Atual
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === 'history'
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              <HistoryIcon /> Histórico
            </button>
          </div>
        </div>

        <main>
          {activeTab === 'current' && (
            <CurrentWeekView
              profiles={profiles}
              attendance={currentAttendance}
              setAttendanceRecords={setAttendanceRecords}
              currentWeekId={currentWeekId}
              isAdmin={profile?.role === 'admin'}
            />
          )}
          {activeTab === 'history' && (
             <HistoryView allProfiles={profiles} allAttendances={attendanceRecords} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile, AttendanceRecord, Attendance, DayKey } from './types';
import AuthView from './components/AuthView';
import Header from './components/Header';
import CurrentWeekView from './components/CurrentWeekView';
import HistoryView from './components/HistoryView';
import AddPersonForm from './components/AddPersonForm';
import EmployeeWeekView from './components/EmployeeWeekView';
import { CalendarIcon, HistoryIcon, UserPlusIcon } from './components/icons';

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
  const [view, setView] = useState<'current' | 'history' | 'admin'>('current');

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
    supabase.auth.getSession
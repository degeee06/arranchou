import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const fetchUserProfile = async (userSession: Session['user'] | null): Promise<UserProfile | null> => {
        if (!userSession) return null;
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userSession.id)
                .single();
            // PGRST116: No rows found. This is a valid state if the profile creation trigger is slow or failed.
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            return profile;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    };

    // Get initial session and profile
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
        setSession(initialSession);
        if (initialSession) {
            const profile = await fetchUserProfile(initialSession.user);
            setUser(profile);
        }
        setLoading(false);
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        const profile = await fetchUserProfile(newSession?.user ?? null);
        setUser(profile);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    session,
    user,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

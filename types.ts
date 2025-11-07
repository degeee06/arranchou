import { User } from '@supabase/supabase-js';

// Fix: Add a global type definition for import.meta.env to fix TypeScript errors
// related to Vite environment variables, as the vite/client types could not be found.
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_SUPABASE_URL: string;
      readonly VITE_SUPABASE_ANON_KEY: string;
    }
  }
}

export enum AttendanceStatus {
  Pendente = 'Pendente',
  Confirmado = 'Confirmado',
  Falta = 'Falta',
  Ausente = 'Ausente',
}

export interface Profile {
  id: string;
  badge_number: string;
  full_name: string;
  role: 'admin' | 'employee';
}

export interface Attendance {
  id: number;
  user_id: string;
  date: string;
  status: AttendanceStatus;
  updated_at: string;
  profiles?: Profile; // Optional, for joined queries
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}
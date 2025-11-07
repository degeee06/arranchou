
import { User } from '@supabase/supabase-js';

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

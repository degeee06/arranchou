
export type DayKey = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';

export interface Profile {
  id: string; // uuid from auth.users
  updated_at?: string;
  full_name: string;
  employee_id: string;
  role: 'super_admin' | 'admin' | 'employee';
  company_id: string; // Novo campo para identificar a empresa (ex: 'ALFA', 'BETA')
}

export interface AttendanceRecord {
  id?: number;
  user_id: string;
  week_id: string;
  day: DayKey;
  is_present: boolean;
  validated: boolean;
  company_id: string; // Identificador da empresa no registro de presença
  created_at?: string;
}

export interface AttendanceStatus {
  is_present: boolean;
  validated: boolean;
}

export type Attendance = {
  [personId: string]: {
    [day in DayKey]?: AttendanceStatus;
  };
};

export interface HistoryEntry {
  weekId: string;
  people: Profile[];
  attendance: Attendance;
}

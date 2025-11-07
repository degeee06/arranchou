export type DayKey = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';

export interface Profile {
  id: string; // uuid from auth.users
  updated_at?: string;
  full_name: string;
  badge_number: string;
  role: 'super_admin' | 'admin' | 'employee';
}

export type AttendanceStatus = 'Presente' | 'Ausente' | 'Pendente';

export interface AttendanceRecord {
  id?: number;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  updated_at?: string;
}


// This will be the transformed structure for easier use in components
export type Attendance = {
  [personId: string]: {
    [date: string]: AttendanceStatus; // date is YYYY-MM-DD
  };
};

export interface HistoryEntry {
  weekId: string;
  people: Profile[];
  attendance: Attendance;
}

// FIX: Add PredictionResult type for the predictive analysis feature.
export interface PredictionResult {
  nextWeekId: string;
  predictions: {
    day: DayKey;
    predicted_attendees: number;
  }[];
  insight: string;
}


export enum UserRole {
  EMPLOYEE = 'Employee',
  ADMIN = 'Admin',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  UNMARKED = 'unmarked',
}

export interface UserProfile {
  id: string;
  full_name: string;
  badge_number: string;
  role: UserRole;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  week_start_date: string;
  profiles: UserProfile; // Joined data
}

export interface WeekData {
  week_start_date: string;
  records: AttendanceRecord[];
}

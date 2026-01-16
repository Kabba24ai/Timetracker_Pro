export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'missed'
  | 'excused';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  check_in_time: string | null;
  minutes_late: number;
  created_at?: string;
}

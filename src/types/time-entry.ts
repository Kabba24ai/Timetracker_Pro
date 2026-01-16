export interface TimeEntry {
  id: number;
  employee_id: number;
  clock_in: string;
  clock_out: string | null;
  break_duration: number;
  notes: string | null;
  status: string;
  total_hours: number;
  created_at: string;
}

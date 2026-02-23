export interface TimeEntry {
  id: number;
  employee_id: number;
  clock_in: string;
  clock_out: string | null;
  break_duration: number;
  notes: string | null;
  status: string;
  total_hours: number;
  breaks: TimeEntryBreak[];
  created_at: string;
}


export interface TimeEntryBreak {
  id: number;
  type: 'lunch' | 'other';
  start_time: string;
  end_time: string | null;
}
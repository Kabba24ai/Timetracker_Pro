export interface VacationRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  start_date: string;
  end_date: string;
  hours: number;
  status: 'pending' | 'approved' | 'denied';
  denial_reason?: string | null;
  created_at: string;
}
export interface Employee {
  id: string;
  user_id: string;
  unique_id?: string;
  employee_code?: string;
  first_name: string;
  last_name: string;
  email: string;

  role: string;        // "employee" | "admin" | "master_admin"
  roles: string[];     // ["admin", "sales"]
  roles_name: string[];   // ["Admin", "Master Admin"]
  created_at: string;

  shift_start_time?: string | null;
  shift_end_time?: string | null;

  pay_start_buffer?: number | null;
  pay_end_buffer?: number | null;


  vacation_eligible?: boolean | null;

  bonus_vacation_hours?: number | null;
  bonus_vacation_hours_start_date?: string | null;
  bonus_vacation_hours_end_date?: string | null;

  // Related objects (for display)
  vacation_allotment_hour?: {
    id: number;
    hours: number;
    name: string;
  } | null;

  vacation_start_day?: {
    id: number;
    day_number: number;
    name: string;
  } | null;


  store?: {
    id: number;
    store_name: string;

    today_schedule?: {
      day: string;
      open: string | null;
      close: string | null;
      is_closed: boolean;
    } | null;

    weekly_schedule?: {
      day: string;
      open: string | null;
      close: string | null;
      is_closed: boolean;
    }[];
  } | null;

}

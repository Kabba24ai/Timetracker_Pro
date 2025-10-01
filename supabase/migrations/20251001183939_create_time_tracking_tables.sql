/*
  # Time Tracking System Schema

  ## New Tables
  
  ### employees
  - id (uuid, primary key)
  - user_id (uuid, references auth.users)
  - first_name (text)
  - last_name (text)
  - email (text, unique)
  - role (text: employee or admin)
  - employee_number (text, unique)
  - phone (text)
  - hire_date (date)
  - is_active (boolean)
  - vacation_days_total (numeric)
  - vacation_days_used (numeric)
  - created_at, updated_at (timestamptz)

  ### time_entries
  - id (uuid, primary key)
  - employee_id (uuid, references employees)
  - clock_in (timestamptz)
  - clock_out (timestamptz, nullable)
  - break_duration (integer, minutes)
  - notes (text)
  - status (text: active, completed, edited)
  - created_at, updated_at (timestamptz)

  ### vacation_requests
  - id (uuid, primary key)
  - employee_id (uuid, references employees)
  - start_date, end_date (date)
  - days_requested (numeric)
  - request_type (text: vacation, sick, personal, unpaid)
  - status (text: pending, approved, denied, cancelled)
  - notes (text)
  - approved_by (uuid, references employees)
  - approved_at (timestamptz)
  - denial_reason (text)
  - created_at, updated_at (timestamptz)

  ### work_schedules
  - id (uuid, primary key)
  - employee_id (uuid, references employees)
  - day_of_week (integer, 0-6)
  - start_time, end_time (time)
  - is_working_day (boolean)
  - created_at, updated_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can access own data
  - Admins can access all data
*/

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  employee_number text UNIQUE,
  phone text,
  hire_date date,
  is_active boolean NOT NULL DEFAULT true,
  vacation_days_total numeric(5,2) NOT NULL DEFAULT 0,
  vacation_days_used numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  break_duration integer DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'edited')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric(5,2) NOT NULL,
  request_type text NOT NULL DEFAULT 'vacation' CHECK (request_type IN ('vacation', 'sick', 'personal', 'unpaid')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  notes text,
  approved_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  denial_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_working_day boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee_id ON vacation_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_id ON work_schedules(employee_id);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own employee record"
  ON employees FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all time entries"
  ON time_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

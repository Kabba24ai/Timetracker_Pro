/*
  # Time Tracking System - Initial Schema

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `first_name` (text)
      - `last_name` (text)
      - `role` (text) - 'admin' or 'employee'
      - `employee_number` (text, unique)
      - `phone` (text)
      - `hire_date` (date)
      - `is_active` (boolean)
      - `vacation_days_total` (numeric)
      - `vacation_days_used` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `time_entries`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `clock_in` (timestamptz)
      - `clock_out` (timestamptz)
      - `break_duration` (integer) - in minutes
      - `notes` (text)
      - `status` (text) - 'active', 'completed', 'edited'
      - `total_hours` (numeric, computed)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `vacation_requests`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `start_date` (date)
      - `end_date` (date)
      - `days_requested` (numeric)
      - `request_type` (text) - 'vacation', 'sick', 'personal', 'unpaid'
      - `status` (text) - 'pending', 'approved', 'denied', 'cancelled'
      - `notes` (text)
      - `approved_by` (uuid, foreign key)
      - `approved_at` (timestamptz)
      - `denial_reason` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `work_schedules`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `day_of_week` (integer) - 0=Sunday, 6=Saturday
      - `start_time` (time)
      - `end_time` (time)
      - `is_working_day` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Employees can read their own data
    - Admins can read all data
    - Employees can create their own time entries
    - Only admins can manage employees and approve vacation requests

  3. Functions
    - Auto-update updated_at timestamp
    - Calculate total hours for time entries
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  employee_number text UNIQUE,
  phone text,
  hire_date date,
  is_active boolean NOT NULL DEFAULT true,
  vacation_days_total numeric(5,2) NOT NULL DEFAULT 0.00,
  vacation_days_used numeric(5,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'employee'))
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  break_duration integer DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active',
  total_hours numeric(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'edited'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);

-- Create vacation_requests table
CREATE TABLE IF NOT EXISTS vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric(5,2) NOT NULL,
  request_type text NOT NULL DEFAULT 'vacation',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  approved_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  denial_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_request_type CHECK (request_type IN ('vacation', 'sick', 'personal', 'unpaid')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'denied', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee_id ON vacation_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON vacation_requests(start_date, end_date);

-- Create work_schedules table
CREATE TABLE IF NOT EXISTS work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_working_day boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT unique_employee_day UNIQUE (employee_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_id ON work_schedules(employee_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vacation_requests_updated_at ON vacation_requests;
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON vacation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_schedules_updated_at ON work_schedules;
CREATE TRIGGER update_work_schedules_updated_at BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate total hours for time entries
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_hours := ROUND(
      (EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) - (COALESCE(NEW.break_duration, 0) * 60)) / 3600,
      2
    );
  ELSE
    NEW.total_hours := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_time_entry_hours ON time_entries;
CREATE TRIGGER calculate_time_entry_hours BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION calculate_total_hours();

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

-- Policies for employees table
CREATE POLICY "Users can view their own employee record"
  ON employees FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Admins can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Policies for time_entries table
CREATE POLICY "Employees can view their own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Employees can create their own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update their own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Policies for vacation_requests table
CREATE POLICY "Employees can view their own vacation requests"
  ON vacation_requests FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all vacation requests"
  ON vacation_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Employees can create their own vacation requests"
  ON vacation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update their pending vacation requests"
  ON vacation_requests FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update all vacation requests"
  ON vacation_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Policies for work_schedules table
CREATE POLICY "Employees can view their own schedules"
  ON work_schedules FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all schedules"
  ON work_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage schedules"
  ON work_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

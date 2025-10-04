/*
  # Attendance Tracking and Achievement System

  1. New Tables
    - `attendance_records`
      - Tracks daily attendance status (present, late, missed)
      - Links to employees and time entries
      - Stores check-in time and tardiness calculation
    
    - `achievement_goals`
      - Configurable achievement tiers (Gold, Silver, Bronze, Sad, Angry)
      - Admin-defined thresholds for days missed/late
      - Trophy/icon assignments
    
    - `monthly_attendance_summary`
      - Pre-calculated monthly statistics per employee
      - Days missed, days late counts
      - Achievement earned for the month

  2. Security
    - Enable RLS on all tables
    - Employees can view their own records
    - Admins can view and manage all records

  3. Functions
    - Auto-calculate attendance from time entries
    - Monthly summary generation
    - Achievement calculation based on goals
*/

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  check_in_time timestamptz,
  scheduled_start_time time,
  minutes_late integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('present', 'late', 'missed', 'excused')),
  CONSTRAINT unique_employee_date UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);

-- Achievement Goals Configuration Table
CREATE TABLE IF NOT EXISTS achievement_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_name text NOT NULL UNIQUE,
  goal_type text NOT NULL,
  display_order integer NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  days_missed_max integer,
  days_late_max integer,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_goal_type CHECK (goal_type IN ('positive', 'negative'))
);

CREATE INDEX IF NOT EXISTS idx_achievement_goals_type ON achievement_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_achievement_goals_active ON achievement_goals(is_active);

-- Monthly Attendance Summary Table
CREATE TABLE IF NOT EXISTS monthly_attendance_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  days_present integer DEFAULT 0,
  days_late integer DEFAULT 0,
  days_missed integer DEFAULT 0,
  days_excused integer DEFAULT 0,
  total_minutes_late integer DEFAULT 0,
  achievement_id uuid REFERENCES achievement_goals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT unique_employee_month UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_employee_id ON monthly_attendance_summary(employee_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_year_month ON monthly_attendance_summary(year, month);

-- Trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_achievement_goals_updated_at ON achievement_goals;
CREATE TRIGGER update_achievement_goals_updated_at BEFORE UPDATE ON achievement_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_summary_updated_at ON monthly_attendance_summary;
CREATE TRIGGER update_monthly_summary_updated_at BEFORE UPDATE ON monthly_attendance_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate attendance status from time entry
CREATE OR REPLACE FUNCTION calculate_attendance_status(
  p_employee_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_time_entry_exists boolean;
  v_clock_in_time timestamptz;
  v_scheduled_start time;
  v_minutes_late integer;
  v_status text;
BEGIN
  -- Get scheduled start time from work schedule
  SELECT start_time INTO v_scheduled_start
  FROM work_schedules
  WHERE employee_id = p_employee_id
    AND day_of_week = EXTRACT(DOW FROM p_date)
    AND is_working_day = true;

  -- If no schedule, assume 9:00 AM
  IF v_scheduled_start IS NULL THEN
    v_scheduled_start := '09:00:00'::time;
  END IF;

  -- Check if time entry exists for this date
  SELECT clock_in INTO v_clock_in_time
  FROM time_entries
  WHERE employee_id = p_employee_id
    AND DATE(clock_in) = p_date
  ORDER BY clock_in ASC
  LIMIT 1;

  IF v_clock_in_time IS NOT NULL THEN
    -- Calculate minutes late
    v_minutes_late := GREATEST(0, 
      EXTRACT(EPOCH FROM (v_clock_in_time::time - v_scheduled_start)) / 60
    );

    IF v_minutes_late > 0 THEN
      v_status := 'late';
    ELSE
      v_status := 'present';
    END IF;

    -- Insert or update attendance record
    INSERT INTO attendance_records (
      employee_id,
      attendance_date,
      status,
      check_in_time,
      scheduled_start_time,
      minutes_late
    ) VALUES (
      p_employee_id,
      p_date,
      v_status,
      v_clock_in_time,
      v_scheduled_start,
      v_minutes_late
    )
    ON CONFLICT (employee_id, attendance_date)
    DO UPDATE SET
      status = EXCLUDED.status,
      check_in_time = EXCLUDED.check_in_time,
      scheduled_start_time = EXCLUDED.scheduled_start_time,
      minutes_late = EXCLUDED.minutes_late,
      updated_at = now();
  ELSE
    -- No time entry means missed day
    INSERT INTO attendance_records (
      employee_id,
      attendance_date,
      status,
      scheduled_start_time,
      minutes_late
    ) VALUES (
      p_employee_id,
      p_date,
      'missed',
      v_scheduled_start,
      0
    )
    ON CONFLICT (employee_id, attendance_date)
    DO UPDATE SET
      status = 'missed',
      updated_at = now();
  END IF;
END;
$$;

-- Function to calculate monthly summary and achievement
CREATE OR REPLACE FUNCTION calculate_monthly_summary(
  p_employee_id uuid,
  p_year integer,
  p_month integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days_present integer;
  v_days_late integer;
  v_days_missed integer;
  v_days_excused integer;
  v_total_minutes_late integer;
  v_achievement_id uuid;
  v_summary_id uuid;
BEGIN
  -- Calculate statistics
  SELECT
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'late'),
    COUNT(*) FILTER (WHERE status = 'missed'),
    COUNT(*) FILTER (WHERE status = 'excused'),
    COALESCE(SUM(minutes_late), 0)
  INTO
    v_days_present,
    v_days_late,
    v_days_missed,
    v_days_excused,
    v_total_minutes_late
  FROM attendance_records
  WHERE employee_id = p_employee_id
    AND EXTRACT(YEAR FROM attendance_date) = p_year
    AND EXTRACT(MONTH FROM attendance_date) = p_month;

  -- Determine achievement (positive goals take priority over negative)
  SELECT id INTO v_achievement_id
  FROM achievement_goals
  WHERE is_active = true
    AND (
      (goal_type = 'positive' AND days_missed_max >= v_days_missed AND days_late_max >= v_days_late)
      OR
      (goal_type = 'negative' AND (days_missed_max <= v_days_missed OR days_late_max <= v_days_late))
    )
  ORDER BY goal_type ASC, display_order ASC
  LIMIT 1;

  -- Insert or update summary
  INSERT INTO monthly_attendance_summary (
    employee_id,
    year,
    month,
    days_present,
    days_late,
    days_missed,
    days_excused,
    total_minutes_late,
    achievement_id
  ) VALUES (
    p_employee_id,
    p_year,
    p_month,
    v_days_present,
    v_days_late,
    v_days_missed,
    v_days_excused,
    v_total_minutes_late,
    v_achievement_id
  )
  ON CONFLICT (employee_id, year, month)
  DO UPDATE SET
    days_present = EXCLUDED.days_present,
    days_late = EXCLUDED.days_late,
    days_missed = EXCLUDED.days_missed,
    days_excused = EXCLUDED.days_excused,
    total_minutes_late = EXCLUDED.total_minutes_late,
    achievement_id = EXCLUDED.achievement_id,
    updated_at = now()
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

-- Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_attendance_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attendance_records
CREATE POLICY "Employees can view their own attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage attendance"
  ON attendance_records FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies for achievement_goals
CREATE POLICY "Everyone can view active achievement goals"
  ON achievement_goals FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage achievement goals"
  ON achievement_goals FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies for monthly_attendance_summary
CREATE POLICY "Employees can view their own summary"
  ON monthly_attendance_summary FOR SELECT
  TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all summaries"
  ON monthly_attendance_summary FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage summaries"
  ON monthly_attendance_summary FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Insert default achievement goals
INSERT INTO achievement_goals (goal_name, goal_type, display_order, icon, color, days_missed_max, days_late_max, description)
VALUES
  ('Gold Trophy', 'positive', 1, '🏆', '#FFD700', 0, 0, 'Perfect attendance - Zero days missed, zero days late'),
  ('Silver Trophy', 'positive', 2, '🥈', '#C0C0C0', 0, 1, 'Excellent attendance - Zero days missed, 1 day late'),
  ('Bronze Trophy', 'positive', 3, '🥉', '#CD7F32', 0, 2, 'Great attendance - Zero days missed, 2 days late'),
  ('Sad Face', 'negative', 4, '😞', '#FFA500', 2, 5, 'Needs improvement - 2 days missed or 5 days late'),
  ('Angry Face', 'negative', 5, '😠', '#FF0000', 3, 8, 'Poor attendance - 3 days missed or 8 days late')
ON CONFLICT (goal_name) DO NOTHING;

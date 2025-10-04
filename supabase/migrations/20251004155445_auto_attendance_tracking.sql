/*
  # Auto-Calculate Attendance from Time Entries

  1. Function
    - Trigger that automatically creates/updates attendance records when time entries are added
    - Calculates if employee was late based on work schedule
    - Updates monthly summaries automatically

  2. Implementation
    - Trigger on time_entries INSERT/UPDATE
    - Calls calculate_attendance_status function
    - Then recalculates monthly summary
*/

-- Create trigger function to auto-calculate attendance
CREATE OR REPLACE FUNCTION auto_calculate_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate attendance for the day of the clock in
  PERFORM calculate_attendance_status(
    NEW.employee_id,
    DATE(NEW.clock_in)
  );

  -- If clock out is set, recalculate monthly summary
  IF NEW.clock_out IS NOT NULL THEN
    PERFORM calculate_monthly_summary(
      NEW.employee_id,
      EXTRACT(YEAR FROM NEW.clock_in)::integer,
      EXTRACT(MONTH FROM NEW.clock_in)::integer
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on time_entries
DROP TRIGGER IF EXISTS trigger_auto_attendance ON time_entries;
CREATE TRIGGER trigger_auto_attendance
  AFTER INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_attendance();

-- Function to mark missed days (should be run daily via cron or scheduled job)
CREATE OR REPLACE FUNCTION mark_missed_attendance_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee RECORD;
  v_date date;
  v_has_entry boolean;
BEGIN
  -- Get yesterday's date
  v_date := CURRENT_DATE - INTERVAL '1 day';

  -- Loop through active employees
  FOR v_employee IN 
    SELECT e.id, ws.day_of_week
    FROM employees e
    LEFT JOIN work_schedules ws ON e.id = ws.employee_id 
      AND ws.day_of_week = EXTRACT(DOW FROM v_date)
      AND ws.is_working_day = true
    WHERE e.is_active = true
  LOOP
    -- Check if employee has time entry for yesterday
    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE employee_id = v_employee.id
        AND DATE(clock_in) = v_date
    ) INTO v_has_entry;

    -- If no time entry and it was a working day, mark as missed
    IF NOT v_has_entry AND v_employee.day_of_week IS NOT NULL THEN
      PERFORM calculate_attendance_status(v_employee.id, v_date);
      
      -- Recalculate monthly summary
      PERFORM calculate_monthly_summary(
        v_employee.id,
        EXTRACT(YEAR FROM v_date)::integer,
        EXTRACT(MONTH FROM v_date)::integer
      );
    END IF;
  END LOOP;
END;
$$;

-- Helper function to recalculate all summaries for current month
CREATE OR REPLACE FUNCTION recalculate_current_month_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee RECORD;
  v_year integer;
  v_month integer;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;

  FOR v_employee IN 
    SELECT id FROM employees WHERE is_active = true
  LOOP
    PERFORM calculate_monthly_summary(
      v_employee.id,
      v_year,
      v_month
    );
  END LOOP;
END;
$$;

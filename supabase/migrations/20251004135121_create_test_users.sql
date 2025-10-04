/*
  # Create Test Users and Employees

  1. Creates Test Auth Users
    - Admin user: admin@example.com / password
    - Employee user: employee@example.com / password

  2. Creates Employee Records
    - Links auth users to employee records
    - Sets up roles and basic information

  Note: This uses a function to safely create users via the Supabase API
*/

-- Function to create a user and employee record
CREATE OR REPLACE FUNCTION create_test_user_and_employee(
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_employee_number text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_employee_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    -- Create auth user (Note: In production, use Supabase Auth API)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- Check if employee record exists
  SELECT id INTO v_employee_id FROM employees WHERE user_id = v_user_id;
  
  IF v_employee_id IS NULL THEN
    -- Create employee record
    INSERT INTO employees (
      user_id,
      email,
      first_name,
      last_name,
      role,
      employee_number,
      hire_date,
      vacation_days_total,
      is_active
    ) VALUES (
      v_user_id,
      p_email,
      p_first_name,
      p_last_name,
      p_role,
      p_employee_number,
      CURRENT_DATE,
      20.00,
      true
    )
    RETURNING id INTO v_employee_id;
  END IF;

  RETURN v_employee_id;
END;
$$;

-- Create admin user
SELECT create_test_user_and_employee(
  'admin@example.com',
  'password',
  'Admin',
  'User',
  'admin',
  'EMP001'
);

-- Create employee user
SELECT create_test_user_and_employee(
  'employee@example.com',
  'password',
  'John',
  'Doe',
  'employee',
  'EMP002'
);

-- Drop the helper function as it's no longer needed
DROP FUNCTION IF EXISTS create_test_user_and_employee;

/*
  # Fix RLS Policies - Remove Infinite Recursion

  1. Problem
    - Current policies have infinite recursion when checking admin role
    - Admin check queries employees table, which triggers the same policy

  2. Solution
    - Simplify policies to avoid self-referencing queries
    - Allow users to view their own record without checking admin status
    - Create a separate function to check admin status that bypasses RLS
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own employee record" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON employees;
DROP POLICY IF EXISTS "Admins can update employees" ON employees;

-- Create a function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM employees
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Recreate policies using the helper function

-- SELECT policies
CREATE POLICY "Users can view their own employee record"
  ON employees FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (is_admin());

-- INSERT policies
CREATE POLICY "Admins can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- UPDATE policies
CREATE POLICY "Admins can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE policies (admins only)
CREATE POLICY "Admins can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (is_admin());

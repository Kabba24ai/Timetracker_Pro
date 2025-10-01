import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (employeeError) {
      return res.status(500).json({
        error: 'Failed to fetch employee data'
      });
    }

    if (!employee) {
      return res.status(404).json({
        error: 'Employee record not found'
      });
    }

    res.json({
      user: {
        id: authData.user.id,
        email: authData.user.email
      },
      employee: employee,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'An error occurred during login'
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        error: 'Failed to logout'
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'An error occurred during logout'
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employeeError) {
      return res.status(500).json({
        error: 'Failed to fetch employee data'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email
      },
      employee: employee
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({
      error: 'An error occurred checking authentication'
    });
  }
});

export default router;

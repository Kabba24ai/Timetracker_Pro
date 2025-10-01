import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!employee) {
      return res.status(404).json({
        error: 'Employee record not found'
      });
    }

    const { data: activeEntry } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'active')
      .maybeSingle();

    if (activeEntry) {
      return res.status(400).json({
        error: 'Already clocked in'
      });
    }

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .insert({
        employee_id: employee.id,
        clock_in: new Date().toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to clock in'
      });
    }

    res.json(timeEntry);
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({
      error: 'An error occurred during clock in'
    });
  }
});

router.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const { break_duration, notes } = req.body;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!employee) {
      return res.status(404).json({
        error: 'Employee record not found'
      });
    }

    const { data: activeEntry } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeEntry) {
      return res.status(400).json({
        error: 'No active clock in found'
      });
    }

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .update({
        clock_out: new Date().toISOString(),
        break_duration: break_duration || 0,
        notes: notes || null,
        status: 'completed'
      })
      .eq('id', activeEntry.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to clock out'
      });
    }

    res.json(timeEntry);
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({
      error: 'An error occurred during clock out'
    });
  }
});

router.get('/my-entries', authenticateToken, async (req, res) => {
  try {
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!employee) {
      return res.status(404).json({
        error: 'Employee record not found'
      });
    }

    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .order('clock_in', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch time entries'
      });
    }

    res.json(entries);
  } catch (error) {
    console.error('Fetch entries error:', error);
    res.status(500).json({
      error: 'An error occurred fetching time entries'
    });
  }
});

export default router;

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch employees'
      });
    }

    res.json(employees);
  } catch (error) {
    console.error('Fetch employees error:', error);
    res.status(500).json({
      error: 'An error occurred fetching employees'
    });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch employee'
      });
    }

    if (!employee) {
      return res.status(404).json({
        error: 'Employee not found'
      });
    }

    if (req.user.role !== 'admin' && req.user.id !== employee.user_id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json(employee);
  } catch (error) {
    console.error('Fetch employee error:', error);
    res.status(500).json({
      error: 'An error occurred fetching employee'
    });
  }
});

export default router;

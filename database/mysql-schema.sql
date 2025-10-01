-- ============================================================================
-- Time Tracking System - MySQL Database Schema
-- ============================================================================
-- This schema supports a comprehensive time tracking system with:
-- - Employee management with roles (admin, employee)
-- - Time clock entries (clock in/out)
-- - Vacation/PTO tracking
-- - Work schedules
-- - Reporting and analytics
-- ============================================================================

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS time_entries;
DROP TABLE IF EXISTS vacation_requests;
DROP TABLE IF EXISTS work_schedules;
DROP TABLE IF EXISTS employees;

-- ============================================================================
-- EMPLOYEES TABLE
-- ============================================================================
-- Stores employee information and authentication credentials
CREATE TABLE employees (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
    employee_number VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    hire_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    vacation_days_total DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    vacation_days_used DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_employee_number (employee_number),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TIME_ENTRIES TABLE
-- ============================================================================
-- Stores clock in/out records for employees
CREATE TABLE time_entries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    clock_in DATETIME NOT NULL,
    clock_out DATETIME NULL,
    break_duration INT UNSIGNED DEFAULT 0 COMMENT 'Break duration in minutes',
    notes TEXT,
    status ENUM('active', 'completed', 'edited') NOT NULL DEFAULT 'active',
    total_hours DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN clock_out IS NOT NULL
            THEN ROUND((TIMESTAMPDIFF(SECOND, clock_in, clock_out) - (break_duration * 60)) / 3600, 2)
            ELSE 0
        END
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_id (employee_id),
    INDEX idx_clock_in (clock_in),
    INDEX idx_clock_out (clock_out),
    INDEX idx_status (status),
    INDEX idx_employee_date (employee_id, clock_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VACATION_REQUESTS TABLE
-- ============================================================================
-- Stores vacation/PTO requests and approvals
CREATE TABLE vacation_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested DECIMAL(5,2) NOT NULL,
    request_type ENUM('vacation', 'sick', 'personal', 'unpaid') NOT NULL DEFAULT 'vacation',
    status ENUM('pending', 'approved', 'denied', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
    approved_by INT UNSIGNED NULL,
    approved_at DATETIME NULL,
    denial_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_employee_id (employee_id),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_request_type (request_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- WORK_SCHEDULES TABLE
-- ============================================================================
-- Stores employee work schedules
CREATE TABLE work_schedules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    day_of_week TINYINT NOT NULL COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_working_day BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_id (employee_id),
    INDEX idx_day_of_week (day_of_week),
    UNIQUE KEY unique_employee_day (employee_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Create admin user (password: admin123 - you should hash this properly)
-- Note: Use Laravel's bcrypt() or Hash::make() to generate proper password hashes
INSERT INTO employees (
    email,
    password_hash,
    first_name,
    last_name,
    role,
    employee_number,
    hire_date,
    vacation_days_total
) VALUES (
    'admin@example.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Admin',
    'User',
    'admin',
    'EMP001',
    CURDATE(),
    20.00
);

-- Create sample employee (password: employee123)
INSERT INTO employees (
    email,
    password_hash,
    first_name,
    last_name,
    role,
    employee_number,
    hire_date,
    vacation_days_total
) VALUES (
    'employee@example.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'John',
    'Doe',
    'employee',
    'EMP002',
    CURDATE(),
    15.00
);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View for current active time entries
CREATE OR REPLACE VIEW active_time_entries AS
SELECT
    te.id,
    te.employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.employee_number,
    te.clock_in,
    te.notes,
    TIMESTAMPDIFF(SECOND, te.clock_in, NOW()) / 3600 AS hours_elapsed
FROM time_entries te
JOIN employees e ON te.employee_id = e.id
WHERE te.clock_out IS NULL AND te.status = 'active';

-- View for daily time summaries
CREATE OR REPLACE VIEW daily_time_summary AS
SELECT
    DATE(te.clock_in) AS work_date,
    te.employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    COUNT(*) AS entry_count,
    SUM(te.total_hours) AS total_hours,
    SUM(te.break_duration) AS total_break_minutes
FROM time_entries te
JOIN employees e ON te.employee_id = e.id
WHERE te.clock_out IS NOT NULL
GROUP BY DATE(te.clock_in), te.employee_id, e.first_name, e.last_name;

-- View for vacation balances
CREATE OR REPLACE VIEW vacation_balances AS
SELECT
    e.id AS employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.vacation_days_total,
    e.vacation_days_used,
    (e.vacation_days_total - e.vacation_days_used) AS vacation_days_remaining,
    COUNT(vr.id) AS pending_requests
FROM employees e
LEFT JOIN vacation_requests vr ON e.id = vr.employee_id AND vr.status = 'pending'
WHERE e.is_active = TRUE
GROUP BY e.id, e.first_name, e.last_name, e.vacation_days_total, e.vacation_days_used;

-- ============================================================================
-- USEFUL QUERIES FOR YOUR LARAVEL API
-- ============================================================================

-- Get employee with current time entry status
-- SELECT e.*,
--        te.id as active_entry_id,
--        te.clock_in as current_clock_in
-- FROM employees e
-- LEFT JOIN time_entries te ON e.id = te.employee_id
--     AND te.clock_out IS NULL
--     AND te.status = 'active'
-- WHERE e.id = ?;

-- Get time entries for a date range
-- SELECT te.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
-- FROM time_entries te
-- JOIN employees e ON te.employee_id = e.id
-- WHERE te.clock_in BETWEEN ? AND ?
-- ORDER BY te.clock_in DESC;

-- Get pending vacation requests
-- SELECT vr.*,
--        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
--        e.employee_number
-- FROM vacation_requests vr
-- JOIN employees e ON vr.employee_id = e.id
-- WHERE vr.status = 'pending'
-- ORDER BY vr.created_at ASC;

-- ============================================================================
-- STORED PROCEDURES (Optional but useful)
-- ============================================================================

DELIMITER //

-- Procedure to clock in an employee
CREATE PROCEDURE clock_in_employee(
    IN p_employee_id INT,
    IN p_notes TEXT
)
BEGIN
    -- Check if employee already has an active entry
    IF EXISTS (
        SELECT 1 FROM time_entries
        WHERE employee_id = p_employee_id
        AND clock_out IS NULL
        AND status = 'active'
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Employee already has an active time entry';
    ELSE
        INSERT INTO time_entries (employee_id, clock_in, notes, status)
        VALUES (p_employee_id, NOW(), p_notes, 'active');

        SELECT LAST_INSERT_ID() as entry_id;
    END IF;
END //

-- Procedure to clock out an employee
CREATE PROCEDURE clock_out_employee(
    IN p_employee_id INT,
    IN p_break_duration INT
)
BEGIN
    DECLARE v_entry_id INT;

    -- Find active entry
    SELECT id INTO v_entry_id
    FROM time_entries
    WHERE employee_id = p_employee_id
    AND clock_out IS NULL
    AND status = 'active'
    LIMIT 1;

    IF v_entry_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No active time entry found for employee';
    ELSE
        UPDATE time_entries
        SET clock_out = NOW(),
            break_duration = p_break_duration,
            status = 'completed'
        WHERE id = v_entry_id;

        SELECT v_entry_id as entry_id;
    END IF;
END //

DELIMITER ;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

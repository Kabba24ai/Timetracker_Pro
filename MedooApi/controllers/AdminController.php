<?php

namespace Api\Controllers;

use Api\Utils\Database;
use Api\Utils\Response;
use Api\Middleware\Auth;

class AdminController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function getEmployees()
    {
        Auth::requireAdmin();

        $employees = $this->db->select('employees', [
            'id',
            'email',
            'first_name',
            'last_name',
            'role',
            'employee_number',
            'phone',
            'hire_date',
            'is_active',
            'vacation_days_total',
            'vacation_days_used',
            'created_at',
            'updated_at'
        ], [
            'ORDER' => ['created_at' => 'DESC']
        ]);

        foreach ($employees as &$employee) {
            $employee['vacation_days_remaining'] = $employee['vacation_days_total'] - $employee['vacation_days_used'];
        }

        Response::success($employees);
    }

    public function getEmployee()
    {
        Auth::requireAdmin();

        if (!isset($_GET['id'])) {
            Response::error('Employee ID is required', 400);
        }

        $employee = $this->db->get('employees', [
            'id',
            'email',
            'first_name',
            'last_name',
            'role',
            'employee_number',
            'phone',
            'hire_date',
            'is_active',
            'vacation_days_total',
            'vacation_days_used',
            'created_at',
            'updated_at'
        ], [
            'id' => $_GET['id']
        ]);

        if (!$employee) {
            Response::error('Employee not found', 404);
        }

        $employee['vacation_days_remaining'] = $employee['vacation_days_total'] - $employee['vacation_days_used'];

        Response::success($employee);
    }

    public function createEmployee()
    {
        Auth::requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['email', 'password', 'first_name', 'last_name'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                Response::error("Field '$field' is required", 400);
            }
        }

        $existing = $this->db->get('employees', 'id', ['email' => $data['email']]);
        if ($existing) {
            Response::error('Email already exists', 400);
        }

        $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT);

        $insertData = [
            'email' => $data['email'],
            'password_hash' => $passwordHash,
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'role' => $data['role'] ?? 'employee',
            'employee_number' => $data['employee_number'] ?? null,
            'phone' => $data['phone'] ?? null,
            'hire_date' => $data['hire_date'] ?? date('Y-m-d'),
            'vacation_days_total' => $data['vacation_days_total'] ?? 0,
            'is_active' => $data['is_active'] ?? true
        ];

        $this->db->insert('employees', $insertData);
        $employeeId = $this->db->id();

        $employee = $this->db->get('employees', [
            'id',
            'email',
            'first_name',
            'last_name',
            'role',
            'employee_number',
            'phone',
            'hire_date',
            'is_active',
            'vacation_days_total',
            'vacation_days_used',
            'created_at',
            'updated_at'
        ], ['id' => $employeeId]);

        Response::success($employee, 'Employee created successfully', 201);
    }

    public function updateEmployee()
    {
        Auth::requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Employee ID is required', 400);
        }

        $employee = $this->db->get('employees', 'id', ['id' => $data['id']]);
        if (!$employee) {
            Response::error('Employee not found', 404);
        }

        $updateData = [];
        if (isset($data['email'])) {
            $existing = $this->db->get('employees', 'id', [
                'email' => $data['email'],
                'id[!]' => $data['id']
            ]);
            if ($existing) {
                Response::error('Email already exists', 400);
            }
            $updateData['email'] = $data['email'];
        }

        if (isset($data['password']) && !empty($data['password'])) {
            $updateData['password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (isset($data['first_name'])) $updateData['first_name'] = $data['first_name'];
        if (isset($data['last_name'])) $updateData['last_name'] = $data['last_name'];
        if (isset($data['role'])) $updateData['role'] = $data['role'];
        if (isset($data['employee_number'])) $updateData['employee_number'] = $data['employee_number'];
        if (isset($data['phone'])) $updateData['phone'] = $data['phone'];
        if (isset($data['hire_date'])) $updateData['hire_date'] = $data['hire_date'];
        if (isset($data['vacation_days_total'])) $updateData['vacation_days_total'] = $data['vacation_days_total'];
        if (isset($data['is_active'])) $updateData['is_active'] = $data['is_active'];

        if (!empty($updateData)) {
            $this->db->update('employees', $updateData, ['id' => $data['id']]);
        }

        $updatedEmployee = $this->db->get('employees', [
            'id',
            'email',
            'first_name',
            'last_name',
            'role',
            'employee_number',
            'phone',
            'hire_date',
            'is_active',
            'vacation_days_total',
            'vacation_days_used',
            'created_at',
            'updated_at'
        ], ['id' => $data['id']]);

        Response::success($updatedEmployee, 'Employee updated successfully');
    }

    public function deleteEmployee()
    {
        Auth::requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Employee ID is required', 400);
        }

        $employee = $this->db->get('employees', 'id', ['id' => $data['id']]);
        if (!$employee) {
            Response::error('Employee not found', 404);
        }

        $this->db->delete('employees', ['id' => $data['id']]);

        Response::success(null, 'Employee deleted successfully');
    }

    public function getAllTimeEntries()
    {
        Auth::requireAdmin();

        $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $_GET['end_date'] ?? date('Y-m-d');
        $employeeId = $_GET['employee_id'] ?? null;

        $where = [
            'clock_in[>=]' => $startDate . ' 00:00:00',
            'clock_in[<=]' => $endDate . ' 23:59:59',
            'ORDER' => ['clock_in' => 'DESC']
        ];

        if ($employeeId) {
            $where['employee_id'] = $employeeId;
        }

        $entries = $this->db->select('time_entries', '*', $where);

        foreach ($entries as &$entry) {
            $employee = $this->db->get('employees', [
                'first_name',
                'last_name',
                'employee_number'
            ], [
                'id' => $entry['employee_id']
            ]);
            $entry['employee_name'] = $employee['first_name'] . ' ' . $employee['last_name'];
            $entry['employee_number'] = $employee['employee_number'];
        }

        Response::success($entries);
    }

    public function getAllVacationRequests()
    {
        Auth::requireAdmin();

        $status = $_GET['status'] ?? null;

        $where = ['ORDER' => ['created_at' => 'DESC']];

        if ($status) {
            $where['status'] = $status;
        }

        $requests = $this->db->select('vacation_requests', '*', $where);

        foreach ($requests as &$request) {
            $employee = $this->db->get('employees', [
                'first_name',
                'last_name',
                'employee_number'
            ], [
                'id' => $request['employee_id']
            ]);
            $request['employee_name'] = $employee['first_name'] . ' ' . $employee['last_name'];
            $request['employee_number'] = $employee['employee_number'];

            if ($request['approved_by']) {
                $approver = $this->db->get('employees', [
                    'first_name',
                    'last_name'
                ], [
                    'id' => $request['approved_by']
                ]);
                $request['approved_by_name'] = $approver['first_name'] . ' ' . $approver['last_name'];
            }
        }

        Response::success($requests);
    }

    public function approveVacation()
    {
        $admin = Auth::requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Request ID is required', 400);
        }

        $request = $this->db->get('vacation_requests', '*', ['id' => $data['id']]);

        if (!$request) {
            Response::error('Request not found', 404);
        }

        if ($request['status'] !== 'pending') {
            Response::error('Can only approve pending requests', 400);
        }

        $this->db->update('vacation_requests', [
            'status' => 'approved',
            'approved_by' => $admin['id'],
            'approved_at' => date('Y-m-d H:i:s')
        ], [
            'id' => $data['id']
        ]);

        $this->db->update('employees', [
            'vacation_days_used[+]' => $request['days_requested']
        ], [
            'id' => $request['employee_id']
        ]);

        $updatedRequest = $this->db->get('vacation_requests', '*', ['id' => $data['id']]);

        Response::success($updatedRequest, 'Vacation request approved');
    }

    public function denyVacation()
    {
        $admin = Auth::requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Request ID is required', 400);
        }

        $request = $this->db->get('vacation_requests', '*', ['id' => $data['id']]);

        if (!$request) {
            Response::error('Request not found', 404);
        }

        if ($request['status'] !== 'pending') {
            Response::error('Can only deny pending requests', 400);
        }

        $this->db->update('vacation_requests', [
            'status' => 'denied',
            'approved_by' => $admin['id'],
            'approved_at' => date('Y-m-d H:i:s'),
            'denial_reason' => $data['denial_reason'] ?? null
        ], [
            'id' => $data['id']
        ]);

        $updatedRequest = $this->db->get('vacation_requests', '*', ['id' => $data['id']]);

        Response::success($updatedRequest, 'Vacation request denied');
    }

    public function getWorkSchedules()
    {
        Auth::requireAdmin();

        $employeeId = $_GET['employee_id'] ?? null;

        if (!$employeeId) {
            Response::error('Employee ID is required', 400);
        }

        $schedules = $this->db->select('work_schedules', '*', [
            'employee_id' => $employeeId,
            'ORDER' => ['day_of_week' => 'ASC']
        ]);

        Response::success($schedules);
    }

    public function saveWorkSchedule()
    {
        Auth::requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['employee_id', 'day_of_week', 'start_time', 'end_time'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                Response::error("Field '$field' is required", 400);
            }
        }

        $existing = $this->db->get('work_schedules', 'id', [
            'employee_id' => $data['employee_id'],
            'day_of_week' => $data['day_of_week']
        ]);

        $scheduleData = [
            'employee_id' => $data['employee_id'],
            'day_of_week' => $data['day_of_week'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'is_working_day' => $data['is_working_day'] ?? true
        ];

        if ($existing) {
            $this->db->update('work_schedules', $scheduleData, [
                'employee_id' => $data['employee_id'],
                'day_of_week' => $data['day_of_week']
            ]);
            $scheduleId = $existing;
        } else {
            $this->db->insert('work_schedules', $scheduleData);
            $scheduleId = $this->db->id();
        }

        $schedule = $this->db->get('work_schedules', '*', ['id' => $scheduleId]);

        Response::success($schedule, 'Work schedule saved successfully');
    }
}

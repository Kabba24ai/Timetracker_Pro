<?php

namespace Api\Controllers;

use Api\Utils\Database;
use Api\Utils\Response;
use Api\Utils\JWT;

class AuthController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function login()
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email']) || !isset($data['password'])) {
            Response::error('Email and password are required', 400);
        }

        $employee = $this->db->get('employees', '*', [
            'email' => $data['email'],
            'is_active' => true
        ]);

        if (!$employee || !password_verify($data['password'], $employee['password_hash'])) {
            Response::error('Invalid credentials', 401);
        }

        unset($employee['password_hash']);

        $token = JWT::encode([
            'user_id' => $employee['id'],
            'email' => $employee['email'],
            'role' => $employee['role']
        ]);

        Response::success([
            'token' => $token,
            'user' => $employee
        ], 'Login successful');
    }

    public function register()
    {
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
        ];

        $this->db->insert('employees', $insertData);
        $employeeId = $this->db->id();

        $employee = $this->db->get('employees', '*', ['id' => $employeeId]);
        unset($employee['password_hash']);

        $token = JWT::encode([
            'user_id' => $employee['id'],
            'email' => $employee['email'],
            'role' => $employee['role']
        ]);

        Response::success([
            'token' => $token,
            'user' => $employee
        ], 'Registration successful', 201);
    }

    public function me()
    {
        $token = JWT::getTokenFromHeader();

        if (!$token) {
            Response::error('Authentication required', 401);
        }

        $payload = JWT::decode($token);

        if (!$payload) {
            Response::error('Invalid or expired token', 401);
        }

        $employee = $this->db->get('employees', '*', [
            'id' => $payload['user_id'],
            'is_active' => true
        ]);

        if (!$employee) {
            Response::error('User not found', 404);
        }

        unset($employee['password_hash']);

        Response::success($employee);
    }
}

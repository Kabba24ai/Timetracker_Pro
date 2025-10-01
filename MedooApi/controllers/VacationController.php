<?php

namespace Api\Controllers;

use Api\Utils\Database;
use Api\Utils\Response;
use Api\Middleware\Auth;

class VacationController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function getBalance()
    {
        $employee = Auth::authenticate();

        $balance = $this->db->get('employees', [
            'vacation_days_total',
            'vacation_days_used'
        ], [
            'id' => $employee['id']
        ]);

        $balance['vacation_days_remaining'] = $balance['vacation_days_total'] - $balance['vacation_days_used'];

        Response::success($balance);
    }

    public function getRequests()
    {
        $employee = Auth::authenticate();

        $requests = $this->db->select('vacation_requests', '*', [
            'employee_id' => $employee['id'],
            'ORDER' => ['created_at' => 'DESC']
        ]);

        foreach ($requests as &$request) {
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

    public function createRequest()
    {
        $employee = Auth::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['start_date', 'end_date', 'days_requested'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                Response::error("Field '$field' is required", 400);
            }
        }

        $balance = $this->db->get('employees', [
            'vacation_days_total',
            'vacation_days_used'
        ], [
            'id' => $employee['id']
        ]);

        $remainingDays = $balance['vacation_days_total'] - $balance['vacation_days_used'];

        if ($data['days_requested'] > $remainingDays) {
            Response::error('Insufficient vacation days available', 400);
        }

        $insertData = [
            'employee_id' => $employee['id'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'days_requested' => $data['days_requested'],
            'request_type' => $data['request_type'] ?? 'vacation',
            'notes' => $data['notes'] ?? null,
            'status' => 'pending'
        ];

        $this->db->insert('vacation_requests', $insertData);
        $requestId = $this->db->id();

        $request = $this->db->get('vacation_requests', '*', ['id' => $requestId]);

        Response::success($request, 'Vacation request created successfully', 201);
    }

    public function updateRequest()
    {
        $employee = Auth::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Request ID is required', 400);
        }

        $request = $this->db->get('vacation_requests', '*', [
            'id' => $data['id'],
            'employee_id' => $employee['id']
        ]);

        if (!$request) {
            Response::error('Request not found', 404);
        }

        if ($request['status'] !== 'pending') {
            Response::error('Can only update pending requests', 400);
        }

        $updateData = [];
        if (isset($data['start_date'])) $updateData['start_date'] = $data['start_date'];
        if (isset($data['end_date'])) $updateData['end_date'] = $data['end_date'];
        if (isset($data['days_requested'])) $updateData['days_requested'] = $data['days_requested'];
        if (isset($data['request_type'])) $updateData['request_type'] = $data['request_type'];
        if (isset($data['notes'])) $updateData['notes'] = $data['notes'];

        if (!empty($updateData)) {
            $this->db->update('vacation_requests', $updateData, ['id' => $data['id']]);
        }

        $updatedRequest = $this->db->get('vacation_requests', '*', ['id' => $data['id']]);

        Response::success($updatedRequest, 'Request updated successfully');
    }

    public function cancelRequest()
    {
        $employee = Auth::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Request ID is required', 400);
        }

        $request = $this->db->get('vacation_requests', '*', [
            'id' => $data['id'],
            'employee_id' => $employee['id']
        ]);

        if (!$request) {
            Response::error('Request not found', 404);
        }

        if ($request['status'] === 'cancelled') {
            Response::error('Request already cancelled', 400);
        }

        $this->db->update('vacation_requests', [
            'status' => 'cancelled'
        ], [
            'id' => $data['id']
        ]);

        $updatedRequest = $this->db->get('vacation_requests', '*', ['id' => $data['id']]);

        Response::success($updatedRequest, 'Request cancelled successfully');
    }
}

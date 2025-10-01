<?php

namespace Api\Controllers;

use Api\Utils\Database;
use Api\Utils\Response;
use Api\Middleware\Auth;

class TimeClockController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function clockIn()
    {
        $employee = Auth::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $activeEntry = $this->db->get('time_entries', 'id', [
            'employee_id' => $employee['id'],
            'clock_out' => null,
            'status' => 'active'
        ]);

        if ($activeEntry) {
            Response::error('You already have an active time entry', 400);
        }

        $insertData = [
            'employee_id' => $employee['id'],
            'clock_in' => date('Y-m-d H:i:s'),
            'notes' => $data['notes'] ?? null,
            'status' => 'active'
        ];

        $this->db->insert('time_entries', $insertData);
        $entryId = $this->db->id();

        $entry = $this->db->get('time_entries', '*', ['id' => $entryId]);

        Response::success($entry, 'Clocked in successfully', 201);
    }

    public function clockOut()
    {
        $employee = Auth::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $activeEntry = $this->db->get('time_entries', '*', [
            'employee_id' => $employee['id'],
            'clock_out' => null,
            'status' => 'active'
        ]);

        if (!$activeEntry) {
            Response::error('No active time entry found', 404);
        }

        $this->db->update('time_entries', [
            'clock_out' => date('Y-m-d H:i:s'),
            'break_duration' => $data['break_duration'] ?? 0,
            'status' => 'completed'
        ], [
            'id' => $activeEntry['id']
        ]);

        $entry = $this->db->get('time_entries', '*', ['id' => $activeEntry['id']]);

        Response::success($entry, 'Clocked out successfully');
    }

    public function getActiveEntry()
    {
        $employee = Auth::authenticate();

        $activeEntry = $this->db->get('time_entries', '*', [
            'employee_id' => $employee['id'],
            'clock_out' => null,
            'status' => 'active'
        ]);

        Response::success($activeEntry);
    }

    public function getTodayEntries()
    {
        $employee = Auth::authenticate();

        $entries = $this->db->select('time_entries', '*', [
            'employee_id' => $employee['id'],
            'clock_in[>=]' => date('Y-m-d 00:00:00'),
            'clock_in[<=]' => date('Y-m-d 23:59:59'),
            'ORDER' => ['clock_in' => 'DESC']
        ]);

        Response::success($entries);
    }

    public function getEntries()
    {
        $employee = Auth::authenticate();

        $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $_GET['end_date'] ?? date('Y-m-d');

        $entries = $this->db->select('time_entries', '*', [
            'employee_id' => $employee['id'],
            'clock_in[>=]' => $startDate . ' 00:00:00',
            'clock_in[<=]' => $endDate . ' 23:59:59',
            'ORDER' => ['clock_in' => 'DESC']
        ]);

        Response::success($entries);
    }

    public function updateEntry()
    {
        $employee = Auth::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            Response::error('Entry ID is required', 400);
        }

        $entry = $this->db->get('time_entries', '*', [
            'id' => $data['id'],
            'employee_id' => $employee['id']
        ]);

        if (!$entry) {
            Response::error('Entry not found', 404);
        }

        $updateData = [];
        if (isset($data['clock_in'])) $updateData['clock_in'] = $data['clock_in'];
        if (isset($data['clock_out'])) $updateData['clock_out'] = $data['clock_out'];
        if (isset($data['break_duration'])) $updateData['break_duration'] = $data['break_duration'];
        if (isset($data['notes'])) $updateData['notes'] = $data['notes'];

        if ($entry['status'] === 'completed') {
            $updateData['status'] = 'edited';
        }

        if (!empty($updateData)) {
            $this->db->update('time_entries', $updateData, ['id' => $data['id']]);
        }

        $updatedEntry = $this->db->get('time_entries', '*', ['id' => $data['id']]);

        Response::success($updatedEntry, 'Entry updated successfully');
    }
}

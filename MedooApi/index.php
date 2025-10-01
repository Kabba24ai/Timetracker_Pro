<?php

require_once __DIR__ . '/vendor/autoload.php';

use Api\Middleware\CORS;
use Api\Utils\Response;
use Api\Controllers\AuthController;
use Api\Controllers\TimeClockController;
use Api\Controllers\VacationController;
use Api\Controllers\AdminController;

if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        putenv(trim($name) . '=' . trim($value));
    }
}

CORS::handle();

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);
$path = str_replace('/index.php', '', $path);
$path = rtrim($path, '/');

try {
    if ($path === '/api/auth/login' && $method === 'POST') {
        $controller = new AuthController();
        $controller->login();
    } elseif ($path === '/api/auth/register' && $method === 'POST') {
        $controller = new AuthController();
        $controller->register();
    } elseif ($path === '/api/auth/me' && $method === 'GET') {
        $controller = new AuthController();
        $controller->me();
    } elseif ($path === '/api/timeclock/clock-in' && $method === 'POST') {
        $controller = new TimeClockController();
        $controller->clockIn();
    } elseif ($path === '/api/timeclock/clock-out' && $method === 'POST') {
        $controller = new TimeClockController();
        $controller->clockOut();
    } elseif ($path === '/api/timeclock/active' && $method === 'GET') {
        $controller = new TimeClockController();
        $controller->getActiveEntry();
    } elseif ($path === '/api/timeclock/today' && $method === 'GET') {
        $controller = new TimeClockController();
        $controller->getTodayEntries();
    } elseif ($path === '/api/timeclock/entries' && $method === 'GET') {
        $controller = new TimeClockController();
        $controller->getEntries();
    } elseif ($path === '/api/timeclock/entries' && $method === 'PUT') {
        $controller = new TimeClockController();
        $controller->updateEntry();
    } elseif ($path === '/api/vacation/balance' && $method === 'GET') {
        $controller = new VacationController();
        $controller->getBalance();
    } elseif ($path === '/api/vacation/requests' && $method === 'GET') {
        $controller = new VacationController();
        $controller->getRequests();
    } elseif ($path === '/api/vacation/requests' && $method === 'POST') {
        $controller = new VacationController();
        $controller->createRequest();
    } elseif ($path === '/api/vacation/requests' && $method === 'PUT') {
        $controller = new VacationController();
        $controller->updateRequest();
    } elseif ($path === '/api/vacation/requests/cancel' && $method === 'POST') {
        $controller = new VacationController();
        $controller->cancelRequest();
    } elseif ($path === '/api/admin/employees' && $method === 'GET') {
        $controller = new AdminController();
        $controller->getEmployees();
    } elseif ($path === '/api/admin/employee' && $method === 'GET') {
        $controller = new AdminController();
        $controller->getEmployee();
    } elseif ($path === '/api/admin/employees' && $method === 'POST') {
        $controller = new AdminController();
        $controller->createEmployee();
    } elseif ($path === '/api/admin/employees' && $method === 'PUT') {
        $controller = new AdminController();
        $controller->updateEmployee();
    } elseif ($path === '/api/admin/employees' && $method === 'DELETE') {
        $controller = new AdminController();
        $controller->deleteEmployee();
    } elseif ($path === '/api/admin/time-entries' && $method === 'GET') {
        $controller = new AdminController();
        $controller->getAllTimeEntries();
    } elseif ($path === '/api/admin/vacation-requests' && $method === 'GET') {
        $controller = new AdminController();
        $controller->getAllVacationRequests();
    } elseif ($path === '/api/admin/vacation-requests/approve' && $method === 'POST') {
        $controller = new AdminController();
        $controller->approveVacation();
    } elseif ($path === '/api/admin/vacation-requests/deny' && $method === 'POST') {
        $controller = new AdminController();
        $controller->denyVacation();
    } elseif ($path === '/api/admin/work-schedules' && $method === 'GET') {
        $controller = new AdminController();
        $controller->getWorkSchedules();
    } elseif ($path === '/api/admin/work-schedules' && $method === 'POST') {
        $controller = new AdminController();
        $controller->saveWorkSchedule();
    } else {
        Response::error('Endpoint not found', 404);
    }
} catch (\Exception $e) {
    Response::error('Server error: ' . $e->getMessage(), 500);
}

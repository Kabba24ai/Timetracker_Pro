<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\TimeClockController;
use App\Http\Controllers\VacationController;
use App\Http\Controllers\AdminController;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('timeclock')->group(function () {
        Route::post('/clock-in', [TimeClockController::class, 'clockIn']);
        Route::post('/clock-out', [TimeClockController::class, 'clockOut']);
        Route::get('/active', [TimeClockController::class, 'getActiveEntry']);
        Route::get('/today', [TimeClockController::class, 'getTodayEntries']);
        Route::get('/entries', [TimeClockController::class, 'getEntries']);
        Route::put('/entries', [TimeClockController::class, 'updateEntry']);
    });

    Route::prefix('vacation')->group(function () {
        Route::get('/balance', [VacationController::class, 'getBalance']);
        Route::get('/requests', [VacationController::class, 'getRequests']);
        Route::post('/requests', [VacationController::class, 'createRequest']);
        Route::put('/requests', [VacationController::class, 'updateRequest']);
        Route::post('/requests/cancel', [VacationController::class, 'cancelRequest']);
    });

    Route::middleware(EnsureUserIsAdmin::class)->prefix('admin')->group(function () {
        Route::get('/employees', [AdminController::class, 'getEmployees']);
        Route::get('/employee', [AdminController::class, 'getEmployee']);
        Route::post('/employees', [AdminController::class, 'createEmployee']);
        Route::put('/employees', [AdminController::class, 'updateEmployee']);
        Route::delete('/employees', [AdminController::class, 'deleteEmployee']);

        Route::get('/time-entries', [AdminController::class, 'getAllTimeEntries']);

        Route::get('/vacation-requests', [AdminController::class, 'getAllVacationRequests']);
        Route::post('/vacation-requests/approve', [AdminController::class, 'approveVacation']);
        Route::post('/vacation-requests/deny', [AdminController::class, 'denyVacation']);

        Route::get('/work-schedules', [AdminController::class, 'getWorkSchedules']);
        Route::post('/work-schedules', [AdminController::class, 'saveWorkSchedule']);
    });
});

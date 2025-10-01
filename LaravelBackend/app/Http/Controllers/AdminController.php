<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\TimeEntry;
use App\Models\VacationRequest;
use App\Models\WorkSchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    public function getEmployees()
    {
        $employees = Employee::orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $employees->makeHidden(['password']),
        ]);
    }

    public function getEmployee(Request $request)
    {
        $request->validate([
            'id' => 'required|exists:employees,id',
        ]);

        $employee = Employee::findOrFail($request->id);

        return response()->json([
            'success' => true,
            'data' => $employee->makeHidden(['password']),
        ]);
    }

    public function createEmployee(Request $request)
    {
        $request->validate([
            'email' => 'required|email|unique:employees',
            'password' => 'required|min:6',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'role' => 'sometimes|in:admin,employee',
            'employee_number' => 'sometimes|string|unique:employees',
            'phone' => 'sometimes|string|max:20',
            'hire_date' => 'sometimes|date',
            'vacation_days_total' => 'sometimes|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $employee = Employee::create([
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'role' => $request->role ?? 'employee',
            'employee_number' => $request->employee_number,
            'phone' => $request->phone,
            'hire_date' => $request->hire_date ?? now()->toDateString(),
            'vacation_days_total' => $request->vacation_days_total ?? 0,
            'is_active' => $request->is_active ?? true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Employee created successfully',
            'data' => $employee->makeHidden(['password']),
        ], 201);
    }

    public function updateEmployee(Request $request)
    {
        $request->validate([
            'id' => 'required|exists:employees,id',
            'email' => 'sometimes|email|unique:employees,email,' . $request->id,
            'password' => 'sometimes|min:6',
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'role' => 'sometimes|in:admin,employee',
            'employee_number' => 'sometimes|string|unique:employees,employee_number,' . $request->id,
            'phone' => 'sometimes|string|max:20',
            'hire_date' => 'sometimes|date',
            'vacation_days_total' => 'sometimes|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $employee = Employee::findOrFail($request->id);

        $updateData = $request->only([
            'email',
            'first_name',
            'last_name',
            'role',
            'employee_number',
            'phone',
            'hire_date',
            'vacation_days_total',
            'is_active',
        ]);

        if ($request->filled('password')) {
            $updateData['password'] = Hash::make($request->password);
        }

        $employee->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Employee updated successfully',
            'data' => $employee->fresh()->makeHidden(['password']),
        ]);
    }

    public function deleteEmployee(Request $request)
    {
        $request->validate([
            'id' => 'required|exists:employees,id',
        ]);

        $employee = Employee::findOrFail($request->id);
        $employee->delete();

        return response()->json([
            'success' => true,
            'message' => 'Employee deleted successfully',
        ]);
    }

    public function getAllTimeEntries(Request $request)
    {
        $request->validate([
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
            'employee_id' => 'sometimes|exists:employees,id',
        ]);

        $query = TimeEntry::with('employee:id,first_name,last_name,employee_number');

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->dateRange($request->start_date, $request->end_date);
        } else {
            $query->dateRange(now()->subDays(30), now());
        }

        if ($request->filled('employee_id')) {
            $query->forEmployee($request->employee_id);
        }

        $entries = $query->orderBy('clock_in', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $entries,
        ]);
    }

    public function getAllVacationRequests(Request $request)
    {
        $request->validate([
            'status' => 'sometimes|in:pending,approved,denied,cancelled',
        ]);

        $query = VacationRequest::with([
            'employee:id,first_name,last_name,employee_number',
            'approver:id,first_name,last_name'
        ]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $requests = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $requests,
        ]);
    }

    public function approveVacation(Request $request)
    {
        $admin = $request->user();

        $request->validate([
            'id' => 'required|exists:vacation_requests,id',
        ]);

        $vacationRequest = VacationRequest::findOrFail($request->id);

        if ($vacationRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'error' => ['Can only approve pending requests'],
            ]);
        }

        $vacationRequest->approve($admin->id);

        return response()->json([
            'success' => true,
            'message' => 'Vacation request approved',
            'data' => $vacationRequest->fresh(),
        ]);
    }

    public function denyVacation(Request $request)
    {
        $admin = $request->user();

        $request->validate([
            'id' => 'required|exists:vacation_requests,id',
            'denial_reason' => 'sometimes|string',
        ]);

        $vacationRequest = VacationRequest::findOrFail($request->id);

        if ($vacationRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'error' => ['Can only deny pending requests'],
            ]);
        }

        $vacationRequest->deny($admin->id, $request->denial_reason);

        return response()->json([
            'success' => true,
            'message' => 'Vacation request denied',
            'data' => $vacationRequest->fresh(),
        ]);
    }

    public function getWorkSchedules(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|exists:employees,id',
        ]);

        $schedules = WorkSchedule::forEmployee($request->employee_id)
            ->orderBy('day_of_week')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $schedules,
        ]);
    }

    public function saveWorkSchedule(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'day_of_week' => 'required|integer|between:0,6',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'is_working_day' => 'sometimes|boolean',
        ]);

        $schedule = WorkSchedule::updateOrCreate(
            [
                'employee_id' => $request->employee_id,
                'day_of_week' => $request->day_of_week,
            ],
            [
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'is_working_day' => $request->is_working_day ?? true,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Work schedule saved successfully',
            'data' => $schedule,
        ]);
    }
}

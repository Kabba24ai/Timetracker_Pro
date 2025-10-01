<?php

namespace App\Http\Controllers;

use App\Models\TimeEntry;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TimeClockController extends Controller
{
    public function clockIn(Request $request)
    {
        $employee = $request->user();

        if ($employee->getActiveTimeEntry()) {
            throw ValidationException::withMessages([
                'error' => ['You already have an active time entry'],
            ]);
        }

        $request->validate([
            'notes' => 'sometimes|string',
        ]);

        $entry = TimeEntry::create([
            'employee_id' => $employee->id,
            'clock_in' => now(),
            'notes' => $request->notes,
            'status' => 'active',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Clocked in successfully',
            'data' => $entry,
        ], 201);
    }

    public function clockOut(Request $request)
    {
        $employee = $request->user();
        $activeEntry = $employee->getActiveTimeEntry();

        if (!$activeEntry) {
            throw ValidationException::withMessages([
                'error' => ['No active time entry found'],
            ]);
        }

        $request->validate([
            'break_duration' => 'sometimes|integer|min:0',
        ]);

        $activeEntry->update([
            'clock_out' => now(),
            'break_duration' => $request->break_duration ?? 0,
            'status' => 'completed',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Clocked out successfully',
            'data' => $activeEntry->fresh(),
        ]);
    }

    public function getActiveEntry(Request $request)
    {
        $employee = $request->user();
        $activeEntry = $employee->getActiveTimeEntry();

        return response()->json([
            'success' => true,
            'data' => $activeEntry,
        ]);
    }

    public function getTodayEntries(Request $request)
    {
        $employee = $request->user();

        $entries = TimeEntry::forEmployee($employee->id)
            ->today()
            ->orderBy('clock_in', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $entries,
        ]);
    }

    public function getEntries(Request $request)
    {
        $employee = $request->user();

        $request->validate([
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
        ]);

        $startDate = $request->start_date ?? now()->subDays(30)->startOfDay();
        $endDate = $request->end_date ?? now()->endOfDay();

        $entries = TimeEntry::forEmployee($employee->id)
            ->dateRange($startDate, $endDate)
            ->orderBy('clock_in', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $entries,
        ]);
    }

    public function updateEntry(Request $request)
    {
        $employee = $request->user();

        $request->validate([
            'id' => 'required|exists:time_entries,id',
            'clock_in' => 'sometimes|date',
            'clock_out' => 'sometimes|date|nullable',
            'break_duration' => 'sometimes|integer|min:0',
            'notes' => 'sometimes|string|nullable',
        ]);

        $entry = TimeEntry::where('id', $request->id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        $updateData = $request->only(['clock_in', 'clock_out', 'break_duration', 'notes']);

        if ($entry->status === 'completed' && count($updateData) > 0) {
            $updateData['status'] = 'edited';
        }

        $entry->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Entry updated successfully',
            'data' => $entry->fresh(),
        ]);
    }
}

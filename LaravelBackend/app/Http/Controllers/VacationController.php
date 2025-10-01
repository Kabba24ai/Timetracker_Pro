<?php

namespace App\Http\Controllers;

use App\Models\VacationRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class VacationController extends Controller
{
    public function getBalance(Request $request)
    {
        $employee = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'vacation_days_total' => $employee->vacation_days_total,
                'vacation_days_used' => $employee->vacation_days_used,
                'vacation_days_remaining' => $employee->vacation_days_remaining,
            ],
        ]);
    }

    public function getRequests(Request $request)
    {
        $employee = $request->user();

        $requests = VacationRequest::forEmployee($employee->id)
            ->with('approver:id,first_name,last_name')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $requests,
        ]);
    }

    public function createRequest(Request $request)
    {
        $employee = $request->user();

        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'days_requested' => 'required|numeric|min:0.5',
            'request_type' => 'sometimes|in:vacation,sick,personal,unpaid',
            'notes' => 'sometimes|string',
        ]);

        if ($request->days_requested > $employee->vacation_days_remaining) {
            throw ValidationException::withMessages([
                'days_requested' => ['Insufficient vacation days available'],
            ]);
        }

        $vacationRequest = VacationRequest::create([
            'employee_id' => $employee->id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'days_requested' => $request->days_requested,
            'request_type' => $request->request_type ?? 'vacation',
            'notes' => $request->notes,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Vacation request created successfully',
            'data' => $vacationRequest,
        ], 201);
    }

    public function updateRequest(Request $request)
    {
        $employee = $request->user();

        $request->validate([
            'id' => 'required|exists:vacation_requests,id',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
            'days_requested' => 'sometimes|numeric|min:0.5',
            'request_type' => 'sometimes|in:vacation,sick,personal,unpaid',
            'notes' => 'sometimes|string',
        ]);

        $vacationRequest = VacationRequest::where('id', $request->id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        if ($vacationRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'error' => ['Can only update pending requests'],
            ]);
        }

        $vacationRequest->update($request->only([
            'start_date',
            'end_date',
            'days_requested',
            'request_type',
            'notes',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Request updated successfully',
            'data' => $vacationRequest->fresh(),
        ]);
    }

    public function cancelRequest(Request $request)
    {
        $employee = $request->user();

        $request->validate([
            'id' => 'required|exists:vacation_requests,id',
        ]);

        $vacationRequest = VacationRequest::where('id', $request->id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        if ($vacationRequest->status === 'cancelled') {
            throw ValidationException::withMessages([
                'error' => ['Request already cancelled'],
            ]);
        }

        $vacationRequest->cancel();

        return response()->json([
            'success' => true,
            'message' => 'Request cancelled successfully',
            'data' => $vacationRequest->fresh(),
        ]);
    }
}

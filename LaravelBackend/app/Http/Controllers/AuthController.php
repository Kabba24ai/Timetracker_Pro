<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $employee = Employee::where('email', $request->email)
            ->where('is_active', true)
            ->first();

        if (!$employee || !Hash::check($request->password, $employee->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $employee->createToken('api-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'token' => $token,
                'user' => $employee->makeHidden(['password']),
            ],
        ]);
    }

    public function register(Request $request)
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
        ]);

        $token = $employee->createToken('api-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registration successful',
            'data' => [
                'token' => $token,
                'user' => $employee->makeHidden(['password']),
            ],
        ], 201);
    }

    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $request->user()->makeHidden(['password']),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }
}

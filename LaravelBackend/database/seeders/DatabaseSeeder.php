<?php

namespace Database\Seeders;

use App\Models\Employee;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Employee::create([
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'first_name' => 'Admin',
            'last_name' => 'User',
            'role' => 'admin',
            'employee_number' => 'EMP001',
            'hire_date' => now()->toDateString(),
            'vacation_days_total' => 20,
            'is_active' => true,
        ]);

        Employee::create([
            'email' => 'employee@example.com',
            'password' => Hash::make('password'),
            'first_name' => 'John',
            'last_name' => 'Doe',
            'role' => 'employee',
            'employee_number' => 'EMP002',
            'hire_date' => now()->toDateString(),
            'vacation_days_total' => 15,
            'is_active' => true,
        ]);
    }
}

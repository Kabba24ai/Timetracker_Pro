<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('first_name');
            $table->string('last_name');
            $table->enum('role', ['admin', 'employee'])->default('employee');
            $table->string('employee_number')->unique()->nullable();
            $table->string('phone', 20)->nullable();
            $table->date('hire_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->decimal('vacation_days_total', 5, 2)->default(0);
            $table->decimal('vacation_days_used', 5, 2)->default(0);
            $table->timestamps();

            $table->index('email');
            $table->index('employee_number');
            $table->index('role');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            $table->dateTime('clock_in');
            $table->dateTime('clock_out')->nullable();
            $table->unsignedInteger('break_duration')->default(0)->comment('Break duration in minutes');
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'completed', 'edited'])->default('active');
            $table->timestamps();

            $table->index('employee_id');
            $table->index('clock_in');
            $table->index('clock_out');
            $table->index('status');
            $table->index(['employee_id', 'clock_in']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_entries');
    }
};

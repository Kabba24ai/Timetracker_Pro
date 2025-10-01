<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vacation_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('days_requested', 5, 2);
            $table->enum('request_type', ['vacation', 'sick', 'personal', 'unpaid'])->default('vacation');
            $table->enum('status', ['pending', 'approved', 'denied', 'cancelled'])->default('pending');
            $table->text('notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('employees')->onDelete('set null');
            $table->dateTime('approved_at')->nullable();
            $table->text('denial_reason')->nullable();
            $table->timestamps();

            $table->index('employee_id');
            $table->index('status');
            $table->index(['start_date', 'end_date']);
            $table->index('request_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vacation_requests');
    }
};

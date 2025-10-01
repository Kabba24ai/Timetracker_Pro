<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VacationRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'start_date',
        'end_date',
        'days_requested',
        'request_type',
        'status',
        'notes',
        'approved_by',
        'approved_at',
        'denial_reason',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'days_requested' => 'decimal:2',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function approver()
    {
        return $this->belongsTo(Employee::class, 'approved_by');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeDenied($query)
    {
        return $query->where('status', 'denied');
    }

    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    public function scopeForEmployee($query, $employeeId)
    {
        return $query->where('employee_id', $employeeId);
    }

    public function approve($adminId)
    {
        $this->update([
            'status' => 'approved',
            'approved_by' => $adminId,
            'approved_at' => now(),
        ]);

        $this->employee->increment('vacation_days_used', $this->days_requested);
    }

    public function deny($adminId, $reason = null)
    {
        $this->update([
            'status' => 'denied',
            'approved_by' => $adminId,
            'approved_at' => now(),
            'denial_reason' => $reason,
        ]);
    }

    public function cancel()
    {
        if ($this->status === 'approved') {
            $this->employee->decrement('vacation_days_used', $this->days_requested);
        }

        $this->update(['status' => 'cancelled']);
    }
}

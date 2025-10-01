<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimeEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'clock_in',
        'clock_out',
        'break_duration',
        'notes',
        'status',
    ];

    protected $casts = [
        'clock_in' => 'datetime',
        'clock_out' => 'datetime',
        'break_duration' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'total_hours',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getTotalHoursAttribute()
    {
        if (!$this->clock_out) {
            return 0;
        }

        $seconds = $this->clock_out->diffInSeconds($this->clock_in);
        $breakSeconds = $this->break_duration * 60;
        $workSeconds = $seconds - $breakSeconds;

        return round($workSeconds / 3600, 2);
    }

    public function scopeActive($query)
    {
        return $query->whereNull('clock_out')->where('status', 'active');
    }

    public function scopeCompleted($query)
    {
        return $query->whereNotNull('clock_out');
    }

    public function scopeToday($query)
    {
        return $query->whereDate('clock_in', today());
    }

    public function scopeForEmployee($query, $employeeId)
    {
        return $query->where('employee_id', $employeeId);
    }

    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('clock_in', [$startDate, $endDate]);
    }
}

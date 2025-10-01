<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Employee extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'email',
        'password',
        'first_name',
        'last_name',
        'role',
        'employee_number',
        'phone',
        'hire_date',
        'is_active',
        'vacation_days_total',
        'vacation_days_used',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'is_active' => 'boolean',
        'vacation_days_total' => 'decimal:2',
        'vacation_days_used' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'vacation_days_remaining',
    ];

    public function getVacationDaysRemainingAttribute()
    {
        return $this->vacation_days_total - $this->vacation_days_used;
    }

    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function vacationRequests()
    {
        return $this->hasMany(VacationRequest::class);
    }

    public function workSchedules()
    {
        return $this->hasMany(WorkSchedule::class);
    }

    public function approvedVacationRequests()
    {
        return $this->hasMany(VacationRequest::class, 'approved_by');
    }

    public function isAdmin()
    {
        return $this->role === 'admin';
    }

    public function getActiveTimeEntry()
    {
        return $this->timeEntries()
            ->whereNull('clock_out')
            ->where('status', 'active')
            ->first();
    }
}

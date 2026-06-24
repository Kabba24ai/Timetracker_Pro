# API Endpoint Audit — Time Tracker Pro
**Codebase:** Kabba Time Tracker Pro Frontend  
**Date:** 2026-06-24  
**API Base URL (local):** `https://api.kabba.local/api/time-tracker/v1`  
**Timezone:** `America/Chicago` (set via `VITE_APP_TIMEZONE`)  
**Auth mechanism:** Bearer token stored in `localStorage('auth_token')`, sent as `Authorization: Bearer <token>` on every request.

> **Scope Note:** This audit covers only the active frontend (`src/`) and its calls to the production Kabba backend (`api.kabba.local`). LaravelBackend, MedooApi, and Supabase migration files have been removed from the repo. The Supabase JS client is still active and used directly by `AttendanceTracking.tsx` for achievement summary recalculation.

---

## 1. Authentication

| Method | Endpoint | Frontend Caller | Controller/Handler | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|-------------------|---------------|-------|
| GET | `/login-users` | `LoginPage.tsx` | MISSING BACKEND IMPLEMENTATION | users / employees | No | Returns `{ data: [{ id, full_name }] }`. Public endpoint — no token. Used to populate employee dropdown before login. |
| POST | `/login` | `AuthContext.tsx → signIn()` | MISSING BACKEND IMPLEMENTATION | users / employees | No | Payload: `{ user_id, employee_code }`. Response: `{ user: { id, unique_id, full_name, email, role, status, token }, employee: { ...Employee } }`. Token stored in `localStorage('auth_token')`. |

### Payload Detail — POST /login
```json
Request:  { "user_id": 1, "employee_code": "ABC123" }
Response: {
  "success": true,
  "user":     { "id": 1, "unique_id": "...", "full_name": "...", "email": "...", "role": "...", "status": "...", "token": "..." },
  "employee": { "id": "...", "first_name": "...", "last_name": "...", "roles": [...], "roles_name": [...], "vacation_eligible": true, "store": {...}, ... }
}
```

### Session Storage (localStorage)
| Key | Value |
|-----|-------|
| `auth_token` | Bearer token |
| `auth_user` | JSON of User object |
| `auth_employee` | JSON of Employee object |
| `dashboard_mode` | `"admin"` or `"employee"` |

---

## 2. Time Clock

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/time-clock/active` | `TimeClockContext.tsx → loadActiveEntry()` | time_entries, time_entry_breaks | Yes | Response: `{ data: { entry: TimeEntry|null, active_break: { type: 'lunch'|'other' }|null } }`. Drives the 4-state UI. |
| GET | `/time-clock/today` | `TimeClockContext.tsx → refreshEntries()` | time_entries, time_entry_breaks | Yes | Response: `{ data: { entries: TimeEntry[] } }`. Drives TodayTimeEntries component. |
| POST | `/time-clock/clock-in` | `TimeClockContext.tsx → clockIn()` | time_entries | Yes | No payload. Creates active time entry. |
| POST | `/time-clock/clock-out` | `TimeClockContext.tsx → clockOut()` | time_entries | Yes | No payload. Closes active time entry. |
| POST | `/time-clock/lunch-start` | `TimeClockContext.tsx → startLunch()` | time_entries, time_entry_breaks | Yes | No payload. Starts a lunch break record. |
| POST | `/time-clock/lunch-end` | `TimeClockContext.tsx → endLunch()` | time_entries, time_entry_breaks | Yes | No payload. Closes the open lunch break. |
| POST | `/time-clock/other-start` | `TimeClockContext.tsx → startOther()` | time_entries, time_entry_breaks | Yes | No payload. Starts an unpaid break record. |
| POST | `/time-clock/other-end` | `TimeClockContext.tsx → endOther()` | time_entries, time_entry_breaks | Yes | No payload. Closes the open unpaid break. |

### /time-clock/active — Inferred Response Shape
```json
{
  "success": true,
  "data": {
    "entry": {
      "id": 1,
      "employee_id": 5,
      "clock_in": "2026-06-24T08:00:00-05:00",
      "clock_out": null,
      "break_duration": 0,
      "status": "active",
      "total_hours": 0,
      "breaks": []
    },
    "active_break": { "type": "lunch" }
  }
}
```

---

## 3. Pay Periods

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/time-reports/pay-periods` | `TimeReports.tsx → fetchPayPeriods()`, `PayrollHours.tsx → fetchPayPeriods()` | pay_periods (or computed) | Yes | Response: `{ success, data: PayPeriod[], current_period: number }`. PayPeriod = `{ number, start_date, end_date, label }`. |

---

## 4. Admin Time Reports

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/time-reports/get?page=&per_page=&pay_period=` | `TimeReports.tsx → fetchTimeReports()` | time_entries, users | Yes (admin) | Returns `{ data: TimeReportData[], meta: { current_page, last_page, per_page, total } }`. TimeReportData = `{ employee_name, employee_id, total_hours, lunch_hours, unpaid_hours, paid_hours, vacation_hours }`. |
| GET | `/time-reports/export?pay_period=` | `TimeReports.tsx → handleExportCSV()` | time_entries, users | Yes (admin) | Returns a CSV Blob. Downloaded via created object URL. |
| GET | `/users/time-entries-list/{userId}?pay_period=` | `TimeReports.tsx → generateDailyBreakdown()`, `PayrollHours.tsx → generateDailyBreakdown()` | time_entries, time_entry_breaks | Yes | Returns daily breakdown array. Each day has `{ date, entries: [...], totals: { worked_hours, unpaid_hours, paid_hours } }`. Each entry has `{ entry_id, clock_in: { adjusted, actual }, clock_out: { adjusted, actual }, lunch_breaks: [{ id, start: {adjusted,actual}, end: {adjusted,actual} }], unpaid_breaks: [...], paid_seconds, unpaid_seconds, worked_seconds }`. |
| GET | `/users/{userId}/time-entries/export?pay_period=` | `TimeReports.tsx → handleUserTimeEntryCSV()` | time_entries | Yes (admin) | Returns a CSV Blob for single employee. |

### Admin Time Entry Edits

| Method | Endpoint | Frontend Caller | Notes |
|--------|----------|-----------------|----|
| POST | `/users/time-entries/update` | `TimeReports.tsx → handleSaveEditEntry()` | Payload: `{ entry_id, break_id\|null, entry_type, new_time }`. Edits a single time event. |
| POST | `/users/time-entries/bulk-update` | `TimeReports.tsx → handleSaveAllChanges()` | Payload: `{ updates: [{ entry_id, break_id, entry_type, old_time, new_time }] }`. Batch edits. |
| POST | `/users/time-entries/create` | `TimeReports.tsx → handleAddNewTime()` | Payload: `{ entry_id, break_id: null, entry_type, new_time }`. Adds lunch/unpaid break event to existing shift. |
| POST | `/users/time-entries/create-empty` | `TimeReports.tsx → AddClockTimeCell` | Payload: `{ user_id, date, entry_type: 'clock_in'|'clock_out', time }`. Creates a brand-new clock event for a date with no entry. |
| POST | `/users/time-entries/delete` | `TimeReports.tsx → handleDeleteEntry()` | Payload: `{ entry_id, break_id\|null, entry_type }`. Deletes a single time event. Confirmed via SweetAlert. |

---

## 5. Vacation — Employee

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/vacation-summary/get` | `VacationSummary.tsx → fetchVacationData()` | vacation_balances or employees | Yes | Response: `{ data: { allotted_hours, accrued_hours, used_hours, hours_worked_this_year } }`. |
| GET | `/vacation-summary/my-vacation-request` | `VacationSummary.tsx → fetchVacationRequests()` | vacation_requests | Yes | Response: `{ data: VacationRequest[] }`. Sorted/sliced to last 10 reversed. |
| GET | `/vacation-summary/get/vacation-request-hour` | `VacationSummary.tsx → fetchVacationRequestHours()` | vacation_request_hours | Yes | Response: `{ data: { hours: [{ id, name, hours }] } }`. Duration options (e.g. "4 hours", "8 hours"). |
| POST | `/vacation-summary/vacation-request/store` | `VacationSummary.tsx → handleSubmitRequest()` | vacation_requests | Yes | Payload: `{ start_date, vacation_request_hour_id }`. No `end_date` or `days_requested` — both computed server-side. |

---

## 6. Vacation — Admin

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/vacation/get-vacation-balances?page=&per_page=` | `VacationManagement.tsx → fetchVacationRecords()` | employees / vacation_balances | Yes (admin) | Response: `{ data: VacationRecord[], meta: { current_page, last_page, per_page, total } }`. VacationRecord = `{ employee_id, employee_name, allotted_hours, accrued_hours, used_hours, vacation_allotment_hour_id }`. |
| GET | `/vacation/all/vacation-requests` | `VacationManagement.tsx → fetchVacationRequests()` | vacation_requests | Yes (admin) | Response: `{ data: VacationRequest[] }`. All statuses. |
| POST | `/vacation/vacation-requests/{id}/approve` | `VacationManagement.tsx → handleApproveRequest()` | vacation_requests, vacation_balances | Yes (admin) | No payload. Confirmed via SweetAlert. |
| POST | `/vacation/vacation-requests/{id}/deny` | `VacationManagement.tsx → handleDenyRequest()` | vacation_requests | Yes (admin) | Payload: `{ reason: string }`. Reason must be >= 3 chars (frontend validation). |
| POST | `/vacation/update-user-vacation/{employeeId}` | `VacationManagement.tsx → saveChanges()` | employees / vacation_balances | Yes (admin) | Payload: `{ vacation_allotment_hour_id, used_hours }`. Admin manual override. |

---

## 7. Employee Management (Admin)

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/users?page=&per_page=` | `EmployeeManagement.tsx → fetchEmployees()` | users, employees, roles, stores | Yes (admin) | Returns paginated Employee list with `roles`, `roles_name`, `store`, `vacation_allotment_hour`, `vacation_start_day`, etc. |
| GET | `/users/vacation-Option` | `EmployeeManagement.tsx`, `VacationManagement.tsx` | vacation_allotment_hours, vacation_start_days | Yes | Response: `{ data: { hours: [...], days: [...] } }`. Lookup tables for vacation plan options. |
| PUT | `/users/{id}/vacation` | `EmployeeManagement.tsx → handleSaveEmployee()` | employees | Yes (admin) | Payload: `{ vacation_eligible, vacation_allotment_hour_id, vacation_start_day_id, bonus_vacation_hours, bonus_vacation_hours_start_date, bonus_vacation_hours_end_date }`. |

**Note:** Delete employee button exists in the UI but is commented out (`<Trash2>` icon in dead code). No DELETE endpoint is called.

---

## 8. Attendance

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/attendance?start_date=&end_date=&page=&per_page=` | `EmployeeAttendance.tsx → loadAttendanceData()` | attendance_records | Yes | Response: `{ data: AttendanceRecord[], meta: {...}, stats: AttendanceStats }`. AttendanceStats = `{ days_present, days_late, days_missed, days_excused, total_minutes_late, achievement: AchievementGoal|null }`. |
| GET | `/users/attendance/summary?start_date=&end_date=&page=&per_page=` | `AttendanceTracking.tsx → loadAggregatedAttendance()` | attendance_records | Yes (admin) | Response: `{ data: EmployeeAggregatedStats[], meta: {...} }`. Per-employee attendance summary with achievement badge. |

---

## 9. Achievement Goals (Admin — Dual Backend: API + Supabase)

| Method | Source | Endpoint / Call | Frontend Caller | Notes |
|--------|--------|------------------|-----------------|----|
| GET | API | `/achievement-goals` | `AttendanceTracking.tsx → loadGoals()` | Returns `{ data: AchievementGoal[] }`. |
| PUT | API | `/achievement-goals/update/{id}` | `AttendanceTracking.tsx → saveGoal()` | Updates existing goal. |
| POST | API | `/achievement-goals/store` | `AttendanceTracking.tsx → saveGoal()` | Creates new goal. |
| SELECT | Supabase | `supabase.from('employees').select('id').eq('is_active', true)` | `AttendanceTracking.tsx → recalculateAllSummaries()` | Fetches all active employee IDs from Supabase directly. |
| RPC | Supabase | `supabase.rpc('calculate_monthly_summary', { p_employee_id, p_year, p_month })` | `AttendanceTracking.tsx → recalculateAllSummaries()` | Calls a stored Postgres function in Supabase to rebuild monthly attendance summaries. |

> **CONCERN:** `AttendanceTracking.tsx` uses BOTH the Kabba API (for goals and summary display) AND Supabase directly (for recalculation). This means the attendance data lives in two systems. The `recalculateAllSummaries()` function reads employees from Supabase and writes summaries back to Supabase — but the display endpoint (`/users/attendance/summary`) appears to come from the Kabba API. It is unclear whether these two stores are synchronized.

---

## 10. Work Schedule

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/work-schedule/employees` | `WorkSchedule.tsx`, `EmpWorkSchedule.tsx → fetchEmployees()` | users, employees, stores, store_schedules | Yes | Returns employees with `store.weekly_schedule` (store open/close per day). |
| GET | `/work-schedule/stores` | `WorkSchedule.tsx`, `EmpWorkSchedule.tsx → fetchStores()` | stores | Yes | Returns `{ data: [{ name: string }] }`. Used to build store filter. |
| GET | `/work-schedule/start-date` | `WorkSchedule.tsx`, `EmpWorkSchedule.tsx → fetchStartDate()` | system_settings or pay_periods | Yes | Response: `{ data: { start_date: string } }`. Used to calculate the range of navigable weeks. |
| GET | `/work-schedule/work-schedule?week_start=&days=&employee_ids[]=` | `WorkSchedule.tsx`, `EmpWorkSchedule.tsx → fetchWorkSchedule()` | work_schedules | Yes | Returns nested object keyed by `employeeId → date → [WorkDay]`. |
| POST | `/work-schedule/work-schedule/save` | `WorkSchedule.tsx → saveWorkSchedule()` | work_schedules | Yes (admin) | Payload: `{ schedules: WorkDay[] }`. Each WorkDay: `{ date, employee_id, start_time, end_time, store_id, store_location, is_scheduled, hours, notes }`. **Admin only.** EmpWorkSchedule.tsx has no save — read-only for employees. |

---

## 11. System Settings

| Method | Endpoint | Frontend Caller | Tables (inferred) | Auth Required | Notes |
|--------|----------|-----------------|--------------------|---------------|-------|
| GET | `/system/settings` | `SettingsContext.tsx → fetchSettings()`, `SystemSettings.tsx → fetchSettings()` | system_settings | Yes | Returns full SystemSettingsType including pay_increments, pay_period_type, holidays, daily_shifts, auto_clock_out_*, etc. Fetched globally on app load via SettingsContext. |
| PUT | `/system/settings/update` | `SystemSettings.tsx → saveSettings()` | system_settings | Yes (admin) | Payload: full SystemSettingsType object. |

---

## 12. Missing Backend Implementations (Frontend Calls with No Known Route)

The following endpoints are called by the frontend but the production backend code is not in this repository. Their existence is proven by the frontend calls.

| Endpoint | Proof |
|----------|-------|
| `GET /login-users` | `LoginPage.tsx:32` |
| `POST /login` | `AuthContext.tsx:98` |
| `GET /time-clock/active` | `TimeClockContext.tsx:198` |
| `GET /time-clock/today` | `TimeClockContext.tsx:222` |
| `POST /time-clock/clock-in` | `TimeClockContext.tsx:241` |
| `POST /time-clock/clock-out` | `TimeClockContext.tsx:266` |
| `POST /time-clock/lunch-start` | `TimeClockContext.tsx:121` |
| `POST /time-clock/lunch-end` | `TimeClockContext.tsx:143` |
| `POST /time-clock/other-start` | `TimeClockContext.tsx:157` |
| `POST /time-clock/other-end` | `TimeClockContext.tsx:178` |
| `GET /time-reports/pay-periods` | `TimeReports.tsx:250`, `PayrollHours.tsx:97` |
| `GET /time-reports/get` | `TimeReports.tsx:301` |
| `GET /time-reports/export` | `TimeReports.tsx:108` |
| `GET /users/time-entries-list/{id}` | `TimeReports.tsx:443`, `PayrollHours.tsx:241` |
| `GET /users/{id}/time-entries/export` | `TimeReports.tsx:183` |
| `POST /users/time-entries/update` | `TimeReports.tsx:504` |
| `POST /users/time-entries/bulk-update` | `TimeReports.tsx:1102` |
| `POST /users/time-entries/create` | `TimeReports.tsx:152` |
| `POST /users/time-entries/create-empty` | `TimeReports.tsx:799` |
| `POST /users/time-entries/delete` | `TimeReports.tsx:1158` |
| `GET /vacation-summary/get` | `VacationSummary.tsx:58` |
| `GET /vacation-summary/my-vacation-request` | `VacationSummary.tsx:73` |
| `GET /vacation-summary/get/vacation-request-hour` | `VacationSummary.tsx:86` |
| `POST /vacation-summary/vacation-request/store` | `VacationSummary.tsx:104` |
| `GET /vacation/get-vacation-balances` | `VacationManagement.tsx:83` |
| `GET /vacation/all/vacation-requests` | `VacationManagement.tsx:107` |
| `POST /vacation/vacation-requests/{id}/approve` | `VacationManagement.tsx:132` |
| `POST /vacation/vacation-requests/{id}/deny` | `VacationManagement.tsx:180` |
| `POST /vacation/update-user-vacation/{id}` | `VacationManagement.tsx:222` |
| `GET /users?page=&per_page=` | `EmployeeManagement.tsx:62` |
| `GET /users/vacation-Option` | `EmployeeManagement.tsx:31`, `VacationManagement.tsx:64` |
| `PUT /users/{id}/vacation` | `EmployeeManagement.tsx:127` |
| `GET /attendance` | `EmployeeAttendance.tsx:79` |
| `GET /users/attendance/summary` | `AttendanceTracking.tsx:111` |
| `GET /achievement-goals` | `AttendanceTracking.tsx:87` |
| `PUT /achievement-goals/update/{id}` | `AttendanceTracking.tsx:142` |
| `POST /achievement-goals/store` | `AttendanceTracking.tsx:145` |
| `GET /work-schedule/employees` | `WorkSchedule.tsx:249`, `EmpWorkSchedule.tsx:249` |
| `GET /work-schedule/stores` | `WorkSchedule.tsx:306`, `EmpWorkSchedule.tsx:306` |
| `GET /work-schedule/start-date` | `WorkSchedule.tsx:158`, `EmpWorkSchedule.tsx:158` |
| `GET /work-schedule/work-schedule` | `WorkSchedule.tsx:346`, `EmpWorkSchedule.tsx:346` |
| `POST /work-schedule/work-schedule/save` | `WorkSchedule.tsx:482` |
| `GET /system/settings` | `SettingsContext.tsx:12`, `SystemSettings.tsx:76` |
| `PUT /system/settings/update` | `SystemSettings.tsx:104` |

---

## 13. Supabase Direct Calls (Active in Frontend)

| Operation | Table / RPC | Caller | Purpose |
|-----------|-------------|--------|---------|
| `SELECT id FROM employees WHERE is_active = true` | `employees` table | `AttendanceTracking.tsx:171` | Get all active employee IDs for monthly recalculation |
| `rpc('calculate_monthly_summary', { p_employee_id, p_year, p_month })` | Stored function | `AttendanceTracking.tsx:182` | Rebuild monthly attendance summary in Supabase |

**Supabase project:** `plrcfkbvmwyaboshhrle.supabase.co`

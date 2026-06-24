# Time Tracker Schema Map — Time Tracker Pro
**Codebase:** Kabba Time Tracker Pro Frontend  
**Date:** 2026-06-24  
**Method:** All tables and columns inferred from TypeScript types, API response shapes, and component data usage.  

> **Important:** The production database schema is not present in this repository. This document is reverse-engineered entirely from the frontend TypeScript types (`src/types/`), API response shapes consumed by components, and request payloads. Every table name and column name listed here is what the frontend expects — the actual backend may use different naming, casing, or structure.

---

## Confirmed Tables (Proven by Frontend Types and API Shapes)

---

### Table: `users`
**Purpose:** Kabba platform user accounts. Authentication identities. Sourced from the Kabba roles/auth module — the `EmployeeManagement.tsx` labels employee information as "From Roles Module" and marks it view-only.

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer | Primary key, used in login payload (`user_id`) |
| `unique_id` | string | UUID or slug identifier |
| `full_name` | string | Shown in login dropdown via `/login-users` |
| `email` | string | Displayed in employee list |
| `role` | string | `"employee"`, `"admin"`, `"master_admin"` |
| `status` | string | Account status (active/inactive) |
| `token` | string | Auth token returned on login (likely generated, not stored as-is) |

**Auth Required for reads:** No (for `/login-users` list), Yes (for admin list via `/users`)  
**Payroll-Sensitive:** No  
**Soft-Delete Risk:** Unknown — if hard-deleted, all time entries may be orphaned

---

### Table: `employees`
**Purpose:** Time Tracker specific employee settings and vacation eligibility. Linked to `users`. The Kabba platform separates user auth from employee time-tracking settings.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | string / integer | No | Primary key. Used as `employee_id` throughout. |
| `user_id` | string / integer | No | FK to `users.id` |
| `employee_code` | string | Yes | Time clock PIN/code. Used for login authentication. |
| `first_name` | string | No | |
| `last_name` | string | No | |
| `email` | string | No | |
| `role` | string | No | Primary role string |
| `shift_start_time` | time | Yes | Per-employee shift start (may be overridden by store schedule) |
| `shift_end_time` | time | Yes | Per-employee shift end |
| `pay_start_buffer` | integer | Yes | Minutes before shift that clock-in rounds to shift start |
| `pay_end_buffer` | integer | Yes | Minutes after shift that clock-out rounds to shift end |
| `vacation_eligible` | boolean | Yes | Whether employee earns vacation |
| `vacation_allotment_hour_id` | integer FK | Yes | FK to `vacation_allotment_hours.id` |
| `vacation_start_day_id` | integer FK | Yes | FK to `vacation_start_days.id` |
| `bonus_vacation_hours` | decimal | Yes | Extra vacation hours grant |
| `bonus_vacation_hours_start_date` | date | Yes | Start of bonus eligibility window |
| `bonus_vacation_hours_end_date` | date | Yes | End of bonus eligibility window |
| `store_id` | integer FK | Yes | FK to `stores.id` — inferred from `employee.store` |

**Related Objects returned by API:**
- `vacation_allotment_hour: { id, hours, name }` — the annual vacation plan
- `vacation_start_day: { id, day_number, name }` — when in the year accrual resets
- `store: { id, store_name, today_schedule, weekly_schedule }`
- `roles: string[]` — array of role slugs
- `roles_name: string[]` — array of role display names
- `roles_with_color: { name, color }[]`

**Payroll-Sensitive:** Yes (pay buffers affect payroll rounding)  
**Soft-Delete Risk:** High — if hard-deleted, all time entries and vacation history are orphaned

---

### Table: `time_entries`
**Purpose:** Records each shift: one row per clock-in/out pair. The primary payroll data table.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` (entry_id) | integer | No | Primary key |
| `employee_id` | integer FK | No | FK to `employees.id` |
| `clock_in` | object `{ adjusted, actual }` | No | `adjusted` = rounded for payroll, `actual` = raw timestamp |
| `clock_out` | object `{ adjusted, actual }` | Yes | Null if shift still active |
| `status` | string | No | `"active"` or `"closed"` (inferred) |
| `total_hours` | decimal | Yes | Computed field |
| `break_duration` | integer | Yes | Legacy total break minutes (may coexist with break events) |
| `notes` | string | Yes | |
| `paid_seconds` | integer | Yes | Per-entry computed paid seconds |
| `unpaid_seconds` | integer | Yes | Per-entry computed unpaid seconds |
| `worked_seconds` | integer | Yes | Per-entry total worked seconds |
| `created_at` | timestamp | No | |

**Payroll-Sensitive:** Yes  
**Soft-Delete Risk:** High — these are the primary payroll records. Currently unknown if hard or soft delete.  
**Data Integrity Risks:**
- `clock_out` can be null indefinitely (forgotten punch-out)
- `paid_seconds` and `unpaid_seconds` suggest server-side calculation

---

### Table: `time_entry_breaks`
**Purpose:** Individual break events associated with a time entry. Proven by the `breaks: TimeEntryBreak[]` array on `TimeEntry` type, and by the `lunch_breaks`, `unpaid_breaks` arrays in the daily breakdown API response.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | integer | No | Primary key. Referenced as `break_id` in edit/delete payloads. |
| `time_entry_id` (entry_id) | integer FK | No | FK to `time_entries.id` |
| `type` | enum `'lunch'|'other'` | No | Frontend labels 'other' as "unpaid" in admin UI (`unpaid_out`, `unpaid_in`) |
| `start_time` | object `{ adjusted, actual }` | No | Break start |
| `end_time` | object `{ adjusted, actual }` | Yes | Null if break still active |

**Payroll-Sensitive:** Yes  
**Notes:** The time entry edit payloads use `entry_type` values of `lunch_out / lunch_in / unpaid_out / unpaid_in` to identify specific break event sides.

---

### Table: `vacation_requests`
**Purpose:** Employee vacation time-off requests, pending admin approval.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | string (UUID or int) | No | |
| `employee_id` | string | No | FK to `employees.id` |
| `employee_name` | string | Yes | Denormalized for display |
| `start_date` | date | No | |
| `end_date` | date | No | Calculated by backend from `vacation_request_hour_id` and `start_date` |
| `hours` | decimal | No | Duration in hours (not days) |
| `status` | enum `'pending'|'approved'|'denied'` | No | |
| `denial_reason` | string | Yes | Required when denying |
| `created_at` | timestamp | No | |

**Payroll-Sensitive:** Yes  
**Soft-Delete Risk:** Medium — denied/cancelled requests should probably be retained for history

---

### Table: `vacation_balances` (or columns on `employees`)
**Purpose:** Tracks each employee's vacation accrual state. May be a separate table or columns on `employees`.

| Column (inferred) | Type | Notes |
|-------------------|------|-------|
| `employee_id` | integer FK | |
| `allotted_hours` | decimal | Annual plan ceiling |
| `accrued_hours` | decimal | Earned based on hours worked |
| `used_hours` | decimal | Deducted on vacation approval |
| `hours_worked_this_year` | decimal | Year-to-date worked hours, used for accrual |
| `vacation_allotment_hour_id` | integer FK | FK to `vacation_allotment_hours` |

**Payroll-Sensitive:** Yes  
**Data Integrity Risk:** `used_hours` is a mutable counter — it can drift from reality if requests are approved/denied concurrently or if the cancel flow has bugs.

---

### Table: `vacation_allotment_hours`
**Purpose:** Lookup table of vacation plan tiers (e.g., "40 hrs/year", "80 hrs/year").

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer | PK |
| `name` | string | Display name (e.g., "40 Hours") |
| `hours` | decimal | Annual allotment in hours |

**Returned by:** `GET /users/vacation-Option` → `data.hours`

---

### Table: `vacation_start_days`
**Purpose:** Lookup table defining when in the year vacation accrual resets (e.g., anniversary date, Jan 1, hire date).

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer | PK |
| `name` | string | Display name |
| `day_number` | integer | Numeric day reference |

**Returned by:** `GET /users/vacation-Option` → `data.days`

---

### Table: `vacation_request_hours`
**Purpose:** Lookup table for vacation duration options shown to employees (e.g., "4 Hours", "Full Day — 8 Hours", "2 Days — 16 Hours").

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer | PK |
| `name` | string | Display label |
| `hours` | decimal | Duration in hours |

**Returned by:** `GET /vacation-summary/get/vacation-request-hour` → `data.hours`

---

### Table: `attendance_records`
**Purpose:** One row per employee per day. Records attendance status and check-in time.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | string | No | |
| `employee_id` | string FK | No | |
| `attendance_date` | date `YYYY-MM-DD` | No | |
| `status` | enum `'present'|'late'|'missed'|'excused'` | No | |
| `check_in_time` | timestamp | Yes | Null if missed/excused |
| `minutes_late` | integer | No | Computed from check_in vs scheduled start |
| `created_at` | timestamp | Yes | |

**Payroll-Sensitive:** No (attendance only, not payroll hours)  
**Also has:** nested `employee: { first_name, last_name, email }` in admin view

---

### Table: `achievement_goals`
**Purpose:** Configurable gamification goals/badges awarded for attendance performance.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | string | No | |
| `goal_name` | string | No | |
| `icon` | string | No | Emoji or icon identifier |
| `color` | string | No | Hex or Tailwind color |
| `description` | string | No | |
| `goal_type` | enum `'positive'|'negative'` | No | |
| `days_missed_max` | integer | No | Threshold for this badge |
| `days_late_max` | integer | No | Threshold for this badge |
| `is_active` | boolean | Yes | |
| `display_order` | integer | Yes | |

**Stored:** In Kabba API database (managed via `/achievement-goals` endpoints)  
**Note:** Supabase also has `achievement_goals` referenced by `calculate_monthly_summary`. Potential duplication.

---

### Table: `work_schedules`
**Purpose:** Per-employee per-date schedule assignments. Overrides the store's default weekly schedule.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `employee_id` | integer FK | No | |
| `date` | date | No | Specific date (not day-of-week) |
| `start_time` | time | No | |
| `end_time` | time | No | |
| `store_id` | integer FK | Yes | Which store location |
| `store_location` | string | Yes | Denormalized store name |
| `is_scheduled` | boolean | No | Whether employee works this day |
| `hours` | decimal | No | Pre-calculated shift hours |
| `notes` | string | Yes | |

**Returned by:** `GET /work-schedule/work-schedule` → keyed by `{ employeeId → { date → [WorkDay] } }`

---

### Table: `stores`
**Purpose:** Physical store locations. Each employee belongs to a store. Each store has a default weekly schedule.

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer | PK |
| `store_name` | string | |
| `weekly_schedule` | JSON / related table | Array of `{ day, open, close, is_closed }` |

**Inferred from:** `Employee.store.weekly_schedule`, `/work-schedule/stores` endpoint

---

### Table: `system_settings`
**Purpose:** Global tenant configuration for pay periods, time rounding, messaging, holidays, and daily shift defaults.

| Column | Type | Notes |
|--------|------|-------|
| `pay_increments` | integer | Rounding increment in minutes (e.g., 5, 15) |
| `pay_period_type` | enum `'weekly'|'biweekly'` | |
| `pay_period_start_date` | date | The anchor date for period calculation |
| `minimum_lunch_duration_minutes` | integer | |
| `default_lunch_duration_minutes` | integer | Used as default when adding lunch end time |
| `limit_start_time_to_shift` | boolean | |
| `limit_end_time_to_shift` | boolean | |
| `first_clock_in_reminder_minutes` | integer | |
| `second_clock_in_reminder_minutes` | integer | |
| `auto_clock_out_limit_minutes` | integer | |
| `auto_clock_out_time` | time | |
| `auto_lunch_minutes` | integer | |
| `auto_lunch_message` | string | Template with `{name}` and `{default_lunch_time}` |
| `clock_in_message_1` | string | |
| `clock_in_message_2` | string | |
| `auto_clock_out_message` | string | |
| `holidays` | JSON | Keyed by year: `{ new_years_day, memorial_day, independence_day, labor_day, thanksgiving_day, christmas_day, floating_holidays }` |
| `daily_shifts` | JSON | Default shifts per day: `{ monday: { start, end, enabled, lunch_required }, ... }` |

---

### Table: `pay_periods` (Inferred)
**Purpose:** Defines the boundaries of each pay period. Required because the frontend requests pay periods by `number` and `label`.

| Column (inferred) | Type | Notes |
|-------------------|------|-------|
| `number` | integer | Sequential period number |
| `start_date` | date | |
| `end_date` | date | |
| `label` | string | Human-readable label (e.g., "Jun 1 – Jun 14, 2026") |

**Inferred from:** `GET /time-reports/pay-periods` response, which returns `{ data: PayPeriod[], current_period: number }`  
**May be:** Computed dynamically from `system_settings.pay_period_type` and `system_settings.pay_period_start_date` rather than stored as rows.

---

## Supabase Tables (Active — Used by AttendanceTracking.tsx)

### Supabase Table: `employees`
**Purpose:** Supabase mirror of employee records. Used to look up active employee IDs for monthly summary recalculation.

| Column | Notes |
|--------|-------|
| `id` | UUID PK |
| `is_active` | boolean — filtered in `recalculateAllSummaries()` |

### Supabase Function: `calculate_monthly_summary(p_employee_id, p_year, p_month)`
**Purpose:** Rebuilds the monthly attendance summary for a given employee and month. Called by admin UI's "recalculate" action.

---

## Missing or Unclear Tables

### MISSING: `time_entry_audit_logs`
**Why it appears necessary:** Admins can edit, bulk-edit, create, and delete individual time events through `TimeReports.tsx`. There is no audit trail visible in the frontend — no "who changed this and when" display.  
**Implied by:** `POST /users/time-entries/update`, `/bulk-update`, `/create`, `/create-empty`, `/delete` — all of these modify payroll records.  
**Risk:** Without an audit log, fraudulent or accidental payroll changes cannot be detected or reversed. **Critical for payroll compliance.**

### MISSING: `payroll_period_locks`
**Why it appears necessary:** Once a pay period is closed (exported to payroll), time entries should be locked against edits. There is no locking mechanism visible in the frontend — the edit UI works for any pay period.  
**Implied by:** The CSV export feature (`/time-reports/export`) implies periods are finalized, but there is no UI or API state that prevents editing after export.  
**Risk:** Edits after payroll export produce a discrepancy between the exported report and the live database. **Critical for payroll accuracy.**

### MISSING: `vacation_ledger` / `vacation_accrual_log`
**Why it appears necessary:** `used_hours` is stored as a mutable counter. If it drifts (bug in approval/cancellation flow), there is no way to reconstruct the correct balance.  
**Implied by:** The complex accrual logic implied by `accrued_hours`, `hours_worked_this_year`, and `bonus_vacation_hours` fields suggests changes should be events, not counter mutations.  
**Risk:** Vacation balances can become permanently incorrect with no recovery path. **High risk.**

### MISSING: `vacation_accrual_rules`
**Why it appears necessary:** The frontend shows `accrued_hours` that change based on `hours_worked_this_year`, `vacation_allotment_hour_id`, and `bonus_vacation_hours`. This implies a configurable rate (e.g., "1 hour earned per 26 hours worked").  
**Implied by:** `VacationSummary.tsx` comment text: "Vacation hours are earned based on your worked hours, up to 40 hours per week. Your accrual rate is determined by your annual vacation plan."  
**Risk:** If the accrual logic is hardcoded in the backend without a configuration table, changing the rate requires code deployment. **Medium risk.**

### UNCLEAR: `monthly_attendance_summary` (Supabase)
**Why unclear:** `AttendanceTracking.tsx` calls `supabase.rpc('calculate_monthly_summary')` which presumably writes to a `monthly_attendance_summary` table in Supabase. But the main attendance display endpoint (`/users/attendance/summary`) appears to come from the Kabba API, not Supabase.  
**Risk:** Two separate attendance data stores. It is unknown whether they stay in sync or whether one overwrites the other. The Supabase recalculation might be orphaned logic.

### UNCLEAR: `stores` schedule relationship
**Why unclear:** `employee.store.weekly_schedule` is returned as an array directly on the employee. It's unclear if this is from a dedicated `store_schedules` table or a JSON column on `stores`.  
**Risk:** If it's a JSON column, querying by day-of-week for "who works on Tuesday" is expensive and error-prone.

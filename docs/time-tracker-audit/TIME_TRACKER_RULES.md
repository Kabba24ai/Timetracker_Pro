# Time Tracker Business Rules — Time Tracker Pro
**Codebase:** Kabba Time Tracker Pro Frontend  
**Date:** 2026-06-24  
**Method:** Rules documented only from code found in `src/`. No rules invented. Backend enforcement is inferred — backend code is not in this repo.

> **Scope:** Only rules found in the active frontend codebase are documented here. Backend enforcement is marked as "UNKNOWN" where it cannot be verified from available code.

---

## 1. Authentication Rules

---

**Rule: Employee-Code Login**  
Description: Login requires selecting an employee from a dropdown and entering an `employee_code` (a PIN). There is no email/password login anywhere in the active codebase.  
Enforced In: Frontend + Backend (inferred)  
Files: `src/pages/LoginPage.tsx`, `src/contexts/AuthContext.tsx`  
Functions: `handleSubmit()` (LoginPage), `signIn()` (AuthContext)  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: No  
Risk Level: Medium  
Notes: The login-users dropdown loads ALL users before login — anyone with network access can see the full employee list. No CAPTCHA or rate limiting is visible in the frontend.

---

**Rule: Bearer Token Auth**  
Description: Every API request (except `/login` and `/login-users`) includes `Authorization: Bearer <token>` from `localStorage('auth_token')`.  
Enforced In: Frontend  
Files: `src/lib/api.ts`  
Functions: `ApiClient.request()`  
Frontend Only / Backend Only / Both: Both (backend must validate)  
Payroll/Vacation Impact: Yes (all payroll and vacation calls depend on this)  
Risk Level: Medium  
Notes: Token stored in `localStorage`, which is readable by any JS on the page (XSS risk). Acceptable for an internal kiosk app but should be noted.

---

**Rule: Role-Based Dashboard Switch**  
Description: Only employees with the `master_admin` role can toggle between the employee dashboard and the admin dashboard. Regular employees are always in employee view.  
Enforced In: Frontend  
Files: `src/contexts/AuthContext.tsx`  
Functions: `toggleDashboardMode()`  
Frontend Only / Backend Only / Both: Frontend Only (visible in UI)  
Payroll/Vacation Impact: No  
Risk Level: High  
Notes: Backend must independently enforce admin authorization on every admin endpoint. The frontend toggle alone is not a security boundary.

---

**Rule: Session Restore on Page Load**  
Description: On app load, if `auth_user`, `auth_employee`, and `auth_token` all exist in `localStorage`, the session is restored silently without re-validating the token with the server.  
Enforced In: Frontend Only  
Files: `src/contexts/AuthContext.tsx`  
Functions: `useEffect` on mount  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Medium  
Notes: A revoked or expired token will still restore the session locally until an API call fails. The app does not proactively validate the token on startup.

---

## 2. Clock In Rules

---

**Rule: Single Active Entry Guard (Frontend)**  
Description: The clock-in button is only shown when `status === 'clocked_out'`. If an active entry exists, the button is hidden. The backend must enforce this independently.  
Enforced In: Frontend (UI gate) + Backend (inferred)  
Files: `src/components/TimeClockCard.tsx`, `src/contexts/TimeClockContext.tsx`  
Functions: `clockIn()`, conditional render based on `status`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: Frontend provides no duplicate-clock-in protection beyond UI state. If two tabs are open or a network retry fires, two POST requests can reach the backend simultaneously.

---

**Rule: Processing Lock**  
Description: While any clock action is in progress (`processingAction !== null`), all clock action functions return immediately without making a new API call.  
Enforced In: Frontend Only  
Files: `src/contexts/TimeClockContext.tsx`  
Functions: `clockIn()`, `clockOut()`, `startLunch()`, `endLunch()`, `startOther()`, `endOther()`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  
Notes: Only prevents double-taps within the same browser tab/session. Does not prevent concurrent requests from multiple tabs or devices.

---

## 3. Clock Out Rules

---

**Rule: Only One Clock Out at a Time**  
Description: Clock Out button is only shown when `status === 'working'`. If the employee is on a break (`lunch_break` or `other_break`), the Clock Out button is not available — the break must be ended first.  
Enforced In: Frontend (UI gate)  
Files: `src/components/TimeClockCard.tsx`  
Functions: Conditional render based on `status`  
Frontend Only / Backend Only / Both: Frontend Only (backend enforcement unknown)  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: Backend must also reject a clock-out when a break is active, or the break duration will be miscalculated.

---

**Rule: Clock Out Clears Active Entry Immediately**  
Description: On successful clock-out, `activeEntry` is set to null and `status` is set to `'clocked_out'` immediately — before `refreshEntries()` completes. This is optimistic UI.  
Enforced In: Frontend  
Files: `src/contexts/TimeClockContext.tsx`  
Functions: `clockOut()`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

## 4. Lunch Break Rules

---

**Rule: Lunch Only While Working**  
Description: The Lunch Start button is only shown when `status === 'working'`. An employee cannot start lunch while already on lunch or another break.  
Enforced In: Frontend (UI gate) + Backend (inferred)  
Files: `src/components/TimeClockCard.tsx`  
Functions: Conditional render based on `status`  
Frontend Only / Backend Only / Both: Both (backend enforcement inferred, not proven)  
Payroll/Vacation Impact: Yes  
Risk Level: High  

---

**Rule: Lunch End Only While On Lunch**  
Description: The Lunch End button is only shown when `status === 'lunch_break'`.  
Enforced In: Frontend (UI gate) + Backend (inferred)  
Files: `src/components/TimeClockCard.tsx`  
Functions: Conditional render  
Frontend Only / Backend Only / Both: Both (backend inferred)  
Payroll/Vacation Impact: Yes  
Risk Level: High  

---

**Rule: Lunch Type Identification**  
Description: Lunch breaks are identified with `type === 'lunch'` in the `active_break` response from `/time-clock/active`. This drives the `status === 'lunch_break'` state.  
Enforced In: Frontend  
Files: `src/contexts/TimeClockContext.tsx`  
Functions: `loadActiveEntry()`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  

---

**Rule: Lunch Labeled as "Unpaid" in Admin Reports**  
Description: In `TimeReports.tsx` and `PayrollHours.tsx`, lunch breaks appear in a column labeled "Unpaid" / "Unpaid Hours". The `entry_type` values are `lunch_out` and `lunch_in`. Lunch is treated as unpaid time.  
Enforced In: Frontend display  
Files: `src/components/admin/TimeReports.tsx`, `src/components/PayrollHours.tsx`  
Functions: `getEntryTypeLabel()`, column headers  
Frontend Only / Backend Only / Both: Frontend display only  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: If any lunch break is incorrectly categorized as paid, payroll overpayment results. Backend calculation of `paid_seconds` vs `unpaid_seconds` is the source of truth.

---

**Rule: Minimum Lunch Duration for Auto-Fill**  
Description: When an admin adds a "Lunch End" time in the time report editor, the default suggested time is the lunch start time plus `settings.minimum_lunch_duration_minutes` (defaulting to 30 minutes if not set).  
Enforced In: Frontend Only  
Files: `src/components/admin/TimeReports.tsx`  
Functions: `AddTimeCell` component  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: Yes  
Risk Level: Low  
Notes: Backend validation of minimum lunch duration is unknown.

---

## 5. Other Break Rules

---

**Rule: Other Break Only While Working**  
Description: The Other Break Start button is only shown when `status === 'working'`. An employee cannot start another break while on lunch or already on an other break.  
Enforced In: Frontend (UI gate) + Backend (inferred)  
Files: `src/components/TimeClockCard.tsx`  
Functions: Conditional render  
Frontend Only / Backend Only / Both: Both (backend inferred)  
Payroll/Vacation Impact: Yes  
Risk Level: High  

---

**Rule: Other Break Labeled as "Unpaid" in Admin UI**  
Description: In `TimeReports.tsx`, other breaks use `entry_type` values `unpaid_out` and `unpaid_in`. The column is labeled "Unpaid Start / Unpaid End". Other breaks are treated as unpaid.  
Enforced In: Frontend display  
Files: `src/components/admin/TimeReports.tsx`  
Functions: `getEntryTypeLabel()`, column headers  
Frontend Only / Backend Only / Both: Frontend display only  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: "Other break" and "lunch break" are both unpaid in this system. No "paid break" type exists.

---

## 6. Active Shift Rules

---

**Rule: Status Driven by Backend Active Break**  
Description: The 4-state status (`clocked_out`, `working`, `lunch_break`, `other_break`) is determined entirely by the response from `GET /time-clock/active`. The frontend sets state from `active_break.type`, not from local tracking.  
Enforced In: Both  
Files: `src/contexts/TimeClockContext.tsx`  
Functions: `loadActiveEntry()`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: Low (correct design)  

---

**Rule: No Elapsed Time Displayed**  
Description: The TimeClockCard does not show how long the employee has been clocked in or on break. There is no running timer in the UI.  
Enforced In: Frontend (absence of feature)  
Files: `src/components/TimeClockCard.tsx`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Low  
Notes: This is a UX gap — employees cannot see their current shift duration without navigating to PayrollHours.

---

## 7. Time Calculation Rules

---

**Rule: Hours Formatted as H:MM (Not Decimal)**  
Description: All hours displayed to users are formatted as `H:MM` (e.g., `8:30`) not decimal (`8.5`). This applies everywhere hours appear: vacation balance, payroll totals, time reports.  
Enforced In: Frontend  
Files: `src/utils/helper.ts`  
Functions: `formatHoursToTime(hours: number): string`, `formatSecondsToTime(seconds: number): string`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No (display only)  
Risk Level: Low  

---

**Rule: Hours from Seconds (Not Float)**  
Description: In `TimeReports.tsx` and `PayrollHours.tsx`, the per-entry totals are computed from `paid_seconds`, `unpaid_seconds`, `worked_seconds` (integers) using `formatSecondsToTime()`. The per-period totals use `paid_hours`, `unpaid_hours`, `total_hours` (floats) using `formatHoursToTime()`.  
Enforced In: Frontend  
Files: `src/components/admin/TimeReports.tsx`, `src/components/PayrollHours.tsx`  
Frontend Only / Backend Only / Both: Frontend display  
Payroll/Vacation Impact: No (display only)  
Risk Level: Low  

---

**Rule: Timezone-Aware Display**  
Description: All timestamps displayed to users are converted to `VITE_APP_TIMEZONE` (currently `America/Chicago`). Raw UTC strings from the API are always formatted using `Intl.DateTimeFormat` with the timezone option. This applies in `TimeReports.tsx`, `PayrollHours.tsx`, `WorkSchedule.tsx`, and `EmployeeAttendance.tsx`.  
Enforced In: Frontend  
Files: Multiple — `TimeReports.tsx`, `PayrollHours.tsx`, `WorkSchedule.tsx`, `EmployeeAttendance.tsx`, `EmpWorkSchedule.tsx`  
Functions: `formatTime()`, `formatDateTime()`, `formatDateToYMD()`  
Frontend Only / Backend Only / Both: Frontend (display); Backend (storage timezone unknown)  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: `VITE_APP_TIMEZONE` is a build-time constant. If the same build is deployed to a tenant in a different timezone, all times will display incorrectly.

---

**Rule: Work Schedule Hours Deduct Lunch**  
Description: When calculating scheduled hours for the work schedule grid, if the shift is longer than 6 hours, lunch is deducted using `settings.default_lunch_duration_minutes`.  
Enforced In: Frontend  
Files: `src/components/admin/WorkSchedule.tsx`, `src/components/EmpWorkSchedule.tsx`  
Functions: `calculateHours(startTime, endTime, includeLunch)`  
Frontend Only / Backend Only / Both: Frontend Only (display calculation for schedule planning)  
Payroll/Vacation Impact: No (schedule display only; actual payroll uses backend calculation)  
Risk Level: Low  

---

**Rule: Available Vacation = Accrued - Used (Excludes Pending)**  
Description: `availableHours = vacationData.accrued_hours - vacationData.used_hours`. Pending (not-yet-approved) vacation requests are NOT subtracted from the displayed available balance.  
Enforced In: Frontend  
Files: `src/components/VacationSummary.tsx:230`, `src/components/admin/VacationManagement.tsx:404`  
Functions: Direct computation in both components  
Frontend Only / Backend Only / Both: Frontend (display); backend balance enforcement unknown  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: An employee with 40 hours available can submit multiple pending requests totaling more than 40 hours — all will appear to be within balance until approved. The backend must subtract pending requests from the balance before allowing new requests.

---

## 8. Rounding Rules

---

**Rule: Pay Increment Rounding Exists**  
Description: The `pay_increments` system setting (default 5 minutes) controls time rounding. The API returns both `adjusted` (rounded) and `actual` (raw) timestamps for every time event. `TimeReports.tsx` and `PayrollHours.tsx` display both values — `adjusted` prominently, `actual` in italic below.  
Enforced In: Backend (rounding logic); Frontend (display only)  
Files: `src/components/admin/TimeReports.tsx`, `src/components/PayrollHours.tsx`  
Functions: `TimeCell` component (renders adjusted vs actual)  
Frontend Only / Backend Only / Both: Backend enforces; Frontend displays  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: Frontend cannot verify the rounding is correct — it only displays what the backend returns. The `pay_start_buffer` and `pay_end_buffer` columns on `employees` suggest per-employee rounding override, but how this interacts with `pay_increments` is unknown.

---

**Rule: Limit Start/End Time to Shift**  
Description: `system_settings.limit_start_time_to_shift` and `limit_end_time_to_shift` are boolean flags. Their enforcement is entirely backend-side — the frontend only stores and displays them via SystemSettings.  
Enforced In: Backend Only (inferred)  
Files: `src/components/admin/SystemSettings.tsx`, `src/types/systemsettings.ts`  
Frontend Only / Backend Only / Both: Backend Only  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  

---

## 9. Pay Period Rules

---

**Rule: Pay Period Anchor-Based Calculation**  
Description: Pay periods are defined by `pay_period_type` (weekly or biweekly) and `pay_period_start_date`. The backend computes all period boundaries from these two values. The frontend requests periods by `number` and displays them by `label`.  
Enforced In: Backend  
Files: `src/types/systemsettings.ts`, `src/components/admin/TimeReports.tsx`, `src/components/PayrollHours.tsx`  
Frontend Only / Backend Only / Both: Backend calculates; Frontend displays  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  

---

**Rule: Current Period Auto-Selected**  
Description: On load, `TimeReports.tsx` and `PayrollHours.tsx` both call `/time-reports/pay-periods`, get `current_period` from the response, and automatically select the current period.  
Enforced In: Frontend  
Files: `src/components/admin/TimeReports.tsx:260`, `src/components/PayrollHours.tsx:106`  
Functions: `fetchPayPeriods()`  
Frontend Only / Backend Only / Both: Frontend (selection); Backend (current period calculation)  
Payroll/Vacation Impact: No (navigation only)  
Risk Level: Low  

---

**Rule: "All" Period Type Shows No Data Without Selection**  
Description: In `TimeReports.tsx`, if `periodType === 'all'` and no specific period is selected (`selectedPayPeriod === null`), `fetchTimeReports()` bails early and shows nothing. The "All" mode only works when the user manually picks a period from the dropdown.  
Enforced In: Frontend  
Files: `src/components/admin/TimeReports.tsx:292-296`  
Functions: `fetchTimeReports()`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Medium  
Notes: This is a UX confusion point. "All" sounds like it shows all periods, but actually requires a specific period selection to show anything. In `PayrollHours.tsx`, "All" is disabled and does not set selectedPayPeriod to null (the period stays selected).

---

**Rule: No Payroll Period Locking**  
Description: There is no UI or API mechanism to lock a pay period after it has been exported to payroll. Admins can edit time entries in any period at any time.  
Enforced In: Not enforced anywhere  
Files: N/A  
Frontend Only / Backend Only / Both: Neither  
Payroll/Vacation Impact: Yes  
Risk Level: Critical  
Notes: Editing exported periods silently creates discrepancies between payroll system records and the Kabba database.

---

## 10. Vacation Accrual Rules

---

**Rule: Accrual is Hours-Based**  
Description: The frontend works entirely in hours (`accrued_hours`, `used_hours`, `allotted_hours`, `hours_worked_this_year`). The accrual is earned based on `hours_worked_this_year` against an annual `vacation_allotment_hour` plan.  
Enforced In: Backend Only  
Files: `src/components/VacationSummary.tsx`, `src/types/employee.ts`  
Frontend Only / Backend Only / Both: Backend calculates; Frontend displays  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: The exact accrual rate formula is not visible in frontend code. Per UI copy: "1 vacation hour per 26 hours worked" is mentioned in `VacationSummary.tsx` UI copy as the accrual description but is not computed in the frontend.

---

**Rule: Bonus Vacation Hours Apply Within a Date Window**  
Description: Employees can receive `bonus_vacation_hours` that only apply between `bonus_vacation_hours_start_date` and `bonus_vacation_hours_end_date`.  
Enforced In: Backend (when computing accrued_hours)  
Files: `src/types/employee.ts`, `src/components/admin/EmployeeManagement.tsx`  
Frontend Only / Backend Only / Both: Backend  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  

---

**Rule: Vacation Eligibility Gate**  
Description: An employee with `vacation_eligible = false` cannot accrue or request vacation. The "Request Vacation Time" button in `VacationSummary.tsx` is disabled when `availableHours <= 0`.  
Enforced In: Frontend (UI gate) + Backend (inferred)  
Files: `src/components/VacationSummary.tsx:347`, `src/types/employee.ts`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  

---

## 11. Vacation Request Rules

---

**Rule: Duration via Option ID (No Manual Days Entry)**  
Description: Employees do not type a number of hours or days. They select a pre-configured duration option (`vacation_request_hour_id`) from a dropdown. The server converts this ID to hours and calculates `end_date`.  
Enforced In: Both (frontend restricts input; backend computes end_date)  
Files: `src/components/VacationSummary.tsx`  
Functions: `handleSubmitRequest()`, `fetchVacationRequestHours()`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: Low  
Notes: This is correct design. The client cannot send manipulated `days_requested` because the field doesn't exist in the submit payload.

---

**Rule: Submit Requires start_date AND vacation_request_hour_id**  
Description: The Submit button is disabled unless both fields are filled. Additionally, it is disabled if `selectedHours > availableHours`.  
Enforced In: Frontend Only  
Files: `src/components/VacationSummary.tsx:305-309`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: Backend must also enforce the balance check — the frontend check is easily bypassed.

---

**Rule: Balance Check Does Not Include Pending Requests**  
Description: `availableHours = accrued_hours - used_hours`. `used_hours` is only updated when requests are approved. Two simultaneous pending requests can each individually pass the balance check.  
Enforced In: Frontend (partial — uses available balance from API but doesn't know about other pending requests)  
Files: `src/components/VacationSummary.tsx:230`, `src/components/VacationSummary.tsx:308`  
Frontend Only / Backend Only / Both: Frontend partial; backend enforcement unknown  
Payroll/Vacation Impact: Yes  
Risk Level: High  

---

**Rule: End Date Preview Uses localStorage (Bug)**  
Description: `calculateEndDate()` reads holiday settings from `localStorage.getItem('demo_system_settings')`. This means the displayed end date preview may be wrong if localStorage is empty, stale, or from a different browser.  
Enforced In: Frontend Only  
Files: `src/components/VacationSummary.tsx:137`  
Functions: `calculateEndDate()`, `getHolidayDates()`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No (display only — server computes real end_date)  
Risk Level: Medium  
Notes: The actual `end_date` stored in the database is computed by the backend, so this bug only affects the preview, not the stored data.

---

**Rule: Holiday Calculation is Correct (Mathematically)**  
Description: The frontend's `getHolidayDates()` function correctly computes U.S. floating holidays — Last Monday in May (Memorial Day), First Monday in September (Labor Day), Fourth Thursday in November (Thanksgiving). The math has been verified for multiple years.  
Enforced In: Frontend  
Files: `src/components/VacationSummary.tsx:169-221`  
Functions: `getHolidayDates()`  
Frontend Only / Backend Only / Both: Frontend Only (display preview)  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

**Rule: No Overlap Detection on Request Submission**  
Description: The frontend does not check whether the requested vacation dates overlap with existing approved or pending requests. There is no overlap warning shown before submission.  
Enforced In: Neither (frontend has no check; backend enforcement unknown)  
Files: N/A  
Frontend Only / Backend Only / Both: Neither  
Payroll/Vacation Impact: Yes  
Risk Level: High  

---

## 12. Vacation Approval / Denial Rules

---

**Rule: Approval Requires SweetAlert Confirmation**  
Description: Admin must confirm approval through a SweetAlert dialog before the API call is made.  
Enforced In: Frontend  
Files: `src/components/admin/VacationManagement.tsx:118-129`  
Functions: `handleApproveRequest()`  
Frontend Only / Backend Only / Both: Frontend (confirmation); Backend (enforcement)  
Payroll/Vacation Impact: Yes  
Risk Level: Low  

---

**Rule: Denial Requires a Reason (Min 3 Characters)**  
Description: Admin must enter a denial reason of at least 3 characters. Validation happens in the SweetAlert `preConfirm` hook before the API call.  
Enforced In: Frontend  
Files: `src/components/admin/VacationManagement.tsx:153-175`  
Functions: `handleDenyRequest()`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Low  
Notes: Backend should also validate reason length.

---

**Rule: Approval and Denial Only Available for Pending Requests**  
Description: The Approve/Deny buttons are only rendered when `request.status === 'pending'`.  
Enforced In: Frontend  
Files: `src/components/admin/VacationManagement.tsx:362`  
Frontend Only / Backend Only / Both: Frontend (UI gate); Backend (must also enforce)  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  
Notes: Backend must reject approve/deny attempts on already-approved or already-denied requests.

---

**Rule: After Approval, Balance is NOT Re-fetched From Frontend State**  
Description: After calling approve or deny, `fetchVacationRequests()` AND `fetchVacationRecords()` are both called, forcing a full refresh from the backend.  
Enforced In: Frontend  
Files: `src/components/admin/VacationManagement.tsx:145-147`, `src/components/admin/VacationManagement.tsx:192-194`  
Frontend Only / Backend Only / Both: Frontend  
Payroll/Vacation Impact: No  
Risk Level: Low (correct design — no stale optimistic updates)  

---

## 13. Vacation Balance Rules

---

**Rule: Admin Can Override Used Hours Directly**  
Description: Admin can manually set `used_hours` to any non-negative decimal (step 0.5) for any employee in the Vacation Management edit form.  
Enforced In: Frontend (min=0, step=0.5); Backend (inferred)  
Files: `src/components/admin/VacationManagement.tsx:444-458`  
Functions: `saveChanges()`  
Frontend Only / Backend Only / Both: Frontend validation + Backend update  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: This is a legitimate correction mechanism, but there is no audit trail. Corrections are silent.

---

**Rule: Admin Sets Allotted Hours via Plan Selection, Not Free Text**  
Description: Admin cannot type an arbitrary number. They must select from `vacation_allotment_hours` options via a dropdown.  
Enforced In: Frontend + Backend (FK constraint)  
Files: `src/components/admin/VacationManagement.tsx:412-435`  
Functions: `saveChanges()` — requires `vacation_allotment_hour_id`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: Low  

---

**Rule: Allotment ID is Required Before Save**  
Description: The save button in VacationManagement is disabled (`disabled={!editValues.vacation_allotment_hour_id}`) until a valid allotment option is selected.  
Enforced In: Frontend  
Files: `src/components/admin/VacationManagement.tsx:481`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

## 14. Work Schedule Rules

---

**Rule: Employees Cannot Save Work Schedules**  
Description: `EmpWorkSchedule.tsx` (employee view) has no save function. `WorkSchedule.tsx` (admin view) has `saveWorkSchedule()`. Employees can view their schedule but not modify it.  
Enforced In: Frontend (no UI element); Backend (must enforce)  
Files: `src/components/EmpWorkSchedule.tsx` (no save), `src/components/admin/WorkSchedule.tsx:482`  
Frontend Only / Backend Only / Both: Frontend (design); Backend (must enforce on `/work-schedule/work-schedule/save`)  
Payroll/Vacation Impact: No  
Risk Level: Medium  

---

**Rule: Schedule Dates Are Specific, Not Day-of-Week**  
Description: Work schedules are stored by specific `date` (YYYY-MM-DD), not recurring day-of-week. The store's `weekly_schedule` provides the default for each date, but the actual schedule entry is date-specific.  
Enforced In: Both  
Files: `src/components/admin/WorkSchedule.tsx`  
Functions: `fetchWorkSchedule()`, `saveWorkSchedule()`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

**Rule: Schedule Hours Calculated Client-Side for Display**  
Description: In the work schedule grid, `hours` per shift is calculated in JavaScript: `(endTime - startTime) - lunch_duration_minutes/60` if shift > 6 hours. This is display-only; it does not affect payroll.  
Enforced In: Frontend Only  
Files: `src/components/admin/WorkSchedule.tsx:440-456`  
Functions: `calculateHours()`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

## 15. Attendance Rules

---

**Rule: Attendance Date Range Filtering**  
Description: Employee attendance records are fetched with `start_date` and `end_date` query params. Date ranges supported: current month, last month, select month, current year, last year.  
Enforced In: Frontend  
Files: `src/components/EmployeeAttendance.tsx`, `src/lib/dateRanges.ts`  
Functions: `loadAttendanceData()`, `getDateRange()`  
Frontend Only / Backend Only / Both: Frontend (determines range); Backend (filters records)  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

**Rule: Attendance Stats Include Achievement Badge**  
Description: The attendance API response includes `stats: { days_present, days_late, days_missed, days_excused, total_minutes_late, achievement: AchievementGoal|null }`. The badge is computed by the backend against `achievement_goals`.  
Enforced In: Backend  
Files: `src/components/EmployeeAttendance.tsx:90`, `src/types/attendance-stats.ts`  
Frontend Only / Backend Only / Both: Backend  
Payroll/Vacation Impact: No  
Risk Level: Low  

---

**Rule: Admin Monthly Summary Recalculation Uses Supabase Directly**  
Description: The admin "Recalculate" action in `AttendanceTracking.tsx` fetches all active employees from Supabase and calls the `calculate_monthly_summary` Postgres function directly. This bypasses the Kabba API entirely.  
Enforced In: Frontend (Supabase client)  
Files: `src/components/admin/AttendanceTracking.tsx:170-190`  
Functions: `recalculateAllSummaries()`  
Frontend Only / Backend Only / Both: Frontend (Supabase client calls)  
Payroll/Vacation Impact: No  
Risk Level: High  
Notes: If the Supabase project is unavailable or the function signature changes, this feature silently breaks. The frontend-to-Supabase direct call also means this logic bypasses any backend authorization checks.

---

## 16. Overtime Rules

---

**Rule: No Overtime Calculation Exists**  
Description: There is no overtime tracking anywhere in the frontend. `TimeReportData` contains `total_hours`, `paid_hours`, `lunch_hours`, `unpaid_hours`, `vacation_hours` — no `overtime_hours` or `regular_hours`. No overtime threshold, rate, or weekly boundary is referenced anywhere.  
Enforced In: Neither  
Files: N/A  
Frontend Only / Backend Only / Both: Neither  
Payroll/Vacation Impact: Yes  
Risk Level: Critical  
Notes: If any employees are non-exempt hourly workers under FLSA (U.S.), overtime must be calculated and paid at 1.5x for hours over 40/week. This system does not implement this. Legal exposure if this applies.

---

## 17. Admin Time Edit Rules

---

**Rule: Entry Type Drives Edit Behavior**  
Description: When editing time entries, each event has a specific `entry_type` (`clock_in`, `clock_out`, `lunch_out`, `lunch_in`, `unpaid_out`, `unpaid_in`). The edit/save/delete payloads always include `entry_type` and `break_id` to identify the exact event.  
Enforced In: Both  
Files: `src/components/admin/TimeReports.tsx`  
Functions: `handleSaveEditEntry()`, `handleDeleteEntry()`, `handleAddNewTime()`  
Frontend Only / Backend Only / Both: Both  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  

---

**Rule: Delete Requires SweetAlert Confirmation**  
Description: Admin must confirm deletion through a SweetAlert dialog. The confirmation states "Deleted entries cannot be recovered."  
Enforced In: Frontend  
Files: `src/components/admin/TimeReports.tsx:1138-1153`  
Functions: `handleDeleteEntry()`  
Frontend Only / Backend Only / Both: Frontend (confirmation); Backend (deletion)  
Payroll/Vacation Impact: Yes  
Risk Level: Medium  
Notes: There is no soft-delete or undo. Deletions are permanent.

---

**Rule: No Validation that clock_out > clock_in in Frontend**  
Description: When an admin edits a time entry, only the time `HH:MM` is editable (not the date separately via the new inline editor). The date is locked for existing entries. However, there is no client-side validation that the entered clock-out time is after the clock-in time on the same day.  
Enforced In: Neither  
Files: `src/components/admin/TimeReports.tsx`  
Functions: `EditInputCell`, `handleSaveEditEntry()`  
Frontend Only / Backend Only / Both: Neither  
Payroll/Vacation Impact: Yes  
Risk Level: High  
Notes: An admin can submit a clock-out time earlier than the clock-in time, resulting in negative paid hours unless the backend catches it.

---

**Rule: No Audit Trail for Admin Edits**  
Description: There is no `time_entry_audit_logs` table or display visible in the frontend. When admin changes a time entry, there is no record of who changed what, from what value, to what value.  
Enforced In: Neither  
Files: N/A  
Frontend Only / Backend Only / Both: Neither  
Payroll/Vacation Impact: Yes  
Risk Level: Critical  
Notes: Without an audit trail, fraudulent or accidental payroll manipulation cannot be detected after the fact.

---

## 18. Employee Management Rules

---

**Rule: Employee CRUD Limited to Vacation Settings**  
Description: In `EmployeeManagement.tsx`, admin can only edit `vacation_eligible`, `vacation_allotment_hour_id`, `vacation_start_day_id`, and bonus vacation fields. Name, email, employee code, and roles are view-only — "From Roles Module."  
Enforced In: Frontend (fields are read-only); Backend (inferred separate module)  
Files: `src/components/admin/EmployeeManagement.tsx:204-246`  
Frontend Only / Backend Only / Both: Frontend (UI); Backend (different module handles core employee data)  
Payroll/Vacation Impact: Yes (vacation eligibility affects all vacation accrual)  
Risk Level: Low  

---

**Rule: No Employee Delete in Frontend**  
Description: The delete button (`<Trash2>`) is commented out in `EmployeeManagement.tsx`. No DELETE endpoint is called from the frontend.  
Enforced In: Frontend (commented out)  
Files: `src/components/admin/EmployeeManagement.tsx:541-543`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: Yes (if delete were enabled, payroll history would be at risk)  
Risk Level: Low (feature is disabled)  

---

## 19. System Settings Rules

---

**Rule: Settings Fetched Globally on App Load**  
Description: `SettingsContext` fetches `GET /system/settings` on mount, making settings available to all components via `useSettings()`. Components use `settings.minimum_lunch_duration_minutes` for UI defaults.  
Enforced In: Frontend  
Files: `src/contexts/SettingsContext.tsx`  
Functions: `fetchSettings()`  
Frontend Only / Backend Only / Both: Frontend (distribution); Backend (storage)  
Payroll/Vacation Impact: No (settings use in frontend is display/UX only)  
Risk Level: Low  

---

**Rule: Holiday Config Stored in System Settings, Not Used for Vacation End-Date Preview**  
Description: `SystemSettings.tsx` correctly reads and writes holidays via `/system/settings`. However, `VacationSummary.tsx → calculateEndDate()` reads holidays from `localStorage('demo_system_settings')` instead of from `SettingsContext`. This is a disconnection bug.  
Enforced In: Frontend (bug)  
Files: `src/components/VacationSummary.tsx:137`, `src/components/admin/SystemSettings.tsx`  
Frontend Only / Backend Only / Both: Frontend Only  
Payroll/Vacation Impact: No (end-date preview only; server computes real end_date)  
Risk Level: Medium  

---

**Rule: Auto Clock-Out Config Exists but No Frontend Enforcement**  
Description: `auto_clock_out_limit_minutes` and `auto_clock_out_time` exist in system settings. The frontend stores and displays these values but does not implement any auto-clock-out timer or check.  
Enforced In: Backend Only (assumed — must be a scheduled job)  
Files: `src/types/systemsettings.ts`, `src/components/admin/SystemSettings.tsx`  
Frontend Only / Backend Only / Both: Backend Only  
Payroll/Vacation Impact: Yes (auto-clock-out affects paid hours)  
Risk Level: Medium  
Notes: If the backend scheduled job does not exist in the production backend, employees who forget to clock out will remain "active" indefinitely.

---

## 20. Missing / Unclear Rules

---

**Rule: UNCLEAR — How is `minutes_late` calculated?**  
Description: `AttendanceRecord.minutes_late` is computed somewhere. It could be backend-computed at clock-in time, or computed by the Supabase `calculate_monthly_summary` function. The frontend does not calculate it.  
Risk Level: High  
Notes: If calculated using UTC instead of tenant timezone, every record will be wrong by the UTC offset.

---

**Rule: MISSING — Can an employee clock in before their shift?**  
Description: `system_settings.limit_start_time_to_shift` exists. If `true`, should prevent clock-in before `shift_start_time`. But no shift_start_time appears to be validated client-side, and the rule's backend implementation is not visible.  
Risk Level: High  

---

**Rule: MISSING — Is there rate limiting on clock actions?**  
Description: No rate limiting is visible on the frontend for clock-in, clock-out, or break actions beyond the `processingAction` lock (one request at a time per tab). The backend rate limiting status is unknown.  
Risk Level: Medium  

---

**Rule: MISSING — What happens to active entries at midnight / period boundary?**  
Description: If an employee clocks in before midnight and clocks out after midnight, how is the shift assigned to a pay period? How is `clock_in` date used for period assignment? No frontend rule exists for this.  
Risk Level: High  

---

**Rule: MISSING — What is `vacation_start_day.day_number`?**  
Description: The `Employee.vacation_start_day` object has a `day_number` field. It is unclear whether this is "day of year" (anniversary), "day of month," or something else. The vacation accrual reset logic is entirely in the backend.  
Risk Level: Medium  

---

**Rule: MISSING — Are deleted time entry records recoverable?**  
Description: `POST /users/time-entries/delete` exists and the SweetAlert says "cannot be recovered." It is unknown whether the backend performs a soft-delete (with `deleted_at`) or a hard delete. If hard delete, payroll history is permanently destroyed.  
Risk Level: Critical  

# TimeTracker Pro V2

A comprehensive employee time tracking and attendance management system with achievement-based gamification.

## Features

### Time Clock Management
- Clock in/out functionality with real-time tracking
- Today's time entries overview
- Historical time entry viewing and reporting
- Automatic attendance calculation from time entries

### Attendance Tracking & Achievements
- Automatic attendance calculation from time entries
- Configurable achievement goals (trophies, badges, emojis)
- Days missed and days late tracking
- Monthly attendance summaries
- Customizable achievement thresholds
- Visual gamification with achievement display

### Date Range Views
- **Current Month to Date** - Shows attendance from first day of current month until today
- **Last Month** - Complete attendance for the previous month
- **Select Month** - Custom month picker to choose any specific month
- **Current Year to Date** - All attendance from January 1st until today
- **Last Year** - Complete attendance for the entire previous year

### Work Schedule Management
- Flexible weekly schedules
- Day-specific start/end times
- Working day configuration
- Break time management

### Vacation Management
- Vacation request submission
- Admin approval workflow
- Vacation balance tracking
- Leave history

### Admin Dashboard
- Employee management
- Time reports and analytics
- Attendance tracking with achievements
- Achievement goal configuration
- Work schedule configuration
- Vacation request management
- System settings

### Employee Dashboard
- Personal time clock
- Today's time entries
- Attendance overview with earned achievements
- Vacation summary and request
- Achievement history across multiple periods
- Personal attendance statistics

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email/Password)

## Database Schema

### Tables
- `employees` - Employee records with role-based access
- `time_entries` - Clock in/out records
- `vacation_requests` - Leave requests and approvals
- `work_schedules` - Employee weekly schedules
- `attendance_records` - Daily attendance status (present, late, missed, excused)
- `achievement_goals` - Configurable achievement tiers
- `monthly_attendance_summary` - Pre-calculated monthly stats

### Security
- Row Level Security (RLS) enabled on all tables
- Role-based access control (admin/employee)
- Secure authentication via Supabase Auth
- Helper functions to prevent infinite recursion in RLS policies

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Timetracker_Pro_V2
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
Create a `.env` file in the root directory:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run database migrations
All migrations are located in `/supabase/migrations/` and should be applied in order:
- `20251004134951_create_time_tracking_schema.sql` - Initial schema
- `20251004135121_create_test_users.sql` - Test user setup
- `20251004140007_create_demo_accounts.sql` - Demo accounts
- `20251004141521_fix_rls_policies.sql` - RLS policy fixes
- `20251004155201_create_attendance_tracking_schema.sql` - Attendance tables
- `20251004155445_auto_attendance_tracking.sql` - Auto-calculation triggers

5. Start development server
```bash
npm run dev
```

6. Build for production
```bash
npm run build
```

## Default Demo Accounts

### Admin Account
- Email: admin@demo.com
- Password: admin123

### Employee Account
- Email: john@demo.com
- Password: demo123

## Achievement System

### Default Achievement Goals

**Positive Achievements:**
- 🏆 Gold Trophy: Zero days missed, zero days late
- 🥈 Silver Trophy: Zero days missed, 1 day late
- 🥉 Bronze Trophy: Zero days missed, 2 days late

**Negative Indicators:**
- 😞 Sad Face: 2 days missed OR 5 days late
- 😠 Angry Face: 3 days missed OR 8 days late

### Customization
Admins can fully customize achievement goals:
- Change icons (any emoji or unicode character)
- Modify colors (hex values)
- Adjust thresholds (days missed/late)
- Create new achievement tiers
- Enable/disable goals
- Set display order

## Project Structure

```
src/
├── components/
│   ├── admin/                    # Admin-specific components
│   │   ├── AttendanceTracking.tsx  # Attendance & achievement management
│   │   ├── EmployeeManagement.tsx  # Employee CRUD
│   │   ├── SystemSettings.tsx      # System configuration
│   │   ├── TimeReports.tsx         # Time reporting
│   │   ├── VacationManagement.tsx  # Vacation approvals
│   │   └── WorkSchedule.tsx        # Schedule management
│   ├── EmployeeAttendance.tsx    # Employee attendance view
│   ├── Header.tsx                # Navigation header
│   ├── TimeClockCard.tsx         # Clock in/out widget
│   ├── TodayTimeEntries.tsx      # Today's entries
│   └── VacationSummary.tsx       # Vacation balance
├── contexts/                     # React contexts
│   ├── AuthContext.tsx           # Authentication state
│   └── TimeClockContext.tsx      # Time tracking state
├── lib/                          # Utilities and configurations
│   ├── api.ts                    # API helper functions
│   ├── dateRanges.ts             # Date range calculations
│   └── supabase.ts               # Supabase client
├── pages/                        # Main page components
│   ├── AdminDashboard.tsx        # Admin main page
│   ├── EmployeeDashboard.tsx     # Employee main page
│   └── LoginPage.tsx             # Login page
└── main.tsx                      # Application entry point

supabase/
└── migrations/                   # Database migration files
```

## Key Features Explained

### Automatic Attendance Tracking
The system automatically creates attendance records when employees clock in:
- Calculates late arrivals based on work schedule (defaults to 9:00 AM)
- Tracks missed days when no clock-in occurs
- Accumulates total minutes late
- Automatically determines achievement eligibility
- Triggers on every time entry insert/update

### Flexible Date Range Reporting
Both admin and employee views support five date range options:
1. Current Month to Date
2. Last Month
3. Select Month (custom)
4. Current Year to Date
5. Last Year

Statistics and achievements are calculated dynamically for any selected period.

### Achievement Gamification
The configurable achievement system motivates employees through visual recognition:
- Achievements automatically calculated based on attendance
- Visual display with emoji icons and custom colors
- Positive achievements (rewards) and negative indicators
- Historical achievement tracking
- Real-time achievement updates

### Row Level Security (RLS)
Comprehensive security policies ensure data protection:
- Employees can only view their own records
- Admins can view and manage all records
- Helper function `is_admin()` prevents infinite recursion
- All tables have restrictive default policies

## API Reference

### Database Functions

#### `calculate_attendance_status(employee_id, date)`
Calculates attendance status for a specific employee and date based on time entries and work schedule.

#### `calculate_monthly_summary(employee_id, year, month)`
Generates monthly attendance summary and assigns appropriate achievement based on goals.

#### `recalculate_current_month_summaries()`
Recalculates all monthly summaries for active employees for the current month.

#### `mark_missed_attendance_days()`
Should be run daily to mark missed days for employees who didn't clock in on working days.

#### `is_admin()`
Security definer function that checks if current user is an admin, used in RLS policies.

## Troubleshooting

### Common Issues

**Login Error: "Employee record not found"**
- Cause: RLS policies had infinite recursion
- Fixed in migration: `20251004141521_fix_rls_policies.sql`
- Solution: Uses `is_admin()` helper function

**Attendance not calculating**
- Ensure work schedules are set up for employees
- Check that time entries have both clock_in and clock_out times
- Run `recalculate_current_month_summaries()` to force recalculation

**Achievements not showing**
- Verify achievement goals are active (`is_active = true`)
- Check that display_order is set correctly
- Ensure thresholds (days_missed_max, days_late_max) are configured

## Performance Considerations

- Attendance calculations are triggered automatically on clock out
- Monthly summaries are pre-calculated and cached
- Date range queries use indexed columns for fast retrieval
- Achievement calculation is done client-side for flexibility

## Future Enhancements

Potential features for V3:
- Push notifications for achievements
- Attendance leaderboards
- Custom reporting export (CSV/PDF)
- Mobile app version
- Integration with payroll systems
- Advanced analytics dashboard
- Multi-language support

## License

Copyright © 2025 TimeTracker Pro. All rights reserved.

## Support

For issues or questions, please refer to the documentation or contact the development team.

---

**Version**: 2.0.0
**Last Updated**: October 2025
**Status**: Production Ready

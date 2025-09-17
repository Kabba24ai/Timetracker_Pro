# Time Clock System - Demo Version

A comprehensive time tracking system built with React, TypeScript, and Tailwind CSS. This demo version works entirely offline using localStorage for data persistence.

## Features

- **Employee Time Tracking**
  - Clock in/out functionality
  - Lunch break tracking (unpaid)
  - Unpaid break tracking
  - Real-time status display

- **Vacation Management**
  - Automatic vacation accrual (1 hour per 26 hours worked)
  - Vacation balance tracking
  - Admin vacation management

- **Admin Dashboard**
  - Employee management
  - Time reports and analytics
  - Vacation administration
  - System settings

- **Responsive Design**
  - Mobile-friendly interface
  - Modern UI with Tailwind CSS
  - Professional appearance

## Demo Credentials

### Employee Account
- **Email:** john@demo.com
- **Password:** demo123

### Admin Account
- **Email:** admin@demo.com
- **Password:** admin123

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`
5. Use the demo credentials above to login

## Technology Stack

- **Frontend:** React 18 with TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Routing:** React Router DOM
- **Build Tool:** Vite
- **Data Storage:** localStorage (demo mode)

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── admin/           # Admin-specific components
│   ├── Header.tsx       # Navigation header
│   ├── LoadingSpinner.tsx
│   ├── ProtectedRoute.tsx
│   ├── TimeClockCard.tsx
│   ├── TodayTimeEntries.tsx
│   └── VacationSummary.tsx
├── contexts/            # React context providers
│   ├── AuthContext.tsx  # Authentication state
│   └── TimeClockContext.tsx # Time tracking state
├── pages/               # Page components
│   ├── AdminDashboard.tsx
│   ├── EmployeeDashboard.tsx
│   └── LoginPage.tsx
├── lib/                 # Utility libraries
│   └── supabase.ts     # Supabase client (placeholder)
└── App.tsx             # Main application component
```

## Demo Data

The system includes mock data for demonstration:
- 3 sample employees (John Doe, Jane Smith, Admin User)
- Sample time entries and vacation records
- Configurable system settings

All data is stored in localStorage and persists during your browser session.

## Features in Detail

### Time Tracking
- Employees can clock in/out for their shifts
- Lunch breaks are automatically deducted from paid time
- Unpaid breaks can be tracked separately
- All entries are timestamped and stored

### Vacation System
- Vacation hours accrue based on hours worked
- Standard rate: 1 vacation hour per 26 hours worked
- Employees can view their vacation balance
- Admins can adjust vacation allocations

### Admin Features
- View all employee time reports
- Manage employee information
- Adjust vacation balances
- Configure system settings
- Export capabilities (UI ready)

## Customization

The system is designed to be easily customizable:
- Modify vacation accrual rates in system settings
- Adjust shift times and pay buffers
- Customize the UI theme and branding
- Add additional employee fields

## Production Deployment

To deploy this system for production use:
1. Replace localStorage with a real database (Supabase recommended)
2. Implement proper user authentication
3. Add data validation and error handling
4. Set up proper environment variables
5. Configure build and deployment pipeline

## License

This project is provided as a demonstration. Please ensure you have appropriate licenses for any production use.
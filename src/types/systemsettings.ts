export interface SystemSettingsType  {
  pay_increments: number;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_start_date: string;
  default_lunch_duration_minutes: number;
  limit_start_time_to_shift: boolean;
  limit_end_time_to_shift: boolean;
  // Automated messaging settings
  first_clock_in_reminder_minutes: number;
  second_clock_in_reminder_minutes: number;
  auto_clock_out_limit_minutes: number;
  clock_in_message_1: string;
  clock_in_message_2: string;
  auto_clock_out_message: string;
  auto_clock_out_time: string;

  // Holiday settings
  holidays: {
    [year: string]: {
      new_years_day: boolean;
      memorial_day: boolean;
      independence_day: boolean;
      labor_day: boolean;
      thanksgiving_day: boolean;
      christmas_day: boolean;
      floating_holidays?: { [date: string]: { name: string; enabled: boolean } };
    };
  };
  daily_shifts: {
    monday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    tuesday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    wednesday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    thursday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    friday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    saturday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    sunday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
  };
}
import { AchievementGoal } from './achievement';

export interface AttendanceStats {
  days_present: number;
  days_late: number;
  days_missed: number;
  days_excused: number;
  total_minutes_late: number;
  achievement: AchievementGoal | null;
}

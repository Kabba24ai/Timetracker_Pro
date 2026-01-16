export type AchievementGoalType = 'positive' | 'negative';

export interface AchievementGoal {
  id: string;
  goal_name: string;
  icon: string;        // emoji or icon string
  color: string;       // hex or tailwind color
  description: string;

  goal_type: AchievementGoalType;
  days_missed_max: number;
  days_late_max: number;

  is_active?: boolean;
  display_order?: number;
}

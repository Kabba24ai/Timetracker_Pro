export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export type DateRangeOption =
  | 'current-month'
  | 'last-month'
  | 'select-month'
  | 'current-year'
  | 'last-year';

export const getDateRange = (option: DateRangeOption, selectedDate?: Date): DateRange => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  switch (option) {
    case 'current-month': {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return {
        startDate: start,
        endDate: end,
        label: `${start.toLocaleString('default', { month: 'long', year: 'numeric' })} (Month to Date)`
      };
    }

    case 'last-month': {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const start = new Date(lastMonthYear, lastMonth, 1);
      const end = new Date(lastMonthYear, lastMonth + 1, 0);
      return {
        startDate: start,
        endDate: end,
        label: `${start.toLocaleString('default', { month: 'long', year: 'numeric' })}`
      };
    }

    case 'select-month': {
      if (!selectedDate) {
        return getDateRange('current-month');
      }
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        startDate: start,
        endDate: end,
        label: `${start.toLocaleString('default', { month: 'long', year: 'numeric' })}`
      };
    }

    case 'current-year': {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      return {
        startDate: start,
        endDate: end,
        label: `${currentYear} (Year to Date)`
      };
    }

    case 'last-year': {
      const lastYear = currentYear - 1;
      const start = new Date(lastYear, 0, 1);
      const end = new Date(lastYear, 11, 31);
      return {
        startDate: start,
        endDate: end,
        label: `${lastYear}`
      };
    }

    default:
      return getDateRange('current-month');
  }
};

export const dateRangeOptions: { value: DateRangeOption; label: string }[] = [
  { value: 'current-month', label: 'Current Month to Date' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'select-month', label: 'Select Month' },
  { value: 'current-year', label: 'Current Year to Date' },
  { value: 'last-year', label: 'Last Year' },
];

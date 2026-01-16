

/**
 * Format JS Date to YYYY-MM-DD (API safe)
 * Example: 2025-01-09
 */
export const formatDateForApi = (date?: Date | null): string => {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Convert 24-hour time (HH:mm) to 12-hour AM/PM format
 * Example: "13:30" → "01:30 PM"
 */
export const formatTime12h = (time?: string | null): string => {
  if (!time) return '';

  const [hours, minutes] = time.split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return '';
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};


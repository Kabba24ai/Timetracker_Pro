export function formatHoursToTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const formattedMins = mins.toString().padStart(2, '0');

  return `${hrs}:${formattedMins}`;
}

export function formatSecondsToTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const formattedMins = mins.toString().padStart(2, '0');

  return `${hrs}:${formattedMins}`;
}
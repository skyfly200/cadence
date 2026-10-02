/** Clock text for a wall-clock time: '12' gives "2:40 pm", '24' gives "14:40". */
export type TimeFormat = '12' | '24';

export function formatClock(hour: number, minute: number, format: TimeFormat = '12'): string {
  const mm = String(minute).padStart(2, '0');
  if (format === '24') return `${hour}:${mm}`;
  return `${hour % 12 || 12}:${mm} ${hour < 12 ? 'am' : 'pm'}`;
}

/**
 * Format date to ISO string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Get timestamp in seconds
 */
export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get timestamp in milliseconds
 */
export function getTimestampMs(): number {
  return Date.now();
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Check if date is expired
 */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

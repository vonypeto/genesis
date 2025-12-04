/**
 * Delay execution for a specified amount of time
 * @param ms - Milliseconds to delay
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delay with exponential backoff
 * @param attempt - Current attempt number
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 */
export async function exponentialBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
): Promise<void> {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

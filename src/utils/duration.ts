const DURATION_PATTERN = /^(\d+)([smhd])$/;

const unitToMs = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
} as const;

export function durationToDate(duration: string, from = new Date()): Date {
  const match = DURATION_PATTERN.exec(duration);

  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof unitToMs;

  return new Date(from.getTime() + amount * unitToMs[unit]);
}

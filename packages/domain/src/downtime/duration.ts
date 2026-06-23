const oneDayMs = 24 * 60 * 60 * 1000;

export interface DowntimeDurationInput {
  readonly startTime: Date;
  readonly endTime?: Date | null;
  readonly now?: Date;
}

export function calculateDowntimeDurationMinutes(input: DowntimeDurationInput): number {
  const startMs = input.startTime.getTime();
  let endMs = (input.endTime ?? input.now ?? new Date()).getTime();

  while (endMs < startMs) {
    endMs += oneDayMs;
  }

  return Math.round((endMs - startMs) / 60_000);
}

export const downtimeStatuses = ["OPEN", "CLOSED"] as const;

export type DowntimeStatus = (typeof downtimeStatuses)[number];

export function isDowntimeStatus(status: string): status is DowntimeStatus {
  return downtimeStatuses.includes(status as DowntimeStatus);
}

export function canTransitionDowntimeStatus(from: DowntimeStatus, to: DowntimeStatus): boolean {
  if (from === to) return true;
  return from === "OPEN" && to === "CLOSED";
}

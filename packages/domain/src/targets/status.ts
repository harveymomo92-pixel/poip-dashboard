export const targetWorkflowStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "INACTIVE",
  "SUPERSEDED"
] as const;

export type TargetWorkflowStatus = (typeof targetWorkflowStatuses)[number];

const allowedTransitions: Record<TargetWorkflowStatus, readonly TargetWorkflowStatus[]> = {
  DRAFT: ["SUBMITTED", "APPROVED", "REJECTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: ["INACTIVE", "SUPERSEDED"],
  ACTIVE: ["INACTIVE", "SUPERSEDED"],
  REJECTED: ["SUBMITTED"],
  INACTIVE: [],
  SUPERSEDED: []
};

export function isTargetWorkflowStatus(status: string): status is TargetWorkflowStatus {
  return targetWorkflowStatuses.includes(status as TargetWorkflowStatus);
}

export function canTransitionTargetStatus(
  from: TargetWorkflowStatus,
  to: TargetWorkflowStatus
): boolean {
  if (from === to) return true;
  return allowedTransitions[from].includes(to);
}

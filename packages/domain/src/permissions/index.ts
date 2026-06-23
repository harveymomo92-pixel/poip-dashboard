export const roles = [
  "Admin",
  "Manager",
  "PPIC",
  "ProductionLeader",
  "Maintenance",
  "QC",
  "Viewer"
] as const;

export const permissions = [
  "dashboard.view",
  "output.view",
  "output.export",
  "target.view",
  "target.create",
  "target.approve",
  "downtime.view",
  "downtime.create",
  "downtime.update",
  "downtime.close",
  "parser.preview",
  "parser.commit",
  "import.preview",
  "import.commit",
  "sync.view",
  "sync.run",
  "data_quality.view",
  "audit.view",
  "settings.manage",
  "users.manage"
] as const;

export type Role = (typeof roles)[number];
export type Permission = (typeof permissions)[number];

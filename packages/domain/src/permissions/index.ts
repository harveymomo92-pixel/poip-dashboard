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
  "master_data.view",
  "master_data.manage",
  "data_quality.view",
  "audit.view",
  "settings.manage",
  "users.manage"
] as const;

export type Role = (typeof roles)[number];
export type Permission = (typeof permissions)[number];

export const roleDescriptions = {
  Admin: "Full system access.",
  Manager: "Executive view, reports, approval, and export.",
  PPIC: "Output, target, detail, selected import, and export workflows.",
  ProductionLeader: "Downtime input and review, shift view, and output view.",
  Maintenance: "Downtime, action item, and maintenance reports.",
  QC: "Reject view, QC notes, and reject export.",
  Viewer: "Read-only dashboard access."
} as const satisfies Record<Role, string>;

export const permissionDescriptions = {
  "dashboard.view": "View executive and operational dashboards.",
  "output.view": "View production output data.",
  "output.export": "Export production output data.",
  "target.view": "View production targets.",
  "target.create": "Create and revise production targets.",
  "target.approve": "Approve production targets.",
  "downtime.view": "View downtime events and summaries.",
  "downtime.create": "Create downtime events.",
  "downtime.update": "Update downtime events.",
  "downtime.close": "Close downtime events.",
  "parser.preview": "Preview WhatsApp parser results.",
  "parser.commit": "Commit reviewed parser results.",
  "import.preview": "Preview import files.",
  "import.commit": "Commit reviewed import runs.",
  "sync.view": "View sync status and history.",
  "sync.run": "Run sync jobs.",
  "master_data.view": "View master data and mapping coverage.",
  "master_data.manage": "Manage master data, aliases, and mapping jobs.",
  "data_quality.view": "View data quality issues.",
  "audit.view": "View audit logs.",
  "settings.manage": "Manage system settings.",
  "users.manage": "Manage users and roles."
} as const satisfies Record<Permission, string>;

export const rolePermissionMatrix = {
  Admin: permissions,
  Manager: [
    "dashboard.view",
    "output.view",
    "output.export",
    "target.view",
    "target.approve",
    "downtime.view",
    "downtime.close",
    "master_data.view",
    "data_quality.view",
    "audit.view"
  ],
  PPIC: [
    "dashboard.view",
    "output.view",
    "output.export",
    "target.view",
    "target.create",
    "downtime.view",
    "downtime.create",
    "downtime.update",
    "parser.preview",
    "parser.commit",
    "import.preview",
    "import.commit",
    "sync.view",
    "master_data.view",
    "master_data.manage",
    "data_quality.view"
  ],
  ProductionLeader: [
    "dashboard.view",
    "output.view",
    "target.view",
    "downtime.view",
    "downtime.create",
    "downtime.update",
    "downtime.close",
    "parser.preview",
    "parser.commit"
  ],
  Maintenance: [
    "dashboard.view",
    "output.view",
    "downtime.view",
    "downtime.create",
    "downtime.update",
    "downtime.close"
  ],
  QC: ["dashboard.view", "output.view", "output.export", "downtime.view", "data_quality.view"],
  Viewer: ["dashboard.view", "output.view", "target.view", "downtime.view", "master_data.view"]
} as const satisfies Record<Role, readonly Permission[]>;

export function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}

export function isPermission(value: string): value is Permission {
  return permissions.includes(value as Permission);
}

export function getPermissionsForRoles(inputRoles: readonly Role[]): Permission[] {
  return [...new Set(inputRoles.flatMap((role) => rolePermissionMatrix[role]))];
}

export function hasPermission(inputRoles: readonly Role[], permission: Permission): boolean {
  return getPermissionsForRoles(inputRoles).includes(permission);
}

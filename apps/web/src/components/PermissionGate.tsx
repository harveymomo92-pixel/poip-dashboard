"use client";

import type { ReactNode } from "react";
import type { CurrentUser } from "../lib/api";

export function PermissionGate({
  user,
  permission,
  fallback,
  children
}: Readonly<{
  user: CurrentUser | null;
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}>) {
  if (!user?.permissions.includes(permission)) {
    return fallback ?? <ForbiddenState />;
  }

  return children;
}

export function ForbiddenState() {
  return (
    <section className="panel">
      <p className="eyebrow">Forbidden</p>
      <h1>Akses ditolak</h1>
      <p>Akun ini belum memiliki permission untuk membuka halaman tersebut.</p>
    </section>
  );
}

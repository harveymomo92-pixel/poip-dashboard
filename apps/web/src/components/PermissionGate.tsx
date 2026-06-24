"use client";

import type { ReactNode } from "react";
import type { CurrentUser } from "../lib/api";
import { ErrorState } from "./ui";

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
    <div className="page">
      <ErrorState message="Akun ini belum memiliki permission untuk membuka halaman tersebut. Hubungi administrator bila akses ini diperlukan untuk pekerjaan Anda." />
    </div>
  );
}

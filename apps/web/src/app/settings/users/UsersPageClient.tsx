"use client";

import { useEffect, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import { DataTable, EmptyState, LoadingSkeleton, PageHeader, SectionHeader, StatusBadge } from "../../../components/ui";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly roles: readonly string[];
}

export function UsersPageClient() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<readonly UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!mounted) return;
      if (me.ok) {
        setCurrentUser(me.data.user);
        if (me.data.user.permissions.includes("users.manage")) {
          const usersResponse = await fetch(`${API_BASE_URL}/users`, { credentials: "include" });
          const userPayload = (await usersResponse.json()) as ApiResult<readonly UserRow[]>;
          if (userPayload.ok) setUsers(userPayload.data);
        }
      }
      setLoaded(true);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!loaded) return <div className="page"><LoadingSkeleton rows={6} /></div>;

  return (
    <PermissionGate user={currentUser} permission="users.manage" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Settings" title="Users & Access" description="Lihat akun, role, dan status akses. Permission tetap diterapkan oleh backend dan RBAC yang ada." meta={<StatusBadge status="ACTIVE" label={`${users.length} akun`} />} />
        <section><SectionHeader title="Daftar user" description="Role menjelaskan cakupan kerja; status disabled mencegah sesi baru." />
        {users.length === 0 ? <EmptyState title="Belum ada user" description="Tidak ada akun yang dapat ditampilkan untuk sesi ini." /> : <DataTable headers={["User", "Nama", "Role", "Status"]}>
          {users.map((user) => (
            <tr key={user.id}><td><strong>{user.email}</strong></td><td>{user.name}</td><td>{user.roles.join(", ") || "—"}</td><td><StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} label={user.isActive ? "Active" : "Disabled"} /></td></tr>
          ))}
        </DataTable>}</section>
      </div>
    </PermissionGate>
  );
}

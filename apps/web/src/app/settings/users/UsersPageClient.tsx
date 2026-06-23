"use client";

import { useEffect, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
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

  if (!loaded) return <section className="panel">Loading users...</section>;

  return (
    <PermissionGate user={currentUser} permission="users.manage" fallback={<ForbiddenState />}>
      <section className="panel">
        <p className="eyebrow">Settings</p>
        <h1>Users</h1>
        <div className="table">
          {users.map((user) => (
            <div className="table-row" key={user.id}>
              <span>{user.email}</span>
              <span>{user.name}</span>
              <span>{user.roles.join(", ")}</span>
              <span>{user.isActive ? "Active" : "Disabled"}</span>
            </div>
          ))}
        </div>
      </section>
    </PermissionGate>
  );
}

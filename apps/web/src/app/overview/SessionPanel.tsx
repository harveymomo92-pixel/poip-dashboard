"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";

export function SessionPanel() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" })
      .then((response) => response.json() as Promise<ApiResult<{ user: CurrentUser }>>)
      .then((payload) => {
        if (!mounted) return;
        if (payload.ok) setUser(payload.data.user);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    router.push("/login");
    router.refresh();
  }

  if (loading) return <p>Loading session...</p>;
  if (!user) return <p>Session tidak valid.</p>;

  return (
    <section className="panel">
      <p className="eyebrow">Session</p>
      <h1>Overview</h1>
      <p>
        Masuk sebagai <strong>{user.name}</strong> ({user.email})
      </p>
      <dl className="facts">
        <div>
          <dt>Roles</dt>
          <dd>{user.roles.join(", ")}</dd>
        </div>
        <div>
          <dt>Permissions</dt>
          <dd>{user.permissions.length}</dd>
        </div>
      </dl>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </section>
  );
}

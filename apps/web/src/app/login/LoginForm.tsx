"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });
      const payload = (await response.json()) as ApiResult<{ user: CurrentUser; token: string }>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      router.push("/overview");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

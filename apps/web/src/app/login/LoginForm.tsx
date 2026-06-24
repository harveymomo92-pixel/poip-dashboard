"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";
import { useToast } from "../../components/Toast";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
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
      toast(`Selamat datang, ${payload.data.user.name}.`);
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
        <input name="email" type="email" autoComplete="email" placeholder="nama@perusahaan.com" required />
      </label>
      <label>
        Kata sandi
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? "Memverifikasi…" : "Masuk"}
      </button>
    </form>
  );
}

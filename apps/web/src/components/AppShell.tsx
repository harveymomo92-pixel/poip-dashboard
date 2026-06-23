import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">POIP</p>
          <strong>PPIC Output Intelligence</strong>
        </div>
        <nav>
          <Link href="/overview">Overview</Link>
          <Link href="/settings/users">Users</Link>
        </nav>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}

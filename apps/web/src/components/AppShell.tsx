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
          <Link href="/downtime">Downtime</Link>
          <Link href="/tools/wa-parser">WA Parser</Link>
          <Link href="/settings/sync">Sync</Link>
          <Link href="/settings/targets">Targets</Link>
          <Link href="/settings/users">Users</Link>
        </nav>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}

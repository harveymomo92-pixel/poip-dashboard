"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type JSX, type ReactNode, type SVGProps } from "react";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../lib/api";
import { Icons } from "./Icons";
import { DropdownMenu, Tooltip } from "./ui";

interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

const navigation: readonly { readonly group: string; readonly items: readonly NavigationItem[] }[] = [
  { group: "Dashboard", items: [{ href: "/overview", label: "Overview", icon: Icons.overview }] },
  { group: "Operations", items: [{ href: "/downtime", label: "Downtime", icon: Icons.downtime }] },
  { group: "Tools", items: [
    { href: "/tools/import-center", label: "Import Center", icon: Icons.import },
    { href: "/tools/wa-parser", label: "WA Parser", icon: Icons.parser }
  ] },
  { group: "Settings", items: [
    { href: "/settings/sync", label: "Sync Center", icon: Icons.sync },
    { href: "/settings/targets", label: "Targets", icon: Icons.target },
    { href: "/settings/users", label: "Users", icon: Icons.users }
  ] }
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("poip.sidebar.collapsed") === "true");
    void fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" })
      .then((response) => response.json() as Promise<ApiResult<{ user: CurrentUser }>>)
      .then((payload) => { if (payload.ok) setCurrentUser(payload.data.user); });
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("poip.sidebar.collapsed", String(next));
      return next;
    });
  }

  async function logout() {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const activeItem = navigation.flatMap((group) => group.items).find((item) => pathname.startsWith(item.href));
  const activeGroup = navigation.find((group) => group.items.some((item) => pathname.startsWith(item.href)));

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}${drawerOpen ? " drawer-open" : ""}`}>
      <aside className="sidebar" aria-label="Navigasi utama">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div className="brand-copy"><strong>POIP</strong><small>Operations cockpit</small></div>
          <button aria-label="Tutup menu" className="icon-button mobile-only" onClick={() => setDrawerOpen(false)}><Icons.close /></button>
        </div>
        <nav>
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <p>{group.group}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return <Tooltip label={item.label} key={item.href}><Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} onClick={() => setDrawerOpen(false)}><Icon /><span>{item.label}</span>{active ? <i /> : null}</Link></Tooltip>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="workspace-state"><span /><div><strong>Production</strong><small>Asia/Jakarta</small></div></div>
        <button aria-pressed={collapsed} className="sidebar-toggle secondary-button" onClick={toggleCollapsed} title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>
          {collapsed ? <Icons.expand /> : <Icons.collapse />}<span>{collapsed ? "Perluas" : "Ciutkan menu"}</span>
        </button>
        </div>
      </aside>
      <div className="sidebar-scrim" onClick={() => setDrawerOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-context">
            <button aria-label="Buka menu" className="icon-button mobile-only" onClick={() => setDrawerOpen(true)}><Icons.menu /></button>
            <span>POIP</span><Icons.chevron /><span>{activeGroup?.group ?? "Workspace"}</span><Icons.chevron /><strong>{activeItem?.label ?? "Workspace"}</strong>
          </div>
          <div className="topbar-actions">
          <Tooltip label="Notifikasi belum dikonfigurasi">
            <span className="notification-control" aria-label="Notifikasi belum dikonfigurasi"><Icons.bell /></span>
          </Tooltip>
          <DropdownMenu className="user-menu" trigger={
            <>
              <span className="user-avatar">{currentUser?.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
              <span className="user-copy"><strong>{currentUser?.name ?? "User"}</strong><small>{currentUser?.roles[0] ?? "Session"}</small></span>
              <Icons.chevron />
            </>
          }>
            <div>
              <div><strong>{currentUser?.name ?? "User"}</strong><small>{currentUser?.email ?? "Sesi aktif"}</small></div>
              <button className="menu-action" onClick={logout}><Icons.logout /> Keluar</button>
            </div>
          </DropdownMenu>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

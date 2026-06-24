import type { Metadata } from "next";
import { ToastProvider } from "../components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "PPIC Output Intelligence",
  description: "Operational intelligence platform for PPIC, production, maintenance, and quality teams."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}

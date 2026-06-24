"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Icons } from "./Icons";

type ToastTone = "success" | "error" | "info";
interface ToastItem { readonly id: number; readonly message: string; readonly tone: ToastTone; }
interface ToastApi { toast: (message: string, tone?: ToastTone) => void; }

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            {item.tone === "success" ? <Icons.check /> : <Icons.alert />}
            <span>{item.message}</span>
            <button aria-label="Tutup notifikasi" className="icon-button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><Icons.close /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

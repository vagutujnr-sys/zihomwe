"use client";

import { Bell, Check, Menu, Store } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppNotification } from "@/components/notification-runtime";
import { readSessionToken } from "@/lib/session";

interface MainHeaderProps {
  onOpenDrawer: () => void;
  onGoHome?: () => void;
  onOpenChats?: (chatId?: string | null) => void;
  onOpenRequests?: () => void;
}

export function MainHeader({ onOpenDrawer, onGoHome, onOpenChats, onOpenRequests }: MainHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    function onSync(event: Event) {
      const detail = (event as CustomEvent<{ notifications: AppNotification[]; unreadCount: number }>).detail;
      if (!detail) return;
      setNotifications(detail.notifications ?? []);
      setUnreadCount(detail.unreadCount ?? 0);
    }
    window.addEventListener("zihomwe:notifications-sync", onSync as EventListener);
    return () => window.removeEventListener("zihomwe:notifications-sync", onSync as EventListener);
  }, []);

  async function markNotificationsRead() {
    const sessionToken = readSessionToken();
    if (!sessionToken || unreadCount === 0) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken }),
    });
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    window.dispatchEvent(new Event("zihomwe:notifications-updated"));
  }

  function toggleNotifications() {
    setNotificationsOpen((open) => !open);
    if (!notificationsOpen) void markNotificationsRead();
  }

  function openNotification(notification: AppNotification) {
    setNotificationsOpen(false);
    const type = (notification.type || "").toLowerCase();
    if (type === "chat_request") {
      onOpenRequests?.();
      onOpenChats?.();
      return;
    }
    if (
      type.includes("chat") ||
      type.includes("message") ||
      type.includes("call") ||
      notification.chatId
    ) {
      onOpenChats?.(notification.chatId ?? null);
      return;
    }
    setNotificationsOpen(true);
  }

  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <header className="fixed inset-x-0 top-0 z-30 min-h-[80px] border-b border-slate-200 bg-white shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-[80px] max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onGoHome?.()}
          className="flex items-center gap-3"
          aria-label="Zihomwe home"
        >
          <img src="/logo_main_second.png" alt="Zihomwe logo" className="block h-12 w-auto" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Marketplace"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition hover:text-slate-900"
          >
            <Store className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            onClick={toggleNotifications}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition hover:text-slate-900"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-slate-950">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Open menu"
            onClick={onOpenDrawer}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition hover:text-slate-900"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      {notificationsOpen && (
        <div className="absolute right-4 top-[76px] w-[min(360px,calc(100vw-2rem))] overflow-hidden border border-slate-200 bg-white shadow-2xl sm:right-6">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Your updates</p>
              <h2 className="mt-1 text-sm font-bold text-slate-900">Notifications</h2>
            </div>
            <Check className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">You have no new notifications.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left ${
                    notification.read_at ? "bg-white" : "bg-emerald-50/60"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                  <p className="mt-2 text-[10px] text-slate-400">{formatTime(notification.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { readSessionToken } from "@/lib/session";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  read_at: string | null;
  created_at: string;
  chatId?: string | null;
  callId?: string | null;
  data?: Record<string, unknown>;
};

type NotificationRuntimeProps = {
  onOpenChats?: (chatId?: string | null) => void;
  onOpenRequests?: () => void;
};

function isChatNotification(item: AppNotification) {
  const type = (item.type || "").toLowerCase();
  return (
    type.includes("chat") ||
    type.includes("message") ||
    type === "incoming_call" ||
    Boolean(item.chatId)
  );
}

function playChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(980, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.34);
    window.setTimeout(() => void context.close(), 500);
  } catch {
    // ignore
  }
}

async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied" as NotificationPermission;
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied" as NotificationPermission;
  }
}

function showBrowserNotification(item: AppNotification, onClick: () => void) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const iconUrl = `${window.location.origin}/app_icon.png`;
    const note = new Notification(item.title || "Zihomwe", {
      body: item.message,
      tag: item.id,
      renotify: true,
      icon: iconUrl,
      badge: iconUrl,
      data: { chatId: item.chatId, type: item.type, id: item.id },
    });
    note.onclick = () => {
      window.focus();
      onClick();
      note.close();
    };
  } catch {
    // ignore
  }
}

export function NotificationRuntime({ onOpenChats, onOpenRequests }: NotificationRuntimeProps) {
  const [toast, setToast] = useState<AppNotification | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const toastTimer = useRef<number | null>(null);
  const permissionAsked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const sync = (notifications: AppNotification[], unreadCount: number) => {
      window.dispatchEvent(
        new CustomEvent("zihomwe:notifications-sync", {
          detail: { notifications, unreadCount },
        })
      );
    };

    const handleOpen = (item: AppNotification) => {
      setToast(null);
      if (item.type === "chat_request") {
        onOpenRequests?.();
        onOpenChats?.();
        return;
      }
      onOpenChats?.(item.chatId ?? null);
    };

    const pull = async () => {
      const sessionToken = readSessionToken();
      if (!sessionToken) {
        if (!cancelled) timer = window.setTimeout(pull, 10000);
        return;
      }

      try {
        if (!permissionAsked.current) {
          permissionAsked.current = true;
          void ensureNotificationPermission();
        }

        const response = await fetch(`/api/notifications?sessionToken=${encodeURIComponent(sessionToken)}`);
        if (!response.ok) throw new Error("notify fetch failed");
        const payload = await response.json();
        const next = (payload.notifications ?? []) as AppNotification[];
        const previous = knownIds.current;

        if (previous) {
          const fresh = next.filter((item) => !previous.has(item.id));
          if (fresh.length) {
            const newest = fresh[0];
            playChime();
            setToast(newest);
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setToast(null), 7000);

            // System notification when tab is hidden or for chat alerts
            if (isChatNotification(newest)) {
              window.dispatchEvent(new Event("zihomwe:inbox-changed"));
            }
            if (document.visibilityState === "hidden" || isChatNotification(newest)) {
              showBrowserNotification(newest, () => handleOpen(newest));
            }
          }
        }

        knownIds.current = new Set(next.map((item) => item.id));
        sync(next, payload.unreadCount ?? 0);
      } catch {
        // keep quiet — next tick retries
      }

      if (!cancelled) timer = window.setTimeout(pull, document.visibilityState === "visible" ? 15000 : 30000);
    };

    void pull();

    const onRefresh = () => void pull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    window.addEventListener("zihomwe:notifications-updated", onRefresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      window.removeEventListener("zihomwe:notifications-updated", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onOpenChats, onOpenRequests]);

  if (!toast) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const item = toast;
        setToast(null);
        if (!item) return;
        if (item.type === "chat_request") {
          onOpenRequests?.();
          onOpenChats?.();
          return;
        }
        onOpenChats?.(item.chatId ?? null);
      }}
      className="fixed right-4 top-20 z-[80] w-[min(360px,calc(100vw-2rem))] overflow-hidden border border-emerald-200 bg-white text-left shadow-2xl shadow-emerald-950/20 sm:right-6"
    >
      <span className="block h-1 bg-emerald-500" />
      <span className="flex items-start gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100">
          <img src="/app_icon.png" alt="" className="h-9 w-9 object-cover" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {isChatNotification(toast) ? "Chat" : "New notification"}
          </span>
          <span className="mt-1 block truncate text-sm font-bold text-slate-900">{toast.title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-600">{toast.message}</span>
        </span>
      </span>
    </button>
  );
}

import { readCitizenToken } from "@/lib/citizen-token";

const PHONE_KEY = "zihomweUserPhone";
const DEVICE_KEY = "zihomweDeviceId";
const TOKEN_KEY = "zihomweSessionToken";
const WELCOME_KEY = "hasSeenWelcomePopup";

export function readCitizenSession() {
  if (typeof window === "undefined") {
    return { phone: null as string | null, deviceId: null as string | null };
  }

  return {
    phone: window.localStorage.getItem(PHONE_KEY),
    deviceId: window.localStorage.getItem(DEVICE_KEY),
  };
}

export function hasCitizenSession() {
  const { phone, deviceId } = readCitizenSession();
  return Boolean(phone && deviceId);
}

export function readSessionToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function readCitizenUserProfile() {
  if (typeof window === "undefined") {
    return { fullName: null as string | null, handle: null as string | null, initials: "U" };
  }

  const profile = readCitizenToken(readSessionToken());
  const fullName = profile?.fullName?.trim() || null;
  const handle = profile?.handle?.trim() || null;
  const nameSource = fullName || handle || "Member";
  const initials = nameSource
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  return {
    fullName,
    handle,
    initials,
  };
}

export function writeCitizenSession(phone: string, deviceId: string, sessionToken?: string | null) {
  window.localStorage.setItem(PHONE_KEY, phone);
  window.localStorage.setItem(DEVICE_KEY, deviceId);
  if (sessionToken) window.localStorage.setItem(TOKEN_KEY, sessionToken);
}

export function clearCitizenSession() {
  window.localStorage.removeItem(PHONE_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  // Keep device id so the same browser stays stable across sign-out/sign-in.
}

/** Mint the app token from the Supabase Auth session. No phone or device lookup. */
export async function ensureCitizenToken() {
  if (typeof window === "undefined") return;
  if (readSessionToken()) return;
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload.sessionToken) {
    window.localStorage.setItem(TOKEN_KEY, payload.sessionToken);
    if (payload.mobileNumber) window.localStorage.setItem(PHONE_KEY, payload.mobileNumber);
  }
}

export function hasSeenWelcome() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(WELCOME_KEY) === "true";
}

export function markWelcomeSeen() {
  window.localStorage.setItem(WELCOME_KEY, "true");
}

export function markWelcomePending() {
  window.localStorage.setItem(WELCOME_KEY, "false");
}

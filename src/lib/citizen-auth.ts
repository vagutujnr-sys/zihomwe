import { authEmailFromPhone, authPasswordFromPin } from "@/lib/auth-pin";
import { supabase } from "@/lib/supabase";

export async function signInWithCitizenPin(storedPhone: string, pin: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmailFromPhone(storedPhone),
    password: authPasswordFromPin(pin),
  });

  if (error || !data.session) {
    const message = (error?.message || "").toLowerCase();
    if (message.includes("email logins are disabled") || message.includes("email provider is disabled")) {
      throw new Error("Email logins are disabled in Supabase. Enable Authentication > Sign In / Providers > Email for this project.");
    }
    if (message.includes("invalid") || message.includes("credential")) {
      throw new Error("Incorrect PIN.");
    }
    throw new Error(error?.message || "Could not sign in.");
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.sessionToken) {
    throw new Error(payload.message || "Signed in, but the profile link is missing.");
  }

  return {
    sessionToken: String(payload.sessionToken),
    mobileNumber: String(payload.mobileNumber || storedPhone),
  };
}

import { authEmailFromPhone, authPasswordFromPin } from "@/lib/auth-pin";
import { getSupabaseServer } from "@/lib/supabase-server";

type AuthUser = { id: string; email?: string | null };

function authErrorMessage(error: { message?: string } | null | undefined) {
  const message = error?.message || "Could not create the sign-in account.";
  const lower = message.toLowerCase();
  if (lower.includes("password") && (lower.includes("6") || lower.includes("short") || lower.includes("least"))) {
    return "Supabase rejected the PIN. In Authentication settings, set the minimum password length to 6 or lower, then try again.";
  }
  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return "This phone already has a sign-in. Enter the PIN you created.";
  }
  return message;
}

async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=20&filter=${encodeURIComponent(email)}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { users?: AuthUser[] };
  return (payload.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Create a confirmed email user using the phone-derived internal email identity. */
export async function ensureEmailAuthUser(storedPhone: string, pin: string, registrationId: string) {
  const supabase = getSupabaseServer();
  const email = authEmailFromPhone(storedPhone);
  const password = authPasswordFromPin(pin);

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { registration_id: registrationId },
  });

  if (created.data.user) return created.data.user;

  const message = (created.error?.message || "").toLowerCase();
  const taken = message.includes("already") || message.includes("registered") || message.includes("exists");
  if (!taken) {
    throw new Error(authErrorMessage(created.error));
  }

  const existing = await findAuthUserByEmail(email);
  if (!existing) throw new Error(authErrorMessage(created.error));

  const linked = await supabase
    .from("registrations")
    .select("id")
    .eq("auth_user_id", existing.id)
    .maybeSingle();

  if (linked.error && !String(linked.error.message || "").includes("auth_user_id")) {
    throw new Error(linked.error.message);
  }
  if (linked.data && linked.data.id !== registrationId) {
    throw new Error("This phone already has a sign-in. Enter the PIN you created.");
  }

  const updated = await supabase.auth.admin.updateUserById(existing.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: { registration_id: registrationId },
  });
  if (updated.error || !updated.data.user) {
    throw new Error(authErrorMessage(updated.error));
  }
  return updated.data.user;
}

export async function linkRegistrationToAuthUser(registrationId: string, authUserId: string) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("registrations")
    .update({ auth_user_id: authUserId })
    .eq("id", registrationId);
  if (!error) return;

  const missing = String(error.message || "").includes("auth_user_id");
  if (missing) {
    throw new Error("Run database_schema/11_supabase_auth.sql in the Supabase SQL editor, then try again.");
  }
  throw new Error(error.message);
}

export async function deleteAuthUser(authUserId: string) {
  await getSupabaseServer().auth.admin.deleteUser(authUserId);
}

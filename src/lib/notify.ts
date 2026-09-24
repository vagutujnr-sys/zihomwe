import { getSupabaseServer } from "@/lib/supabase-server";

export type NotifyPayload = {
  registrationId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
};

/** Current @handle for a person. The sign-in token can still carry an older handle. */
export async function senderLabel(registrationId: string, fallbackHandle?: string | null, fallbackName?: string | null) {
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("registrations")
      .select("handle, full_name")
      .eq("id", registrationId)
      .maybeSingle();
    const handle = data?.handle || fallbackHandle;
    const name = data?.full_name || fallbackName;
    return handle ? `@${handle}` : name || "Someone";
  } catch {
    return fallbackHandle ? `@${fallbackHandle}` : fallbackName || "Someone";
  }
}

/** Insert a user notification. Never throws — chat/calls must not fail because of notify. */
export async function notifyUser(payload: NotifyPayload) {
  try {
    const supabase = getSupabaseServer();
    const row: Record<string, unknown> = {
      registration_id: payload.registrationId,
      title: payload.title,
      message: payload.message.slice(0, 500),
      // Encode chatId in type as fallback when `data` column is missing
      type:
        payload.data?.chatId && typeof payload.data.chatId === "string"
          ? `${payload.type}:${payload.data.chatId}`
          : payload.type,
    };
    if (payload.data && Object.keys(payload.data).length) {
      row.data = payload.data;
    }

    const { error } = await supabase.from("notifications").insert(row);
    if (error && String(error.message || "").includes("data")) {
      // Column may not exist yet — insert without data
      const { error: fallbackError } = await supabase.from("notifications").insert({
        registration_id: payload.registrationId,
        title: payload.title,
        message: payload.message.slice(0, 500),
        type: payload.type,
      });
      if (fallbackError) console.error("notifyUser fallback failed", fallbackError.message);
      return;
    }
    if (error) console.error("notifyUser failed", error.message);
  } catch (error) {
    console.error("notifyUser error", error);
  }
}

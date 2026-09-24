import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";

function mapNotification(row: Record<string, unknown>) {
  const data = (row.data && typeof row.data === "object" ? row.data : {}) as Record<string, unknown>;
  const rawType = String(row.type ?? "general");
  const [baseType, embeddedId] = rawType.includes(":") ? rawType.split(/:(.+)/) : [rawType, null];
  const chatId =
    typeof data.chatId === "string"
      ? data.chatId
      : embeddedId && (baseType.startsWith("chat") || baseType.includes("message") || baseType.includes("call"))
        ? embeddedId
        : null;

  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: baseType,
    read_at: row.read_at,
    created_at: row.created_at,
    data,
    chatId,
    callId: typeof data.callId === "string" ? data.callId : null,
  };
}

export async function GET(request: Request) {
  try {
    const sessionToken = new URL(request.url).searchParams.get("sessionToken")?.trim() ?? "";
    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ notifications: [], unreadCount: 0 });

    const supabase = getSupabaseServer();
    const registrationId = me.id;

    let result = await supabase
      .from("notifications")
      .select("id, title, message, type, read_at, created_at, data")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (result.error && String(result.error.message || "").includes("data")) {
      result = await supabase
        .from("notifications")
        .select("id, title, message, type, read_at, created_at")
        .eq("registration_id", registrationId)
        .order("created_at", { ascending: false })
        .limit(40);
    }

    if (result.error) {
      return NextResponse.json({ message: "Unable to load notifications." }, { status: 500 });
    }

    const notifications = (result.data ?? []).map((row) => mapNotification(row as Record<string, unknown>));

    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read_at).length,
    });
  } catch (error) {
    console.error("Notifications API error", error);
    return NextResponse.json({ message: "Notifications could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const id = body.id ? String(body.id) : null;
    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ ok: true });

    const supabase = getSupabaseServer();
    const registrationId = me.id;

    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("registration_id", registrationId);
    query = id ? query.eq("id", id) : query.is("read_at", null);
    const { error } = await query;
    if (error) return NextResponse.json({ message: "Unable to update notifications." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notifications update API error", error);
    return NextResponse.json({ message: "Notifications could not be updated." }, { status: 500 });
  }
}

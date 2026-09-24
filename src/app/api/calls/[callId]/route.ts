import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";
import { buildProfileImageUrl } from "@/lib/profile";
import { formatHandle } from "@/lib/handles";

async function loadCallForUser(callId: string, userId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("call_sessions")
    .select("*")
    .eq("id", callId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.caller_id !== userId && data.callee_id !== userId) return null;
  return data;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await context.params;
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";
    const after = url.searchParams.get("after");

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const call = await loadCallForUser(callId, me.id);
    if (!call) return NextResponse.json({ message: "Call not found." }, { status: 404 });

    const otherId = call.caller_id === me.id ? call.callee_id : call.caller_id;
    const supabase = getSupabaseServer();
    const { data: other } = await supabase
      .from("registrations")
      .select("id, full_name, handle, profile_image_path")
      .eq("id", otherId)
      .maybeSingle();

    let signalsQuery = supabase
      .from("call_signals")
      .select("id, sender_id, signal_type, payload, created_at")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });

    if (after) {
      signalsQuery = signalsQuery.gt("created_at", after);
    }

    const { data: signals, error: signalsError } = await signalsQuery;
    if (signalsError) throw signalsError;

    return NextResponse.json({
      call: {
        id: call.id,
        chatId: call.chat_id,
        callerId: call.caller_id,
        calleeId: call.callee_id,
        callType: call.call_type,
        status: call.status,
        other: other
          ? {
              id: other.id,
              fullName: other.full_name || formatHandle(other.handle) || "Member",
              handle: other.handle,
              avatarUrl: buildProfileImageUrl(other.profile_image_path),
            }
          : null,
      },
      signals: (signals ?? []).filter((row) => row.sender_id !== me.id),
      meId: me.id,
    });
  } catch (error) {
    console.error("Call GET error", error);
    return NextResponse.json({ message: "Could not load call." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await context.params;
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const action = String(body.action ?? "");

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const call = await loadCallForUser(callId, me.id);
    if (!call) return NextResponse.json({ message: "Call not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    if (action === "accept") {
      if (call.callee_id !== me.id) {
        return NextResponse.json({ message: "Only the callee can accept." }, { status: 403 });
      }
      const { data, error } = await supabase
        .from("call_sessions")
        .update({ status: "active", started_at: now, updated_at: now })
        .eq("id", callId)
        .eq("status", "ringing")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ call: data });
    }

    if (action === "decline") {
      if (call.callee_id !== me.id) {
        return NextResponse.json({ message: "Only the callee can decline." }, { status: 403 });
      }
      const { error } = await supabase
        .from("call_sessions")
        .update({ status: "declined", ended_at: now, updated_at: now })
        .eq("id", callId);
      if (error) throw error;
      await supabase.from("call_signals").insert({
        call_id: callId,
        sender_id: me.id,
        signal_type: "hangup",
        payload: { reason: "declined" },
      });
      return NextResponse.json({ ok: true, status: "declined" });
    }

    if (action === "end" || action === "fail") {
      const status = action === "fail" ? "failed" : "ended";
      const { error } = await supabase
        .from("call_sessions")
        .update({ status, ended_at: now, updated_at: now })
        .eq("id", callId)
        .in("status", ["ringing", "active"]);
      if (error) throw error;
      await supabase.from("call_signals").insert({
        call_id: callId,
        sender_id: me.id,
        signal_type: "hangup",
        payload: { reason: status },
      });
      return NextResponse.json({ ok: true, status });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Call PATCH error", error);
    return NextResponse.json({ message: "Could not update call." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await context.params;
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const signalType = String(body.signalType ?? "");
    const payload = body.payload ?? {};

    if (!["offer", "answer", "ice", "hangup"].includes(signalType)) {
      return NextResponse.json({ message: "Invalid signal." }, { status: 400 });
    }

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const call = await loadCallForUser(callId, me.id);
    if (!call) return NextResponse.json({ message: "Call not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("call_signals")
      .insert({
        call_id: callId,
        sender_id: me.id,
        signal_type: signalType,
        payload,
      })
      .select("id, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ signal: data });
  } catch (error) {
    console.error("Call signal error", error);
    return NextResponse.json({ message: "Could not send signal." }, { status: 500 });
  }
}

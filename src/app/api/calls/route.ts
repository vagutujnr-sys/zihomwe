import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";
import { assertChatParticipant, isBlockedEitherWay } from "@/lib/chat-guards";
import { buildProfileImageUrl } from "@/lib/profile";
import { formatHandle } from "@/lib/handles";
import { notifyUser, senderLabel } from "@/lib/notify";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";
    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("call_sessions")
      .select("id, chat_id, caller_id, callee_id, call_type, status, created_at")
      .eq("callee_id", me.id)
      .eq("status", "ringing")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;

    const callerIds = [...new Set((data ?? []).map((row) => row.caller_id))];
    const { data: people } = callerIds.length
      ? await supabase.from("registrations").select("id, full_name, handle, profile_image_path").in("id", callerIds)
      : { data: [] };
    const map = new Map((people ?? []).map((p) => [p.id, p]));

    return NextResponse.json({
      calls: (data ?? []).map((row) => {
        const person = map.get(row.caller_id);
        return {
          id: row.id,
          chatId: row.chat_id,
          callerId: row.caller_id,
          calleeId: row.callee_id,
          callType: row.call_type,
          status: row.status,
          other: person
            ? {
                id: person.id,
                fullName: person.full_name || formatHandle(person.handle) || "Caller",
                handle: person.handle,
                avatarUrl: buildProfileImageUrl(person.profile_image_path),
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Incoming calls error", error);
    return NextResponse.json({ message: "Could not load calls." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const chatId = String(body.chatId ?? "");
    const callType = body.callType === "video" ? "video" : "audio";

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const chat = await assertChatParticipant(chatId, me.id);
    if (!chat) return NextResponse.json({ message: "Chat not found." }, { status: 404 });

    const otherId = chat.participant_one_id === me.id ? chat.participant_two_id : chat.participant_one_id;
    if (!otherId) return NextResponse.json({ message: "Invalid chat participants." }, { status: 400 });

    if (await isBlockedEitherWay(me.id, otherId)) {
      return NextResponse.json({ message: "You can’t call this user." }, { status: 403 });
    }

    const supabase = getSupabaseServer();

    // End any stale ringing calls for this pair
    await supabase
      .from("call_sessions")
      .update({ status: "missed", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("status", "ringing")
      .or(
        `and(caller_id.eq.${me.id},callee_id.eq.${otherId}),and(caller_id.eq.${otherId},callee_id.eq.${me.id})`
      );

    const { data: call, error } = await supabase
      .from("call_sessions")
      .insert({
        chat_id: chatId,
        caller_id: me.id,
        callee_id: otherId,
        call_type: callType,
        status: "ringing",
      })
      .select("id, chat_id, caller_id, callee_id, call_type, status")
      .single();
    if (error) throw error;

    await notifyUser({
      registrationId: otherId,
      title: callType === "video" ? "Incoming video call" : "Incoming voice call",
      message: `${await senderLabel(me.id, me.handle, me.full_name)} is calling…`,
      type: "incoming_call",
      data: {
        callId: call.id,
        chatId,
        callType,
        callerId: me.id,
      },
    });

    return NextResponse.json({ call });
  } catch (error) {
    console.error("Start call error", error);
    return NextResponse.json({ message: "Could not start call." }, { status: 500 });
  }
}

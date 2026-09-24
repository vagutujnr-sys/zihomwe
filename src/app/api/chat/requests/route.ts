import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";
import { buildProfileImageUrl } from "@/lib/profile";
import { orderedParticipantIds } from "@/lib/handles";
import { isBlockedEitherWay } from "@/lib/chat-guards";
import { notifyUser, senderLabel } from "@/lib/notify";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";
    const box = url.searchParams.get("box") === "sent" ? "sent" : "inbox";

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ requests: [] });

    const supabase = getSupabaseServer();
    const column = box === "sent" ? "from_registration_id" : "to_registration_id";
    const otherColumn = box === "sent" ? "to_registration_id" : "from_registration_id";

    const { data, error } = await supabase
      .from("chat_requests")
      .select(`id, note, status, created_at, updated_at, from_registration_id, to_registration_id`)
      .eq(column, me.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Chat requests list error", error);
      return NextResponse.json({ requests: [] });
    }

    const otherIds = [...new Set((data ?? []).map((row) => row[otherColumn] as string))];
    const { data: people, error: peopleError } = otherIds.length
      ? await supabase.from("registrations").select("id, full_name, handle, profile_image_path").in("id", otherIds)
      : { data: [], error: null };
    if (peopleError) throw peopleError;

    const peopleMap = new Map((people ?? []).map((person) => [person.id, person]));

    const requests = (data ?? []).map((row) => {
      const other = peopleMap.get(row[otherColumn] as string);
      return {
        id: row.id,
        note: row.note,
        status: row.status,
        createdAt: row.created_at,
        other: other
          ? {
              id: other.id,
              fullName: other.full_name,
              handle: other.handle,
              avatarUrl: buildProfileImageUrl(other.profile_image_path),
            }
          : null,
      };
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Chat requests list error", error);
    return NextResponse.json({ requests: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const toHandle = String(body.toHandle ?? "").replace(/^@/, "").trim().toLowerCase();
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";

    if (!toHandle) {
      return NextResponse.json({ message: "Enter a handle to message." }, { status: 400 });
    }

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });
    if (!me.handle) {
      return NextResponse.json({ message: "Set your @handle in Profile before messaging." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: target, error: targetError } = await supabase
      .from("registrations")
      .select("id, full_name, handle, profile_image_path")
      .ilike("handle", toHandle)
      .limit(1)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ message: "No user found with that handle." }, { status: 404 });
    if (target.id === me.id) {
      return NextResponse.json({ message: "You cannot message yourself." }, { status: 400 });
    }

    if (await isBlockedEitherWay(me.id, target.id)) {
      return NextResponse.json({ message: "You can’t message this user." }, { status: 403 });
    }

    const [one, two] = orderedParticipantIds(me.id, target.id);
    const { data: existingThread } = await supabase
      .from("chats")
      .select("id")
      .eq("participant_one_id", one)
      .eq("participant_two_id", two)
      .eq("is_group", false)
      .limit(1)
      .maybeSingle();

    if (existingThread) {
      return NextResponse.json({ alreadyConnected: true, chatId: existingThread.id });
    }

    const { data: pendingEither } = await supabase
      .from("chat_requests")
      .select("id, status, from_registration_id")
      .eq("status", "pending")
      .or(
        `and(from_registration_id.eq.${me.id},to_registration_id.eq.${target.id}),and(from_registration_id.eq.${target.id},to_registration_id.eq.${me.id})`
      )
      .limit(1)
      .maybeSingle();

    if (pendingEither) {
      return NextResponse.json({
        message:
          pendingEither.from_registration_id === me.id
            ? "You already sent a request to this person."
            : "This person already sent you a request. Check Requests.",
        requestId: pendingEither.id,
      }, { status: 409 });
    }

    const { data: created, error: createError } = await supabase
      .from("chat_requests")
      .insert({
        from_registration_id: me.id,
        to_registration_id: target.id,
        note: note || null,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();
    if (createError) throw createError;

    await notifyUser({
      registrationId: target.id,
      title: "New message request",
      message: `${await senderLabel(me.id, me.handle, me.full_name)} wants to chat with you.`,
      type: "chat_request",
      data: {
        requestId: created.id,
        fromId: me.id,
        fromHandle: me.handle,
      },
    });

    return NextResponse.json({
      request: created,
      other: {
        id: target.id,
        fullName: target.full_name,
        handle: target.handle,
        avatarUrl: buildProfileImageUrl(target.profile_image_path),
      },
    });
  } catch (error) {
    console.error("Chat request create error", error);
    return NextResponse.json({ message: "Could not send request." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const requestId = String(body.requestId ?? "");
    const action = String(body.action ?? "");

    if (!requestId || !["accept", "reject", "cancel"].includes(action)) {
      return NextResponse.json({ message: "Invalid request action." }, { status: 400 });
    }

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const { data: chatRequest, error: lookupError } = await supabase
      .from("chat_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!chatRequest || chatRequest.status !== "pending") {
      return NextResponse.json({ message: "Request not found." }, { status: 404 });
    }

    if (action === "cancel") {
      if (chatRequest.from_registration_id !== me.id) {
        return NextResponse.json({ message: "Only the sender can cancel." }, { status: 403 });
      }
      const { error } = await supabase
        .from("chat_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    if (chatRequest.to_registration_id !== me.id) {
      return NextResponse.json({ message: "Only the recipient can respond." }, { status: 403 });
    }

    if (action === "reject") {
      const { error } = await supabase
        .from("chat_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    // accept → create DM thread
    const [one, two] = orderedParticipantIds(chatRequest.from_registration_id, chatRequest.to_registration_id);
    const { data: fromUser } = await supabase
      .from("registrations")
      .select("full_name, handle")
      .eq("id", chatRequest.from_registration_id)
      .maybeSingle();
    const { data: toUser } = await supabase
      .from("registrations")
      .select("full_name, handle")
      .eq("id", chatRequest.to_registration_id)
      .maybeSingle();

    const threadName = [fromUser?.handle || fromUser?.full_name, toUser?.handle || toUser?.full_name]
      .filter(Boolean)
      .join(" · ");

    const { data: thread, error: threadError } = await supabase
      .from("chats")
      .insert({
        name: threadName || "Direct message",
        is_group: false,
        participant_one_id: one,
        participant_two_id: two,
        chat_request_id: chatRequest.id,
        is_active: true,
        last_message: "You’re connected. Say hello.",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (threadError) throw threadError;

    const { error: updateError } = await supabase
      .from("chat_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId);
    if (updateError) throw updateError;

    await supabase.from("chat_messages").insert({
      chat_id: thread.id,
      sender_registration_id: null,
      message: "Chat connected. You can message each other now.",
    });

    await notifyUser({
      registrationId: chatRequest.from_registration_id,
      title: "Message request accepted",
      message: `${await senderLabel(me.id, me.handle, me.full_name)} accepted your chat request.`,
      type: "chat_accepted",
      data: {
        chatId: thread.id,
        requestId: chatRequest.id,
      },
    });

    return NextResponse.json({ ok: true, status: "accepted", chatId: thread.id });
  } catch (error) {
    console.error("Chat request update error", error);
    return NextResponse.json({ message: "Could not update request." }, { status: 500 });
  }
}

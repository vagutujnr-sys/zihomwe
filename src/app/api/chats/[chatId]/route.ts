import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";
import { buildProfileImageUrl } from "@/lib/profile";
import { formatHandle } from "@/lib/handles";
import { assertChatParticipant, isBlockedEitherWay } from "@/lib/chat-guards";
import { notifyUser, senderLabel } from "@/lib/notify";

export async function GET(
  request: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await context.params;
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";
    const markRead = url.searchParams.get("markRead") !== "0";

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const includeProfile = url.searchParams.get("profile") !== "0";

    const chatResult = await supabase
      .from("chats")
      .select("id, participant_one_id, participant_two_id, name, chat_request_id")
      .eq("id", chatId)
      .maybeSingle();

    if (chatResult.error) throw chatResult.error;
    const chat = chatResult.data;
    if (!chat || (chat.participant_one_id !== me.id && chat.participant_two_id !== me.id)) {
      return NextResponse.json({ message: "Chat not found." }, { status: 404 });
    }
    if (!chat.chat_request_id) {
      return NextResponse.json({ message: "Chat not found." }, { status: 404 });
    }

    const otherId = chat.participant_one_id === me.id ? chat.participant_two_id : chat.participant_one_id;

    const [messagesResult, approvedRequestResult, personResult, blockResult] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("id, message, created_at, sender_registration_id, read_at, reply_to_message_id, reply_excerpt")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("chat_requests")
        .select("id")
        .eq("id", chat.chat_request_id)
        .eq("status", "accepted")
        .or(`from_registration_id.eq.${me.id},to_registration_id.eq.${me.id}`)
        .maybeSingle(),
      otherId && includeProfile
        ? supabase.from("registrations").select("id, full_name, handle, profile_image_path").eq("id", otherId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      otherId && includeProfile
        ? supabase.from("chat_blocks").select("id").eq("blocker_id", me.id).eq("blocked_id", otherId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (approvedRequestResult.error) throw approvedRequestResult.error;
    if (!approvedRequestResult.data) {
      return NextResponse.json({ message: "Chat not found." }, { status: 404 });
    }

    if (markRead) {
      void supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .neq("sender_registration_id", me.id)
        .is("read_at", null);
    }

    let messages: Array<{
      id: string;
      message: string;
      created_at: string;
      sender_registration_id: string | null;
      read_at?: string | null;
      reply_to_message_id?: string | null;
      reply_excerpt?: string | null;
    }> = messagesResult.data ?? [];
    const messageError = String(messagesResult.error?.message || "");
    if (messagesResult.error && (messageError.includes("read_at") || messageError.includes("reply_"))) {
      const fallback = await supabase
        .from("chat_messages")
        .select("id, message, created_at, sender_registration_id")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (fallback.error) throw fallback.error;
      messages = fallback.data ?? [];
    } else if (messagesResult.error) {
      throw messagesResult.error;
    }

    const other = personResult.data;
    const blockedByMe = Boolean(blockResult.data);

    return NextResponse.json({
      chat: {
        id: chat.id,
        blockedByMe,
        other: other
          ? {
              id: other.id,
              fullName: other.full_name || formatHandle(other.handle) || "Member",
              handle: other.handle,
              avatarUrl: buildProfileImageUrl(other.profile_image_path),
            }
          : null,
      },
      meId: me.id,
      messages: (messages ?? []).map((row) => ({
        id: row.id,
        body: row.message,
        createdAt: row.created_at,
        mine: row.sender_registration_id === me.id,
        system: !row.sender_registration_id,
        readAt: "read_at" in row ? (row as { read_at?: string | null }).read_at ?? null : null,
        replyTo: row.reply_excerpt
          ? { id: row.reply_to_message_id || "", body: row.reply_excerpt }
          : null,
      })),
    });
  } catch (error) {
    console.error("Chat messages GET error", error);
    return NextResponse.json({ message: "Could not load messages." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await context.params;
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const text = String(body.message ?? "").trim();
    const replyToId = typeof body.replyToId === "string" ? body.replyToId : "";
    const replyExcerpt = String(body.replyExcerpt ?? "").trim().slice(0, 140);

    if (!text) return NextResponse.json({ message: "Message cannot be empty." }, { status: 400 });
    if (text.length > 2000) {
      return NextResponse.json({ message: "Message is too long." }, { status: 400 });
    }

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const chat = await assertChatParticipant(chatId, me.id);
    if (!chat) return NextResponse.json({ message: "Chat not found." }, { status: 404 });

    const recipientId = chat.participant_one_id === me.id ? chat.participant_two_id : chat.participant_one_id;
    if (recipientId && (await isBlockedEitherWay(me.id, recipientId))) {
      return NextResponse.json({ message: "You can’t message this user." }, { status: 403 });
    }

    const supabase = getSupabaseServer();
    const insertRow = {
      chat_id: chatId,
      sender_registration_id: me.id,
      message: text,
      ...(replyToId && replyExcerpt
        ? { reply_to_message_id: replyToId, reply_excerpt: replyExcerpt }
        : {}),
    };
    let { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert(insertRow)
      .select("id, message, created_at, sender_registration_id, read_at, reply_to_message_id, reply_excerpt")
      .single();

    if (error && /read_at|reply_/.test(String(error.message || ""))) {
      ({ data: inserted, error } = await supabase
        .from("chat_messages")
        .insert({
          chat_id: chatId,
          sender_registration_id: me.id,
          message: text,
        })
        .select("id, message, created_at, sender_registration_id")
        .single());
    }
    if (error) throw error;
    if (!inserted) throw new Error("Message insert returned no row");

    await supabase
      .from("chats")
      .update({
        last_message: text,
        last_message_at: inserted.created_at,
      })
      .eq("id", chatId);

    if (recipientId) {
      const preview = text.slice(0, 120);
      const label = await senderLabel(me.id, me.handle, me.full_name);
      await notifyUser({
        registrationId: recipientId,
        title: label,
        message: preview,
        type: "chat_message",
        data: {
          chatId,
          senderId: me.id,
          senderHandle: label.startsWith("@") ? label.slice(1) : me.handle,
          senderName: me.full_name,
        },
      });
    }

    return NextResponse.json({
      message: {
        id: inserted.id,
        body: inserted.message,
        createdAt: inserted.created_at,
        mine: true,
        system: false,
        readAt: inserted && "read_at" in inserted ? (inserted as { read_at?: string | null }).read_at ?? null : null,
        replyTo:
          inserted && "reply_excerpt" in inserted && (inserted as { reply_excerpt?: string | null }).reply_excerpt
            ? {
                id: (inserted as { reply_to_message_id?: string | null }).reply_to_message_id || replyToId,
                body: (inserted as { reply_excerpt?: string | null }).reply_excerpt || replyExcerpt,
              }
            : replyExcerpt
              ? { id: replyToId, body: replyExcerpt }
              : null,
      },
    });
  } catch (error) {
    console.error("Chat messages POST error", error);
    return NextResponse.json({ message: "Could not send message." }, { status: 500 });
  }
}

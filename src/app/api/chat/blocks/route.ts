import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";
import { buildProfileImageUrl } from "@/lib/profile";
import { assertChatParticipant } from "@/lib/chat-guards";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";
    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("chat_blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", me.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (data ?? []).map((row) => row.blocked_id);
    const { data: people } = ids.length
      ? await supabase.from("registrations").select("id, full_name, handle, profile_image_path").in("id", ids)
      : { data: [] };
    const map = new Map((people ?? []).map((p) => [p.id, p]));

    return NextResponse.json({
      blocked: (data ?? []).map((row) => {
        const person = map.get(row.blocked_id);
        return {
          id: row.id,
          createdAt: row.created_at,
          person: person
            ? {
                id: person.id,
                fullName: person.full_name,
                handle: person.handle,
                avatarUrl: buildProfileImageUrl(person.profile_image_path),
              }
            : { id: row.blocked_id, fullName: "User", handle: null, avatarUrl: null },
        };
      }),
    });
  } catch (error) {
    console.error("Blocks GET error", error);
    return NextResponse.json({ message: "Could not load blocked users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const blockedId = String(body.blockedId ?? "");
    const chatId = typeof body.chatId === "string" ? body.chatId : "";

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });
    if (!blockedId || blockedId === me.id) {
      return NextResponse.json({ message: "Invalid user to block." }, { status: 400 });
    }

    if (chatId) {
      const chat = await assertChatParticipant(chatId, me.id);
      if (!chat) return NextResponse.json({ message: "Chat not found." }, { status: 404 });
      const other = chat.participant_one_id === me.id ? chat.participant_two_id : chat.participant_one_id;
      if (other !== blockedId) {
        return NextResponse.json({ message: "User is not in this chat." }, { status: 400 });
      }
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("chat_blocks")
      .upsert({ blocker_id: me.id, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" })
      .select("id")
      .single();
    if (error) throw error;

    // Decline any pending requests both ways
    await supabase
      .from("chat_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .or(
        `and(from_registration_id.eq.${me.id},to_registration_id.eq.${blockedId}),and(from_registration_id.eq.${blockedId},to_registration_id.eq.${me.id})`
      );

    return NextResponse.json({ ok: true, blockId: data.id });
  } catch (error) {
    console.error("Blocks POST error", error);
    return NextResponse.json({ message: "Could not block user." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const blockedId = String(body.blockedId ?? "");
    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("chat_blocks")
      .delete()
      .eq("blocker_id", me.id)
      .eq("blocked_id", blockedId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Blocks DELETE error", error);
    return NextResponse.json({ message: "Could not unblock user." }, { status: 500 });
  }
}

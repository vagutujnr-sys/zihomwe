import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { userFromAuth } from "@/lib/chat-auth";
import { buildProfileImageUrl } from "@/lib/profile";
import { formatHandle } from "@/lib/handles";

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";

    const me = userFromAuth(sessionToken);
    if (!me) {
      return NextResponse.json({ chats: [], me: null });
    }

    const supabase = getSupabaseServer();

    const [blocksResult, requestsResult] = await Promise.all([
      supabase
        .from("chat_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`),
      supabase
        .from("chat_requests")
        .select("id, from_registration_id, to_registration_id")
        .eq("status", "accepted")
        .or(`from_registration_id.eq.${me.id},to_registration_id.eq.${me.id}`),
    ]);

    const blockedIds = new Set<string>();
    for (const row of blocksResult.data ?? []) {
      if (row.blocker_id === me.id) blockedIds.add(row.blocked_id);
      if (row.blocked_id === me.id) blockedIds.add(row.blocker_id);
    }

    if (requestsResult.error) {
      console.error("Approved chat requests query error", requestsResult.error);
      return NextResponse.json({
        chats: [],
        me: { id: me.id, handle: me.handle, fullName: me.full_name },
      });
    }

    const approvedRequestIds = (requestsResult.data ?? []).map((request) => request.id);
    if (!approvedRequestIds.length) {
      return NextResponse.json({
        chats: [],
        me: { id: me.id, handle: me.handle, fullName: me.full_name },
      });
    }

    const threadsResult = await supabase
      .from("chats")
      .select("id, name, last_message, last_message_at, participant_one_id, participant_two_id, is_group")
      .eq("is_group", false)
      .in("chat_request_id", approvedRequestIds)
      .or(`participant_one_id.eq.${me.id},participant_two_id.eq.${me.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    const threads = threadsResult.data;
    const error = threadsResult.error;

    if (error) {
      console.error("Chats list query error", error);
      return NextResponse.json({
        chats: [],
        me: { id: me.id, handle: me.handle, fullName: me.full_name },
      });
    }

    const visible = (threads ?? []).filter((thread) => {
      const otherId =
        thread.participant_one_id === me.id ? thread.participant_two_id : thread.participant_one_id;
      return Boolean(otherId) && !blockedIds.has(otherId);
    });

    const otherIds = [
      ...new Set(
        visible
          .map((thread) =>
            thread.participant_one_id === me.id ? thread.participant_two_id : thread.participant_one_id
          )
          .filter(Boolean) as string[]
      ),
    ];

    const chatIds = visible.map((thread) => thread.id);
    const [withHandle, unreadResult] = await Promise.all([
      otherIds.length
        ? supabase.from("registrations").select("id, full_name, handle, profile_image_path").in("id", otherIds)
        : Promise.resolve({ data: [], error: null }),
      chatIds.length
        ? supabase
            .from("chat_messages")
            .select("chat_id")
            .in("chat_id", chatIds)
            .neq("sender_registration_id", me.id)
            .is("read_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    let peopleMap = new Map<string, { id: string; full_name: string | null; handle: string | null; profile_image_path: string | null }>();
    if (otherIds.length) {
      if (withHandle.error && String(withHandle.error.message || "").includes("handle")) {
        const without = await supabase
          .from("registrations")
          .select("id, full_name, profile_image_path")
          .in("id", otherIds);
        peopleMap = new Map(
          (without.data ?? []).map((person) => [
            person.id,
            { ...person, handle: null },
          ])
        );
      } else {
        peopleMap = new Map((withHandle.data ?? []).map((person) => [person.id, person]));
      }
    }

    const unreadMap = new Map<string, number>();
    for (const row of unreadResult.data ?? []) {
      unreadMap.set(row.chat_id, (unreadMap.get(row.chat_id) ?? 0) + 1);
    }

    const chats = visible.map((thread) => {
      const otherId =
        thread.participant_one_id === me.id ? thread.participant_two_id : thread.participant_one_id;
      const other = otherId ? peopleMap.get(otherId) : null;
      return {
        id: thread.id,
        lastMessage: thread.last_message || "",
        lastMessageAt: thread.last_message_at,
        timeLabel: formatTime(thread.last_message_at),
        unreadCount: unreadMap.get(thread.id) ?? 0,
        other: other
          ? {
              id: other.id,
              fullName: other.full_name || formatHandle(other.handle) || "Member",
              handle: other.handle,
              avatarUrl: buildProfileImageUrl(other.profile_image_path),
            }
          : {
              id: otherId,
              fullName: thread.name || "Member",
              handle: null,
              avatarUrl: null,
            },
      };
    });

    return NextResponse.json({
      chats,
      me: { id: me.id, handle: me.handle, fullName: me.full_name },
    });
  } catch (error) {
    console.error("Chats list error", error);
    return NextResponse.json({ chats: [], me: null });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { authFromBody, userFromAuth } from "@/lib/chat-auth";
import { sanitizeHandleInput, isValidHandle } from "@/lib/handles";
import { buildProfileImageUrl } from "@/lib/profile";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = sanitizeHandleInput(url.searchParams.get("q") ?? url.searchParams.get("handle") ?? "");
    const sessionToken = url.searchParams.get("sessionToken")?.trim() ?? "";

    if (url.searchParams.get("check") === "1") {
      if (!isValidHandle(q)) {
        return NextResponse.json({
          available: false,
          handle: q,
          message: "Use 3–24 letters, numbers, or underscores.",
        });
      }
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from("registrations")
        .select("id")
        .ilike("handle", q)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({
        available: !data,
        handle: q,
        message: data ? "That handle is already taken." : "Handle is available.",
      });
    }

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const me = userFromAuth(sessionToken);
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("registrations")
      .select("id, full_name, handle, profile_image_path")
      .ilike("handle", `%${q}%`)
      .not("handle", "is", null)
      .limit(20);

    if (error) throw error;

    let blocked = new Set<string>();
    if (me) {
      const { data: blocks } = await supabase
        .from("chat_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`);
      blocked = new Set(
        (blocks ?? []).flatMap((row) =>
          row.blocker_id === me.id ? [row.blocked_id] : row.blocked_id === me.id ? [row.blocker_id] : []
        )
      );
    }

    const users = (data ?? [])
      .filter((row) => row.id !== me?.id && !blocked.has(row.id))
      .map((row) => ({
        id: row.id,
        fullName: row.full_name,
        handle: row.handle,
        avatarUrl: buildProfileImageUrl(row.profile_image_path),
      }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Handle search error", error);
    return NextResponse.json({ message: "Search failed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = await authFromBody(body);
    const handle = sanitizeHandleInput(String(body.handle ?? ""));

    if (!isValidHandle(handle)) {
      return NextResponse.json(
        { message: "Handle must be 3–24 characters: letters, numbers, underscore." },
        { status: 400 }
      );
    }

    const me = userFromAuth(sessionToken);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const supabase = getSupabaseServer();
    const { data: current, error: currentError } = await supabase
      .from("registrations")
      .select("handle")
      .eq("id", me.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current?.handle) {
      return NextResponse.json({
        message: "Your handle is already set and cannot be changed.",
        profile: { handle: current.handle },
      }, { status: 409 });
    }

    const { data: taken, error: takenError } = await supabase
      .from("registrations")
      .select("id")
      .ilike("handle", handle)
      .neq("id", me.id)
      .limit(1)
      .maybeSingle();
    if (takenError) throw takenError;
    if (taken) {
      return NextResponse.json({ message: "That handle is already taken." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("registrations")
      .update({ handle })
      .eq("id", me.id)
      .select("id, full_name, handle, profile_image_path, mobile_number")
      .single();
    if (error) throw error;

    return NextResponse.json({
      profile: {
        ...data,
        avatarUrl: buildProfileImageUrl(data.profile_image_path),
      },
    });
  } catch (error) {
    console.error("Handle update error", error);
    return NextResponse.json({ message: "Handle could not be updated." }, { status: 500 });
  }
}

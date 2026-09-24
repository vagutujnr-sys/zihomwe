import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

async function findRegistration(supabase: ReturnType<typeof getSupabaseServer>, mobileNumber: string) {
  const digits = mobileNumber.replace(/\D/g, "");
  const candidates = [...new Set([mobileNumber, digits.startsWith("07") ? `+263${digits.slice(1)}` : `+${digits}`])];
  for (const candidate of candidates) {
    const { data, error } = await supabase.from("registrations").select("id, full_name, role, assigned_location").eq("mobile_number", candidate).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

function realProjectId(value: string) {
  return value.startsWith("funding-") ? value.slice(8) : value;
}

async function getProjectContext(supabase: ReturnType<typeof getSupabaseServer>, projectId: string) {
  const member = await supabase.from("member_projects").select("id, constituency_id, location").eq("id", projectId).maybeSingle();
  if (member.data) return { constituency: member.data.constituency_id || member.data.location || null };
  const request = await supabase.from("project_requests").select("id, registration_id, location").eq("id", projectId).maybeSingle();
  if (!request.data) return null;
  if (request.data.registration_id) {
    const owner = await supabase.from("registrations").select("assigned_location").eq("id", request.data.registration_id).maybeSingle();
    const assigned = owner.data?.assigned_location as { constituency?: string } | null;
    return { constituency: assigned?.constituency || request.data.location || null };
  }
  return { constituency: request.data.location || null };
}

import { buildProfileImageUrl } from "@/lib/profile";

async function getEngagement(supabase: ReturnType<typeof getSupabaseServer>, projectId: string, registrationId: string | null) {
  const [likes, comments, views, registrations, context] = await Promise.all([
    supabase.from("project_likes").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("project_comments").select("id, body, created_at, registrations(full_name, role, profile_image_path)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
    supabase.from("project_views").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("registrations").select("assigned_location"),
    getProjectContext(supabase, projectId),
  ]);
  if (likes.error || comments.error || views.error || registrations.error) throw likes.error || comments.error || views.error || registrations.error;
  const constituency = context?.constituency?.toLowerCase();
  const constituencyPeople = constituency
    ? registrations.data.filter((row) => String((row.assigned_location as { constituency?: string } | null)?.constituency || "").toLowerCase() === constituency).length
    : registrations.data.length;
  const supportDenominator = Math.max(constituencyPeople, 1);
  let liked = false;
  if (registrationId) {
    const result = await supabase.from("project_likes").select("id").eq("project_id", projectId).eq("registration_id", registrationId).maybeSingle();
    if (result.error) throw result.error;
    liked = Boolean(result.data);
  }
  return {
    likes: likes.count ?? 0,
    views: views.count ?? 0,
    comments: (comments.data ?? []).map((comment) => {
      const authorRecord = comment.registrations as { full_name?: string | null; role?: string; profile_image_path?: string | null } | null;
      return {
        id: comment.id,
        text: comment.body,
        author: authorRecord?.full_name || "Community member",
        role: authorRecord?.role || "Member",
        avatar: buildProfileImageUrl(authorRecord?.profile_image_path) ?? "/logo_main_second.png",
        createdAt: comment.created_at,
      };
    }),
    liked,
    constituencyPeople,
    supportPercent: Math.min(100, Math.round(((likes.count ?? 0) / supportDenominator) * 100)),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: rawProjectId } = await params;
    const projectId = realProjectId(rawProjectId);
    const supabase = getSupabaseServer();
    const mobileNumber = new URL(request.url).searchParams.get("mobileNumber") || "";
    const registration = mobileNumber ? await findRegistration(supabase, mobileNumber) : null;
    const engagement = await getEngagement(supabase, projectId, registration?.id ?? null);
    return NextResponse.json({ engagement });
  } catch (error) {
    console.error("Project engagement GET failed", error);
    return NextResponse.json({ message: "Project engagement could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: rawProjectId } = await params;
    const projectId = realProjectId(rawProjectId);
    const body = await request.json();
    const supabase = getSupabaseServer();
    const registration = body.mobileNumber ? await findRegistration(supabase, String(body.mobileNumber)) : null;

    if (body.action === "view") {
      const visitorKey = String(body.visitorKey || "").trim();
      if (!registration?.id && !visitorKey) return NextResponse.json({ message: "A visitor key is required." }, { status: 400 });
      const { error } = await supabase.from("project_views").insert({ project_id: projectId, registration_id: registration?.id ?? null, visitor_key: visitorKey || null });
      if (error) throw error;
    } else {
      if (!registration?.id) return NextResponse.json({ message: "Sign in to like or comment on a project." }, { status: 401 });
      if (body.action === "like") {
        const existing = await supabase.from("project_likes").select("id").eq("project_id", projectId).eq("registration_id", registration.id).maybeSingle();
        if (existing.data) await supabase.from("project_likes").delete().eq("id", existing.data.id);
        else await supabase.from("project_likes").insert({ project_id: projectId, registration_id: registration.id });
      } else if (body.action === "comment") {
        const text = String(body.text || "").trim();
        if (text.length < 2 || text.length > 1000) return NextResponse.json({ message: "Comment must be between 2 and 1000 characters." }, { status: 400 });
        await supabase.from("project_comments").insert({ project_id: projectId, registration_id: registration.id, body: text });
      } else return NextResponse.json({ message: "Unsupported project action." }, { status: 400 });
    }
    return NextResponse.json({ engagement: await getEngagement(supabase, projectId, registration?.id ?? null) });
  } catch (error) {
    console.error("Project engagement POST failed", error);
    return NextResponse.json({ message: "Project engagement could not be saved." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { summarizeProjectStats } from "@/lib/project-stats";

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServer();
    const mobileNumber = new URL(request.url).searchParams.get("mobileNumber")?.trim();
    const [fullQuery, likesQuery, commentsQuery] = await Promise.all([
      supabase
        .from("project_requests")
        .select("id, title, short_description, description, category, location, requested_amount, status, project_image_path, registration_id, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("project_likes").select("project_id"),
      supabase.from("project_comments").select("project_id"),
    ]);

    const legacyQuery = fullQuery.error
      ? await supabase.from("project_requests").select("id, title, description, category, location, requested_amount, status, created_at, registration_id").eq("status", "approved").order("created_at", { ascending: false }).limit(100)
      : null;
    const data = fullQuery.data ?? legacyQuery?.data ?? [];
    const error = fullQuery.error && legacyQuery?.error;

    if (error) return NextResponse.json({ message: "Unable to load approved projects." }, { status: 500 });

    const projectStats = summarizeProjectStats(likesQuery.data ?? [], commentsQuery.data ?? []);

    let currentRegistrationId: string | null = null;
    if (mobileNumber) {
      const digits = mobileNumber.replace(/\D/g, "");
      const candidates = [...new Set([mobileNumber, digits.startsWith("07") ? `+263${digits.slice(1)}` : `+${digits}`])];
      for (const candidate of candidates) {
        const { data: registration } = await supabase.from("registrations").select("id").eq("mobile_number", candidate).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (registration?.id) { currentRegistrationId = registration.id; break; }
      }
    }

    const projects = data.map((project) => {
      const projectKey = String(project.id);
      const stats = projectStats[projectKey] ?? { votes: 0, comments: 0 };

      return {
        id: `funding-${project.id}`,
        title: project.title,
        description: ("short_description" in project && project.short_description) || project.description,
        status: "In Progress",
        progress: 0,
        votes: stats.votes,
        comments: stats.comments,
        imageUrl: ("project_image_path" in project && project.project_image_path)
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-images/${project.project_image_path}`
          : "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80",
        category: project.category || "Funded Member Project",
        location: project.location || "Community-led",
        isCurrentUser: currentRegistrationId && "registration_id" in project ? project.registration_id === currentRegistrationId : false,
      };
    });

    projects.sort((left, right) => Number(right.isCurrentUser) - Number(left.isCurrentUser));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Approved projects API error", error);
    return NextResponse.json({ message: "Approved projects could not be loaded." }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

function candidates(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return [...new Set([trimmed, digits.startsWith("07") ? `+263${digits.slice(1)}` : `+${digits}`])];
}

async function findRegistration(client: ReturnType<typeof getSupabaseServer>, mobileNumber: string) {
  for (const mobile of candidates(mobileNumber)) {
    const { data, error } = await client.from("registrations").select("id").eq("mobile_number", mobile).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

async function getEngagement(client: ReturnType<typeof getSupabaseServer>, articleId: string, registrationId: string | null) {
  const [likes, views, liked] = await Promise.all([
    client.from("news_likes").select("id", { count: "exact", head: true }).eq("news_id", articleId),
    client.from("news_views").select("id", { count: "exact", head: true }).eq("news_id", articleId),
    registrationId ? client.from("news_likes").select("id").eq("news_id", articleId).eq("registration_id", registrationId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (likes.error || views.error || liked.error) throw likes.error || views.error || liked.error;
  return { likes: likes.count ?? 0, views: views.count ?? 0, liked: Boolean(liked.data) };
}

export async function GET(request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  try {
    const { articleId } = await params;
    const client = getSupabaseServer();
    const mobileNumber = new URL(request.url).searchParams.get("mobileNumber") || "";
    const registration = mobileNumber ? await findRegistration(client, mobileNumber) : null;
    const { data: article, error } = await client.from("news_stories").select("*").eq("id", articleId).eq("status", "published").maybeSingle();
    if (error) throw error;
    if (!article) return NextResponse.json({ message: "News article not found." }, { status: 404 });
    return NextResponse.json({ article, engagement: await getEngagement(client, articleId, registration?.id ?? null) });
  } catch (error) {
    console.error("News engagement GET failed", error);
    return NextResponse.json({ message: "News engagement could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  try {
    const { articleId } = await params;
    const body = await request.json();
    const client = getSupabaseServer();
    const registration = body.mobileNumber ? await findRegistration(client, String(body.mobileNumber)) : null;
    const visitorKey = String(body.visitorKey || "").trim();

    if (body.action === "view") {
      if (!registration?.id && !visitorKey) return NextResponse.json({ message: "A visitor key is required." }, { status: 400 });
      const { error } = await client.from("news_views").insert({ news_id: articleId, registration_id: registration?.id ?? null, visitor_key: visitorKey || null });
      if (error) throw error;
    } else if (body.action === "like") {
      if (!registration?.id) return NextResponse.json({ message: "Sign in to like a news article." }, { status: 401 });
      const existing = await client.from("news_likes").select("id").eq("news_id", articleId).eq("registration_id", registration.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        const { error } = await client.from("news_likes").delete().eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await client.from("news_likes").insert({ news_id: articleId, registration_id: registration.id });
        if (error) throw error;
      }
    } else return NextResponse.json({ message: "Unsupported news action." }, { status: 400 });

    return NextResponse.json({ engagement: await getEngagement(client, articleId, registration?.id ?? null) });
  } catch (error) {
    console.error("News engagement POST failed", error);
    return NextResponse.json({ message: "News engagement could not be saved." }, { status: 500 });
  }
}
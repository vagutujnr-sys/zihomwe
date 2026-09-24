import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";
import { sanitizeArticleHtml } from "@/lib/rich-text";

const bucket = "news-images";
const statuses = new Set(["draft", "published", "archived"]);

async function getAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return null;

  const { data } = await getSupabaseServer()
    .from("admin_accounts")
    .select("id, is_active")
    .eq("id", session.adminId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function imagePath(id: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${id}/${randomUUID()}.${extension}`;
}

async function uploadImage(client: ReturnType<typeof getSupabaseServer>, id: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) throw new Error("News images must be image files.");
  if (file.size > 10 * 1024 * 1024) throw new Error("News images must be 10 MB or smaller.");

  // Make image uploads work even when the storage bucket migration has not been run yet.
  await client.storage.createBucket(bucket, { public: true });
  const path = imagePath(id, file);
  const { error } = await client.storage.from(bucket).upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("News image upload failed", error.message);
    throw new Error("Unable to upload the news image. Check that the news image storage is available.");
  }
  return path;
}

export async function GET(request: Request) {
  try {
    if (!await getAdmin(request)) return NextResponse.json({ message: "Admin session expired." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id")?.trim();
    const query = getSupabaseServer().from("news_stories").select("*").order("created_at", { ascending: false });
    const result = id ? await query.eq("id", id).maybeSingle() : await query.limit(1000);
    if (result.error) return NextResponse.json({ message: "Unable to load news articles." }, { status: 500 });
    return NextResponse.json(id ? { article: result.data } : { articles: result.data ?? [] });
  } catch (error) {
    console.error("Admin news list failed", error);
    return NextResponse.json({ message: "Unable to load news articles." }, { status: 500 });
  }
}

async function saveArticle(request: Request, id?: string) {
  const form = await request.formData();
  const title = text(form, "title");
  const status = text(form, "status") || "published";
  if (!title) return NextResponse.json({ message: "Article title is required." }, { status: 400 });
  if (!statuses.has(status)) return NextResponse.json({ message: "Invalid article status." }, { status: 400 });

  const client = getSupabaseServer();
  const articleId = id || randomUUID();
  let previousImagePath: string | null = null;
  if (id) {
    const { data: existing } = await client.from("news_stories").select("image_url").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ message: "Article not found." }, { status: 404 });
    previousImagePath = typeof existing.image_url === "string" && !/^https?:\/\//i.test(existing.image_url) ? existing.image_url : null;
  }
  const imageUrl = await uploadImage(client, articleId, form.get("image"));
  const values = {
    title,
    category: text(form, "category") || "Community",
    excerpt: text(form, "excerpt"),
    body: sanitizeArticleHtml(text(form, "body")),
    constituency_id: text(form, "constituency_id") || null,
    status,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    updated_at: new Date().toISOString(),
  };

  const result = id
    ? await client.from("news_stories").update(values).eq("id", id).select("*").single()
    : await client.from("news_stories").insert({ id: articleId, ...values }).select("*").single();
  if (result.error) {
    if (imageUrl) await client.storage.from(bucket).remove([imageUrl]);
    console.error("News article database save failed", result.error.message, result.error.details, result.error.hint);
    return NextResponse.json({ message: "Unable to save the news article." }, { status: 500 });
  }

  if (imageUrl && previousImagePath) await client.storage.from(bucket).remove([previousImagePath]);
  return NextResponse.json({ ok: true, article: result.data });
}

export async function POST(request: Request) {
  try {
    if (!await getAdmin(request)) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    return await saveArticle(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to save the news article." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!await getAdmin(request)) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    const form = await request.clone().formData();
    const id = text(form, "id");
    if (!id) return NextResponse.json({ message: "Article id is required." }, { status: 400 });
    return await saveArticle(request, id);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update the news article." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await getAdmin(request)) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ message: "Article id is required." }, { status: 400 });
    const client = getSupabaseServer();
    const { data: article, error: readError } = await client.from("news_stories").select("image_url").eq("id", id).maybeSingle();
    if (readError || !article) return NextResponse.json({ message: "Article not found." }, { status: 404 });
    const { error } = await client.from("news_stories").delete().eq("id", id);
    if (error) return NextResponse.json({ message: "Unable to delete the news article." }, { status: 500 });
    if (article.image_url && !/^https?:\/\//i.test(article.image_url)) await client.storage.from(bucket).remove([article.image_url]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin news delete failed", error);
    return NextResponse.json({ message: "Unable to delete the news article." }, { status: 500 });
  }
}
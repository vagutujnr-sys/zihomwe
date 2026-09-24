import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

const tableNames = ["member_projects", "news_stories", "events", "chats", "affiliate_requests", "project_requests"] as const;

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return NextResponse.json({ message: "Admin session expired." }, { status: 401 });

  const client = getSupabaseServer();
  const { data: admin } = await client.from("admin_accounts").select("id, role, is_active").eq("id", session.adminId).eq("is_active", true).maybeSingle();
  if (!admin) return NextResponse.json({ message: "Admin account unavailable." }, { status: 401 });

  const results = await Promise.all(tableNames.map(async (table) => {
    const rowLimit = table === "member_projects" || table === "project_requests" ? 1000 : 8;
    const { data, count, error } = await client.from(table).select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(rowLimit);
    return { table, count: count ?? 0, rows: data ?? [], error };
  }));
  const failed = results.find((result) => result.error);
  if (failed) return NextResponse.json({ message: `Unable to read ${failed.table}. Run database_schema/application-content.sql in Supabase.` }, { status: 500 });
  return NextResponse.json({ tables: results.map(({ table, count, rows }) => ({ table, count, rows })) });
}

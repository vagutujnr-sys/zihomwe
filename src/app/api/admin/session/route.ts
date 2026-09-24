import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;

  if (!session) {
    return NextResponse.json({ message: "Admin session expired." }, { status: 401 });
  }

  const { data: admin, error } = await getSupabaseServer()
    .from("admin_accounts")
    .select("id, display_name, role, constituency_id, theme_color, is_active, constituencies(id, name)")
    .eq("id", session.adminId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !admin) {
    return NextResponse.json({ message: "Admin account unavailable." }, { status: 401 });
  }

  const constituency = Array.isArray(admin.constituencies)
    ? admin.constituencies[0]
    : admin.constituencies;

  return NextResponse.json({
    admin: {
      displayName: admin.display_name,
      role: admin.role,
      constituencyId: admin.constituency_id,
      constituencyName: constituency?.name ?? "Entire application",
      themeColor: admin.theme_color,
    },
  });
}

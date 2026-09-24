import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { createAdminToken, verifyAdminPin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { message: "Enter your 4-digit PIN." },
        { status: 400 },
      );
    }

    const supabaseServer = getSupabaseServer();
    const { data: admins, error } = await supabaseServer
      .from("admin_accounts")
      .select("id, constituency_id, display_name, pin_hash, theme_color, role, is_active, constituencies(id, name)")
      .eq("is_active", true);

    const matchingAdmins = (admins ?? []).filter((candidate) => verifyAdminPin(pin, candidate.pin_hash));
    const superAdmins = matchingAdmins.filter((candidate) => candidate.role === "super_admin");
    const constituencyAdmins = matchingAdmins.filter((candidate) => candidate.role === "constituency_admin");
    const admin = superAdmins[0] ?? (constituencyAdmins.length === 1 ? constituencyAdmins[0] : null);

    if (error || !admin) {
      const message = constituencyAdmins.length > 1
        ? "This PIN is assigned to more than one constituency. Ask the super admin to make each PIN unique."
        : "The PIN is not valid.";
      return NextResponse.json({ message }, { status: 401 });
    }

    await supabaseServer
      .from("admin_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", admin.id);

    const constituency = Array.isArray(admin.constituencies)
      ? admin.constituencies[0]
      : admin.constituencies;

    return NextResponse.json({
      token: createAdminToken(admin.id),
      admin: {
        displayName: admin.display_name,
        role: admin.role,
        constituencyId: admin.constituency_id,
        constituencyName: constituency?.name ?? "Entire application",
        themeColor: admin.theme_color,
      },
    });
  } catch (error) {
    console.error("Admin login error", error);
    return NextResponse.json({ message: "Admin login is unavailable." }, { status: 500 });
  }
}

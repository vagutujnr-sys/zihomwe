import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

async function getAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return null;

  const client = getSupabaseServer();
  const { data } = await client
    .from("admin_accounts")
    .select("id, role, constituency_id")
    .eq("id", session.adminId)
    .eq("is_active", true)
    .maybeSingle();
  return data ? { client, ...data } : null;
}

export async function PATCH(request: Request) {
  try {
    const admin = await getAdmin(request);
    if (!admin) return NextResponse.json({ message: "Admin session expired." }, { status: 401 });

    const body = await request.json();
    const registrationId = String(body.registrationId ?? "").trim();
    const cellId = String(body.cellId ?? "").trim();
    if (!registrationId || !cellId) return NextResponse.json({ message: "Select a cell before saving." }, { status: 400 });

    const { data: cell, error: cellError } = await admin.client
      .from("cells")
      .select("id, constituency_id")
      .eq("id", cellId)
      .maybeSingle();
    if (cellError) throw cellError;
    if (!cell) return NextResponse.json({ message: "Selected cell was not found." }, { status: 400 });
    if (admin.role !== "super_admin" && cell.constituency_id !== admin.constituency_id) {
      return NextResponse.json({ message: "You cannot assign members outside your constituency." }, { status: 403 });
    }

    const registrationQuery = admin.client
      .from("registrations")
      .select("id, cell_id")
      .eq("id", registrationId)
      .maybeSingle();
    const { data: registration, error: registrationError } = await registrationQuery;
    if (registrationError) throw registrationError;
    if (!registration) return NextResponse.json({ message: "Registration was not found." }, { status: 404 });
    if (admin.role !== "super_admin" && registration.cell_id) {
      const { data: currentCell, error: currentCellError } = await admin.client.from("cells").select("constituency_id").eq("id", registration.cell_id).maybeSingle();
      if (currentCellError) throw currentCellError;
      if (currentCell?.constituency_id !== admin.constituency_id) return NextResponse.json({ message: "You cannot reassign members outside your constituency." }, { status: 403 });
    }

    const { data: updated, error: updateError } = await admin.client
      .from("registrations")
      .update({ cell_id: cell.id })
      .eq("id", registrationId)
      .select("id, cell_id")
      .single();
    if (updateError) throw updateError;
    return NextResponse.json({ registration: updated });
  } catch (error) {
    console.error("Registration cell assignment error", error);
    return NextResponse.json({ message: "Unable to assign registration to the selected cell." }, { status: 500 });
  }
}

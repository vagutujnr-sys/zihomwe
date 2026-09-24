import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

type AdminScope = { adminId: string; constituencyId: string | null };

async function getScope(request: Request): Promise<AdminScope | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return null;

  const supabaseServer = getSupabaseServer();
  const { data: admin } = await supabaseServer
    .from("admin_accounts")
    .select("id, constituency_id, role, is_active")
    .eq("id", session.adminId)
    .eq("is_active", true)
    .maybeSingle();

  if (!admin) return null;
  return { adminId: admin.id, constituencyId: admin.role === "super_admin" ? null : admin.constituency_id };
}

export async function GET(request: Request) {
  const scope = await getScope(request);
  if (!scope) return NextResponse.json({ message: "Admin session expired." }, { status: 401 });

  const supabaseServer = getSupabaseServer();
  const [constituencies, provinces, districts, wards, cells] = await Promise.all([
    supabaseServer.from("constituencies").select("id, name, province_id, district_id, latitude, longitude, mp_name", { count: "exact" }),
    supabaseServer.from("provinces").select("id, name", { count: "exact" }),
    supabaseServer.from("districts").select("id, name, province_id", { count: "exact" }),
    supabaseServer.from("wards").select("id, name, constituency_id, ward_number", { count: "exact" }),
    supabaseServer.from("cells").select("id, name, constituency_id, ward_id, is_active", { count: "exact" }),
  ]);

  if ([constituencies, provinces, districts, wards, cells].some((result) => result.error)) {
    return NextResponse.json({ message: "Unable to load administration data." }, { status: 500 });
  }

  const scopedConstituencyIds = scope.constituencyId
    ? [scope.constituencyId]
    : (constituencies.data ?? []).map((item) => item.id);
  const scopedCells = (cells.data ?? []).filter((item) => scopedConstituencyIds.includes(item.constituency_id));
  const scopedCellIds = scopedCells.map((item) => item.id);
  const registrationQuery = supabaseServer
    .from("registrations")
    .select("id, full_name, mobile_number, role, created_at, cell_id, assigned_location")
    .order("created_at", { ascending: false });
  const registrations = scope.constituencyId && scopedCellIds.length
    ? await registrationQuery.in("cell_id", scopedCellIds).limit(8)
    : await registrationQuery.limit(8);

  if (registrations.error) {
    return NextResponse.json({ message: "Unable to load registration data." }, { status: 500 });
  }

  const memberRegistrations = scopedCellIds.length
    ? await supabaseServer.from("registrations").select("cell_id").in("cell_id", scopedCellIds)
    : { data: [], error: null };
  if (memberRegistrations.error) {
    return NextResponse.json({ message: "Unable to load cell member counts." }, { status: 500 });
  }
  const memberCounts = (memberRegistrations.data ?? []).reduce<Record<string, number>>((counts, registration) => {
    if (registration.cell_id) counts[registration.cell_id] = (counts[registration.cell_id] ?? 0) + 1;
    return counts;
  }, {});

  const scoped = <T>(items: T[] | null, matches: (item: T) => boolean = () => true) =>
    (items ?? []).filter((item) => !scope.constituencyId || matches(item));

  const constituencyDirectory = (constituencies.data ?? [])
    .filter((item) => !scope.constituencyId || item.id === scope.constituencyId)
    .map((item) => {
      const districtIds = item.district_id ? [item.district_id] : [];
      const wardRows = (wards.data ?? []).filter((ward) => ward.constituency_id === item.id);
      const cellRows = (cells.data ?? []).filter((cell) => cell.constituency_id === item.id);
      return {
        ...item,
        districtCount: districtIds.filter((districtId) => (districts.data ?? []).some((district) => district.id === districtId)).length,
        wardCount: wardRows.length,
        cellCount: cellRows.length,
      };
    });

  return NextResponse.json({
    metrics: {
      users: scope.constituencyId ? (await supabaseServer.from("registrations").select("id", { count: "exact", head: true }).in("cell_id", scopedCellIds)).count ?? 0 : (await supabaseServer.from("registrations").select("id", { count: "exact", head: true })).count ?? 0,
      constituencies: scopedConstituencyIds.length,
      wards: scoped(wards.data).length,
      cells: scopedCells.length,
    },
    recentRegistrations: registrations.data ?? [],
    directory: {
      constituencies: constituencyDirectory,
      provinces: provinces.data ?? [],
      districts: scoped(districts.data, (item) => (constituencies.data ?? []).some((constituency) => constituency.id === scope.constituencyId && constituency.district_id === item.id)),
      wards: scoped(wards.data, (item) => item.constituency_id === scope.constituencyId),
      cells: scopedCells.map((cell) => ({ ...cell, memberCount: memberCounts[cell.id] ?? 0 })),
    },
  });
}

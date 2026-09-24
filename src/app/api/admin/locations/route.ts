import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

async function requireSuperAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return null;

  const client = getSupabaseServer();
  const { data } = await client
    .from("admin_accounts")
    .select("id")
    .eq("id", session.adminId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .maybeSingle();

  return data ? client : null;
}

async function nextLocationId(client: Awaited<ReturnType<typeof requireSuperAdmin>>, table: "wards" | "cells", prefix: "WARD" | "CELL") {
  if (!client) return "";
  const { data, error } = await client.from(table).select("id");
  if (error) throw error;
  const nextNumber = (data ?? []).reduce((highest, row) => {
    const match = new RegExp(`^${prefix}(\\d+)$`, "i").exec(String(row.id));
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0) + 1;
  return `${prefix}${String(nextNumber).padStart(6, "0")}`;
}

export async function GET(request: Request) {
  try {
    const client = await requireSuperAdmin(request);
    if (!client) return NextResponse.json({ message: "Super-admin access required." }, { status: 403 });

    const type = new URL(request.url).searchParams.get("type");
    if (type === "ward") return NextResponse.json({ id: await nextLocationId(client, "wards", "WARD") });
    if (type === "cell") return NextResponse.json({ id: await nextLocationId(client, "cells", "CELL") });
    return NextResponse.json({ message: "Unsupported location type." }, { status: 400 });
  } catch (error) {
    console.error("Location ID generation error", error);
    return NextResponse.json({ message: "Unable to generate location ID." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const client = await requireSuperAdmin(request);
    if (!client) return NextResponse.json({ message: "Super-admin access required." }, { status: 403 });

    const body = await request.json();
    const type = String(body.type ?? "");
    const name = String(body.name ?? "").trim();
    if (!type || !name) return NextResponse.json({ message: "Type and name are required." }, { status: 400 });

    if (type === "ward") {
      const id = await nextLocationId(client, "wards", "WARD");
      const constituencyId = String(body.constituencyId ?? "").trim();
      if (!constituencyId) return NextResponse.json({ message: "Select a constituency." }, { status: 400 });
      const { data: constituency, error: constituencyError } = await client
        .from("constituencies")
        .select("id, province_id, district_id")
        .eq("id", constituencyId)
        .maybeSingle();
      if (constituencyError) throw constituencyError;
      if (!constituency) return NextResponse.json({ message: "Selected constituency was not found." }, { status: 400 });

      const wardNumber = Number(body.wardNumber);
      const { data: ward, error } = await client.from("wards").insert({
        id,
        name,
        province_id: constituency.province_id,
        district_id: constituency.district_id,
        constituency_id: constituency.id,
        ward_number: Number.isInteger(wardNumber) && wardNumber > 0 ? wardNumber : null,
      }).select("id, name").single();
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });
      return NextResponse.json({ ward });
    }

    if (type === "cell") {
      const id = await nextLocationId(client, "cells", "CELL");
      const wardId = String(body.wardId ?? "").trim();
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!wardId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json({ message: "Select a ward and provide valid coordinates." }, { status: 400 });
      }
      const { data: ward, error: wardError } = await client
        .from("wards")
        .select("id, province_id, district_id, constituency_id")
        .eq("id", wardId)
        .maybeSingle();
      if (wardError) throw wardError;
      if (!ward) return NextResponse.json({ message: "Selected ward was not found." }, { status: 400 });

      const { data: cell, error } = await client.from("cells").insert({
        id,
        name,
        province_id: ward.province_id,
        district_id: ward.district_id,
        constituency_id: ward.constituency_id,
        ward_id: ward.id,
        latitude,
        longitude,
      }).select("id, name").single();
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });
      return NextResponse.json({ cell });
    }

    return NextResponse.json({ message: "Unsupported location type." }, { status: 400 });
  } catch (error) {
    console.error("Location creation error", error);
    return NextResponse.json({ message: "Unable to save location." }, { status: 500 });
  }
}

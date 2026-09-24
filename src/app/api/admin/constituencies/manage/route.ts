import { NextResponse } from "next/server";
import { readAdminToken, hashAdminPin } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";
import { randomUUID } from "node:crypto";

async function requireSuperAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return null;

  const adminClient = getSupabaseServer();
  const { data } = await adminClient
    .from("admin_accounts")
    .select("id, role, is_active")
    .eq("id", session.adminId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .maybeSingle();

  return data ? adminClient : null;
}

async function nextConstituencyId(adminClient: Awaited<ReturnType<typeof requireSuperAdmin>>) {
  if (!adminClient) return "";
  const { data, error } = await adminClient.from("constituencies").select("id");
  if (error) throw error;
  const highest = (data ?? []).reduce((value, row) => {
    const match = /^CONS(\d+)$/i.exec(String(row.id));
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 0);
  return `CONS${String(highest + 1).padStart(6, "0")}`;
}

export async function GET(request: Request) {
  try {
    const adminClient = await requireSuperAdmin(request);
    if (!adminClient) return NextResponse.json({ message: "Super-admin access required." }, { status: 403 });
    return NextResponse.json({ id: await nextConstituencyId(adminClient) });
  } catch (error) {
    console.error("Constituency ID generation error", error);
    return NextResponse.json({ message: "Unable to generate constituency ID." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminClient = await requireSuperAdmin(request);
    if (!adminClient) return NextResponse.json({ message: "Super-admin access required." }, { status: 403 });

    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const body = isMultipart ? await request.formData() : await request.json();
    const value = (key: string) => body instanceof FormData ? String(body.get(key) ?? "") : body[key];
    const { id: submittedId, name, provinceId, districtId, latitude, longitude, mpName, mpPhone, mpEmail, adminName, pin, themeColor } = { id: value("id"), name: value("name"), provinceId: value("provinceId"), districtId: value("districtId"), latitude: value("latitude"), longitude: value("longitude"), mpName: value("mpName"), mpPhone: value("mpPhone"), mpEmail: value("mpEmail"), adminName: value("adminName"), pin: value("pin"), themeColor: value("themeColor") };
    const id = submittedId || await nextConstituencyId(adminClient);
    if (!id || !name || !provinceId || !/^\d{4}$/.test(pin) || !/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
      return NextResponse.json({ message: "Provide constituency details, a 4-digit PIN, and a valid theme color." }, { status: 400 });
    }

    let imagePath: string | null = null;
    const image = body instanceof FormData ? body.get("mpImage") : null;
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith("image/") || image.size > 10 * 1024 * 1024) return NextResponse.json({ message: "MP image must be an image up to 10 MB." }, { status: 400 });
      await adminClient.storage.createBucket("leadership-images", { public: true });
      imagePath = `${id}/${randomUUID()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
      const { error: uploadError } = await adminClient.storage.from("leadership-images").upload(imagePath, await image.arrayBuffer(), { contentType: image.type, upsert: false });
      if (uploadError) return NextResponse.json({ message: "Unable to upload the MP image." }, { status: 500 });
    }
    const { data: constituency, error: constituencyError } = await adminClient
      .from("constituencies")
      .upsert({ id, name, province_id: provinceId, district_id: districtId || null, latitude: latitude || null, longitude: longitude || null, mp_name: mpName || null, mp_phone: mpPhone || null, mp_email: mpEmail || null, ...(imagePath ? { mp_image_path: imagePath } : {}) }, { onConflict: "id" })
      .select("id, name")
      .single();

    if (constituencyError) return NextResponse.json({ message: constituencyError.message }, { status: 400 });

    const { data: existingAdmin } = await adminClient.from("admin_accounts").select("id").eq("constituency_id", id).eq("role", "constituency_admin").maybeSingle();
    const adminPayload = { constituency_id: id, display_name: adminName || null, pin_hash: hashAdminPin(pin), role: "constituency_admin", theme_color: themeColor, is_active: true };
    const { error: adminError } = existingAdmin
      ? await adminClient.from("admin_accounts").update(adminPayload).eq("id", existingAdmin.id)
      : await adminClient.from("admin_accounts").insert(adminPayload);
    if (adminError) return NextResponse.json({ message: adminError.message }, { status: 400 });

    return NextResponse.json({ constituency });
  } catch (error) {
    console.error("Constituency setup error", error);
    return NextResponse.json({ message: "Unable to save constituency setup." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const client = getSupabaseServer();
    const mobileNumber = new URL(request.url).searchParams.get("mobileNumber")?.trim();
    if (!mobileNumber) return NextResponse.json({ leadership: null });

    const { data: registration, error: registrationError } = await client
      .from("registrations")
      .select("cell_id")
      .eq("mobile_number", mobileNumber)
      .maybeSingle();
    if (registrationError) throw registrationError;
    if (!registration?.cell_id) return NextResponse.json({ leadership: null });

    const { data: cell, error: cellError } = await client.from("cells").select("constituency_id").eq("id", registration.cell_id).maybeSingle();
    if (cellError) throw cellError;
    if (!cell?.constituency_id) return NextResponse.json({ leadership: null });

    const { data: constituency, error } = await client
      .from("constituencies")
      .select("id, name, mp_name, mp_phone, mp_email, mp_image_path")
      .eq("id", cell.constituency_id)
      .maybeSingle();
    if (error) throw error;
    if (!constituency?.mp_name) return NextResponse.json({ leadership: null });

    const image = constituency.mp_image_path
      ? (/^https?:\/\//i.test(constituency.mp_image_path) ? constituency.mp_image_path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/leadership-images/${constituency.mp_image_path}`)
      : null;
    return NextResponse.json({ leadership: { id: constituency.id, name: constituency.mp_name, role: "Member of Parliament", constituency: constituency.name, image, bio: `Representing the people of ${constituency.name} and serving the community.`, phone: constituency.mp_phone, email: constituency.mp_email } });
  } catch (error) {
    console.error("Leadership API error", error);
    return NextResponse.json({ message: "Leadership could not be loaded." }, { status: 500 });
  }
}
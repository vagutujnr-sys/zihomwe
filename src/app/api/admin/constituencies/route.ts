import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const { data, error } = await getSupabaseServer()
    .from("constituencies")
    .select("id, name")
    .order("name");

  if (error) {
    return NextResponse.json({ message: "Unable to load constituencies" }, { status: 500 });
  }

  return NextResponse.json({ constituencies: data ?? [] });
}

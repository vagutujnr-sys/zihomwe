import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { resolveLocationFromCell } from "@/lib/location";

import { randomUUID } from "crypto";

function candidates(input: string) {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  return [...new Set([trimmed, digits.startsWith("07") ? `+263${digits.slice(1)}` : `+${digits}`])];
}

async function findRegistration(supabase: ReturnType<typeof getSupabaseServer>, mobileNumber: string, deviceId?: string) {
  if (deviceId) {
    const { data: deviceRegistration, error: deviceError } = await supabase
      .from("registrations")
      .select("id, full_name, mobile_number, role, assigned_location, cell_id, created_at, device_id, profile_image_path, handle")
      .eq("device_id", deviceId)
      .limit(1)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (deviceRegistration) return deviceRegistration;
  }

  for (const mobile of candidates(mobileNumber)) {
    const { data, error } = await supabase.from("registrations").select("id, full_name, mobile_number, role, assigned_location, cell_id, created_at, device_id, profile_image_path, handle").eq("mobile_number", mobile).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

async function enrichLocation(supabase: ReturnType<typeof getSupabaseServer>, registration: NonNullable<Awaited<ReturnType<typeof findRegistration>>>) {
  try {
    const location = await resolveLocationFromCell(supabase, registration.cell_id);
    return location ? { ...registration, assigned_location: location } : registration;
  } catch (error) {
    // Location enrichment is secondary; a location query must not hide the profile.
    console.error("Profile location enrichment failed", error);
    return registration;
  }
}

export async function GET(request: Request) {
  try {
    const mobileNumber = new URL(request.url).searchParams.get("mobileNumber")?.trim();
    const deviceId = new URL(request.url).searchParams.get("deviceId")?.trim();
    if (!mobileNumber) return NextResponse.json({ message: "Mobile number is required." }, { status: 400 });

    const supabase = getSupabaseServer();
    const registration = await findRegistration(supabase, mobileNumber, deviceId);
    if (!registration) return NextResponse.json({ profile: null, wallet: null });

    const profile = await enrichLocation(supabase, registration);

    const { data: wallet, error: walletError } = await supabase.from("home_wallets").upsert({ registration_id: profile.id }, { onConflict: "registration_id" }).select("id, points_balance, lifetime_points").single();
    if (walletError || !wallet) {
      console.error("Profile wallet load failed", walletError);
      return NextResponse.json({
        profile,
        wallet: { points_balance: 0, lifetime_points: 0, activity: [] },
      });
    }

    const { data: existingReward, error: rewardLookupError } = await supabase
      .from("home_wallet_activity")
      .select("id")
      .eq("wallet_id", wallet.id)
      .eq("reward_key", "community_profile_creation")
      .limit(1)
      .maybeSingle();
    if (rewardLookupError) throw rewardLookupError;

    let reward = existingReward;
    let awardedNow = false;
    if (!reward) {
      const { data: insertedReward, error: rewardInsertError } = await supabase
        .from("home_wallet_activity")
        .insert({
        wallet_id: wallet.id,
        title: "Community Profile Creation",
        description: "Welcome reward for creating your Zihomwe community profile.",
        points: 50,
        reward_key: "community_profile_creation",
        })
        .select("id")
        .maybeSingle();

      if (rewardInsertError && rewardInsertError.code !== "23505") throw rewardInsertError;
      reward = insertedReward;
      awardedNow = Boolean(insertedReward);
    }

    if (awardedNow) {
      const { data: updatedWallet, error: updateError } = await supabase
        .from("home_wallets")
        .update({ points_balance: wallet.points_balance + 50, lifetime_points: wallet.lifetime_points + 50, updated_at: new Date().toISOString() })
        .eq("id", wallet.id)
        .select("id, points_balance, lifetime_points")
        .single();
      if (updateError) throw updateError;
      wallet.points_balance = updatedWallet.points_balance;
      wallet.lifetime_points = updatedWallet.lifetime_points;

      const { error: notificationError } = await supabase.from("notifications").insert({
        registration_id: profile.id,
        title: "You received 50 HM",
        message: "Community Profile Creation earned you 50 Homwe. Welcome to the Zihomwe rewards community.",
        type: "homwe_reward",
      });
      if (notificationError) console.error("Homwe reward notification insert failed", notificationError.message);
    }

    const { data: activity, error: activityError } = await supabase.from("home_wallet_activity").select("id, title, description, points, created_at").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(10);
    if (activityError) throw activityError;

    return NextResponse.json({
      profile,
      wallet: { ...wallet, activity: activity ?? [] },
    });
  } catch (error) {
    console.error("Profile API error", error);
    return NextResponse.json({ message: "Profile could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mobileNumber = String(formData.get("mobileNumber") ?? "").trim();
    const deviceId = String(formData.get("deviceId") ?? "").trim();
    const profileImage = formData.get("profileImage");

    if (!mobileNumber) {
      return NextResponse.json({ message: "Mobile number is required." }, { status: 400 });
    }

    if (!(profileImage instanceof File) || profileImage.size === 0) {
      return NextResponse.json({ message: "Profile picture is required." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const registration = await findRegistration(supabase, mobileNumber, deviceId || undefined);
    if (!registration) {
      return NextResponse.json({ message: "Profile not found." }, { status: 404 });
    }

    const fileExtension = profileImage.name.split(".").pop() || "jpg";
    const imagePath = `${registration.id}/${randomUUID()}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(imagePath, await profileImage.arrayBuffer(), {
        contentType: profileImage.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Profile image upload failed", uploadError.message);
      return NextResponse.json({ message: "Unable to upload the profile picture." }, { status: 500 });
    }

    const previousPath = registration.profile_image_path?.trim();
    if (previousPath) {
      await supabase.storage.from("profile-pictures").remove([previousPath]).catch(() => undefined);
    }

    const { data: updatedRegistration, error: updateError } = await supabase
      .from("registrations")
      .update({ profile_image_path: imagePath })
      .eq("id", registration.id)
      .select("id, full_name, mobile_number, role, assigned_location, cell_id, created_at, device_id, profile_image_path, handle")
      .single();

    if (updateError) {
      await supabase.storage.from("profile-pictures").remove([imagePath]).catch(() => undefined);
      console.error("Profile image DB update failed", updateError.message);
      return NextResponse.json({ message: "Unable to save the profile picture." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile: await enrichLocation(supabase, updatedRegistration) });
  } catch (error) {
    console.error("Profile upload API error", error);
    return NextResponse.json({ message: "Profile picture upload failed." }, { status: 500 });
  }
}

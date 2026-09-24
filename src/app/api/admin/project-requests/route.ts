import { NextResponse } from "next/server";
import { readAdminToken } from "@/lib/admin-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

const statuses = ["pending", "reviewing", "approved", "rejected", "completed"] as const;
type RequestStatus = (typeof statuses)[number];

const allowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  pending: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: ["completed"],
  rejected: [],
  completed: [],
};

async function getSuperAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = token ? readAdminToken(token) : null;
  if (!session) return null;

  const { data } = await getSupabaseServer()
    .from("admin_accounts")
    .select("id, role, is_active")
    .eq("id", session.adminId)
    .eq("is_active", true)
    .maybeSingle();

  return data?.role === "super_admin" ? data : null;
}

export async function PATCH(request: Request) {
  try {
    const admin = await getSuperAdmin(request);
    if (!admin) return NextResponse.json({ message: "Super-admin access required." }, { status: 403 });

    const body = await request.json();
    const id = String(body.id ?? "").trim();
    const nextStatus = String(body.status ?? "") as RequestStatus;
    if (!id || !statuses.includes(nextStatus)) {
      return NextResponse.json({ message: "Provide a valid request and approval status." }, { status: 400 });
    }

    const client = getSupabaseServer();
    const { data: current, error: readError } = await client
      .from("project_requests")
      .select("id, status, registration_id, title")
      .eq("id", id)
      .maybeSingle();

    if (readError || !current) return NextResponse.json({ message: "Funding request not found." }, { status: 404 });
    if (!allowedTransitions[current.status as RequestStatus]?.includes(nextStatus)) {
      return NextResponse.json({ message: `A request in ${current.status} cannot move to ${nextStatus}.` }, { status: 409 });
    }

    const { data, error } = await client
      .from("project_requests")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, title, status, updated_at")
      .single();

    if (error) {
      console.error("Project request status update failed", error.message, error.details, error.hint);
      return NextResponse.json({ message: "Unable to update the project request." }, { status: 500 });
    }

    if (current.registration_id) {
      const notifications = nextStatus === "approved"
        ? [
            { registration_id: current.registration_id, title: "Funding request approved", message: `${current.title} has been approved for the next stage.`, type: "project_request" },
            { registration_id: current.registration_id, title: "Disbursement preparation started", message: `Funds for ${current.title} will be disbursed soon. We will notify you when the payment process is ready.`, type: "project_disbursement" },
          ]
        : [{ registration_id: current.registration_id, title: nextStatus === "rejected" ? "Funding request update" : "Funding request stage updated", message: `${current.title} is now ${nextStatus}.`, type: "project_request" }];
      const { error: notificationError } = await client.from("notifications").insert(notifications);
      if (notificationError) console.error("Approval notification insert failed", notificationError.message);
    }

    return NextResponse.json({ ok: true, request: data });
  } catch (error) {
    console.error("Project request admin API error", error);
    return NextResponse.json({ message: "Project request update could not be processed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const admin = await getSuperAdmin(request);
    if (!admin) return NextResponse.json({ message: "Super-admin access required." }, { status: 403 });

    const id = new URL(request.url).searchParams.get("id")?.trim();

    const client = getSupabaseServer();
    if (!id) {
      const fullQuery = await client
        .from("project_requests")
        .select("id, title, category, description, short_description, requested_amount, location, timeline, status, document_path, project_image_path, registration_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!fullQuery.error) return NextResponse.json({ requests: fullQuery.data ?? [] });

      // Keep older installations visible while the optional migration is being applied.
      const legacyQuery = await client
        .from("project_requests")
        .select("id, title, category, description, requested_amount, location, status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (legacyQuery.error) {
        console.error("Admin project request list failed", fullQuery.error.message, legacyQuery.error.message);
        return NextResponse.json({ message: "Unable to load project requests." }, { status: 500 });
      }
      return NextResponse.json({ requests: legacyQuery.data ?? [] });
    }

    const fullRequestQuery = await client
      .from("project_requests")
      .select("id, title, category, description, short_description, requested_amount, location, timeline, supporting_notes, bank_name, account_name, account_number, branch, document_path, project_image_path, registration_id, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    const legacyRequestQuery = fullRequestQuery.error
      ? await client.from("project_requests").select("id, title, category, description, requested_amount, location, status, created_at, updated_at").eq("id", id).maybeSingle()
      : null;
    const projectRequest = fullRequestQuery.data ?? legacyRequestQuery?.data;
    const requestError = fullRequestQuery.error && legacyRequestQuery?.error;

    if (requestError || !projectRequest) return NextResponse.json({ message: "Funding request not found." }, { status: 404 });
    const documentPath = "document_path" in projectRequest && typeof projectRequest.document_path === "string" ? projectRequest.document_path : null;
    let documentUrl: string | null = null;

    if (documentPath) {
      const { data, error } = await client.storage
        .from("project-documents")
        .createSignedUrl(documentPath, 60 * 10);

      if (error || !data?.signedUrl) {
        console.error("Project document link failed", error?.message);
        return NextResponse.json({ message: "Unable to open the submitted document." }, { status: 500 });
      }
      documentUrl = data.signedUrl;
    }

    return NextResponse.json({ documentUrl, request: projectRequest });
  } catch (error) {
    console.error("Project document admin API error", error);
    return NextResponse.json({ message: "Project document could not be opened." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase-server";
import { validateProjectRequestInput } from "@/lib/project-requests";

function phoneCandidates(input: string) {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  const candidates = new Set([trimmed]);
  if (digits.startsWith("263")) candidates.add(`+${digits}`);
  if (digits.startsWith("07")) candidates.add(`+263${digits.slice(1)}`);
  return [...candidates];
}

async function findRegistrationId(supabase: ReturnType<typeof getSupabaseServer>, mobileNumber: string) {
  for (const candidate of phoneCandidates(mobileNumber)) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id")
      .eq("mobile_number", candidate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }
  return null;
}

export async function POST(request: Request) {
  let uploadedDocumentPath: string | null = null;

  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const body = isMultipart ? await request.formData() : await request.json();
    const getValue = (key: string) => {
      const value = body instanceof FormData ? body.get(key) : body[key];
      return typeof value === "string" ? value : "";
    };
    const document = body instanceof FormData ? body.get("document") : null;

    const projectImage = body instanceof FormData ? body.get("projectImage") : null;
    if (projectImage instanceof File && projectImage.size > 0) {
      if (!projectImage.type.startsWith("image/")) return NextResponse.json({ message: "Project image must be a valid image file." }, { status: 400 });
      if (projectImage.size > 5 * 1024 * 1024) return NextResponse.json({ message: "Project images must be 5 MB or smaller." }, { status: 400 });
    }
    if (document instanceof File && document.size > 0) {
      const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
      if (!allowedTypes.includes(document.type)) {
        return NextResponse.json({ message: "Please upload a PDF, Word document, or text document." }, { status: 400 });
      }
      if (document.size > 10 * 1024 * 1024) {
        return NextResponse.json({ message: "Project documents must be 10 MB or smaller." }, { status: 400 });
      }
    }

    const payload = {
      title: getValue("title").trim(),
      category: getValue("category").trim(),
      description: getValue("description").trim(),
      short_description: getValue("shortDescription").trim(),
      requested_amount: Number(getValue("requestedAmount") || 0),
      location: getValue("location").trim(),
      timeline: getValue("timeline").trim() || null,
      supporting_notes: getValue("supportingNotes").trim() || null,
      bank_name: getValue("bankName").trim() || null,
      account_name: getValue("accountName").trim() || null,
      account_number: getValue("accountNumber").trim() || null,
      branch: getValue("branch").trim() || null,
      status: "pending",
      document_path: null as string | null,
      project_image_path: null as string | null,
      registration_id: null as string | null,
    };

    const validation = validateProjectRequestInput({
      title: payload.title,
      category: payload.category,
      description: payload.description,
      shortDescription: payload.short_description,
      projectImageProvided: projectImage instanceof File && projectImage.size > 0,
      requestedAmount: payload.requested_amount,
      location: payload.location,
      timeline: payload.timeline ?? undefined,
      bankName: payload.bank_name ?? undefined,
      accountName: payload.account_name ?? undefined,
      accountNumber: payload.account_number ?? undefined,
      branch: payload.branch ?? undefined,
      supportingNotes: payload.supporting_notes ?? undefined,
    });

    if (!validation.valid) {
      return NextResponse.json({ message: validation.errors[0] }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const mobileNumber = getValue("mobileNumber").trim();
    if (mobileNumber) {
      payload.registration_id = await findRegistrationId(supabase, mobileNumber);
    }
    if (document instanceof File && document.size > 0) {
      uploadedDocumentPath = `${randomUUID()}-${document.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(uploadedDocumentPath, await document.arrayBuffer(), {
          contentType: document.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Project document upload failed", uploadError.message);
        return NextResponse.json({ message: "Unable to upload the project document." }, { status: 500 });
      }
      payload.document_path = uploadedDocumentPath;
    }

    if (projectImage instanceof File && projectImage.size > 0) {
      const imagePath = `${randomUUID()}-${projectImage.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: imageError } = await supabase.storage.from("project-images").upload(imagePath, await projectImage.arrayBuffer(), { contentType: projectImage.type, upsert: false });
      if (imageError) {
        if (uploadedDocumentPath) await supabase.storage.from("project-documents").remove([uploadedDocumentPath]);
        console.error("Project image upload failed", imageError.message);
        return NextResponse.json({ message: "Unable to upload the project image." }, { status: 500 });
      }
      payload.project_image_path = imagePath;
    }

    const { data, error } = await supabase
      .from("project_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (uploadedDocumentPath) {
        await supabase.storage.from("project-documents").remove([uploadedDocumentPath]);
      }
      console.error("Project request insert failed", error.message, error.details, error.hint);
      return NextResponse.json({ message: "Unable to save the funding request." }, { status: 500 });
    }

    if (payload.registration_id) {
      const { error: notificationError } = await supabase.from("notifications").insert({
        registration_id: payload.registration_id,
        title: "Funding request submitted",
        message: `${data.title} has been received and is now waiting for review.`,
        type: "project_request",
      });
      if (notificationError) console.error("Funding notification insert failed", notificationError.message);
    }

    return NextResponse.json({
      ok: true,
      request: {
        id: data.id,
        title: data.title,
        status: data.status,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error("Project request API error", error);
    return NextResponse.json({ message: "Project funding request could not be processed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const mobileNumber = new URL(request.url).searchParams.get("mobileNumber")?.trim();
    if (!mobileNumber) return NextResponse.json({ message: "Mobile number is required." }, { status: 400 });

    const supabase = getSupabaseServer();
    const registrationId = await findRegistrationId(supabase, mobileNumber);
    if (!registrationId) return NextResponse.json({ requests: [] });

    const { data, error } = await supabase
      .from("project_requests")
      .select("id, title, category, description, short_description, requested_amount, location, timeline, status, document_path, project_image_path, created_at, updated_at")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ message: "Unable to load your funding requests." }, { status: 500 });
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    console.error("Project request list API error", error);
    return NextResponse.json({ message: "Funding requests could not be loaded." }, { status: 500 });
  }
}

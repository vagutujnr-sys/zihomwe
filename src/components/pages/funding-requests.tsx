"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, CircleDashed, CreditCard, FolderOpen, ShieldCheck } from "lucide-react";
import { buildProjectRequestTimeline, validateProjectRequestInput } from "@/lib/project-requests";

const exampleStatus = {
  pending: { label: "Submitted", color: "bg-amber-100 text-amber-700", icon: CircleDashed },
  reviewing: { label: "Under Review", color: "bg-blue-100 text-blue-700", icon: FolderOpen },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-rose-100 text-rose-700", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-violet-100 text-violet-700", icon: ShieldCheck },
} as const;

type FundingRequest = {
  id: string;
  title: string;
  category: string | null;
  description: string;
  requested_amount: number | string | null;
  location: string | null;
  timeline: string | null;
  status: keyof typeof exampleStatus;
  document_path: string | null;
  created_at: string;
};

export function FundingRequestsPage() {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [requests, setRequests] = useState<FundingRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestLoadError, setRequestLoadError] = useState("");
  const [formStep, setFormStep] = useState(1);
  const [document, setDocument] = useState<File | null>(null);
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    shortDescription: "",
    requestedAmount: "",
    location: "",
    timeline: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    branch: "",
    supportingNotes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadRequests() {
    const mobileNumber = window.localStorage.getItem("zihomweUserPhone");
    if (!mobileNumber) {
      setLoadingRequests(false);
      return;
    }
    try {
      const response = await fetch(`/api/project-requests?mobileNumber=${encodeURIComponent(mobileNumber)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load funding requests.");
      setRequests(payload.requests ?? []);
      setRequestLoadError("");
    } catch (error) {
      setRequestLoadError(error instanceof Error ? error.message : "Unable to load funding requests.");
    } finally {
      setLoadingRequests(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openRequestModal() {
    setFormStep(1);
    setErrors([]);
    setShowRequestModal(true);
  }

  function validateStep(step: number) {
    const stepErrors: string[] = [];

    if (step === 1) {
      if (!form.title.trim() || form.title.trim().length < 3) stepErrors.push("Project title is required.");
      if (!form.category.trim() || form.category.trim().length < 2) stepErrors.push("Project category is required.");
      if (!form.requestedAmount || Number(form.requestedAmount) <= 0) stepErrors.push("Requested amount must be greater than zero.");
      if (!form.location.trim() || form.location.trim().length < 2) stepErrors.push("Project location is required.");
    }

    if (step === 2) {
      if (!form.shortDescription.trim() || form.shortDescription.trim().length < 10) stepErrors.push("Please provide a short project description of at least 10 characters.");
      if (!form.description.trim() || form.description.trim().length < 20) stepErrors.push("Please describe the project in at least 20 characters.");
    }

    setErrors(stepErrors);
    return stepErrors.length === 0;
  }

  function goToNextStep() {
    if (validateStep(formStep)) setFormStep((step) => Math.min(step + 1, 3));
  }

  function goToPreviousStep() {
    setErrors([]);
    setFormStep((step) => Math.max(step - 1, 1));
  }

  async function handleSubmit() {
    const result = validateProjectRequestInput({
      title: form.title,
      category: form.category,
      description: form.description,
      shortDescription: form.shortDescription,
      projectImageProvided: Boolean(projectImage),
      requestedAmount: Number(form.requestedAmount) || 0,
      location: form.location,
      timeline: form.timeline,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
      branch: form.branch,
      supportingNotes: form.supportingNotes,
    });

    setErrors(result.errors);
    if (!result.valid) return;

    setSaving(true);
    try {
      const response = await fetch("/api/project-requests", {
        method: "POST",
        body: (() => {
          const body = new FormData();
          body.append("title", form.title);
          body.append("category", form.category);
          body.append("description", form.description);
          body.append("shortDescription", form.shortDescription);
          body.append("requestedAmount", String(Number(form.requestedAmount)));
          body.append("location", form.location);
          body.append("timeline", form.timeline);
          body.append("bankName", form.bankName);
          body.append("accountName", form.accountName);
          body.append("accountNumber", form.accountNumber);
          body.append("branch", form.branch);
          body.append("supportingNotes", form.supportingNotes);
          body.append("mobileNumber", window.localStorage.getItem("zihomweUserPhone") ?? "");
          if (document) body.append("document", document);
          if (projectImage) body.append("projectImage", projectImage);
          return body;
        })(),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Could not submit request.");
      }

      setSubmitted(true);
      setErrors([]);
      setDocument(null);
      setProjectImage(null);
      await loadRequests();
      window.dispatchEvent(new Event("zihomwe:notifications-updated"));
      setForm({
        title: "",
        category: "",
        description: "",
        shortDescription: "",
        requestedAmount: "",
        location: "",
        timeline: "",
        bankName: "",
        accountName: "",
        accountNumber: "",
        branch: "",
        supportingNotes: "",
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to submit request.";
      setErrors([message]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="-mx-4 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg shadow-emerald-900/20 sm:-mx-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100">Funding</p>
            <h2 className="mt-2 text-2xl font-bold">Project support</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>
        <p className="mt-3 text-sm text-emerald-50">Apply for help, track the review, and see the status of each request in one place.</p>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Your requests</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Project funding</h3>
          </div>
          <span className="text-xs text-slate-500">{requests.length} {requests.length === 1 ? "request" : "requests"}</span>
        </div>
        {loadingRequests && <p className="border-b border-slate-200 py-5 text-sm text-slate-500">Loading your requests...</p>}
        {!loadingRequests && requestLoadError && <div className="border-b border-slate-200 py-5"><p className="text-sm text-slate-600">You have not requested funding yet.</p><p className="mt-2 text-xs leading-5 text-slate-500">Taking part in other community programmes may help strengthen your application as it moves through review.</p></div>}
        {!loadingRequests && !requestLoadError && requests.length === 0 && <div className="border-b border-slate-200 py-5"><p className="text-sm text-slate-600">You have not requested funding yet.</p><p className="mt-2 text-xs leading-5 text-slate-500">Taking part in other community programmes may help strengthen your application as it moves through review.</p></div>}
        {!loadingRequests && requests.map((request) => {
          const statusMeta = exampleStatus[request.status] ?? exampleStatus.pending;
          const RequestStatusIcon = statusMeta.icon;
          return <button key={request.id} type="button" onClick={() => { setSelectedRequestId(request.id); setShowRequestDetails(true); }} className="flex w-full items-center gap-3 border-b border-slate-200 py-4 text-left transition hover:bg-white/60">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-emerald-100 text-emerald-700"><FolderOpen className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{request.title}</span><span className="mt-1 block text-xs text-slate-500">{request.category ?? "Uncategorised"} · US$ {Number(request.requested_amount ?? 0).toLocaleString()} · {new Date(request.created_at).toLocaleDateString("en-GB")}</span></span>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}><RequestStatusIcon className="h-3.5 w-3.5" />{statusMeta.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </button>;
        })}
      </section>

      {showRequestDetails && selectedRequestId && (() => {
        const request = requests.find((item) => item.id === selectedRequestId);
        if (!request) return null;
        const requestTimeline = buildProjectRequestTimeline(request.status);
        return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Request details</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{request.title}</h3>
              </div>
              <button type="button" onClick={() => setShowRequestDetails(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Category" value={request.category ?? "Uncategorised"} />
                <InfoCard label="Amount" value={`US$ ${Number(request.requested_amount ?? 0).toLocaleString()}`} />
                <InfoCard label="Location" value={request.location ?? "-"} />
                <InfoCard label="Timeline" value={request.timeline ?? "-"} />
              </div>
              <div className="mt-4 bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Summary</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{request.description}</p>
              </div>
              <div className="mt-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Project Approval path</p>
                <div className="grid grid-cols-4 gap-2">
                  {requestTimeline.map((step, index) => (
                    <div key={step.label} className={`border p-2 ${step.active ? "border-emerald-200 bg-emerald-50" : step.complete ? "border-emerald-200 bg-emerald-100" : "border-slate-200 bg-slate-50"}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">{index + 1}</span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] ${step.active || step.complete ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{step.complete ? "✓" : index + 1}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-800">{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <button
        type="button"
        onClick={openRequestModal}
        className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700"
      >
        <CreditCard className="h-4 w-4" />
        New request
      </button>

      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-t-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-[24px]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center bg-emerald-100 text-emerald-700">
                  <CreditCard className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">New request</h3>
              </div>
              <button type="button" aria-label="Close request form" onClick={() => setShowRequestModal(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>

            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                {["Project basics", "Proposal", "Banking"] .map((label, index) => {
                  const step = index + 1;
                  return (
                    <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${formStep >= step ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {step}
                      </span>
                      <span className={`truncate text-xs font-semibold ${formStep === step ? "text-emerald-700" : "text-slate-500"}`}>{label}</span>
                      {step < 3 && <span className="h-px flex-1 bg-slate-200" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[calc(100dvh-190px)] overflow-y-auto p-4 sm:max-h-[75vh]">
              {errors.length > 0 && (
                <div className="mb-4 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <ul className="list-disc space-y-1 pl-4">
                    {errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                </div>
              )}

              {submitted && (
                <div className="mb-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Request submitted successfully. It is now in review.
                </div>
              )}

              {formStep === 1 && (
                <div className="space-y-3">
                  <Field label="Project title">
                    <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className="input" placeholder="Solar irrigation pilot" />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Category">
                      <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className="input" placeholder="Agriculture" />
                    </Field>
                    <Field label="Amount (USD)">
                      <input type="number" inputMode="decimal" value={form.requestedAmount} onChange={(e) => updateField("requestedAmount", e.target.value)} className="input" placeholder="24000" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Location">
                      <input value={form.location} onChange={(e) => updateField("location", e.target.value)} className="input" placeholder="Ward 8" />
                    </Field>
                    <Field label="Timeline">
                      <input value={form.timeline} onChange={(e) => updateField("timeline", e.target.value)} className="input" placeholder="3 months" />
                    </Field>
                  </div>
                </div>
              )}

              {formStep === 2 && (
                <div className="space-y-3">
                  <Field label="Short project description">
                    <textarea value={form.shortDescription} onChange={(e) => updateField("shortDescription", e.target.value)} className="input min-h-[90px]" placeholder="A short description that can be shown on the Projects page." />
                  </Field>
                  <Field label="Project proposal">
                    <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} className="input min-h-[180px]" placeholder="Tell us what the project is, why it matters, and how the funds will be used." />
                  </Field>
                  <Field label="Support notes">
                    <textarea value={form.supportingNotes} onChange={(e) => updateField("supportingNotes", e.target.value)} className="input min-h-[110px]" placeholder="Optional notes about milestones, needs, or sustainability." />
                  </Field>
                  <label className="block border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">Project document (optional)</span>
                    <span className="mt-1 block text-sm text-slate-600">Upload a PDF, Word document, or text file up to 10 MB.</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt"
                      onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
                      className="mt-3 block w-full text-base text-slate-700 file:mr-3 file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    {document && <span className="mt-2 block truncate text-sm font-medium text-emerald-700">Selected: {document.name}</span>}
                  </label>
                  <label className="block border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">Project image</span>
                    <span className="mt-1 block text-sm text-slate-600">Required. Choose an image that represents the project. Maximum 5 MB.</span>
                    <input required type="file" accept="image/*" onChange={(event) => setProjectImage(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-base text-slate-700 file:mr-3 file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
                    {projectImage && <span className="mt-2 block truncate text-sm font-medium text-emerald-700">Selected: {projectImage.name}</span>}
                  </label>
                </div>
              )}

              {formStep === 3 && (
                <div className="space-y-3">
                  <div className="border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                    Banking details are optional and can be added now or later if the request is approved for payout.
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Bank name">
                      <input value={form.bankName} onChange={(e) => updateField("bankName", e.target.value)} className="input" placeholder="CBZ" />
                    </Field>
                    <Field label="Account no.">
                      <input inputMode="numeric" value={form.accountNumber} onChange={(e) => updateField("accountNumber", e.target.value)} className="input" placeholder="0001234567" />
                    </Field>
                    <Field label="Account name">
                      <input value={form.accountName} onChange={(e) => updateField("accountName", e.target.value)} className="input" placeholder="Account holder" />
                    </Field>
                    <Field label="Branch">
                      <input value={form.branch} onChange={(e) => updateField("branch", e.target.value)} className="input" placeholder="Harare CBD" />
                    </Field>
                  </div>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                {formStep > 1 && (
                  <button type="button" onClick={goToPreviousStep} className="flex-1 border border-slate-300 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50">
                    Back
                  </button>
                )}
                {formStep < 3 ? (
                  <button type="button" onClick={goToNextStep} className="flex-1 bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-700">
                    Continue
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">
                    {saving ? "Submitting..." : "Submit request"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Camera, ChevronRight, MapPin, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { buildProfileImageUrl } from "@/lib/profile";

type ProfileData = {
  full_name: string | null;
  mobile_number: string;
  handle?: string | null;
  role: string;
  assigned_location: { province?: string; district?: string; constituency?: string; ward?: string; cell?: string } | null;
  created_at: string;
  profile_image_path?: string | null;
};

type WalletData = {
  points_balance: number;
  lifetime_points: number;
  activity: { id: string; title: string; description: string | null; points: number; created_at: string }[];
};

export function UserPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [handleDraft, setHandleDraft] = useState("");
  const [handleMessage, setHandleMessage] = useState("");
  const [savingHandle, setSavingHandle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const mobileNumber = window.localStorage.getItem("zihomweUserPhone");
    if (!mobileNumber) {
      return () => controller.abort();
    }

    const deviceId = window.localStorage.getItem("zihomweDeviceId") ?? "";
    fetch(`/api/profile?mobileNumber=${encodeURIComponent(mobileNumber)}&deviceId=${encodeURIComponent(deviceId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Profile could not be loaded.");
        setProfile(payload.profile);
        setWallet(payload.wallet);
        setHandleDraft(payload.profile?.handle ?? "");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Profile could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    const mobileNumber = window.localStorage.getItem("zihomweUserPhone");
    const deviceId = window.localStorage.getItem("zihomweDeviceId") ?? "";

    if (!mobileNumber) {
      setError("Your phone number is required before updating your profile picture.");
      return;
    }

    const formData = new FormData();
    formData.append("mobileNumber", mobileNumber);
    formData.append("deviceId", deviceId);
    formData.append("profileImage", file);

    setUploading(true);
    setError("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Profile picture upload failed.");
      setProfile(payload.profile);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Profile picture upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return <p className="py-12 text-center text-sm text-slate-500">Loading your profile...</p>;
  if (error) return <p className="py-12 text-center text-sm text-slate-600">{error}</p>;
  if (!profile || !wallet) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-slate-600" role="status" aria-live="polite">
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600" />
        </div>
        <span>Pulling your profile</span>
      </div>
    );
  }

  const name = profile.full_name?.trim() || "Zihomwe member";
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const profileImageUrl = buildProfileImageUrl(profile.profile_image_path);
  const location = profile.assigned_location ?? {};
  const joined = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(profile.created_at));
  const hasHandle = Boolean(profile.handle);

  return (
    <div className="space-y-6 pb-36">
      <section className="relative -mx-4 overflow-hidden bg-emerald-800 px-5 pb-6 pt-5 text-white shadow-lg shadow-emerald-900/15 sm:-mx-6">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full border-[24px] border-emerald-500/20" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt={name} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/40" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400 text-xl font-bold text-emerald-950">{initials}</div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-emerald-800 bg-white text-emerald-800 shadow-sm"
                aria-label="Upload profile picture"
                disabled={uploading}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">Member profile</p>
              <h1 className="mt-1 text-xl font-bold">{name}</h1>
              <p className="mt-1 text-sm text-emerald-100">{profile.handle ? `@${profile.handle}` : "No @handle yet"}</p>
              <p className="mt-1 text-xs text-emerald-200">{profile.mobile_number}</p>
            </div>
          </div>
          <ShieldCheck className="mt-1 h-5 w-5 text-yellow-300" />
        </div>
        {uploading && <div className="relative mt-3 text-xs text-emerald-100">Uploading profile picture...</div>}
        <div className="relative mt-5 flex items-center gap-2 text-xs text-emerald-100"><span className="rounded-full bg-emerald-700 px-2.5 py-1 capitalize">{profile.role.replaceAll("_", " ")}</span><span>Member since {joined}</span></div>
      </section>

      <section className="rounded-none border-y border-slate-200 bg-white px-0 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Your handle</p>
        <p className="mt-1 text-sm text-slate-600">People find you in Chats with @{handleDraft || "yourhandle"}.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-slate-400">@</span>
          <input
            value={handleDraft}
            onChange={(event) => setHandleDraft(event.target.value.replace(/^@/, "").toLowerCase())}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder="lloydgutu"
            disabled={hasHandle || savingHandle}
            aria-label={hasHandle ? "Locked handle" : "Choose a handle"}
          />
          {!hasHandle ? <button
            type="button"
            disabled={savingHandle}
            onClick={async () => {
              setSavingHandle(true);
              setHandleMessage("");
              try {
                const response = await fetch("/api/handles", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    mobileNumber: window.localStorage.getItem("zihomweUserPhone"),
                    deviceId: window.localStorage.getItem("zihomweDeviceId"),
                    sessionToken: window.localStorage.getItem("zihomweSessionToken"),
                    handle: handleDraft,
                  }),
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || "Could not save handle.");
                setProfile((prev) => (prev ? { ...prev, handle: payload.profile.handle } : prev));
                setHandleDraft(payload.profile.handle);
                setHandleMessage("Handle saved.");
              } catch (saveError) {
                setHandleMessage(saveError instanceof Error ? saveError.message : "Could not save handle.");
              } finally {
                setSavingHandle(false);
              }
            }}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-emerald-300"
          >
            {savingHandle ? "…" : "Save"}
          </button> : <span className="text-xs font-medium text-slate-500">Locked</span>}
        </div>
        {handleMessage ? <p className="mt-2 text-xs text-slate-500">{handleMessage}</p> : null}
      </section>

      <section className="relative -mx-4 overflow-hidden bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 p-5 text-emerald-950 shadow-md shadow-amber-500/15 sm:-mx-6">
        <div className="absolute -bottom-8 -right-5 h-28 w-28 rounded-full bg-white/20" />
        <div className="relative flex items-start justify-between">
          <div><div className="flex items-center gap-2"><Wallet className="h-5 w-5" /><p className="text-xs font-bold uppercase tracking-[0.18em]">Homwe Wallet</p></div><p className="mt-3 text-4xl font-bold">{wallet.points_balance.toLocaleString()} <span className="text-lg">HM</span></p><p className="mt-1 text-sm text-emerald-900/70">Homwe reward currency available</p></div>
          <Sparkles className="h-6 w-6 text-emerald-800" />
        </div>
        <div className="relative mt-5 flex items-center justify-between border-t border-emerald-900/10 pt-3 text-xs"><span>Lifetime earned</span><strong>{wallet.lifetime_points.toLocaleString()} HM</strong></div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Your activity</p><h2 className="mt-1 text-lg font-bold text-slate-900">Homwe history</h2></div><Award className="h-5 w-5 text-amber-500" /></div>
        {wallet.activity.length === 0 ? <div className="border-b border-slate-200 py-5 text-sm text-slate-600">Your Homwe rewards will appear here as you take part in Zihomwe programmes.</div> : <div className="divide-y divide-slate-200 border-y border-slate-200">{wallet.activity.map((item) => <div key={item.id} className="flex items-center gap-3 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-100 text-emerald-700"><Award className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.description || "Reward earned"}</p></div><span className="text-sm font-bold text-emerald-700">+{item.points} HM</span></div>)}</div>}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-700" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Your community</p><h2 className="mt-1 text-lg font-bold text-slate-900">Location profile</h2></div></div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-200 py-4">{["province", "district", "constituency", "ward", "cell"].map((key) => <div key={key}><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{key}</p><p className="mt-1 text-sm font-semibold capitalize text-slate-800">{location[key as keyof typeof location] || "Not assigned"}</p></div>)}</div>
      </section>

      <button type="button" className="flex w-full items-center justify-between border-b border-slate-200 py-4 text-left text-sm font-semibold text-slate-800"><span>Profile and account settings</span><ChevronRight className="h-4 w-4 text-slate-400" /></button>
    </div>
  );
}

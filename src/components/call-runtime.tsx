"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { readSessionToken } from "@/lib/session";
import { WebRtcCall, type CallKind } from "@/lib/webrtc-call";

type CallPerson = {
  id?: string;
  fullName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
};

type IncomingCall = {
  id: string;
  chatId: string;
  callType: CallKind;
  other: CallPerson | null;
};

type OutgoingDetail = {
  chatId: string;
  callType: CallKind;
  other?: CallPerson | null;
};

type Phase = "idle" | "ringing" | "connecting" | "active";

function labelFor(person: CallPerson | null | undefined) {
  return person?.fullName || (person?.handle ? `@${person.handle}` : "Member");
}

export function CallRuntime() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [role, setRole] = useState<"caller" | "callee" | null>(null);
  const [callType, setCallType] = useState<CallKind>("audio");
  const [person, setPerson] = useState<CallPerson | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const engineRef = useRef<WebRtcCall | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  function attachStreams(engine: WebRtcCall) {
    if (localVideoRef.current && engine.localStream) localVideoRef.current.srcObject = engine.localStream;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = engine.remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = engine.remoteStream;
  }

  function clearCall(message = "") {
    engineRef.current?.stop();
    engineRef.current = null;
    callIdRef.current = null;
    setPhase("idle");
    setRole(null);
    setPerson(null);
    setIncoming(null);
    setMuted(false);
    setCameraOn(true);
    setError(message);
  }

  async function finishOnServer(callId: string, action: "end" | "fail" | "decline") {
    await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: readSessionToken(), action }),
    }).catch(() => undefined);
  }

  async function beginMedia(callId: string, type: CallKind, nextRole: "caller" | "callee") {
    const engine = new WebRtcCall(callId, type, nextRole, {
      onRemoteStream: () => attachStreams(engine),
      onStatus: (status) => {
        if (status === "active") setPhase("active");
        if (status === "ringing") setPhase("ringing");
      },
      onEnded: (reason) => {
        const text =
          reason === "declined" ? "Call declined." : reason === "missed" ? "No answer." : "";
        clearCall(text);
      },
    });
    engineRef.current = engine;
    setPhase(nextRole === "caller" ? "ringing" : "connecting");
    await engine.start();
    attachStreams(engine);
  }

  async function startOutgoing(detail: OutgoingDetail) {
    if (callIdRef.current || phase !== "idle") return;
    setError("");
    setCallType(detail.callType);
    setPerson(detail.other ?? null);
    setRole("caller");
    setIncoming(null);
    setPhase("connecting");
    try {
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: readSessionToken(),
          chatId: detail.chatId,
          callType: detail.callType,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.call?.id) throw new Error(payload.message || "Could not start call.");
      callIdRef.current = payload.call.id;
      await beginMedia(payload.call.id, detail.callType, "caller");
    } catch (startError) {
      if (callIdRef.current) await finishOnServer(callIdRef.current, "fail");
      clearCall(startError instanceof Error ? startError.message : "Could not start call.");
    }
  }

  async function acceptIncoming() {
    if (!incoming) return;
    const next = incoming;
    setIncoming(null);
    setCallType(next.callType);
    setPerson(next.other);
    setRole("callee");
    setError("");
    setPhase("connecting");
    callIdRef.current = next.id;
    try {
      const response = await fetch(`/api/calls/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: readSessionToken(), action: "accept" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Could not answer.");
      }
      await beginMedia(next.id, next.callType, "callee");
    } catch (acceptError) {
      if (callIdRef.current) await finishOnServer(callIdRef.current, "fail");
      clearCall(acceptError instanceof Error ? acceptError.message : "Could not answer.");
    }
  }

  async function declineIncoming() {
    if (!incoming) return;
    const id = incoming.id;
    setIncoming(null);
    await finishOnServer(id, "decline");
  }

  async function hangUp() {
    const id = callIdRef.current;
    engineRef.current?.stop();
    engineRef.current = null;
    callIdRef.current = null;
    if (id) await finishOnServer(id, "end");
    clearCall();
  }

  useEffect(() => {
    function onOutgoing(event: Event) {
      const detail = (event as CustomEvent<OutgoingDetail>).detail;
      if (!detail?.chatId) return;
      void startOutgoing(detail);
    }
    window.addEventListener("zihomwe:outgoing-call", onOutgoing);
    return () => window.removeEventListener("zihomwe:outgoing-call", onOutgoing);
    // startOutgoing reads the latest refs; the listener is registered once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (cancelled || callIdRef.current) return;
      const sessionToken = readSessionToken();
      if (!sessionToken) return;
      try {
        const response = await fetch(`/api/calls?sessionToken=${encodeURIComponent(sessionToken)}`);
        const payload = await response.json().catch(() => ({}));
        if (cancelled || !response.ok) return;
        const next = (payload.calls ?? [])[0] as IncomingCall | undefined;
        setIncoming(next?.id ? next : null);
      } catch {
        // The next poll retries.
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase === "idle") return;
    attachStreams(engine);
  }, [phase, callType]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const inCall = phase !== "idle" && role;
  const title =
    phase === "ringing"
      ? callType === "video"
        ? "Calling for video…"
        : "Calling…"
      : phase === "connecting"
        ? "Connecting…"
        : callType === "video"
          ? "Video call"
          : "Voice call";

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {error ? (
        <div className="fixed inset-x-0 top-4 z-[70] mx-auto w-[min(92vw,24rem)] rounded-2xl bg-rose-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          {error}
        </div>
      ) : null}

      {incoming && !inCall ? (
        <div className="fixed inset-x-0 bottom-24 z-[70] mx-auto flex w-[min(92vw,24rem)] items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-emerald-300">
              {incoming.callType === "video" ? "Incoming video call" : "Incoming voice call"}
            </p>
            <p className="truncate text-sm font-semibold">{labelFor(incoming.other)}</p>
          </div>
          <button
            type="button"
            onClick={() => void declineIncoming()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600"
            aria-label="Decline call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void acceptIncoming()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500"
            aria-label="Answer call"
          >
            {incoming.callType === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
          </button>
        </div>
      ) : null}

      {inCall ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white">
          <div className="relative min-h-0 flex-1">
            {callType === "video" ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full bg-black object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-700 text-3xl font-semibold">
                  {labelFor(person).slice(0, 1).toUpperCase()}
                </div>
              </div>
            )}
            {callType === "video" ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-36 w-28 rounded-2xl bg-slate-800 object-cover shadow-lg"
              />
            ) : null}
            <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pb-10 pt-8">
              <p className="text-sm text-white/80">{title}</p>
              <p className="mt-1 text-xl font-semibold">{labelFor(person)}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 px-6 pb-10 pt-4">
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                engineRef.current?.setMuted(next);
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            {callType === "video" ? (
              <button
                type="button"
                onClick={() => {
                  const next = !cameraOn;
                  setCameraOn(next);
                  engineRef.current?.setCameraEnabled(next);
                }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15"
                aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              >
                {cameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void hangUp()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600"
              aria-label="End call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

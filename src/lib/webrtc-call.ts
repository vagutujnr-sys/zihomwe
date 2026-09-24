import { ICE_SERVERS } from "@/lib/chat-types";
import { readSessionToken } from "@/lib/session";

export type CallKind = "audio" | "video";

type SignalRow = {
  id: string;
  signal_type: string;
  payload: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; reason?: string };
  created_at: string;
};

type CallHandlers = {
  onRemoteStream: (stream: MediaStream) => void;
  onStatus: (status: string) => void;
  onEnded: (reason: string) => void;
};

function authQuery() {
  return `sessionToken=${encodeURIComponent(readSessionToken())}`;
}

async function postSignal(callId: string, signalType: string, payload: unknown) {
  const response = await fetch(`/api/calls/${callId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: readSessionToken(), signalType, payload }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Could not send call signal.");
  }
}

export class WebRtcCall {
  localStream: MediaStream | null = null;
  readonly remoteStream = new MediaStream();
  private pc: RTCPeerConnection | null = null;
  private seen = new Set<string>();
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private stopped = false;
  private cursor = "";

  constructor(
    private callId: string,
    private callType: CallKind,
    private role: "caller" | "callee",
    private handlers: CallHandlers
  ) {}

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Calling is not available in this browser.");
    }
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: this.callType === "video" ? { facingMode: "user" } : false,
    });
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }
    pc.ontrack = (event) => {
      const tracks = event.streams[0]?.getTracks() ?? [event.track];
      for (const track of tracks) {
        if (!this.remoteStream.getTracks().some((existing) => existing.id === track.id)) {
          this.remoteStream.addTrack(track);
        }
      }
      this.handlers.onRemoteStream(this.remoteStream);
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate || this.stopped) return;
      void postSignal(this.callId, "ice", { candidate: event.candidate.toJSON() }).catch(() => undefined);
    };
    if (this.role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await postSignal(this.callId, "offer", { sdp: pc.localDescription });
    }
    void this.poll();
  }

  stop() {
    this.stopped = true;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream.getTracks().forEach((track) => track.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  setCameraEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  private async flushIce() {
    if (!this.pc || !this.remoteSet) return;
    const queued = this.pendingIce.splice(0);
    for (const candidate of queued) {
      await this.pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  private async applySignal(signal: SignalRow) {
    if (this.seen.has(signal.id) || !this.pc || this.stopped) return;
    this.seen.add(signal.id);
    if (signal.signal_type === "offer" && this.role === "callee" && signal.payload.sdp) {
      await this.pc.setRemoteDescription(signal.payload.sdp);
      this.remoteSet = true;
      await this.flushIce();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await postSignal(this.callId, "answer", { sdp: this.pc.localDescription });
      this.handlers.onStatus("active");
    } else if (signal.signal_type === "answer" && this.role === "caller" && signal.payload.sdp && !this.remoteSet) {
      await this.pc.setRemoteDescription(signal.payload.sdp);
      this.remoteSet = true;
      await this.flushIce();
      this.handlers.onStatus("active");
    } else if (signal.signal_type === "ice" && signal.payload.candidate) {
      if (!this.remoteSet) this.pendingIce.push(signal.payload.candidate);
      else await this.pc.addIceCandidate(signal.payload.candidate).catch(() => undefined);
    } else if (signal.signal_type === "hangup") {
      this.handlers.onEnded(signal.payload.reason || "ended");
      this.stop();
    }
  }

  private async poll() {
    while (!this.stopped) {
      try {
        const after = this.cursor ? `&after=${encodeURIComponent(this.cursor)}` : "";
        const response = await fetch(`/api/calls/${this.callId}?${authQuery()}${after}`);
        const payload = await response.json().catch(() => ({}));
        if (this.stopped) return;
        if (response.ok) {
          const status = String(payload.call?.status || "");
          if (status) this.handlers.onStatus(status);
          if (status === "ended" || status === "declined" || status === "missed" || status === "failed") {
            this.handlers.onEnded(status);
            this.stop();
            return;
          }
          const signals = (payload.signals ?? []) as SignalRow[];
          for (const signal of signals) {
            await this.applySignal(signal);
            if (signal.created_at > this.cursor) this.cursor = signal.created_at;
          }
        }
      } catch {
        // Keep the call up across a brief network miss.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
  }
}

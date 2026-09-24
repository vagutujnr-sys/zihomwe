export type ChatPerson = {
  id: string;
  fullName: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

export type ChatListItem = {
  id: string;
  lastMessage: string;
  timeLabel: string;
  unreadCount: number;
  other: ChatPerson;
};

export type ChatRequestItem = {
  id: string;
  note: string | null;
  createdAt: string;
  other: ChatPerson | null;
};

export type ChatMessageItem = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  system?: boolean;
  readAt?: string | null;
};

export type CallSession = {
  id: string;
  chatId: string;
  callerId: string;
  calleeId: string;
  callType: "audio" | "video";
  status: "ringing" | "active" | "ended" | "declined" | "missed" | "failed";
  other?: ChatPerson | null;
};

export function chatAuthQuery() {
  if (typeof window === "undefined") return "";
  const mobileNumber = window.localStorage.getItem("zihomweUserPhone") ?? "";
  const deviceId = window.localStorage.getItem("zihomweDeviceId") ?? "";
  return `mobileNumber=${encodeURIComponent(mobileNumber)}&deviceId=${encodeURIComponent(deviceId)}`;
}

export function chatAuthBody() {
  return {
    mobileNumber: typeof window !== "undefined" ? window.localStorage.getItem("zihomweUserPhone") ?? "" : "",
    deviceId: typeof window !== "undefined" ? window.localStorage.getItem("zihomweDeviceId") ?? "" : "",
  };
}

export function personInitials(name: string | null | undefined, handle: string | null | undefined) {
  const source = (name || handle || "?").trim().replace(/^@/, "");
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

/** Public @handles for find-and-request messaging */

const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

export function sanitizeHandleInput(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

export function formatHandle(handle: string | null | undefined): string {
  if (!handle) return "";
  return `@${sanitizeHandleInput(handle)}`;
}

/** Build a handle candidate from a display name, e.g. "Lloyd Gutu" → "lloydgutu" */
export function handleFromName(fullName: string | null | undefined, mobileNumber?: string): string {
  const fromName = sanitizeHandleInput((fullName ?? "").replace(/\s+/g, ""));
  if (fromName.length >= 3) return fromName.slice(0, 24);

  const digits = (mobileNumber ?? "").replace(/\D/g, "");
  const tail = digits.slice(-8) || String(Date.now()).slice(-6);
  return `user${tail}`.slice(0, 24);
}

export function orderedParticipantIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

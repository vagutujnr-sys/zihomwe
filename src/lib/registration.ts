import { DEFAULT_PHONE_COUNTRY, findPhoneCountry, type PhoneCountry } from "./phone-countries";

export type UserRole =
  | "citizen"
  | "cell_leader"
  | "ward_leader"
  | "constituency_admin"
  | "provincial_admin"
  | "national_admin"
  | "super_admin";

export interface RegistrationDraft {
  fullName?: string;
  handle?: string;
  mobileNumber: string;
  otpCode: string;
  locationConsent: boolean;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  assignedLocation?: {
    province: string;
    district: string;
    constituency: string;
    ward: string;
    cell: string;
    village?: string;
  };
  role: UserRole;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Strip a single leading trunk 0 from a national number. */
export function stripTrunkZero(nationalDigits: string): string {
  return nationalDigits.startsWith("0") ? nationalDigits.slice(1) : nationalDigits;
}

/**
 * Canonical DB format: country code + national number, digits only.
 * Example: Zimbabwe 785323166 → 263785323166
 */
export function buildStoredPhone(
  dialCodeOrCountry: string | PhoneCountry,
  nationalInput: string
): string {
  const country =
    typeof dialCodeOrCountry === "string"
      ? findPhoneCountry(dialCodeOrCountry)
      : dialCodeOrCountry;
  const dial = digitsOnly(country.dialCode);
  let national = stripTrunkZero(digitsOnly(nationalInput));

  if (!national) return "";

  // User pasted a full international number already containing the dial code.
  if (national.startsWith(dial) && national.length >= dial.length + Math.max(country.nationalLength - 1, 6)) {
    return national;
  }

  // User pasted +263… / 263… into the national field.
  if (national.startsWith("00")) {
    national = national.slice(2);
  }

  return `${dial}${national}`;
}

/**
 * Normalize any known local / international input into stored form (no +).
 * Defaults to Zimbabwe (263) when no country is provided.
 */
export function normalizePhoneNumber(
  input: string,
  dialCodeOrCountry: string | PhoneCountry = DEFAULT_PHONE_COUNTRY
): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const country =
    typeof dialCodeOrCountry === "string"
      ? findPhoneCountry(dialCodeOrCountry)
      : dialCodeOrCountry;
  const dial = digitsOnly(country.dialCode);
  let digits = digitsOnly(trimmed);

  if (!digits) return "";

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Already international for this country.
  if (digits.startsWith(dial)) {
    return digits;
  }

  // Bare Zimbabwe-style legacy values / national entry.
  return buildStoredPhone(country, digits);
}

export function isValidStoredPhone(
  storedPhone: string,
  dialCodeOrCountry: string | PhoneCountry = DEFAULT_PHONE_COUNTRY
): boolean {
  const country =
    typeof dialCodeOrCountry === "string"
      ? findPhoneCountry(dialCodeOrCountry)
      : dialCodeOrCountry;
  const dial = digitsOnly(country.dialCode);
  const digits = digitsOnly(storedPhone);
  if (!digits.startsWith(dial)) return false;

  const national = digits.slice(dial.length);
  // Allow slight length flexibility (±1) for regional variants.
  return (
    national.length >= Math.max(6, country.nationalLength - 1) &&
    national.length <= country.nationalLength + 1
  );
}

/** Display helper: 263785323166 → +263785323166 */
export function formatPhoneForDisplay(storedPhone: string): string {
  const digits = digitsOnly(storedPhone);
  return digits ? `+${digits}` : "";
}

/** All formats that may already exist in registrations.mobile_number */
export function phoneLookupCandidates(
  input: string,
  dialCodeOrCountry: string | PhoneCountry = DEFAULT_PHONE_COUNTRY
): string[] {
  const trimmed = input.trim();
  const digits = digitsOnly(trimmed);
  const country =
    typeof dialCodeOrCountry === "string"
      ? findPhoneCountry(dialCodeOrCountry)
      : dialCodeOrCountry;
  const stored = normalizePhoneNumber(trimmed, country);
  const candidates = new Set<string>();

  if (trimmed) candidates.add(trimmed);
  if (stored) {
    candidates.add(stored);
    candidates.add(`+${stored}`);
  }
  if (digits) {
    candidates.add(digits);
    candidates.add(`+${digits}`);
  }

  const dial = digitsOnly(country.dialCode);
  let national = "";

  if (digits.startsWith(dial) && digits.length > dial.length) {
    national = digits.slice(dial.length);
  } else if (digits.startsWith("0")) {
    national = stripTrunkZero(digits);
  } else if (digits.length >= 7 && digits.length <= 11) {
    national = stripTrunkZero(digits);
  }

  if (national) {
    candidates.add(national);
    candidates.add(`0${national}`);
    candidates.add(`${dial}${national}`);
    candidates.add(`+${dial}${national}`);
  }

  // Always include Zimbabwe legacy shapes when dial is 263, for older rows.
  if (dial === "263" && national) {
    candidates.add(national);
    candidates.add(`0${national}`);
    candidates.add(`263${national}`);
    candidates.add(`+263${national}`);
  }

  return [...candidates].filter(Boolean);
}

export function generateOtpCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function buildLocationSummary(draft: RegistrationDraft): string {
  const location = draft.assignedLocation;
  if (!location) {
    return "Location pending";
  }

  return [location.constituency, location.ward, location.cell].filter(Boolean).join(" • ");
}

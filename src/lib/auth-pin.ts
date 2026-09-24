/** Six digits the person chooses. This is the only secret they type. */
export function isSixDigitPin(value: string) {
  return /^\d{6}$/.test(value);
}

/**
 * Supabase Auth accepts the six-digit PIN directly as a password.
 * Sign-in must use this same value.
 */
export function authPasswordFromPin(pin: string) {
  if (!isSixDigitPin(pin)) {
    throw new Error("Choose a 6-digit PIN.");
  }
  return pin;
}

/** registrations.mobile_number is stored as digits; Auth uses a deterministic internal email. */
export function authEmailFromPhone(storedPhone: string) {
  const digits = storedPhone.replace(/\D/g, "");
  if (!digits) throw new Error("Phone number is required.");
  return `${digits}@medcard.co.zw`;
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStoredPhone,
  formatPhoneForDisplay,
  generateOtpCode,
  isValidStoredPhone,
  normalizePhoneNumber,
  phoneLookupCandidates,
} from "../src/lib/registration";

test("stores Zimbabwe numbers with country code and no plus", () => {
  assert.equal(normalizePhoneNumber("0771234567"), "263771234567");
  assert.equal(normalizePhoneNumber("+263771234567"), "263771234567");
  assert.equal(normalizePhoneNumber("771234567"), "263771234567");
  assert.equal(normalizePhoneNumber("785323166"), "263785323166");
  assert.equal(buildStoredPhone("263", "785323166"), "263785323166");
  assert.equal(formatPhoneForDisplay("263785323166"), "+263785323166");
});

test("validates national length for selected country", () => {
  assert.equal(isValidStoredPhone("263785323166", "263"), true);
  assert.equal(isValidStoredPhone("26378532", "263"), false);
  assert.equal(isValidStoredPhone(buildStoredPhone("27", "821234567"), "27"), true);
});

test("builds lookup candidates across legacy phone formats", () => {
  const candidates = phoneLookupCandidates("785323166");
  assert.ok(candidates.includes("785323166"));
  assert.ok(candidates.includes("263785323166"));
  assert.ok(candidates.includes("+263785323166"));
  assert.ok(candidates.includes("0785323166"));
});

test("generates a four digit OTP code", () => {
  const otp = generateOtpCode();
  assert.match(otp, /^\d{4}$/);
});

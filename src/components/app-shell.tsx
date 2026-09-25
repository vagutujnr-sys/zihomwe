"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CountryCodePicker } from "@/components/country-code-picker";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone-countries";
import { isSixDigitPin } from "@/lib/auth-pin";
import { signInWithCitizenPin } from "@/lib/citizen-auth";
import {
  buildStoredPhone,
  formatPhoneForDisplay,
  generateOtpCode,
  isValidStoredPhone,
  type RegistrationDraft,
} from "@/lib/registration";
import { isValidHandle, sanitizeHandleInput } from "@/lib/handles";
import { markWelcomePending, markWelcomeSeen, writeCitizenSession } from "@/lib/session";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function getDeviceId() {
  if (typeof window === "undefined") return "";
  let deviceId = window.localStorage.getItem("zihomweDeviceId");
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem("zihomweDeviceId", deviceId);
  }
  return deviceId;
}

async function reverseGeocodeLocation(latitude: number, longitude: number) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=region,district,place,locality,neighborhood,address&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const context = feature.context || [];
    const assign = (prefix: string) => {
      const match = context.find((item: { id?: string; text?: string }) => item.id?.startsWith(prefix));
      return match?.text ?? "";
    };

    return {
      province: assign("region"),
      district: assign("district"),
      constituency: assign("place") || assign("locality") || "",
      ward: assign("neighborhood") || "",
      cell: feature.text || "",
      village: "",
    };
  } catch (error) {
    console.error("Mapbox reverse geocode failed", error);
    return null;
  }
}

export function AppShell({ resumePin = false }: { resumePin?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraft>({
    fullName: "",
    handle: "",
    mobileNumber: "",
    otpCode: generateOtpCode(),
    locationConsent: true,
    role: "citizen",
  });

  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [otpStep, setOtpStep] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [locationStatus, setLocationStatus] = useState<"pending" | "requesting" | "available" | "denied" | "error">("pending");
  const [allocationState, setAllocationState] = useState<"idle" | "pending" | "done">("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pinStep, setPinStep] = useState(false);
  const [pinMode, setPinMode] = useState<"create" | "enter">("enter");
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [linkingExisting, setLinkingExisting] = useState(false);
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [accountPhone, setAccountPhone] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const storedPhone = useMemo(
    () => (draft.mobileNumber.trim() ? buildStoredPhone(selectedCountry, draft.mobileNumber) : ""),
    [draft.mobileNumber, selectedCountry]
  );
  const phoneIsValid = isValidStoredPhone(storedPhone, selectedCountry);
  const displayPhone = formatPhoneForDisplay(storedPhone);

  const fieldHint = phoneIsValid
    ? `We will send SMS to ${displayPhone}`
    : `Enter a valid ${selectedCountry.name} mobile number to continue.`;
  const canContinue = phoneIsValid;
  const continueBtnClass = canContinue ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400";
  const confirmBtnClass = "w-full rounded-full px-4 py-3 text-sm font-semibold transition bg-emerald-600 text-white";
  const otpComplete = otpDigits.every((d) => d.length > 0);
  const pinComplete = pinDigits.every((digit) => digit.length > 0);
  const confirmComplete = confirmDigits.every((digit) => digit.length > 0);
  const locationHint =
    locationStatus === "available"
      ? "Location enabled. We will allocate your area."
      : locationStatus === "requesting"
        ? "Requesting location…"
        : "Location disabled. Please enable location.";

  function showPin(mode: "create" | "enter", existing: boolean, message?: string | null, phone?: string) {
    setLinkingExisting(existing);
    setAccountPhone(phone || "");
    setPinMode(mode);
    setPinDigits(["", "", "", "", "", ""]);
    setConfirmDigits(["", "", "", "", "", ""]);
    setPinError(message || null);
    setPinStep(true);
    setOtpStep(false);
  }

  async function lookupPhone(phone: string, dialCode: string) {
    const loginResponse = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber: phone, dialCode }),
    });
    const loginData = await loginResponse.json().catch(() => ({}));
    if (!loginResponse.ok) {
      throw new Error(loginData?.error || "Unable to verify this phone number right now.");
    }
    return loginData as {
      exists?: boolean;
      hasAuth?: boolean;
      needsPin?: boolean;
      mobileNumber?: string;
      setupMessage?: string;
    };
  }

  useEffect(() => {
    if (!resumePin) return;
    const phone = window.localStorage.getItem("zihomweUserPhone") ?? "";
    if (!phone) return;
    const national = phone.replace(/\D/g, "").replace(/^263/, "");
    setDraft((current) => ({ ...current, mobileNumber: national }));
    let cancelled = false;
    void lookupPhone(phone, "263")
      .then((loginData) => {
        if (cancelled || !loginData.exists) return;
        showPin(loginData.hasAuth ? "enter" : "create", true, loginData.setupMessage, loginData.mobileNumber);
      })
      .catch((error) => {
        if (!cancelled) setLoginError(error instanceof Error ? error.message : "Unable to open your PIN.");
      });
    return () => {
      cancelled = true;
    };
    // Resume once for people who already have a profile but no Supabase session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumePin]);

  async function handleContinue() {
    if (!canContinue) return;

    setLoginError(null);
    setIsProcessing(true);
    try {
      const loginData = await lookupPhone(storedPhone, selectedCountry.dialCode);
      if (loginData.exists) {
        showPin(loginData.hasAuth ? "enter" : "create", true, loginData.setupMessage, loginData.mobileNumber);
        setIsProcessing(false);
        return;
      }
    } catch (error) {
      console.error("Login check failed", error);
      setLoginError(error instanceof Error ? error.message : "Unable to reach the server. Check your connection and try again.");
      setIsProcessing(false);
      return;
    }

    setIsProcessing(false);
    startOtpStep();
  }

  function startOtpStep() {
    setOtpStep(true);
    const code = draft.otpCode || "1234";
    setOtpDigits(["", "", "", ""]);
    code.split("").forEach((ch, i) =>
      window.setTimeout(() => {
        setOtpDigits((p) => {
          const next = [...p];
          next[i] = ch;
          return next;
        });
      }, i * 2000)
    );
    setShowLocationToast(true);
    window.setTimeout(() => setShowLocationToast(false), 8000);
    setLocationStatus("requesting");

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationStatus("available");
          setDraft((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
        },
        () => setLocationStatus("denied")
      );
    }
  }

  const chosenHandle = sanitizeHandleInput(draft.handle ?? "");

  useEffect(() => {
    if (!otpStep) return;
    if (!chosenHandle) {
      setHandleStatus("idle");
      return;
    }
    if (!isValidHandle(chosenHandle)) {
      setHandleStatus("invalid");
      return;
    }
    const controller = new AbortController();
    setHandleStatus("checking");
    const timer = window.setTimeout(() => {
      void fetch(`/api/handles?check=1&q=${encodeURIComponent(chosenHandle)}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.message || "Could not check that handle.");
          setHandleStatus(payload.available ? "available" : "taken");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setHandleStatus("idle");
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [chosenHandle, otpStep]);

  function handleConfirmOtp() {
    if (!otpComplete || !termsAccepted) return;
    if (!(draft.fullName ?? "").trim()) {
      setLoginError("Enter your full name.");
      return;
    }
    if (!isValidHandle(chosenHandle)) {
      setLoginError("Choose a handle with 3–24 letters, numbers, or underscores.");
      return;
    }
    if (handleStatus === "taken") {
      setLoginError("That handle is already taken.");
      return;
    }
    setLoginError(null);
    setDraft((current) => ({ ...current, handle: chosenHandle }));
    showPin("create", false);
  }

  function setPinBox(which: "pin" | "confirm", index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const setter = which === "pin" ? setPinDigits : setConfirmDigits;
    setter((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      document.getElementById(`${which}-${index + 1}`)?.focus();
    }
  }

  async function handleSubmitPin() {
    const pin = pinDigits.join("");
    const confirmPin = confirmDigits.join("");
    if (!isSixDigitPin(pin)) {
      setPinError("Enter a 6-digit PIN.");
      return;
    }
    if (pinMode === "create" && pin !== confirmPin) {
      setPinError("Enter the same 6-digit PIN twice.");
      return;
    }

    setPinError(null);
    setIsConfirming(true);
    if (!linkingExisting) setAllocationState("pending");
    const deviceId = getDeviceId();
    let phoneForAuth = accountPhone || storedPhone;

    try {
      if (pinMode === "create" && !linkingExisting) {
        let assignedLocation = null;
        if (draft.latitude && draft.longitude) {
          assignedLocation = await reverseGeocodeLocation(draft.latitude, draft.longitude);
        }
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            mobileNumber: storedPhone,
            dialCode: selectedCountry.dialCode,
            locationConsent: draft.locationConsent || termsAccepted,
            deviceId,
            assignedLocation,
            pin,
            confirmPin,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Registration failed");
        }
        phoneForAuth = payload?.data?.mobile_number || phoneForAuth;
      } else if (pinMode === "create") {
        const response = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobileNumber: phoneForAuth,
            dialCode: selectedCountry.dialCode,
            pin,
            confirmPin,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Could not save the PIN.");
        }
        phoneForAuth = payload?.mobileNumber || phoneForAuth;
      }

      const session = await signInWithCitizenPin(phoneForAuth, pin);
      if (pinMode === "create" && !linkingExisting) markWelcomePending();
      else markWelcomeSeen();
      writeCitizenSession(session.mobileNumber || storedPhone, deviceId, session.sessionToken);
      router.replace("/main");
    } catch (error) {
      console.error(error);
      setAllocationState("idle");
      setPinError(error instanceof Error ? error.message : "Could not sign in.");
      setIsConfirming(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto text-slate-900">
      <div
        className="pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/main_bg.png')" }}
      />

      <div className="relative z-10 flex min-h-[100dvh] w-full max-w-md flex-shrink-0 flex-col justify-center px-4 pb-10 pt-4 sm:px-6">
        <div className="mb-2 text-center">
          <img src="/logo_main.png" alt="Zihomwe" className="mx-auto mb-4 h-[150px] w-auto" />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-xl">
          {pinStep ? (
            <div className="mt-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {pinMode === "enter" ? "Enter your PIN" : "Create a 6-digit PIN"}
              </h2>
              <p className="text-sm text-slate-600">
                {pinMode === "enter"
                  ? `Sign in to ${displayPhone || storedPhone}`
                  : "You will use this PIN the next time you open ZiHomwe. It is not sent as an SMS."}
              </p>

              <div className="grid grid-cols-6 gap-2">
                {pinDigits.map((digit, index) => (
                  <input
                    key={`pin-${index}`}
                    id={`pin-${index}`}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={1}
                    value={digit}
                    onChange={(event) => setPinBox("pin", index, event.target.value)}
                    className="h-14 rounded-2xl border border-slate-200 bg-slate-50 text-center text-2xl font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                  />
                ))}
              </div>

              {pinMode === "create" ? (
                <>
                  <p className="text-sm font-medium text-slate-700">Confirm PIN</p>
                  <div className="grid grid-cols-6 gap-2">
                    {confirmDigits.map((digit, index) => (
                      <input
                        key={`confirm-${index}`}
                        id={`confirm-${index}`}
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={1}
                        value={digit}
                        onChange={(event) => setPinBox("confirm", index, event.target.value)}
                        className="h-14 rounded-2xl border border-slate-200 bg-slate-50 text-center text-2xl font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {pinError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{pinError}</div>
              ) : null}

              {allocationState === "pending" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Creating your account and allocating your area… please keep location on.
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSubmitPin()}
                disabled={!pinComplete || (pinMode === "create" && !confirmComplete) || isConfirming}
                className={confirmBtnClass + (isConfirming ? " cursor-progress opacity-90" : "")}
                style={{ fontSize: 16 }}
              >
                {isConfirming
                  ? pinMode === "enter"
                    ? "Signing in…"
                    : "Creating account…"
                  : pinMode === "enter"
                    ? "Sign in"
                    : "Create PIN and continue"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPinStep(false);
                  setPinError(null);
                  setIsConfirming(false);
                  setAllocationState("idle");
                  if (!linkingExisting) setOtpStep(true);
                }}
                className="w-full rounded-full border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                style={{ fontSize: 16 }}
              >
                {linkingExisting ? "Edit phone number" : "Back"}
              </button>
            </div>
          ) : !otpStep ? (
            <div className="mt-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Enter your phone number</h2>
              <p className="mt-2 text-sm text-slate-600">We will send an SMS message with a verification code.</p>

              <div className="flex gap-3">
                <CountryCodePicker
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  disabled={isProcessing}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={draft.mobileNumber}
                  onChange={(e) => setDraft((c) => ({ ...c, mobileNumber: e.target.value }))}
                  placeholder={selectedCountry.placeholder}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:bg-white"
                  style={{ fontSize: 16 }}
                />
              </div>

              {loginError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loginError}</div>
              ) : null}

              <p className="text-sm text-slate-500">{fieldHint}</p>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue || isProcessing}
                className={
                  "w-full rounded-full px-4 py-3 text-sm font-semibold transition " +
                  continueBtnClass +
                  (isProcessing ? " cursor-progress opacity-90" : "")
                }
                style={{ fontSize: 16 }}
              >
                {isProcessing ? "Processing…" : "Continue"}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Our OTP is automatically pulled.</h2>

              <p className="text-sm text-slate-500">Code sent to {displayPhone || storedPhone}</p>

              <div className="mt-2 grid grid-cols-4 gap-3">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    readOnly
                    className="h-14 rounded-2xl border border-slate-200 bg-slate-50 text-center text-2xl font-semibold tracking-[0.35em] outline-none"
                  />
                ))}
              </div>

              <label className="block text-sm font-medium text-slate-700">
                  Full name
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draft.fullName}
                    onChange={(e) => setDraft((c) => ({ ...c, fullName: e.target.value }))}
                    placeholder="Your full name"
                    disabled={!otpComplete}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    style={{ fontSize: 16 }}
                  />
                </label>

              <label className="block text-sm font-medium text-slate-700">
                  Handle
                  <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-500 focus-within:bg-white">
                    <span className="text-base text-slate-400">@</span>
                    <input
                      type="text"
                      value={draft.handle ?? ""}
                      onChange={(e) => setDraft((c) => ({ ...c, handle: sanitizeHandleInput(e.target.value) }))}
                      placeholder="yourhandle"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={!otpComplete}
                      className="w-full bg-transparent py-3 pl-1 text-base outline-none disabled:text-slate-400"
                      style={{ fontSize: 16 }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {handleStatus === "checking"
                      ? "Checking availability…"
                      : handleStatus === "available"
                        ? `@${chosenHandle} is available.`
                        : handleStatus === "taken"
                          ? "That handle is already taken."
                          : handleStatus === "invalid"
                            ? "Use 3–24 letters, numbers, or underscores."
                            : "People will find you in Chats with this handle. You choose it."}
                  </p>
                </label>

              <div className="mt-3 flex items-start gap-3">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-700">
                    I agree to the{" "}
                    <a href="/terms" className="text-emerald-600 underline">
                      Terms & Conditions
                    </a>
                  </label>
                </div>

              <button
                type="button"
                onClick={handleConfirmOtp}
                disabled={!otpComplete || !termsAccepted || !(draft.fullName ?? "").trim() || !isValidHandle(chosenHandle) || handleStatus === "taken" || handleStatus === "checking"}
                className={confirmBtnClass}
                style={{ fontSize: 16 }}
              >
                Continue
              </button>

              {loginError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loginError}</div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setOtpStep(false);
                  setIsProcessing(false);
                  setLoginError(null);
                }}
                className="w-full rounded-full border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                style={{ fontSize: 16 }}
              >
                Edit phone number
              </button>
            </div>
          )}
        </div>

        <div className="pointer-events-none">
          <div
            className={`absolute left-4 top-6 z-20 w-[calc(100vw-32px)] max-w-xs transition-all duration-500 ease-out ${
              showLocationToast ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
            }`}
          >
            <div className="pointer-events-auto relative overflow-hidden rounded-3xl border border-emerald-500 bg-white px-4 py-3 text-sm text-slate-900 shadow-xl shadow-slate-900/10">
              <button
                type="button"
                onClick={() => setShowLocationToast(false)}
                className="absolute right-3 top-3 h-7 w-7 rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                aria-label="Close notification"
              >
                ×
              </button>
              <div className="flex items-center gap-3">
                <img src="/app_icon.png" alt="App icon" className="h-10 w-10 rounded-full border border-emerald-500 bg-white" />
                <div>
                  <div className="font-semibold text-slate-900">
                    {locationStatus === "available"
                      ? "Location enabled"
                      : locationStatus === "requesting"
                        ? "Requesting location"
                        : "Location disabled"}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{locationHint}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

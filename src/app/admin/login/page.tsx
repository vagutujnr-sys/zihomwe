"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: pinDigits.join("") }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      // Store token and redirect to dashboard
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminProfile", JSON.stringify(data.admin));
      router.push("/admin/dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-page min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="admin-login-card w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/logo_main.png"
            alt="Zihomwe"
            className="h-24 w-auto"
          />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <p className="mt-2 text-slate-600">
            Enter Your Secure PIN To Continue
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* PIN Field */}
          <div className="admin-pin-field">
            <div className="admin-pin-inputs">
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  ref={(element) => { pinRefs.current[index] = element; }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={digit}
                  required
                  aria-label={`PIN digit ${index + 1}`}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "").slice(-1);
                    setPinDigits((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
                    if (value && index < 3) pinRefs.current[index + 1]?.focus();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digit && index > 0) pinRefs.current[index - 1]?.focus();
                  }}
                  className="admin-pin-input"
                />
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⚙️</span>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            Version 1.0.0.2 • Zihomwe Management Portal
          </p>
        </div>
      </div>
    </div>
  );
}

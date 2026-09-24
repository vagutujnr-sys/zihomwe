"use client";

import { useEffect, useState } from "react";

type SplashProps = {
  children?: React.ReactNode;
  /** Keep splash visible (no auto-dismiss) — used during boot/session redirect */
  hold?: boolean;
};

export default function Splash({ children, hold = false }: SplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (hold) {
      setVisible(true);
      // Never hold forever — soft-dismiss if boot/redirect stalls
      const failSafe = window.setTimeout(() => setVisible(false), 10000);
      return () => window.clearTimeout(failSafe);
    }

    const timeoutId = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(timeoutId);
  }, [hold]);

  return (
    <>
      {children}
      {visible && (
        <div
          className={`splash-overlay flex items-center justify-center${hold ? " splash-hold" : ""}`}
          style={{
            backgroundImage: "url('/main_bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <img
            src="/logo_main.png"
            alt="Splash"
            className="h-[120px] w-auto object-contain"
            loading="eager"
            onError={() => {
              if (!hold) setVisible(false);
            }}
          />
        </div>
      )}
    </>
  );
}

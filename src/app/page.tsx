"use client";

import { useEffect, useState } from "react";
import Splash from "@/components/Splash";
import { AppShell } from "@/components/app-shell";
import { hasCitizenSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type BootPhase = "boot" | "login" | "redirecting";

export default function Home() {
  const [phase, setPhase] = useState<BootPhase>("boot");
  const [resumePin, setResumePin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const resume = new URLSearchParams(window.location.search).get("pin") === "1";
      if (data.session && hasCitizenSession()) {
        setPhase("redirecting");
        window.location.replace("/main");
        return;
      }
      setResumePin(resume && hasCitizenSession());
      setPhase("login");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "boot" || phase === "redirecting") {
    return <Splash hold />;
  }

  return (
    <Splash>
      <AppShell resumePin={resumePin} />
    </Splash>
  );
}

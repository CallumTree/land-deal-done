"use client";

import { useEffect, useState } from "react";
import { ensureSession } from "@/lib/supabase/client";

type Status = "checking" | "ok" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureSession()
      .then((session) => {
        setUserId(session?.user.id ?? null);
        setStatus("ok");
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus("error");
      });
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-8 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Plot Line</h1>
      <p className="text-sm text-zinc-500">Scaffold check — Supabase anonymous session</p>
      {status === "checking" && <p className="text-zinc-400">Checking…</p>}
      {status === "ok" && (
        <p className="rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
          Connected · auth.uid = {userId}
        </p>
      )}
      {status === "error" && (
        <p className="max-w-md rounded-full bg-amber-50 px-4 py-1.5 text-center text-sm font-medium text-amber-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

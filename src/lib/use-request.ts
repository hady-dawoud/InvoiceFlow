"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function useRequest() {
  const t = useTranslations();
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setReady(true), []);

  // A rejected browser request keeps the form intact and returns undefined for retry.
  async function run<T>(request: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    setPending(true);
    try { return await request(); }
    catch { setError(t("requestFailed")); }
    finally { setPending(false); }
  }
  return { run, pending: pending || !ready, error, setError };
}

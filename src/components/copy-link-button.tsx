"use client";

import { useEffect, useState } from "react";
import { useRequest } from "@/lib/use-request";

async function copyToClipboard(url: string) {
  try { await navigator.clipboard.writeText(url); return; }
  catch {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    try {
      input.select();
      if (!document.execCommand("copy")) throw new Error("Clipboard copy failed.");
    } finally { input.remove(); }
  }
}

export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const { run, pending, error } = useRequest();
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setCopied(false);
    const link = `${window.location.origin}/pay/${token}`;
    setUrl(link);
    const success = await run(async () => { await copyToClipboard(link); return true; });
    if (success) setCopied(true);
  }

  return (
    <div>
      <button onClick={copy} disabled={pending}
        className="btn btn-ghost">
        {copied ? "Link copied ✓" : "Copy client link"}
      </button>
      {error && <div role="alert" className="mt-2 text-sm text-red-600">
        Could not copy. Select the link below to copy it manually.
        <input aria-label="Client link" readOnly value={url} onFocus={(event) => event.target.select()}
          className="mt-1 block w-full rounded border border-line px-2 py-1" />
      </div>}
    </div>
  );
}

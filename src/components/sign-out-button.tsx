"use client";

import { useRouter } from "next/navigation";
import { useRequest } from "@/lib/use-request";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const { run, pending, error, setError } = useRequest();
  return (
    <div>
    <button
      disabled={pending}
      onClick={async () => {
        const result = await run(() => signOut());
        if (!result) return;
        if (result.error) { setError(result.error.message ?? "Could not sign out."); return; }
        router.push("/login");
        router.refresh();
      }}
      className="btn btn-ghost"
    >
      Sign out
    </button>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRequest } from "@/lib/use-request";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { run, pending, error, setError } = useRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => signIn.email({ email, password }));
    if (!result) return;
    const { error } = result;
    if (error) {
      setError(error.message ?? "Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="display text-2xl">Welcome back</h1>
      <p className="mt-1 text-sm text-quiet">
        Sign in to manage your invoices.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn w-full"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-quiet">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-carbon hover:underline">
          Start for free
        </Link>
      </p>
    </div>
  );
}

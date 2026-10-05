"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRequest } from "@/lib/use-request";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { signUp } from "@/lib/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { run, pending, error, setError } = useRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => signUp.email({ name, email, password }));
    if (!result) return;
    const { error } = result;
    if (error) {
      setError(error.message ?? "Could not create your account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="display text-2xl">Create your account</h1>
      <p className="mt-1 text-sm text-quiet">
        Free plan: {FREE_MONTHLY_LIMIT} invoices per month. No card required.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Your name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field mt-1"
            placeholder="Alex Doe"
          />
        </div>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1"
            placeholder="At least 8 characters"
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
          {pending ? "Creating account…" : "Create free account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-quiet">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-carbon hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

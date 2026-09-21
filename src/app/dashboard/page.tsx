import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();
  const { user } = session;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            Hi {user.name.split(" ")[0]} 👋
          </h1>
          <SignOutButton />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Signed in as {user.email} · Plan: {user.isPro ? "Pro" : "Free"} ·
          Dashboard under construction.
        </p>
      </div>
    </div>
  );
}

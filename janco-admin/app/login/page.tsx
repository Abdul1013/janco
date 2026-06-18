"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, isAuthenticated } from "@/lib/auth";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { ok, error: err } = await login(email, password);
    setLoading(false);
    if (!ok) {
      setError(err ?? "Login failed");
      return;
    }
    const from = params.get("from") ?? "/dashboard";
    router.replace(from);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-2xl p-8 space-y-5 shadow-xl shadow-black/30"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          placeholder="admin@janco.app"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-text mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-primary-dark transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-primary tracking-wide">JANCO</h1>
          <p className="text-text-muted text-sm mt-1">Admin Dashboard</p>
        </div>

        <Suspense fallback={
          <div className="bg-surface border border-border rounded-2xl p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

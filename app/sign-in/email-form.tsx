"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icon";

export function EmailPasswordForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const res = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (res?.error) {
        setError("Incorrect email or password.");
        setBusy(false);
        return;
      }
      window.location.href = "/projects";
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600 flex items-start gap-2">
          <Icon name="alert-circle" className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          className="input"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input pr-16"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400 hover:text-ink-700 transition-colors"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full h-12 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #00BAF2 0%, #0080aa 100%)" }}
      >
        {busy ? "Signing in…" : (<>Sign in <Icon name="arrow-right" className="h-4 w-4" /></>)}
      </button>
    </form>
  );
}
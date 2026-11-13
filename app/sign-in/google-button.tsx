"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icon";
import { submitGoogleAccessRequest, type AccessRequestResult } from "./actions";

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z" />
    </svg>
  );
}

type Style = { icon: React.ComponentProps<typeof Icon>["name"]; ring: string; iconBg: string; title: string };

function styleFor(status: AccessRequestResult["status"]): Style {
  switch (status) {
    case "submitted":
      return { icon: "check", ring: "text-emerald-600", iconBg: "bg-emerald-50 text-emerald-600 ring-emerald-100", title: "Request submitted" };
    case "already_pending":
      return { icon: "clock", ring: "text-primary-600", iconBg: "bg-primary-50 text-primary-600 ring-primary-100", title: "Request pending" };
    case "exists_inactive":
      return { icon: "clock", ring: "text-amber-600", iconBg: "bg-amber-50 text-amber-600 ring-amber-100", title: "Account not active" };
    case "exists_active":
      return { icon: "shield", ring: "text-primary-600", iconBg: "bg-primary-50 text-primary-600 ring-primary-100", title: "Almost there" };
    default:
      return { icon: "alert-circle", ring: "text-rose-600", iconBg: "bg-rose-50 text-rose-600 ring-rose-100", title: "Something went wrong" };
  }
}

function ResultDialog({ result, onClose }: { result: AccessRequestResult; onClose: () => void }) {
  const s = styleFor(result.status);
  const showEmailNote = result.status === "submitted" || result.status === "already_pending";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[400px] rounded-2xl bg-white shadow-2xl ring-1 ring-ink-200/60 p-7 text-center animate-fade-in">
        <div className={`mx-auto h-14 w-14 rounded-2xl grid place-items-center ring-8 ${s.iconBg}`}>
          <Icon name={s.icon} className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-ink-900 tracking-tight">{s.title}</h2>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">{result.message}</p>
        {showEmailNote && (
          <p className="mt-3 text-xs text-ink-400">
            You&apos;ll be able to sign in with Google as soon as an administrator approves your access.
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full h-11 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
          style={{ background: "linear-gradient(135deg, #00BAF2 0%, #0080aa 100%)" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccessRequestResult | null>(null);

  async function handleClick() {
    setBusy(true);
    try {
      const { getFirebaseAuth, googleProvider } = await import("@/lib/firebase-client");
      const { signInWithPopup } = await import("firebase/auth");

      const popup = await signInWithPopup(getFirebaseAuth(), googleProvider());
      const idToken = await popup.user.getIdToken();

      // Existing, approved account → this signs them straight in.
      const res = await signIn("firebase", { idToken, redirect: false });
      if (!res?.error) {
        window.location.href = "/projects";
        return;
      }

      // Not approved yet → file an access request and show the outcome.
      const outcome = await submitGoogleAccessRequest(idToken);
      setResult(outcome);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setBusy(false);
        return;
      }
      setResult({ status: "error", message: "Google sign-in couldn't be completed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="relative flex items-center my-6">
        <div className="flex-grow border-t border-ink-200/70" />
        <span className="mx-3 text-[11px] font-semibold uppercase tracking-widest text-ink-300">or</span>
        <div className="flex-grow border-t border-ink-200/70" />
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="w-full h-12 rounded-xl border border-ink-200 bg-white text-sm font-semibold text-ink-700 shadow-soft hover:shadow-card hover:border-ink-300 transition-all duration-200 inline-flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <GoogleMark />
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      <p className="mt-3 text-center text-xs text-ink-400">
        New here? Continue with Google to request access.
      </p>

      {result && <ResultDialog result={result} onClose={() => setResult(null)} />}
    </div>
  );
}
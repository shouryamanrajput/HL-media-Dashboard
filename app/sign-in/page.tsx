import { Icon } from "@/components/icon";
import { EmailPasswordForm } from "./email-form";
import { GoogleSignInButton } from "./google-button";

export default function SignInPage() {
  const googleEnabled =
    !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] shrink-0 relative bg-gradient-to-br from-[#002970] via-[#003b75] to-[#0080aa] flex-col justify-between p-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.04] rounded-full blur-[80px] -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00BAF2]/10 rounded-full blur-[60px] translate-y-1/4 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/[0.03] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/[0.05] rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hl-media-logo.svg" alt="HL Media" className="h-10 w-10 rounded-xl" />
            <span className="text-white/90 font-bold text-lg tracking-tight">HL Media</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-[2.5rem] font-bold text-white leading-[1.15] tracking-tight">
            Video Project<br />
            <span className="text-[#6dcfff]">Studio</span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-[340px]">
            Plan shoots, track edits, run internal reviews and hit every delivery date — all in one place.
          </p>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/[0.08] grid place-items-center">
                <Icon name="list" className="h-4 w-4 text-[#6dcfff]" />
              </div>
              <span className="text-sm text-white/60">Brief-to-delivery project pipeline</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/[0.08] grid place-items-center">
                <Icon name="clock" className="h-4 w-4 text-[#6dcfff]" />
              </div>
              <span className="text-sm text-white/60">Deadline and workload tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/[0.08] grid place-items-center">
                <Icon name="chart" className="h-4 w-4 text-[#6dcfff]" />
              </div>
              <span className="text-sm text-white/60">Real-time dashboards & reports</span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[11px] text-white/25 font-medium tracking-wide">
            INTERNAL USE ONLY · HL MEDIA
          </p>
        </div>
      </div>

      {/* Right sign-in panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#fafbfd] relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,186,242,0.04)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(0,41,112,0.03)_0%,_transparent_60%)]" />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hl-media-logo.svg" alt="HL Media" className="h-14 w-14 rounded-2xl shadow-lg mb-4" />
            <h1 className="text-xl font-bold text-ink-900 tracking-tight">HL Media</h1>
            <p className="text-xs text-ink-400 mt-0.5">Video Project Studio</p>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-ink-400 mt-1">Sign in to your account to continue.</p>
          </div>

          <EmailPasswordForm />

          {googleEnabled && <GoogleSignInButton />}

          <p className="text-center text-[10px] text-ink-300 mt-8 font-medium tracking-widest uppercase">
            Internal use only · HL Media
          </p>
        </div>
      </div>
    </div>
  );
}
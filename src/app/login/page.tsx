"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { api, USE_MOCK } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const role = useAuth((s) => s.user?.role);
  const setSession = useAuth((s) => s.setSession);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotResult, setForgotResult] = useState<{ message: string; devResetPath?: string } | null>(null);

  const forgotMutation = useMutation({
    mutationFn: (targetEmail: string) => api.forgotPassword(targetEmail),
    onSuccess: (res) => {
      setForgotError(null);
      setForgotResult({ message: res.message, devResetPath: res.devResetPath });
    },
    onError: (e: Error) => setForgotError(e.message || "Couldn't process request."),
  });

  const submitForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotMutation.isPending) return;
    if (!/^\S+@\S+\.\S+$/.test(forgotEmail.trim())) {
      setForgotError("Enter a valid email address.");
      return;
    }
    setForgotError(null);
    forgotMutation.mutate(forgotEmail.trim());
  };

  const closeForgot = () => {
    if (forgotMutation.isPending) return;
    setForgotOpen(false);
    setForgotError(null);
    setForgotResult(null);
  };

  useEffect(() => {
    if (token) router.replace(role?.toLowerCase() === "admin" ? "/moderation" : "/discover");
  }, [token, role, router]);

  const auth = useMutation({
    mutationFn: () => (mode === "signin" ? api.login(email, password) : api.register(name, email, password)),
    onSuccess: (r) => {
      setSession(r.token, r.user);
      router.replace(r.user?.role?.toLowerCase() === "admin" ? "/moderation" : "/discover");
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && !name.trim()) return setError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    auth.mutate();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section
        className="relative hidden flex-col justify-between overflow-hidden bg-cover bg-center p-10 lg:flex"
        style={{ backgroundImage: "url('/images/pic1.jpg')" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(10,14,30,0.62) 0%, rgba(16,18,34,0.42) 45%, rgba(10,12,24,0.90) 100%)" }}
        />
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200 bg-gradient-to-br from-sky-300 via-blue-500 to-cyan-700 font-serif text-xl italic text-white shadow-[0_0_10px_#38bdf8,0_0_22px_#0ea5e9]">
  𝑺
  <span className="absolute -inset-1 top-[9px] rotate-[-25deg] rounded-[50%] border border-cyan-200 shadow-[0_0_5px_#38bdf8]" />
  <span className="absolute -right-2 -top-1 text-[10px] text-cyan-200">
    ✈
  </span>
</span>
          <span className="font-bold">SoloTrip Match</span>
        </div>
        <div className="relative z-10 max-w-sm">
          <h1 className="font-serif text-6xl leading-[1.05]">
            Find your <span className="italic text-orange-300">perfect</span> travel partner
          </h1>
          <p className="mt-5 text-white/85">Connect with like-minded travelers heading to the same destination.</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <form onSubmit={submit} className="panel space-y-4 p-7" noValidate>
            <div>
              <h2 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
              <p className="text-sm text-muted">{mode === "signin" ? "Sign in to continue exploring" : "Start finding travel partners"}</p>
            </div>

            {mode === "signup" && (
              <input className="field" placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" />
            )}
            <input className="field" type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
            <div className="relative">
              <input className="field pr-10" type={show ? "text" : "password"} placeholder="Password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
              <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>

            {mode === "signin" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotError(null);
                    setForgotResult(null);
                    setForgotOpen(true);
                  }}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

            <Button type="submit" full disabled={auth.isPending}>
              {auth.isPending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            <p className="text-center text-xs text-muted">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button type="button" className="font-semibold text-brand" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </form>
          <p className="mt-4 text-center text-[11px] text-muted/70">By continuing, you agree to our Terms & Privacy Policy</p>
          {USE_MOCK && <p className="mt-3 text-center text-[11px] text-muted/70">Mock mode: any valid email and 8+ character password works.</p>}
        </div>
      </section>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Reset password"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForgot();
          }}
        >
          <div className="panel w-full max-w-md rounded-2xl border border-white/10 bg-ink-800 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-brand">
                  <KeyRound size={18} aria-hidden />
                </span>
                <div>
                  <h2 className="font-serif text-2xl leading-tight">Forgot password?</h2>
                  <p className="mt-1 text-xs text-muted">
                    Enter your account email to generate a password reset link.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeForgot}
                className="rounded-lg p-1 text-muted transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {forgotResult ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand-soft p-3.5 text-sm text-white">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  <p>{forgotResult.message}</p>
                </div>
                {forgotResult.devResetPath && (
                  <Link
                    href={forgotResult.devResetPath}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-glow transition hover:brightness-110"
                  >
                    <span>Continue to Reset Password</span>
                    <ArrowRight size={15} aria-hidden />
                  </Link>
                )}
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" onClick={closeForgot}>
                    Back to Sign in
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitForgot} className="mt-5 space-y-4" noValidate>
                <div>
                  <label className="label" htmlFor="forgot-email">
                    Email address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    className="field"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
                {forgotError && (
                  <p role="alert" className="text-sm text-rose-400">
                    {forgotError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" disabled={forgotMutation.isPending} onClick={closeForgot}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={forgotMutation.isPending}>
                    {forgotMutation.isPending ? "Sending..." : "Send reset link"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  const reset = useMutation({
    mutationFn: () => api.resetPassword({ token: token.trim(), password }),
    onSuccess: () => {
      setError(null);
      setDone(true);
      setTimeout(() => router.replace("/login"), 1600);
    },
    onError: (e: Error) => setError(e.message || "Couldn't reset password."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reset.isPending) return;
    if (!token.trim()) return setError("Reset token is missing.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setError(null);
    reset.mutate();
  };

  return (
    <div className="panel space-y-4 p-7">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-brand">
          <KeyRound size={18} aria-hidden />
        </span>
        <div>
          <h2 className="text-2xl font-bold">Reset password</h2>
          <p className="text-sm text-muted">Choose a new password for your account.</p>
        </div>
      </div>

      {done ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand-soft p-3.5 text-sm text-white">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <p>Your password has been updated. Redirecting you to sign in…</p>
          </div>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-ink-950 shadow-glow transition hover:brightness-110"
          >
            Go to Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {!tokenFromUrl && (
            <div>
              <label className="label" htmlFor="reset-token">
                Reset token
              </label>
              <input
                id="reset-token"
                className="field"
                placeholder="Paste reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                className="field pr-10"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                className="field pr-10"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showConfirm ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}

          <Button type="submit" full disabled={reset.isPending}>
            {reset.isPending ? "Updating..." : "Reset password"}
          </Button>

          <p className="text-center text-xs text-muted">
            <Link href="/login" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              <ArrowLeft size={13} aria-hidden /> Back to Sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section
        className="relative hidden flex-col justify-between overflow-hidden bg-cover bg-center p-10 lg:flex"
        style={{ backgroundImage: "url('/images/pic1.jpg')" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,14,30,0.62) 0%, rgba(16,18,34,0.42) 45%, rgba(10,12,24,0.90) 100%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200 bg-gradient-to-br from-sky-300 via-blue-500 to-cyan-700 font-serif text-xl italic text-white shadow-[0_0_10px_#38bdf8,0_0_22px_#0ea5e9]">
            S
          </span>
          <span className="font-bold">SoloTrip Match</span>
        </div>
        <div className="relative z-10 max-w-sm">
          <h1 className="font-serif text-6xl leading-[1.05]">
            Get back on your <span className="italic text-orange-300">journey</span>
          </h1>
          <p className="mt-5 text-white/85">Set a fresh password and continue connecting with travel partners.</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Suspense fallback={<div className="panel p-7 text-sm text-muted">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

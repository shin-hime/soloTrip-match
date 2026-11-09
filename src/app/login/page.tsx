"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, USE_MOCK } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const setSession = useAuth((s) => s.setSession);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) router.replace("/discover");
  }, [token, router]);

  const auth = useMutation({
    mutationFn: () => (mode === "signin" ? api.login(email, password) : api.register(name, email, password)),
    onSuccess: (r) => {
      setSession(r.token, r.user);
      router.replace("/discover");
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

  const oauth = (p: "google" | "facebook") => {
    if (USE_MOCK) return api.login("", "").then((r) => { setSession(r.token, r.user); router.replace("/discover"); });
    window.location.href = api.oauthUrl(p);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{ background: "linear-gradient(180deg,#3a4a6b 0%,#6b5a63 45%,#1a1626 100%)" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-brand font-bold">T</span>
          <span className="font-bold">TravelMate</span>
        </div>
        <div className="max-w-sm">
          <h1 className="font-serif text-6xl leading-[1.05]">
            Find your <span className="italic text-orange-300">perfect</span> travel partner
          </h1>
          <p className="mt-5 text-white/75">Connect with like-minded travelers heading to the same destination.</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <form onSubmit={submit} className="panel space-y-4 p-7" noValidate>
            <div>
              <h2 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
              <p className="text-sm text-muted">{mode === "signin" ? "Sign in to continue exploring" : "Start finding travel partners"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => oauth("google")}>Google</Button>
              <Button type="button" variant="outline" onClick={() => oauth("facebook")}>Facebook</Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-white/10" /> or continue with email <span className="h-px flex-1 bg-white/10" />
            </div>

            {mode === "signup" && (
              <input className="field" placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" />
            )}
            <input className="field" type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
            <div className="relative">
              <input className="field pr-10" type={show ? "text" : "password"} placeholder="Password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
              <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                {show ? "🙈" : "👁"}
              </button>
            </div>

            {mode === "signin" && (
              <div className="text-right"><span className="text-xs text-brand">Forgot password?</span></div>
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
    </div>
  );
}

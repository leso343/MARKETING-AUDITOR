"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Sanitize redirect target — only allow internal paths (prevents open redirect)
  const rawFrom = params.get("from") ?? "/";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(from);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-5">
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
        />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 pr-10 text-sm focus:border-[var(--red)] outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {error && (
        <div className="text-xs text-[var(--red)] font-mono">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest py-3 hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setShowForgot(true)}
          className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--red)] transition-colors uppercase tracking-widest"
        >
          Forgot password?
        </button>
        <a
          href="/signup"
          className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--red)] transition-colors uppercase tracking-widest"
        >
          No account? Sign up &rarr;
        </a>
      </div>

      <ForgotPasswordModal
        open={showForgot}
        onClose={() => setShowForgot(false)}
      />
    </form>
  );
}

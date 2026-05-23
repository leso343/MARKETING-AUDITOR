import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password — Blank Page Audits",
  description: "Set a new password for your Blank Page Audits account.",
};

export default function ResetPasswordPage() {
  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
            &gt; Blank Page Audits / Reset Password
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            New password
          </h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Choose a new password for your account.
          </p>
        </div>

        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}

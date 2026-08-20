export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
            Bid Ledger
          </div>
          <div className="mt-1 font-serif text-xl text-ink">
            Capital Project Comparison
          </div>
        </div>
        <div className="rounded border border-rule bg-paper-card shadow-card p-6">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-ink-soft">
          By continuing, you agree to the{" "}
          <a href="/terms" className="underline hover:text-ink">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-ink">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

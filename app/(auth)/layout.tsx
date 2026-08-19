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
      </div>
    </div>
  );
}

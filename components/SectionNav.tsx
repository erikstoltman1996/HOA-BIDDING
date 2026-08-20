import Link from "next/link";

const SECTIONS = [
  { href: "/project", label: "Bid Ledger" },
  { href: "/community", label: "Community" },
  { href: "/reserve", label: "Reserve Fund" },
  { href: "/dues", label: "Dues" },
];

export function SectionNav({ current }: { current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {SECTIONS.map((s) => {
        const active = s.href === current;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-ink text-paper-card"
                : "border border-rule text-ink-soft hover:border-gold hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

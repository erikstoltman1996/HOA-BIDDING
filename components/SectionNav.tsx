import Link from "next/link";

const SECTIONS = [
  { href: "/projects", label: "Bid Ledger" },
  { href: "/community", label: "Community" },
  { href: "/reserve", label: "Reserve Fund" },
  { href: "/dues", label: "Dues" },
];

// The Bid Ledger tab also covers every individual /project/[id] page, not
// just the /projects list itself, so a specific project's ledger still
// shows "Bid Ledger" as the active tab.
function isActive(href: string, current: string) {
  if (href === current) return true;
  if (href === "/projects" && current.startsWith("/project/")) return true;
  return false;
}

export function SectionNav({ current }: { current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {SECTIONS.map((s) => {
        const active = isActive(s.href, current);
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

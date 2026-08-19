import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
      <span
        aria-hidden
        className="flex items-center justify-center rounded font-serif font-bold"
        style={{
          width: size,
          height: size,
          background: "#1F2B3D",
          color: "#B8863B",
          fontSize: size * 0.55,
          lineHeight: 1,
        }}
      >
        B
      </span>
      <span className="font-serif text-lg font-semibold text-ink">Bid Ledger</span>
    </Link>
  );
}
